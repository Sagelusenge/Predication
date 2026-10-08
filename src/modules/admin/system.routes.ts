import { Router } from 'express';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../db/pool.js';
import { createToken, hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { sendMail } from '../../lib/mailer.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { updateRow } from '../../lib/sql.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idSchema } from '../public/public.schemas.js';
import {
  adminListSchema,
  dashboardRangeSchema,
  inviteUserSchema,
  rolesSchema,
  userUpdateSchema,
} from './admin.schemas.js';

export const systemAdminRouter = Router();

systemAdminRouter.get('/dashboard', requirePermission('dashboard.view'), validate(dashboardRangeSchema, 'query'), async (req, res) => {
  const requested = req.query as unknown as { from?: string; to?: string };
  const rangeResult = await pool.query<{ from_date: string; to_date: string }>(
    `SELECT coalesce($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 29)::text AS from_date,
            coalesce($2::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date)::text AS to_date`,
    [requested.from ?? null, requested.to ?? null],
  );
  const range = rangeResult.rows[0]!;
  const days = Math.round((new Date(`${range.to_date}T00:00:00Z`).getTime() - new Date(`${range.from_date}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 366) throw new AppError(422, 'INVALID_DATE_RANGE', 'Choisissez une période comprise entre 1 et 366 jours.');
  const [summary, trend, performance, recent, pendingTestimonials, audioJobs, scheduled, devices] = await Promise.all([
    pool.query(
      `SELECT d.*,
              (SELECT count(*) FROM papaleki.testimonials WHERE status = 'draft') AS pending_testimonials,
              coalesce((SELECT sum(play_starts) FROM papaleki.sermon_daily_stats
                        WHERE stats_date BETWEEN $1::date AND $2::date), 0) AS range_plays,
              coalesce((SELECT sum(unique_listeners) FROM papaleki.sermon_daily_stats
                        WHERE stats_date BETWEEN $1::date AND $2::date), 0) AS range_unique_listeners,
              (SELECT CASE WHEN coalesce(sum(play_starts), 0) = 0 THEN 0
                           ELSE round(100.0 * sum(completions)::numeric / sum(play_starts)::numeric, 1)
                      END FROM papaleki.sermon_daily_stats
                      WHERE stats_date BETWEEN $1::date AND $2::date) AS range_completion_rate
       FROM papaleki.v_dashboard_summary d`,
      [range.from_date, range.to_date],
    ),
    pool.query(
      `SELECT days.stats_date,
              coalesce(sum(ds.play_starts), 0) AS play_starts,
              coalesce(sum(ds.unique_listeners), 0) AS summed_daily_unique_listeners,
              coalesce(sum(ds.completions), 0) AS completions
       FROM generate_series($1::date, $2::date, interval '1 day') AS days(stats_date)
       LEFT JOIN papaleki.sermon_daily_stats ds ON ds.stats_date = days.stats_date::date
       GROUP BY days.stats_date ORDER BY days.stats_date`,
      [range.from_date, range.to_date],
    ),
    pool.query(
      `SELECT s.id AS sermon_id, s.title, s.slug, p.display_name AS preacher_name,
              coalesce(sum(ds.play_starts), 0) AS play_starts,
              coalesce(sum(ds.unique_listeners), 0) AS summed_daily_unique_listeners,
              coalesce(sum(ds.completions), 0) AS completions
       FROM papaleki.sermons s
       JOIN papaleki.preachers p ON p.id = s.preacher_id
       LEFT JOIN papaleki.sermon_daily_stats ds
         ON ds.sermon_id = s.id AND ds.stats_date BETWEEN $1::date AND $2::date
       WHERE s.status = 'published'
       GROUP BY s.id, p.display_name
       ORDER BY play_starts DESC LIMIT 10`,
      [range.from_date, range.to_date],
    ),
    pool.query(
      `SELECT id, title, slug, scripture_reference, status, preached_on,
              published_at, play_count, duration_seconds, updated_at
       FROM papaleki.sermons ORDER BY updated_at DESC LIMIT 8`,
    ),
    pool.query(
      `SELECT id, author_name, author_role, quote, created_at
       FROM papaleki.testimonials
       WHERE status = 'draft'
       ORDER BY created_at DESC LIMIT 2`,
    ),
    pool.query(
      `SELECT job_id, status, progress_percent, original_filename, queued_at
       FROM papaleki.v_audio_processing_queue
       WHERE status IN ('queued', 'processing')
       ORDER BY queued_at LIMIT 1`,
    ),
    pool.query(
      `SELECT id, title, scheduled_for
       FROM papaleki.sermons
       WHERE status = 'scheduled' AND scheduled_for >= CURRENT_TIMESTAMP
       ORDER BY scheduled_for LIMIT 1`,
    ),
    pool.query(
      `SELECT coalesce(device_type, 'inconnu') AS device_type, count(*)::int AS event_count
       FROM papaleki.sermon_events
       WHERE event_type = 'play_start'
         AND (occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date BETWEEN $1::date AND $2::date
       GROUP BY coalesce(device_type, 'inconnu')
       ORDER BY event_count DESC`,
      [range.from_date, range.to_date],
    ),
  ]);
  res.json({
    success: true,
    data: {
      summary: camelize(summary.rows[0] ?? {}),
      trend: camelize(trend.rows),
      topSermons: camelize(performance.rows),
      recentSermons: camelize(recent.rows),
      pendingTestimonials: camelize(pendingTestimonials.rows),
      activeAudioJob: camelize(audioJobs.rows[0] ?? null),
      nextScheduledSermon: camelize(scheduled.rows[0] ?? null),
      devices: camelize(devices.rows),
      range: { from: range.from_date, to: range.to_date, days },
    },
  });
});

systemAdminRouter.get('/statistics/sermons', requirePermission('statistics.view'), async (_req, res) => {
  const result = await pool.query(
    'SELECT * FROM papaleki.v_sermon_performance_30d ORDER BY play_starts DESC, title',
  );
  res.json({ success: true, data: camelize(result.rows) });
});

systemAdminRouter.get('/audio-jobs', requirePermission('media.manage'), validate(adminListSchema, 'query'), async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; status?: string };
  const { offset } = pagination(q.page, q.limit);
  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM papaleki.v_audio_processing_queue
     WHERE ($1::papaleki.processing_status IS NULL OR status = $1)
     ORDER BY queued_at DESC LIMIT $2 OFFSET $3`,
    [q.status ?? null, q.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(q.page, q.limit, total),
  });
});

systemAdminRouter.get('/roles', requirePermission('users.view'), async (_req, res) => {
  const result = await pool.query(
    `SELECT r.id, r.code, r.name, r.description,
            array_remove(array_agg(p.code ORDER BY p.code), NULL) AS permissions
     FROM papaleki.roles r
     LEFT JOIN papaleki.role_permissions rp ON rp.role_id = r.id
     LEFT JOIN papaleki.permissions p ON p.id = rp.permission_id
     GROUP BY r.id ORDER BY r.name`,
  );
  res.json({ success: true, data: camelize(result.rows) });
});

systemAdminRouter.get('/users', requirePermission('users.view'), validate(adminListSchema, 'query'), async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; search?: string; status?: string };
  const { offset } = pagination(q.page, q.limit);
  const result = await pool.query(
    `SELECT u.id, u.email::text, u.first_name, u.last_name, u.status,
            u.locale, u.timezone, u.last_login_at, u.locked_until,
            u.created_at, u.updated_at,
            array_remove(array_agg(DISTINCT r.code), NULL) AS roles,
            count(*) OVER()::int AS total_count
     FROM papaleki.users u
     LEFT JOIN papaleki.user_roles ur ON ur.user_id = u.id
     LEFT JOIN papaleki.roles r ON r.id = ur.role_id
     WHERE u.deleted_at IS NULL
       AND ($1::text IS NULL OR u.email::text ILIKE '%' || $1 || '%'
            OR u.first_name ILIKE '%' || $1 || '%'
            OR u.last_name ILIKE '%' || $1 || '%')
       AND ($2::papaleki.user_status IS NULL OR u.status = $2)
     GROUP BY u.id
     ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,
    [q.search ?? null, q.status ?? null, q.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(q.page, q.limit, total),
  });
});

systemAdminRouter.get('/users/:id', requirePermission('users.view'), validate(idSchema, 'params'), async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email::text, u.first_name, u.last_name, u.status,
            u.locale, u.timezone, u.last_login_at, u.locked_until,
            u.created_at, u.updated_at,
            array_remove(array_agg(DISTINCT r.code), NULL) AS roles
     FROM papaleki.users u
     LEFT JOIN papaleki.user_roles ur ON ur.user_id = u.id
     LEFT JOIN papaleki.roles r ON r.id = ur.role_id
     WHERE u.id = $1 AND u.deleted_at IS NULL
     GROUP BY u.id`,
    [req.params.id],
  );
  if (!result.rows[0]) throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable.');
  res.json({ success: true, data: camelize(result.rows[0]) });
});

systemAdminRouter.patch('/users/:id', requirePermission('users.manage'), validate(idSchema, 'params'), validate(userUpdateSchema), async (req, res) => {
  const row = await withTransaction((client) => updateRow(
    'papaleki.users', req.params.id as string, req.body,
    { email: 'email', firstName: 'first_name', lastName: 'last_name', locale: 'locale', timezone: 'timezone' },
    client,
  ), { userId: req.auth!.userId, requestId: String(req.id), ipAddress: req.ip });
  res.json({ success: true, data: camelize(row) });
});

systemAdminRouter.post('/users/invite', requirePermission('users.manage'), validate(inviteUserSchema), async (req, res) => {
  if (req.body.roleCode === 'super_admin' && !req.auth!.roles.includes('super_admin')) {
    throw new AppError(403, 'FORBIDDEN', 'Seul un super administrateur peut attribuer ce rôle.');
  }
  const token = createToken(48);
  const expiresAt = new Date(Date.now() + env.INVITATION_TTL_DAYS * 86_400_000);
  const result = await pool.query<{ p_user_id: string }>(
    'CALL papaleki.sp_invite_user($1, $2, $3, $4, $5, $6, $7, NULL)',
    [
      req.auth!.userId,
      req.body.email,
      req.body.firstName,
      req.body.lastName,
      req.body.roleCode,
      hashToken(token),
      expiresAt,
    ],
  );
  const invitationUrl = `${env.APP_URL}/accepter-invitation?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: req.body.email,
    subject: 'Invitation à administrer la plateforme PapaLeki',
    text: `Vous avez été invité. Activez votre compte : ${invitationUrl}`,
    html: `<p>Vous avez été invité à administrer la plateforme PapaLeki.</p><p><a href="${invitationUrl}">Activer mon compte</a></p>`,
    developmentUrl: invitationUrl,
  });
  res.status(201).json({
    success: true,
    data: {
      userId: result.rows[0]?.p_user_id,
      ...(env.NODE_ENV === 'development' ? { developmentToken: token } : {}),
    },
  });
});

systemAdminRouter.put('/users/:id/roles', requirePermission('users.manage'), validate(idSchema, 'params'), validate(rolesSchema), async (req, res) => {
  const roleCodes = [...new Set(req.body.roleCodes)];
  if (roleCodes.includes('super_admin') && !req.auth!.roles.includes('super_admin')) {
    throw new AppError(403, 'FORBIDDEN', 'Seul un super administrateur peut attribuer ce rôle.');
  }

  await withTransaction(async (client) => {
    const roles = await client.query<{ id: string; code: string }>(
      'SELECT id, code FROM papaleki.roles WHERE code = ANY($1::text[])',
      [roleCodes],
    );
    if (roles.rows.length !== roleCodes.length) throw new AppError(422, 'INVALID_ROLE', 'Rôle invalide.');

    for (const role of roles.rows) {
      await client.query(
        `INSERT INTO papaleki.user_roles (user_id, role_id, granted_by)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [req.params.id, role.id, req.auth!.userId],
      );
    }
    await client.query(
      `DELETE FROM papaleki.user_roles ur
       USING papaleki.roles r
       WHERE ur.role_id = r.id AND ur.user_id = $1 AND NOT (r.code = ANY($2::text[]))`,
      [req.params.id, roleCodes],
    );
  }, { userId: req.auth!.userId, requestId: String(req.id), ipAddress: req.ip });
  res.json({ success: true, message: 'Rôles mis à jour.' });
});

systemAdminRouter.post('/users/:id/deactivate', requirePermission('users.manage'), validate(idSchema, 'params'), async (req, res) => {
  await pool.query('CALL papaleki.sp_deactivate_user($1, $2)', [req.params.id, req.auth!.userId]);
  res.json({ success: true, message: 'Utilisateur désactivé.' });
});

systemAdminRouter.delete('/users/:id', requirePermission('users.manage'), validate(idSchema, 'params'), async (req, res) => {
  await pool.query('CALL papaleki.sp_deactivate_user($1, $2)', [req.params.id, req.auth!.userId]);
  res.status(204).send();
});

systemAdminRouter.get('/audit-logs', requirePermission('audit.view'), validate(adminListSchema, 'query'), async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; search?: string };
  const { offset } = pagination(q.page, q.limit);
  const result = await pool.query(
    `SELECT a.*, u.email::text AS actor_email,
            count(*) OVER()::int AS total_count
     FROM papaleki.audit_logs a
     LEFT JOIN papaleki.users u ON u.id = a.actor_id
     WHERE ($1::text IS NULL OR a.entity_type ILIKE '%' || $1 || '%'
            OR a.action ILIKE '%' || $1 || '%'
            OR u.email::text ILIKE '%' || $1 || '%')
     ORDER BY a.occurred_at DESC LIMIT $2 OFFSET $3`,
    [q.search ?? null, q.limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(q.page, q.limit, total),
  });
});

systemAdminRouter.post('/maintenance/publish-due', requirePermission('settings.manage'), async (_req, res) => {
  await pool.query('CALL papaleki.sp_publish_due_content()');
  res.json({ success: true });
});

systemAdminRouter.post('/maintenance/rebuild-statistics', requirePermission('settings.manage'), async (_req, res) => {
  await pool.query('CALL papaleki.sp_rebuild_sermon_statistics()');
  res.status(202).json({ success: true });
});

