import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import { Router, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { AUDIO_MIME_TYPES, IMAGE_MIME_TYPES } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { pageMeta, pagination, paginationSchema } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idSchema } from '../public/public.schemas.js';
import {
  buildStorageKey,
  ensureStorage,
  fileSize,
  moveFile,
  removeFileQuietly,
  sha256File,
  storagePath,
  temporaryRoot,
} from './storage.service.js';
import {
  DATABASE_STORAGE_PROVIDER,
  databaseStorageKey,
  forEachDatabaseFileRange,
  persistFileInDatabase,
} from './database-storage.service.js';

mkdirSync(temporaryRoot, { recursive: true });

const uploader = (maxMb: number, accepted: Set<string>) =>
  multer({
    dest: temporaryRoot,
    limits: { files: 1, fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      callback(null, accepted.has(file.mimetype.toLowerCase()));
    },
  }).single('file');

const audioUpload = uploader(env.MAX_AUDIO_MB, AUDIO_MIME_TYPES);
const imageUpload = uploader(env.MAX_IMAGE_MB, IMAGE_MIME_TYPES);

interface MediaRow {
  id: string;
  kind: 'audio' | 'image' | 'document';
  processing_status: string;
  storage_provider: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  alt_text: string | null;
  deleted_at: Date | null;
  is_public: boolean;
  allow_download: boolean;
}

const getMedia = async (id: string, authenticated: boolean): Promise<MediaRow> => {
  const result = await pool.query<MediaRow>(
    `SELECT m.*,
       (
         EXISTS (
           SELECT 1 FROM papaleki.sermons s
           WHERE (s.audio_media_id = m.id OR s.cover_media_id = m.id)
             AND s.status = 'published' AND s.published_at <= CURRENT_TIMESTAMP
         ) OR EXISTS (
           SELECT 1 FROM papaleki.pages p
           WHERE p.cover_media_id = m.id
             AND p.status = 'published' AND p.published_at <= CURRENT_TIMESTAMP
         ) OR EXISTS (
           SELECT 1 FROM papaleki.testimonials t
           WHERE t.photo_media_id = m.id AND t.status = 'published'
         ) OR EXISTS (
           SELECT 1 FROM papaleki.preachers p
           WHERE p.photo_media_id = m.id AND p.is_active = true
         ) OR EXISTS (
           SELECT 1 FROM papaleki.sermon_series ss
           WHERE ss.cover_media_id = m.id AND ss.is_active = true
         )
       ) AS is_public,
       COALESCE((
         SELECT bool_or(s.allow_download)
         FROM papaleki.sermons s
         WHERE s.audio_media_id = m.id AND s.status = 'published'
       ), false) AS allow_download
     FROM papaleki.media_files m
     WHERE m.id = $1
       AND m.processing_status = 'ready'
       AND m.deleted_at IS NULL`,
    [id],
  );
  const media = result.rows[0];
  if (!media || (!media.is_public && !authenticated)) {
    throw new AppError(404, 'MEDIA_NOT_FOUND', 'Média introuvable.');
  }
  if (media.storage_provider !== 'local' && media.storage_provider !== DATABASE_STORAGE_PROVIDER) {
    throw new AppError(501, 'STORAGE_PROVIDER_UNSUPPORTED', 'Fournisseur de stockage non pris en charge.');
  }
  return media;
};

const sendDatabaseRange = async (
  mediaId: string,
  start: number,
  end: number,
  res: Response,
): Promise<void> => {
  await forEachDatabaseFileRange(mediaId, start, end, async (chunk) => {
    if (res.destroyed) return;
    if (!res.write(chunk)) await once(res, 'drain');
  });
  if (!res.destroyed) res.end();
};

export const mediaPublicRouter = Router();

mediaPublicRouter.get('/:id', validate(idSchema, 'params'), async (req, res) => {
  const media = await getMedia(req.params.id as string, Boolean(req.auth));
  if (media.kind === 'audio') {
    res.redirect(307, `${req.baseUrl}/${media.id}/stream`);
    return;
  }
  if (media.storage_provider === DATABASE_STORAGE_PROVIDER) {
    res.set({
      'Content-Type': media.mime_type,
      'Content-Length': String(media.file_size_bytes),
      'Cache-Control': media.is_public
        ? 'public, max-age=86400, stale-while-revalidate=604800'
        : 'private, no-store',
      ETag: `"${media.id}-${media.file_size_bytes}"`,
    });
    await sendDatabaseRange(media.id, 0, media.file_size_bytes - 1, res);
    return;
  }
  const absolutePath = storagePath(media.storage_key);
  await stat(absolutePath).catch(() => {
    throw new AppError(404, 'FILE_NOT_FOUND', 'Fichier absent du stockage.');
  });
  res.set({
    'Content-Type': media.mime_type,
    'Cache-Control': media.is_public
      ? 'public, max-age=86400, stale-while-revalidate=604800'
      : 'private, no-store',
    ETag: `"${media.id}-${media.file_size_bytes}"`,
  });
  res.sendFile(absolutePath);
});

mediaPublicRouter.get('/:id/stream', validate(idSchema, 'params'), async (req, res) => {
  const media = await getMedia(req.params.id as string, Boolean(req.auth));
  if (media.kind !== 'audio') throw new AppError(422, 'NOT_AUDIO', 'Ce média n’est pas un audio.');

  const absolutePath = media.storage_provider === 'local' ? storagePath(media.storage_key) : undefined;
  const size = absolutePath
    ? (await stat(absolutePath).catch(() => {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Fichier absent du stockage.');
      })).size
    : media.file_size_bytes;
  const range = req.headers.range;
  const wantsDownload = req.query.download === '1';
  if (wantsDownload && !media.allow_download && !req.auth) {
    throw new AppError(403, 'DOWNLOAD_DISABLED', 'Le téléchargement de cet audio est désactivé.');
  }

  const disposition = wantsDownload
    ? `attachment; filename*=UTF-8''${encodeURIComponent(media.original_filename)}`
    : 'inline';

  res.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': media.mime_type,
    'Content-Disposition': disposition,
    'Cache-Control': media.is_public ? 'public, max-age=3600' : 'private, no-store',
    ETag: `"${media.id}-${size}"`,
  });

  if (!range) {
    res.set('Content-Length', String(size));
    if (media.storage_provider === DATABASE_STORAGE_PROVIDER) {
      await sendDatabaseRange(media.id, 0, size - 1, res);
    } else {
      createReadStream(absolutePath!).pipe(res);
    }
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).set('Content-Range', `bytes */${size}`).end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= size) {
    res.status(416).set('Content-Range', `bytes */${size}`).end();
    return;
  }

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1),
  });
  if (media.storage_provider === DATABASE_STORAGE_PROVIDER) {
    await sendDatabaseRange(media.id, start, end, res);
  } else {
    createReadStream(absolutePath!, { start, end }).pipe(res);
  }
});

export const mediaAdminRouter = Router();
mediaAdminRouter.use(requireAuth);

const mediaListSchema = paginationSchema.extend({
  kind: z.enum(['audio', 'image', 'document']).optional(),
  status: z.enum(['uploaded', 'queued', 'processing', 'ready', 'failed', 'deleted']).optional(),
});

mediaAdminRouter.get('/', requirePermission('media.view'), validate(mediaListSchema, 'query'), async (req, res) => {
  const query = req.query as unknown as { page: number; limit: number; kind?: string; status?: string };
  const { offset } = pagination(query.page, query.limit);
  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM papaleki.v_media_library
     WHERE ($1::papaleki.media_kind IS NULL OR kind = $1)
       AND ($2::papaleki.media_status IS NULL OR processing_status = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [query.kind ?? null, query.status ?? null, query.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(query.page, query.limit, total),
  });
});

mediaAdminRouter.post('/audio', requirePermission('media.upload'), audioUpload, async (req, res) => {
  if (!req.file) throw new AppError(422, 'FILE_REQUIRED', 'Un fichier audio est requis.');
  let finalPath: string | undefined;
  try {
    const detected = await fileTypeFromFile(req.file.path);
    const mime = detected?.mime ?? req.file.mimetype.toLowerCase();
    if (!AUDIO_MIME_TYPES.has(mime)) {
      throw new AppError(422, 'INVALID_AUDIO_TYPE', 'Format audio non autorisé.');
    }
    const extension = detected?.ext ?? (path.extname(req.file.originalname).slice(1).toLowerCase() || 'bin');
    const key = buildStorageKey('audio/raw', extension);
    finalPath = await moveFile(req.file.path, key);
    const result = await pool.query(
      `INSERT INTO papaleki.media_files
       (kind, processing_status, storage_key, original_filename, mime_type,
        file_size_bytes, checksum_sha256, metadata, uploaded_by)
       VALUES ('audio', 'uploaded', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        key,
        req.file.originalname,
        mime,
        await fileSize(finalPath),
        await sha256File(finalPath),
        { uploadedMime: req.file.mimetype },
        req.auth!.userId,
      ],
    );
    res.status(201).json({ success: true, data: camelize(result.rows[0]) });
  } catch (error) {
    await removeFileQuietly(finalPath ?? req.file.path);
    throw error;
  }
});

mediaAdminRouter.post('/image', requirePermission('media.upload'), imageUpload, async (req, res) => {
  if (!req.file) throw new AppError(422, 'FILE_REQUIRED', 'Une image est requise.');
  const uploadedFile = req.file;
  let processedPath: string | undefined;
  try {
    const detected = await fileTypeFromFile(uploadedFile.path);
    if (!detected || !IMAGE_MIME_TYPES.has(detected.mime)) {
      throw new AppError(422, 'INVALID_IMAGE_TYPE', 'Format d’image non autorisé.');
    }
    const mediaId = randomUUID();
    const key = databaseStorageKey(mediaId);
    processedPath = `${uploadedFile.path}.webp`;
    const processed = sharp(uploadedFile.path).rotate().resize({
      width: 2400,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    }).webp({ quality: 85 });
    const info = await processed.toFile(processedPath);
    const checksum = await sha256File(processedPath);
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO papaleki.media_files
       (id, kind, processing_status, storage_provider, storage_key, original_filename, mime_type,
        file_size_bytes, checksum_sha256, width_pixels, height_pixels,
        alt_text, metadata, uploaded_by)
       VALUES ($1, 'image', 'ready', $2, $3, $4, 'image/webp', $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
        [
          mediaId,
          DATABASE_STORAGE_PROVIDER,
          key,
          uploadedFile.originalname,
          info.size,
          checksum,
          info.width,
          info.height,
          typeof req.body.altText === 'string' ? req.body.altText.trim().slice(0, 255) : null,
          { originalMime: detected.mime, originalSize: uploadedFile.size },
          req.auth!.userId,
        ],
      );
      await persistFileInDatabase(client, mediaId, processedPath!);
      return inserted;
    });
    res.status(201).json({ success: true, data: camelize(result.rows[0]) });
  } catch (error) {
    throw error;
  } finally {
    await Promise.all([
      rm(uploadedFile.path, { force: true }).catch(() => undefined),
      processedPath ? rm(processedPath, { force: true }).catch(() => undefined) : Promise.resolve(),
    ]);
  }
});

mediaAdminRouter.delete('/:id', requirePermission('media.manage'), validate(idSchema, 'params'), async (req, res) => {
  const mediaResult = await pool.query<{ storage_key: string; storage_provider: string }>(
    'SELECT storage_key, storage_provider FROM papaleki.media_files WHERE id = $1 AND deleted_at IS NULL',
    [req.params.id],
  );
  const media = mediaResult.rows[0];
  await withTransaction(async (client) => {
    await client.query('CALL papaleki.sp_soft_delete_media($1, $2)', [req.params.id, req.auth!.userId]);
    if (media?.storage_provider === DATABASE_STORAGE_PROVIDER) {
      await client.query('DELETE FROM papaleki.media_file_chunks WHERE media_file_id = $1', [req.params.id]);
    }
  });
  if (media?.storage_provider === 'local') await removeFileQuietly(storagePath(media.storage_key));
  res.status(204).send();
});

mediaAdminRouter.post('/:id/requeue', requirePermission('media.manage'), validate(idSchema, 'params'), async (req, res) => {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM papaleki.audio_processing_jobs
     WHERE media_file_id = $1 AND status IN ('failed', 'cancelled')
     ORDER BY queued_at DESC LIMIT 1`,
    [req.params.id],
  );
  const job = result.rows[0];
  if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Aucun traitement relançable.');
  await pool.query('CALL papaleki.sp_requeue_audio_job($1, $2)', [job.id, req.auth!.userId]);
  res.status(202).json({ success: true, data: { jobId: job.id } });
});
