import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { camelize } from '../../lib/serialize.js';
import { requireWorkerKey } from '../../middleware/worker-auth.js';
import { validate } from '../../middleware/validate.js';
import { idSchema } from '../public/public.schemas.js';

const claimSchema = z.object({ workerName: z.string().trim().min(2).max(120) });
const progressSchema = z.object({
  workerName: z.string().trim().min(2).max(120),
  progressPercent: z.number().int().min(0).max(99),
  result: z.record(z.string(), z.unknown()).default({}),
});
const finishSchema = z.object({
  success: z.boolean(),
  durationSeconds: z.number().positive().optional(),
  storageKey: z.string().trim().min(1).max(2_000).optional(),
  mimeType: z.string().trim().max(150).optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  result: z.record(z.string(), z.unknown()).default({}),
  errorMessage: z.string().trim().min(1).max(10_000).optional(),
}).superRefine((value, context) => {
  if (value.success && !value.durationSeconds) {
    context.addIssue({ code: 'custom', message: 'La durée est requise en cas de succès.' });
  }
  if (!value.success && !value.errorMessage) {
    context.addIssue({ code: 'custom', message: 'Le message d’erreur est requis.' });
  }
});

export const workerRouter = Router();
workerRouter.use(requireWorkerKey);

workerRouter.post('/jobs/claim', validate(claimSchema), async (req, res) => {
  const claimed = await pool.query<{ p_job_id: string | null }>(
    'CALL papaleki.sp_claim_audio_job($1, NULL)',
    [req.body.workerName],
  );
  const jobId = claimed.rows[0]?.p_job_id;
  if (!jobId) {
    res.status(204).send();
    return;
  }
  const result = await pool.query(
    `SELECT j.*, m.storage_provider, m.storage_key, m.original_filename,
            m.mime_type, m.file_size_bytes
     FROM papaleki.audio_processing_jobs j
     JOIN papaleki.media_files m ON m.id = j.media_file_id
     WHERE j.id = $1`,
    [jobId],
  );
  res.json({ success: true, data: camelize(result.rows[0]) });
});

workerRouter.patch('/jobs/:id/progress', validate(idSchema, 'params'), validate(progressSchema), async (req, res) => {
  await pool.query('CALL papaleki.sp_update_audio_progress($1, $2, $3, $4)', [
    req.params.id,
    req.body.workerName,
    req.body.progressPercent,
    req.body.result,
  ]);
  res.json({ success: true });
});

workerRouter.post('/jobs/:id/finish', validate(idSchema, 'params'), validate(finishSchema), async (req, res) => {
  const b = req.body;
  await withTransaction(async (client) => {
    const job = await client.query<{ media_file_id: string; status: string }>(
      'SELECT media_file_id, status::text FROM papaleki.audio_processing_jobs WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const row = job.rows[0];
    if (!row) throw new AppError(404, 'JOB_NOT_FOUND', 'Traitement introuvable.');
    if (row.status !== 'processing') throw new AppError(409, 'JOB_NOT_ACTIVE', 'Traitement non actif.');

    if (b.success && b.storageKey) {
      await client.query(
        `UPDATE papaleki.media_files
         SET storage_key = $1,
             mime_type = COALESCE($2, mime_type),
             file_size_bytes = COALESCE($3, file_size_bytes),
             checksum_sha256 = COALESCE($4, checksum_sha256)
         WHERE id = $5`,
        [b.storageKey, b.mimeType ?? null, b.fileSizeBytes ?? null, b.checksumSha256 ?? null, row.media_file_id],
      );
    }
    await client.query('CALL papaleki.sp_finish_audio_job($1, $2, $3, $4, $5)', [
      req.params.id,
      b.success,
      b.durationSeconds ?? null,
      b.result,
      b.errorMessage ?? null,
    ]);
  });
  res.json({ success: true });
});
