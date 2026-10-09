import os from 'node:os';
import { spawn } from 'node:child_process';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import {
  ensureStorage,
  fileSize,
  removeFileQuietly,
  sha256File,
  storagePath,
} from '../media/storage.service.js';
import {
  DATABASE_STORAGE_PROVIDER,
  databaseStorageKey,
  persistFileInDatabase,
  writeDatabaseFileToPath,
} from '../media/database-storage.service.js';

interface ClaimedJob {
  id: string;
  media_file_id: string;
  storage_provider: string;
  storage_key: string;
  original_filename: string;
  file_size_bytes: number;
}

const workerName = `${os.hostname()}-${process.pid}`.slice(0, 120);

const runProcess = (
  command: string,
  args: string[],
  onStdout?: (chunk: Buffer) => void,
  collectStdout = true,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (collectStdout) stdout += chunk.toString();
      onStdout?.(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-20_000);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} a quitté avec le code ${code}: ${stderr}`));
    });
  });

const probeDuration = async (inputPath: string): Promise<number> => {
  const result = await runProcess(env.FFPROBE_PATH, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', inputPath,
  ]);
  const duration = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Durée audio invalide.');
  return duration;
};

const transcode = async (jobId: string, inputPath: string, outputPath: string, duration: number): Promise<void> => {
  let progressBuffer = '';
  let lastReported = -1;
  await runProcess(env.FFMPEG_PATH, [
    '-hide_banner', '-y', '-i', inputPath,
    '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-codec:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', '-ar', '44100',
    '-progress', 'pipe:1', '-nostats', outputPath,
  ], (chunk) => {
    progressBuffer += chunk.toString();
    const lines = progressBuffer.split(/\r?\n/);
    progressBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const [key, value] = line.split('=', 2);
      if (key !== 'out_time_us' || !value) continue;
      const percent = Math.min(95, Math.max(1, Math.floor((Number(value) / 1_000_000 / duration) * 95)));
      if (percent >= lastReported + 5) {
        lastReported = percent;
        void pool.query('CALL papaleki.sp_update_audio_progress($1::uuid, $2::text, $3::smallint, $4::jsonb)', [
          jobId, workerName, percent, { stage: 'transcoding' },
        ]).catch((error) => logger.warn({ err: error, jobId }, 'Progression audio non enregistrée.'));
      }
    }
  }, false);
};

const createWaveform = async (audioPath: string, duration: number): Promise<number[]> => {
  const sampleRate = 8_000;
  const bucketCount = 600;
  const samplesPerBucket = Math.max(1, Math.ceil((duration * sampleRate) / bucketCount));
  const peaks = Array.from({ length: bucketCount }, () => 0);
  let sampleIndex = 0;
  let remainder = Buffer.alloc(0);

  await runProcess(env.FFMPEG_PATH, [
    '-v', 'error', '-i', audioPath, '-ac', '1', '-ar', String(sampleRate),
    '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1',
  ], (chunk) => {
    const data = Buffer.concat([remainder, chunk]);
    const completeLength = data.length - (data.length % 2);
    for (let offset = 0; offset < completeLength; offset += 2) {
      const bucket = Math.min(bucketCount - 1, Math.floor(sampleIndex / samplesPerBucket));
      peaks[bucket] = Math.max(peaks[bucket]!, Math.abs(data.readInt16LE(offset)) / 32768);
      sampleIndex += 1;
    }
    remainder = data.subarray(completeLength);
  }, false);

  return peaks.map((peak) => Number(peak.toFixed(3)));
};

const claimJob = async (): Promise<ClaimedJob | undefined> => {
  const claimed = await pool.query<{ p_job_id: string | null }>(
    'CALL papaleki.sp_claim_audio_job($1::text, NULL::uuid)', [workerName],
  );
  const id = claimed.rows[0]?.p_job_id;
  if (!id) return undefined;
  const result = await pool.query<ClaimedJob>(
    `SELECT j.id, j.media_file_id, m.storage_provider, m.storage_key,
            m.original_filename, m.file_size_bytes
     FROM papaleki.audio_processing_jobs j
     JOIN papaleki.media_files m ON m.id = j.media_file_id
     WHERE j.id = $1`,
    [id],
  );
  return result.rows[0];
};

export const processNextAudio = async (): Promise<boolean> => {
  const job = await claimJob();
  if (!job) return false;

  const inputPath = job.storage_provider === DATABASE_STORAGE_PROVIDER
    ? storagePath(`.tmp/${job.id}.source`)
    : storagePath(job.storage_key);
  const temporaryOutput = storagePath(`.tmp/${job.id}.mp3`);
  let finalPath: string | undefined;
  try {
    if (job.storage_provider === DATABASE_STORAGE_PROVIDER) {
      await writeDatabaseFileToPath(job.media_file_id, inputPath);
    }
    const originalSize = job.storage_provider === DATABASE_STORAGE_PROVIDER
      ? job.file_size_bytes
      : await fileSize(inputPath);
    const inputDuration = await probeDuration(inputPath);
    await transcode(job.id, inputPath, temporaryOutput, inputDuration);
    const duration = await probeDuration(temporaryOutput);
    await pool.query('CALL papaleki.sp_update_audio_progress($1::uuid, $2::text, 97::smallint, $3::jsonb)', [
      job.id, workerName, { stage: 'waveform' },
    ]);
    const waveform = await createWaveform(temporaryOutput, duration);
    const key = databaseStorageKey(job.media_file_id);
    finalPath = temporaryOutput;
    const size = await fileSize(finalPath);
    const checksum = await sha256File(finalPath);

    await withTransaction(async (client) => {
      await persistFileInDatabase(client, job.media_file_id, finalPath!);
      await client.query(
        `UPDATE papaleki.media_files
         SET storage_provider = $1, storage_key = $2, mime_type = 'audio/mpeg',
             file_size_bytes = $3, checksum_sha256 = $4,
             metadata = metadata || jsonb_build_object('original_storage_key', $5::text)
         WHERE id = $6`,
        [DATABASE_STORAGE_PROVIDER, key, size, checksum, job.storage_key, job.media_file_id],
      );
      await client.query('CALL papaleki.sp_finish_audio_job($1::uuid, true, $2::numeric, $3::jsonb, NULL::text)', [
        job.id,
        duration,
        {
          codec: 'mp3',
          bitrateKbps: 96,
          channels: 1,
          normalizedLufs: -16,
          originalSizeBytes: originalSize,
          compressedSizeBytes: size,
          savedPercent: Math.max(0, Number(((1 - size / originalSize) * 100).toFixed(1))),
          waveform,
        },
      ]);
    });

    if (inputPath !== finalPath) await removeFileQuietly(inputPath);
    await removeFileQuietly(finalPath);
    logger.info({ jobId: job.id, mediaId: job.media_file_id, duration }, 'Audio traité.');
    return true;
  } catch (error) {
    await removeFileQuietly(temporaryOutput);
    await removeFileQuietly(finalPath);
    const message = error instanceof Error ? error.message.slice(0, 10_000) : 'Erreur audio inconnue.';
    await pool.query('CALL papaleki.sp_finish_audio_job($1::uuid, false, NULL::numeric, $2::jsonb, $3::text)', [
      job.id, { stage: 'failed' }, message,
    ]).catch((finishError) => logger.error({ err: finishError, jobId: job.id }, 'Échec de clôture du traitement.'));
    logger.error({ err: error, jobId: job.id }, 'Traitement audio échoué.');
    return true;
  }
};

export const runAudioWorker = async (signal: AbortSignal): Promise<void> => {
  await ensureStorage();
  logger.info({ workerName }, 'Worker audio démarré.');
  while (!signal.aborted) {
    const processed = await processNextAudio().catch((error) => {
      logger.error({ err: error }, 'Erreur de boucle du worker audio.');
      return false;
    });
    if (!processed) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }
  }
  logger.info('Worker audio arrêté.');
};
