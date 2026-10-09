import { createReadStream } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';

export const DATABASE_STORAGE_PROVIDER = 'database';
export const DATABASE_CHUNK_BYTES = 1024 * 1024;

export const databaseStorageKey = (mediaFileId: string): string => `database/media/${mediaFileId}`;

const databaseMediaLimitBytes = (): number => env.DATABASE_MEDIA_MAX_MB * 1024 * 1024;

export const persistFileInDatabase = async (
  client: PoolClient,
  mediaFileId: string,
  filePath: string,
): Promise<number> => {
  const incomingBytes = (await stat(filePath)).size;

  // Les écritures sont sérialisées afin que deux téléversements simultanés ne
  // puissent pas dépasser ensemble la réserve affectée aux médias.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('papaleki.database-media-storage'))");
  const usage = await client.query<{ bytes_used: number }>(
    `SELECT COALESCE(sum(octet_length(data)), 0)::bigint AS bytes_used
     FROM papaleki.media_file_chunks
     WHERE media_file_id <> $1`,
    [mediaFileId],
  );
  const usedBytes = Number(usage.rows[0]?.bytes_used ?? 0);
  const limitBytes = databaseMediaLimitBytes();
  if (usedBytes + incomingBytes > limitBytes) {
    const remainingMb = Math.max(0, Math.floor((limitBytes - usedBytes) / 1024 / 1024));
    throw new AppError(
      507,
      'MEDIA_STORAGE_FULL',
      `Stockage audio presque plein. Espace disponible réservé aux médias : ${remainingMb} Mo.`,
    );
  }

  await client.query('DELETE FROM papaleki.media_file_chunks WHERE media_file_id = $1', [mediaFileId]);
  let chunkIndex = 0;
  for await (const chunk of createReadStream(filePath, { highWaterMark: DATABASE_CHUNK_BYTES })) {
    await client.query(
      `INSERT INTO papaleki.media_file_chunks (media_file_id, chunk_index, data)
       VALUES ($1, $2, $3)`,
      [mediaFileId, chunkIndex, chunk],
    );
    chunkIndex += 1;
  }
  if (chunkIndex === 0) {
    throw new AppError(422, 'EMPTY_MEDIA_FILE', 'Le fichier média est vide.');
  }
  return incomingBytes;
};

export const writeDatabaseFileToPath = async (
  mediaFileId: string,
  destinationPath: string,
): Promise<void> => {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const handle = await open(destinationPath, 'w');
  const client = await pool.connect();
  let nextChunk = 0;
  let position = 0;
  try {
    while (true) {
      const result = await client.query<{ chunk_index: number; data: Buffer }>(
        `SELECT chunk_index, data
         FROM papaleki.media_file_chunks
         WHERE media_file_id = $1 AND chunk_index >= $2
         ORDER BY chunk_index
         LIMIT 16`,
        [mediaFileId, nextChunk],
      );
      if (result.rows.length === 0) break;
      for (const row of result.rows) {
        if (row.chunk_index !== nextChunk) {
          throw new AppError(500, 'MEDIA_CHUNK_MISSING', 'Le fichier média stocké est incomplet.');
        }
        await handle.write(row.data, 0, row.data.length, position);
        position += row.data.length;
        nextChunk += 1;
      }
    }
    if (nextChunk === 0) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Fichier absent du stockage PostgreSQL.');
    }
  } finally {
    client.release();
    await handle.close();
  }
};

export const forEachDatabaseFileRange = async (
  mediaFileId: string,
  start: number,
  end: number,
  consumer: (chunk: Buffer) => Promise<void>,
): Promise<void> => {
  const firstChunk = Math.floor(start / DATABASE_CHUNK_BYTES);
  const lastChunk = Math.floor(end / DATABASE_CHUNK_BYTES);
  const client = await pool.connect();
  let nextChunk = firstChunk;
  let bytesSent = 0;
  try {
    while (nextChunk <= lastChunk) {
      const result = await client.query<{ chunk_index: number; data: Buffer }>(
        `SELECT chunk_index, data
         FROM papaleki.media_file_chunks
         WHERE media_file_id = $1
           AND chunk_index BETWEEN $2 AND $3
         ORDER BY chunk_index
         LIMIT 16`,
        [mediaFileId, nextChunk, lastChunk],
      );
      if (result.rows.length === 0) break;
      for (const row of result.rows) {
        if (row.chunk_index !== nextChunk) {
          throw new AppError(500, 'MEDIA_CHUNK_MISSING', 'Le fichier média stocké est incomplet.');
        }
        const absoluteChunkStart = row.chunk_index * DATABASE_CHUNK_BYTES;
        const sliceStart = Math.max(0, start - absoluteChunkStart);
        const sliceEnd = Math.min(row.data.length, end - absoluteChunkStart + 1);
        const data = row.data.subarray(sliceStart, sliceEnd);
        await consumer(data);
        bytesSent += data.length;
        nextChunk += 1;
      }
    }
  } finally {
    client.release();
  }
  if (bytesSent !== end - start + 1) {
    throw new AppError(500, 'MEDIA_CHUNK_MISSING', 'Le fichier média stocké est incomplet.');
  }
};
