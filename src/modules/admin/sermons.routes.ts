import { Router, type Request } from 'express';
import { pool, withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { updateRow } from '../../lib/sql.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idSchema } from '../public/public.schemas.js';
import { sendSermonPublishedNotification } from '../notifications/notifications.service.js';
import {
  adminListSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  confirmDeleteSchema,
  preacherCreateSchema,
  preacherUpdateSchema,
  scheduleSchema,
  seriesCreateSchema,
  seriesUpdateSchema,
  sermonCreateSchema,
  sermonUpdateSchema,
  tagCreateSchema,
  tagUpdateSchema,
} from './admin.schemas.js';

export const sermonsAdminRouter = Router();

const auditContext = (req: Request) => ({
  userId: req.auth!.userId,
  requestId: String(req.id),
  ipAddress: req.ip,
});

sermonsAdminRouter.get('/preachers', requirePermission('sermons.view'), async (_req, res) => {
  const result = await pool.query(
    `SELECT p.*, m.storage_key AS photo_storage_key,
            count(s.id)::int AS sermon_count
     FROM papaleki.preachers p
     LEFT JOIN papaleki.media_files m ON m.id = p.photo_media_id
     LEFT JOIN papaleki.sermons s ON s.preacher_id = p.id
     GROUP BY p.id, m.storage_key
     ORDER BY p.is_primary DESC, p.display_name`,
  );
  res.json({ success: true, data: camelize(result.rows) });
});

sermonsAdminRouter.post('/preachers', requirePermission('sermons.create'), validate(preacherCreateSchema), async (req, res) => {
  const b = req.body;
  const result = await withTransaction((client) => client.query(
    `INSERT INTO papaleki.preachers
     (display_name, title, biography, church_name, photo_media_id, is_primary, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [b.displayName, b.title ?? null, b.biography ?? null, b.churchName ?? null,
      b.photoMediaId ?? null, b.isPrimary, b.isActive],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

sermonsAdminRouter.patch('/preachers/:id', requirePermission('sermons.update'), validate(idSchema, 'params'), validate(preacherUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.preachers', req.params.id as string, req.body,
    { displayName: 'display_name', title: 'title', biography: 'biography', churchName: 'church_name',
      photoMediaId: 'photo_media_id', isPrimary: 'is_primary', isActive: 'is_active' },
    client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

sermonsAdminRouter.delete('/preachers/:id', requirePermission('sermons.delete'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.preachers WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Prédicateur introuvable.');
  res.status(204).send();
});

sermonsAdminRouter.get('/categories', requirePermission('sermons.view'), async (_req, res) => {
  const result = await pool.query(
    `SELECT c.*, count(s.id)::int AS sermon_count
     FROM papaleki.sermon_categories c
     LEFT JOIN papaleki.sermons s ON s.category_id = c.id
     GROUP BY c.id ORDER BY c.display_order, c.name`,
  );
  res.json({ success: true, data: camelize(result.rows) });
});

sermonsAdminRouter.post('/categories', requirePermission('sermons.create'), validate(categoryCreateSchema), async (req, res) => {
  const b = req.body;
  const result = await withTransaction((client) => client.query(
    `INSERT INTO papaleki.sermon_categories
     (name, slug, description, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [b.name, b.slug ?? '', b.description ?? null, b.displayOrder, b.isActive],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

sermonsAdminRouter.patch('/categories/:id', requirePermission('sermons.update'), validate(idSchema, 'params'), validate(categoryUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.sermon_categories', req.params.id as string, req.body,
    { name: 'name', slug: 'slug', description: 'description', displayOrder: 'display_order', isActive: 'is_active' }, client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

sermonsAdminRouter.delete('/categories/:id', requirePermission('sermons.delete'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.sermon_categories WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Catégorie introuvable.');
  res.status(204).send();
});

sermonsAdminRouter.get('/series', requirePermission('sermons.view'), async (_req, res) => {
  const result = await pool.query(
    `SELECT sr.*, count(s.id)::int AS sermon_count
     FROM papaleki.sermon_series sr
     LEFT JOIN papaleki.sermons s ON s.series_id = sr.id
     GROUP BY sr.id ORDER BY sr.start_date DESC NULLS LAST, sr.title`,
  );
  res.json({ success: true, data: camelize(result.rows) });
});

sermonsAdminRouter.post('/series', requirePermission('sermons.create'), validate(seriesCreateSchema), async (req, res) => {
  const b = req.body;
  const result = await withTransaction((client) => client.query(
    `INSERT INTO papaleki.sermon_series
     (title, slug, description, cover_media_id, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [b.title, b.slug ?? '', b.description ?? null, b.coverMediaId ?? null,
      b.startDate ?? null, b.endDate ?? null, b.isActive],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

sermonsAdminRouter.patch('/series/:id', requirePermission('sermons.update'), validate(idSchema, 'params'), validate(seriesUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.sermon_series', req.params.id as string, req.body,
    { title: 'title', slug: 'slug', description: 'description', coverMediaId: 'cover_media_id',
      startDate: 'start_date', endDate: 'end_date', isActive: 'is_active' }, client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

sermonsAdminRouter.delete('/series/:id', requirePermission('sermons.delete'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.sermon_series WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Série introuvable.');
  res.status(204).send();
});

sermonsAdminRouter.get('/tags', requirePermission('sermons.view'), async (_req, res) => {
  const result = await pool.query(
    `SELECT t.*, count(stl.sermon_id)::int AS sermon_count
     FROM papaleki.sermon_tags t
     LEFT JOIN papaleki.sermon_tag_links stl ON stl.tag_id = t.id
     GROUP BY t.id ORDER BY t.name`,
  );
  res.json({ success: true, data: camelize(result.rows) });
});

sermonsAdminRouter.post('/tags', requirePermission('sermons.create'), validate(tagCreateSchema), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'INSERT INTO papaleki.sermon_tags (name, slug) VALUES ($1, $2) RETURNING *',
    [req.body.name, req.body.slug ?? ''],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

sermonsAdminRouter.patch('/tags/:id', requirePermission('sermons.update'), validate(idSchema, 'params'), validate(tagUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.sermon_tags', req.params.id as string, req.body, { name: 'name', slug: 'slug' }, client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

sermonsAdminRouter.delete('/tags/:id', requirePermission('sermons.delete'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.sermon_tags WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Mot-clé introuvable.');
  res.status(204).send();
});

sermonsAdminRouter.get('/sermons', requirePermission('sermons.view'), validate(adminListSchema, 'query'), async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; search?: string; status?: string };
  const { offset } = pagination(q.page, q.limit);
  const result = await pool.query(
    `SELECT v.*, s.cover_media_id, s.audio_media_id, s.scripture_reference,
            count(*) OVER()::int AS total_count
     FROM papaleki.v_sermon_admin_overview v
     JOIN papaleki.sermons s ON s.id = v.id
     WHERE ($1::text IS NULL OR v.title ILIKE '%' || $1 || '%')
       AND ($2::papaleki.sermon_status IS NULL OR v.status = $2)
     ORDER BY v.created_at DESC LIMIT $3 OFFSET $4`,
    [q.search ?? null, q.status ?? null, q.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => ({
      ...camelize(row),
      coverUrl: row.cover_media_id ? `/api/v1/media/${row.cover_media_id}` : null,
    })),
    meta: pageMeta(q.page, q.limit, total),
  });
});

sermonsAdminRouter.get('/sermons/:id', requirePermission('sermons.view'), validate(idSchema, 'params'), async (req, res) => {
  const [sermonResult, tagsResult] = await Promise.all([
    pool.query(
      `SELECT s.*, p.display_name AS preacher_name, c.name AS category_name,
              audio.original_filename AS audio_filename,
              audio.processing_status AS audio_status,
              cover.original_filename AS cover_filename
       FROM papaleki.sermons s
       JOIN papaleki.preachers p ON p.id = s.preacher_id
       LEFT JOIN papaleki.sermon_categories c ON c.id = s.category_id
       LEFT JOIN papaleki.media_files audio ON audio.id = s.audio_media_id
       LEFT JOIN papaleki.media_files cover ON cover.id = s.cover_media_id
       WHERE s.id = $1`,
      [req.params.id],
    ),
    pool.query(
      `SELECT t.id, t.name, t.slug
       FROM papaleki.sermon_tag_links stl
       JOIN papaleki.sermon_tags t ON t.id = stl.tag_id
       WHERE stl.sermon_id = $1 ORDER BY t.name`,
      [req.params.id],
    ),
  ]);
  const sermon = sermonResult.rows[0];
  if (!sermon) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');
  res.json({
    success: true,
    data: {
      ...camelize(sermon),
      coverUrl: sermon.cover_media_id ? `/api/v1/media/${sermon.cover_media_id}` : null,
      tags: camelize(tagsResult.rows),
    },
  });
});

const mediaStatusForSermon = async (audioMediaId: string | null | undefined): Promise<string> => {
  if (!audioMediaId) return 'draft';
  const result = await pool.query<{ processing_status: string; kind: string }>(
    `SELECT processing_status, kind::text
     FROM papaleki.media_files WHERE id = $1 AND deleted_at IS NULL`,
    [audioMediaId],
  );
  const media = result.rows[0];
  if (!media || media.kind !== 'audio') throw new AppError(422, 'INVALID_AUDIO', 'Audio invalide.');
  return media.processing_status === 'ready' ? 'ready' : 'processing';
};

sermonsAdminRouter.post('/sermons', requirePermission('sermons.create'), validate(sermonCreateSchema), async (req, res) => {
  const b = req.body;
  const mediaStatus = await mediaStatusForSermon(b.audioMediaId);
  const status = mediaStatus === 'ready' && b.publishWhenReady ? 'published' : mediaStatus;
  const sermon = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO papaleki.sermons
       (title, slug, excerpt, description, scripture_reference, preacher_id,
        category_id, series_id, audio_media_id, cover_media_id, preached_on,
        status, is_featured, allow_download, publish_when_ready, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12::papaleki.sermon_status, $13, $14, $15, $16, $16)
       RETURNING *`,
      [b.title, b.slug ?? '', b.excerpt ?? null, b.description ?? null,
        b.scriptureReference ?? null, b.preacherId, b.categoryId ?? null,
        b.seriesId ?? null, b.audioMediaId ?? null, b.coverMediaId ?? null,
        b.preachedOn, status, b.isFeatured, b.allowDownload, b.publishWhenReady, req.auth!.userId],
    );
    const row = result.rows[0]!;
    for (const tagId of b.tagIds) {
      await client.query(
        'INSERT INTO papaleki.sermon_tag_links (sermon_id, tag_id) VALUES ($1, $2)',
        [row.id, tagId],
      );
    }
    return row;
  }, auditContext(req));
  if (sermon.status === 'published') {
    void sendSermonPublishedNotification(sermon.id).catch((error) => {
      logger.error({ err: error, sermonId: sermon.id }, 'Echec de la notification de publication.');
    });
  }
  res.status(201).json({ success: true, data: camelize(sermon) });
});

sermonsAdminRouter.patch('/sermons/:id', requirePermission('sermons.update'), validate(idSchema, 'params'), validate(sermonUpdateSchema), async (req, res) => {
  const { tagIds, ...changes } = req.body;
  const internalChanges: Record<string, unknown> = { ...changes, updatedBy: req.auth!.userId };
  if (changes.audioMediaId !== undefined) {
    const mediaStatus = await mediaStatusForSermon(changes.audioMediaId);
    internalChanges.status = mediaStatus === 'ready' && changes.publishWhenReady ? 'published' : mediaStatus;
    if (changes.audioMediaId === null) internalChanges.durationSeconds = null;
  }

  const sermon = await withTransaction(async (client) => {
    const row = await updateRow(
      'papaleki.sermons', req.params.id as string, internalChanges,
      { title: 'title', slug: 'slug', excerpt: 'excerpt', description: 'description',
        scriptureReference: 'scripture_reference', preacherId: 'preacher_id', categoryId: 'category_id',
        seriesId: 'series_id', audioMediaId: 'audio_media_id', coverMediaId: 'cover_media_id',
        preachedOn: 'preached_on', isFeatured: 'is_featured', allowDownload: 'allow_download',
        publishWhenReady: 'publish_when_ready', status: 'status', durationSeconds: 'duration_seconds', updatedBy: 'updated_by' }, client,
    );
    if (tagIds !== undefined) {
      await client.query('DELETE FROM papaleki.sermon_tag_links WHERE sermon_id = $1', [req.params.id]);
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO papaleki.sermon_tag_links (sermon_id, tag_id) VALUES ($1, $2)',
          [req.params.id, tagId],
        );
      }
    }
    return row;
  }, auditContext(req));
  res.json({ success: true, data: camelize(sermon) });
});

sermonsAdminRouter.post('/sermons/:id/publish', requirePermission('sermons.publish'), validate(idSchema, 'params'), async (req, res) => {
  await pool.query('CALL papaleki.sp_publish_sermon($1, $2)', [req.params.id, req.auth!.userId]);
  void sendSermonPublishedNotification(req.params.id as string).catch((error) => {
    logger.error({ err: error, sermonId: req.params.id }, 'Échec de la notification de publication.');
  });
  res.json({ success: true, message: 'Prédication publiée.' });
});

sermonsAdminRouter.post('/sermons/:id/schedule', requirePermission('sermons.publish'), validate(idSchema, 'params'), validate(scheduleSchema), async (req, res) => {
  await pool.query('CALL papaleki.sp_schedule_sermon($1, $2, $3)', [req.params.id, req.auth!.userId, req.body.publishAt]);
  res.json({ success: true, message: 'Publication programmée.' });
});

sermonsAdminRouter.post('/sermons/:id/archive', requirePermission('sermons.archive'), validate(idSchema, 'params'), async (req, res) => {
  await pool.query('CALL papaleki.sp_archive_sermon($1, $2)', [req.params.id, req.auth!.userId]);
  res.json({ success: true, message: 'Prédication archivée.' });
});

sermonsAdminRouter.post('/sermons/:id/unpublish', requirePermission('sermons.publish'), validate(idSchema, 'params'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    `UPDATE papaleki.sermons s
     SET status = CASE WHEN m.processing_status = 'ready' THEN 'ready'::papaleki.sermon_status
                       ELSE 'draft'::papaleki.sermon_status END,
         published_at = NULL,
         scheduled_for = NULL,
         updated_by = $2
     FROM papaleki.media_files m
     WHERE s.id = $1 AND m.id = s.audio_media_id
     RETURNING s.*`,
    [req.params.id, req.auth!.userId],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');
  res.json({ success: true, data: camelize(result.rows[0]) });
});

sermonsAdminRouter.post('/sermons/:id/duplicate', requirePermission('sermons.create'), validate(idSchema, 'params'), async (req, res) => {
  const duplicate = await withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO papaleki.sermons
       (title, slug, excerpt, description, scripture_reference, preacher_id,
        category_id, series_id, audio_media_id, cover_media_id, preached_on,
        status, is_featured, allow_download, created_by, updated_by)
       SELECT title || ' (copie)', '', excerpt, description, scripture_reference, preacher_id,
              category_id, series_id, audio_media_id, cover_media_id, preached_on,
              'draft', false, allow_download, $2, $2
       FROM papaleki.sermons WHERE id = $1
       RETURNING *`,
      [req.params.id, req.auth!.userId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');
    await client.query(
      `INSERT INTO papaleki.sermon_tag_links (sermon_id, tag_id)
       SELECT $1, tag_id FROM papaleki.sermon_tag_links WHERE sermon_id = $2`,
      [row.id, req.params.id],
    );
    return row;
  }, auditContext(req));
  res.status(201).json({ success: true, data: camelize(duplicate) });
});

sermonsAdminRouter.delete('/sermons/:id', requirePermission('sermons.delete'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.sermons WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');
  res.status(204).send();
});
