import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { API_PREFIX } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { validate } from '../../middleware/validate.js';
import { getFeaturedBiblePassage } from '../bible/bible.service.js';
import {
  contactSchema,
  eventSchema,
  idSchema,
  publicTestimonialSchema,
  sermonListSchema,
  slugSchema,
} from './public.schemas.js';

export const publicRouter = Router();

const visitorHash = (req: Request, res: Response, create = true): string | null => {
  let visitorToken = req.signedCookies?.pl_visitor as string | undefined;
  if (!visitorToken && create) {
    visitorToken = randomBytes(32).toString('base64url');
    res.cookie('pl_visitor', visitorToken, {
      httpOnly: true,
      signed: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 86_400_000,
    });
  }
  return visitorToken ? hashToken(`${env.COOKIE_SECRET}:${visitorToken}`) : null;
};

const contactLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const eventLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

publicRouter.get('/sermons', validate(sermonListSchema, 'query'), async (req, res) => {
  const { page, limit, search, category, series, preacher, year, featured, sort } = req.query as unknown as {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    series?: string;
    preacher?: string;
    year?: number;
    featured?: boolean;
    sort: 'newest' | 'oldest' | 'popular';
  };
  const { offset } = pagination(page, limit);
  const order = {
    newest: 'published_at DESC, preached_on DESC',
    oldest: 'published_at ASC, preached_on ASC',
    popular: 'play_count DESC, published_at DESC',
  }[sort];

  const result = await pool.query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM papaleki.v_public_sermons
     WHERE ($1::text IS NULL OR title ILIKE '%' || $1 || '%'
            OR description ILIKE '%' || $1 || '%'
            OR scripture_reference ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR category_slug = $2)
       AND ($3::text IS NULL OR series_slug = $3)
       AND ($4::uuid IS NULL OR preacher_id = $4)
       AND ($5::int IS NULL OR EXTRACT(YEAR FROM preached_on)::int = $5)
       AND ($6::boolean IS NULL OR is_featured = $6)
     ORDER BY ${order}
     LIMIT $7 OFFSET $8`,
    [search ?? null, category ?? null, series ?? null, preacher ?? null, year ?? null, featured ?? null, limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  const data = result.rows.map(({ total_count: _total, ...row }) => ({
    ...camelize(row),
    audioUrl: `${API_PREFIX}/media/${row.audio_media_id}/stream`,
    coverUrl: row.cover_media_id ? `${API_PREFIX}/media/${row.cover_media_id}` : null,
  }));
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ success: true, data, meta: pageMeta(page, limit, total) });
});

publicRouter.get('/sermons/:slug', validate(slugSchema, 'params'), async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM papaleki.v_public_sermons WHERE slug = $1',
    [req.params.slug],
  );
  const sermon = result.rows[0];
  if (!sermon) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');

  const related = await pool.query(
    `SELECT id, title, slug, excerpt, preached_on, duration_seconds,
            cover_media_id, audio_media_id, preacher_name, category_name, play_count, like_count
     FROM papaleki.v_public_sermons
     WHERE id <> $1
       AND (category_id = $2 OR series_id = $3)
     ORDER BY published_at DESC
     LIMIT 4`,
    [sermon.id, sermon.category_id, sermon.series_id],
  );
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    success: true,
    data: {
      ...camelize(sermon),
      audioUrl: `${API_PREFIX}/media/${sermon.audio_media_id}/stream`,
      coverUrl: sermon.cover_media_id ? `${API_PREFIX}/media/${sermon.cover_media_id}` : null,
      related: related.rows.map((row) => ({
        ...camelize(row),
        audioUrl: row.audio_media_id ? `${API_PREFIX}/media/${row.audio_media_id}/stream` : null,
        coverUrl: row.cover_media_id ? `${API_PREFIX}/media/${row.cover_media_id}` : null,
      })),
    },
  });
});

publicRouter.post('/sermons/:id/events', eventLimit, validate(idSchema, 'params'), validate(eventSchema), async (req, res) => {
  const body = req.body;
  await pool.query(
    `CALL papaleki.sp_record_sermon_event(
       $1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $9
     )`,
    [
      req.params.id,
      body.eventType,
      visitorHash(req, res),
      body.sessionIdentifier ? hashToken(body.sessionIdentifier) : null,
      body.secondsListened,
      body.progressPercent ?? null,
      body.deviceType ?? null,
      body.referrer ?? req.get('referer') ?? null,
      body.metadata,
    ],
  );
  res.status(202).json({ success: true });
});

publicRouter.get('/sermons/:id/like', eventLimit, validate(idSchema, 'params'), async (req, res) => {
  const hash = visitorHash(req, res, false);
  const result = await pool.query<{ like_count: number; liked: boolean }>(
    `SELECT s.like_count,
            CASE WHEN $2::text IS NULL THEN false ELSE EXISTS (
              SELECT 1 FROM papaleki.sermon_likes sl
              WHERE sl.sermon_id = s.id AND sl.visitor_hash = $2
            ) END AS liked
     FROM papaleki.sermons s
     WHERE s.id = $1 AND s.status = 'published' AND s.published_at <= CURRENT_TIMESTAMP`,
    [req.params.id, hash],
  );
  if (!result.rows[0]) throw new AppError(404, 'SERMON_NOT_FOUND', 'Prédication introuvable.');
  res.json({ success: true, data: { liked: result.rows[0].liked, likeCount: Number(result.rows[0].like_count) } });
});

publicRouter.post('/sermons/:id/like', eventLimit, validate(idSchema, 'params'), async (req, res) => {
  const hash = visitorHash(req, res);
  const result = await pool.query<{ p_liked: boolean; p_like_count: number }>(
    'CALL papaleki.sp_toggle_sermon_like($1, $2, $3::boolean, $4::bigint)',
    [req.params.id, hash, null, 0],
  );
  const row = result.rows[0];
  res.json({
    success: true,
    data: { liked: row?.p_liked ?? false, likeCount: Number(row?.p_like_count ?? 0) },
  });
});

publicRouter.get('/categories', async (_req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.display_order,
            count(s.id) FILTER (WHERE s.status = 'published')::int AS sermon_count
     FROM papaleki.sermon_categories c
     LEFT JOIN papaleki.sermons s ON s.category_id = c.id
     WHERE c.is_active = true
     GROUP BY c.id
     ORDER BY c.display_order, c.name`,
  );
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: camelize(result.rows) });
});

publicRouter.get('/series', async (_req, res) => {
  const result = await pool.query(
    `SELECT sr.id, sr.title, sr.slug, sr.description, sr.start_date, sr.end_date,
            sr.cover_media_id,
            count(s.id) FILTER (WHERE s.status = 'published')::int AS sermon_count
     FROM papaleki.sermon_series sr
     LEFT JOIN papaleki.sermons s ON s.series_id = sr.id
     WHERE sr.is_active = true
     GROUP BY sr.id
     ORDER BY sr.start_date DESC NULLS LAST, sr.title`,
  );
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({
    success: true,
    data: result.rows.map((row) => ({
      ...camelize(row),
      coverUrl: row.cover_media_id ? `${API_PREFIX}/media/${row.cover_media_id}` : null,
    })),
  });
});

publicRouter.get('/preachers', async (_req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.display_name, p.title, p.biography, p.church_name,
            p.photo_media_id, p.is_primary,
            count(s.id) FILTER (WHERE s.status = 'published')::int AS sermon_count
     FROM papaleki.preachers p
     LEFT JOIN papaleki.sermons s ON s.preacher_id = p.id
     WHERE p.is_active = true
     GROUP BY p.id
     ORDER BY p.is_primary DESC, p.display_name`,
  );
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({
    success: true,
    data: result.rows.map((row) => ({
      ...camelize(row),
      photoUrl: row.photo_media_id ? `${API_PREFIX}/media/${row.photo_media_id}` : null,
    })),
  });
});

publicRouter.get('/pages/:slug', validate(slugSchema, 'params'), async (req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.v_public_pages WHERE slug = $1', [req.params.slug]);
  const page = result.rows[0];
  if (!page) throw new AppError(404, 'PAGE_NOT_FOUND', 'Page introuvable.');
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  res.json({
    success: true,
    data: {
      ...camelize(page),
      coverUrl: page.cover_media_id ? `${API_PREFIX}/media/${page.cover_media_id}` : null,
    },
  });
});

publicRouter.get('/testimonials', async (_req, res) => {
  const result = await pool.query('SELECT * FROM papaleki.v_public_testimonials');
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  res.json({
    success: true,
    data: result.rows.map((row) => ({
      ...camelize(row),
      photoUrl: row.photo_media_id ? `${API_PREFIX}/media/${row.photo_media_id}` : null,
    })),
  });
});

publicRouter.post('/testimonials', contactLimit, validate(publicTestimonialSchema), async (req, res) => {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO papaleki.testimonials (author_name, author_role, quote, status)
     VALUES ($1, $2, $3, 'draft') RETURNING id`,
    [
      req.body.authorName,
      req.body.authorLocation ? `Depuis ${req.body.authorLocation}` : null,
      req.body.quote,
    ],
  );
  res.status(201).json({
    success: true,
    data: { id: result.rows[0]?.id },
    message: 'Merci. Votre témoignage sera relu avant publication.',
  });
});

publicRouter.get('/settings', async (_req, res) => {
  const result = await pool.query('SELECT setting_key, value FROM papaleki.v_public_site_settings');
  const data = Object.fromEntries(result.rows.map((row) => [row.setting_key, row.value]));
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  res.json({ success: true, data });
});

publicRouter.get('/app-config', async (_req, res) => {
  const [settings, latest, homePage, testimonials, statistics, primaryPreacher, featuredBibleVerse] = await Promise.all([
    pool.query('SELECT setting_key, value FROM papaleki.v_public_site_settings'),
    pool.query(
      `SELECT id, title, slug, excerpt, preached_on, duration_seconds,
              cover_media_id, audio_media_id, preacher_name, category_name,
              play_count, like_count, is_featured
       FROM papaleki.v_public_sermons
       ORDER BY published_at DESC
       LIMIT 3`,
    ),
    pool.query(
      `SELECT * FROM papaleki.v_public_pages
       WHERE slug = 'accueil'
       LIMIT 1`,
    ),
    pool.query(
      `SELECT id, author_name, author_role, quote, photo_media_id
       FROM papaleki.v_public_testimonials
       LIMIT 3`,
    ),
    pool.query(
      `SELECT count(*)::int AS published_sermons,
              coalesce(sum(duration_seconds), 0)::double precision AS total_duration_seconds,
              coalesce(sum(play_count), 0)::double precision AS total_plays,
              coalesce(sum(like_count), 0)::double precision AS total_likes
       FROM papaleki.sermons
       WHERE status = 'published' AND published_at <= CURRENT_TIMESTAMP`,
    ),
    pool.query(
      `SELECT id, display_name, title, biography, church_name, photo_media_id
       FROM papaleki.preachers
       WHERE is_active = true
       ORDER BY is_primary DESC, display_name
       LIMIT 1`,
    ),
    getFeaturedBiblePassage(),
  ]);
  const page = homePage.rows[0];
  const preacher = primaryPreacher.rows[0];
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    success: true,
    data: {
      settings: Object.fromEntries(settings.rows.map((row) => [row.setting_key, row.value])),
      latestSermons: latest.rows.map((row) => ({
        ...camelize(row),
        audioUrl: `${API_PREFIX}/media/${row.audio_media_id}/stream`,
        coverUrl: row.cover_media_id ? `${API_PREFIX}/media/${row.cover_media_id}` : null,
      })),
      page: page ? {
        ...camelize(page),
        coverUrl: page.cover_media_id ? `${API_PREFIX}/media/${page.cover_media_id}` : null,
      } : null,
      testimonials: testimonials.rows.map((row) => ({
        id: row.id,
        authorName: row.author_name,
        authorLocation: row.author_role?.replace(/^Depuis\s+/i, '') ?? null,
        content: row.quote,
        photoUrl: row.photo_media_id ? `${API_PREFIX}/media/${row.photo_media_id}` : null,
      })),
      statistics: camelize(statistics.rows[0] ?? {
        published_sermons: 0,
        total_duration_seconds: 0,
        total_plays: 0,
        total_likes: 0,
      }),
      primaryPreacher: preacher ? {
        ...camelize(preacher),
        photoUrl: preacher.photo_media_id ? `${API_PREFIX}/media/${preacher.photo_media_id}` : null,
      } : null,
      featuredBibleVerse,
    },
  });
});

publicRouter.post('/contact', contactLimit, validate(contactSchema), async (req, res) => {
  const body = req.body;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO papaleki.contact_messages
     (full_name, email, phone, subject, message, source_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [body.fullName, body.email, body.phone ?? null, body.subject, body.message, req.ip, req.get('user-agent')],
  );
  res.status(201).json({
    success: true,
    data: { id: result.rows[0]!.id },
    message: 'Votre message a bien été envoyé.',
  });
});
