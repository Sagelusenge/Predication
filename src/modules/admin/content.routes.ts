import { Router, type Request } from 'express';
import { pool, withTransaction } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { updateRow } from '../../lib/sql.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idSchema } from '../public/public.schemas.js';
import {
  adminListSchema,
  confirmDeleteSchema,
  messageStatusSchema,
  pageCreateSchema,
  pageUpdateSchema,
  scheduleSchema,
  settingSchema,
  testimonialCreateSchema,
  testimonialUpdateSchema,
} from './admin.schemas.js';

export const contentAdminRouter = Router();

const auditContext = (req: Request) => ({
  userId: req.auth!.userId,
  requestId: String(req.id),
  ipAddress: req.ip,
});

contentAdminRouter.get('/pages', requirePermission('pages.view'), async (_req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.pages ORDER BY display_order, title');
  res.json({ success: true, data: camelize(result.rows) });
});

contentAdminRouter.get('/pages/:id', requirePermission('pages.view'), validate(idSchema, 'params'), async (req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.pages WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  res.json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.post('/pages', requirePermission('pages.manage'), validate(pageCreateSchema), async (req, res) => {
  const b = req.body;
  const result = await withTransaction((client) => client.query(
    `INSERT INTO papaleki.pages
     (slug, title, navigation_label, content, meta_title, meta_description,
      cover_media_id, display_order, show_in_navigation, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [b.slug ?? '', b.title, b.navigationLabel ?? null, b.content,
      b.metaTitle ?? null, b.metaDescription ?? null, b.coverMediaId ?? null,
      b.displayOrder, b.showInNavigation, req.auth!.userId],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.patch('/pages/:id', requirePermission('pages.manage'), validate(idSchema, 'params'), validate(pageUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.pages', req.params.id as string, { ...req.body, updatedBy: req.auth!.userId },
    { slug: 'slug', title: 'title', navigationLabel: 'navigation_label', content: 'content',
      metaTitle: 'meta_title', metaDescription: 'meta_description', coverMediaId: 'cover_media_id',
      displayOrder: 'display_order', showInNavigation: 'show_in_navigation', updatedBy: 'updated_by' },
    client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

contentAdminRouter.post('/pages/:id/publish', requirePermission('pages.publish'), validate(idSchema, 'params'), async (req, res) => {
  await pool.query('CALL papaleki.sp_publish_page($1, $2)', [req.params.id, req.auth!.userId]);
  res.json({ success: true, message: 'Page publiée.' });
});

contentAdminRouter.post('/pages/:id/schedule', requirePermission('pages.publish'), validate(idSchema, 'params'), validate(scheduleSchema), async (req, res) => {
  await pool.query('CALL papaleki.sp_publish_page($1, $2, $3)', [req.params.id, req.auth!.userId, req.body.publishAt]);
  res.json({ success: true, message: 'Page programmée.' });
});

contentAdminRouter.post('/pages/:id/archive', requirePermission('pages.publish'), validate(idSchema, 'params'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    `UPDATE papaleki.pages
     SET status = 'archived', scheduled_for = NULL, updated_by = $2
     WHERE id = $1 RETURNING *`,
    [req.params.id, req.auth!.userId],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  res.json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.delete('/pages/:id', requirePermission('pages.manage'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.pages WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  res.status(204).send();
});

contentAdminRouter.get('/testimonials', requirePermission('pages.view'), async (_req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.testimonials ORDER BY display_order, created_at DESC');
  res.json({ success: true, data: camelize(result.rows) });
});

contentAdminRouter.post('/testimonials', requirePermission('pages.manage'), validate(testimonialCreateSchema), async (req, res) => {
  const b = req.body;
  const result = await withTransaction((client) => client.query(
    `INSERT INTO papaleki.testimonials
     (author_name, author_role, quote, photo_media_id, status, display_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [b.authorName, b.authorRole ?? null, b.quote, b.photoMediaId ?? null,
      b.status, b.displayOrder, req.auth!.userId],
  ), auditContext(req));
  res.status(201).json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.patch('/testimonials/:id', requirePermission('pages.manage'), validate(idSchema, 'params'), validate(testimonialUpdateSchema), async (req, res) => {
  const changes = {
    ...req.body,
    ...(req.body.status === 'published' ? { publishedAt: new Date() } : {}),
  };
  const row = await withTransaction((client) => updateRow(
    'papaleki.testimonials', req.params.id as string, changes,
    { authorName: 'author_name', authorRole: 'author_role', quote: 'quote',
      photoMediaId: 'photo_media_id', status: 'status', displayOrder: 'display_order', publishedAt: 'published_at' }, client,
  ), auditContext(req));
  res.json({ success: true, data: camelize(row) });
});

contentAdminRouter.delete('/testimonials/:id', requirePermission('pages.manage'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await withTransaction((client) => client.query(
    'DELETE FROM papaleki.testimonials WHERE id = $1 RETURNING id', [req.params.id],
  ), auditContext(req));
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Témoignage introuvable.');
  res.status(204).send();
});

contentAdminRouter.get('/messages', requirePermission('messages.view'), validate(adminListSchema, 'query'), async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; search?: string; status?: string };
  const { offset } = pagination(q.page, q.limit);
  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM papaleki.v_contact_inbox
     WHERE ($1::text IS NULL OR full_name ILIKE '%' || $1 || '%'
            OR email::text ILIKE '%' || $1 || '%'
            OR subject ILIKE '%' || $1 || '%')
       AND ($2::papaleki.contact_status IS NULL OR status = $2)
     ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
    [q.search ?? null, q.status ?? null, q.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(q.page, q.limit, total),
  });
});

contentAdminRouter.get('/messages/:id', requirePermission('messages.view'), validate(idSchema, 'params'), async (req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.v_contact_inbox WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message introuvable.');
  res.json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.patch('/messages/:id/status', requirePermission('messages.manage'), validate(idSchema, 'params'), validate(messageStatusSchema), async (req, res) => {
  await pool.query('CALL papaleki.sp_mark_contact_message($1, $2, $3, $4)', [
    req.params.id,
    req.body.status,
    req.auth!.userId,
    req.body.assignedTo ?? null,
  ]);
  const result = await pool.query('SELECT * FROM papaleki.v_contact_inbox WHERE id = $1', [req.params.id]);
  res.json({ success: true, data: camelize(result.rows[0]) });
});

contentAdminRouter.delete('/messages/:id', requirePermission('messages.manage'), validate(idSchema, 'params'), validate(confirmDeleteSchema, 'query'), async (req, res) => {
  const result = await pool.query('DELETE FROM papaleki.contact_messages WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rows[0]) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message introuvable.');
  res.status(204).send();
});

contentAdminRouter.get('/settings', requirePermission('settings.view'), async (_req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.site_settings ORDER BY setting_group, setting_key');
  res.json({ success: true, data: camelize(result.rows) });
});

contentAdminRouter.put('/settings/:key', requirePermission('settings.manage'), validate(settingSchema), async (req, res) => {
  const b = req.body;
  await pool.query('CALL papaleki.sp_upsert_site_setting($1, $2, $3, $4, $5, $6)', [
    req.params.key,
    b.settingGroup,
    b.value,
    b.description ?? null,
    b.isPublic,
    req.auth!.userId,
  ]);
  const result = await pool.query('SELECT * FROM papaleki.site_settings WHERE setting_key = $1', [req.params.key]);
  res.json({ success: true, data: camelize(result.rows[0]) });
});
