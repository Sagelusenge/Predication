import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { pageMeta, pagination } from '../../lib/pagination.js';
import { camelize } from '../../lib/serialize.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { importBibleTranslations } from './bible-import.service.js';
import {
  bibleChapterSchema,
  bibleSearchSchema,
  bibleTranslationSchema,
  featuredBiblePassageSchema,
} from './bible.schemas.js';
import { getFeaturedBiblePassage } from './bible.service.js';

export const biblePublicRouter = Router();
export const bibleAdminRouter = Router();

const translationFields = `
  id, code, language_code, language_name, title, abbreviation,
  source_url, license_name, copyright_notice, attribution,
  text_direction, is_complete, verse_count, imported_at`;

biblePublicRouter.get('/translations', async (_req, res) => {
  const result = await pool.query(
    `SELECT ${translationFields}
     FROM papaleki.bible_translations
     WHERE is_active = true AND is_complete = true
     ORDER BY CASE language_code WHEN 'fr' THEN 1 WHEN 'en' THEN 2 WHEN 'sw' THEN 3 ELSE 4 END, title`,
  );
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json({ success: true, data: camelize(result.rows) });
});

biblePublicRouter.get('/translations/:translation/books', validate(bibleTranslationSchema, 'params'), async (req, res) => {
  const result = await pool.query(
    `SELECT b.code, bn.name, bn.short_name, b.canonical_order, b.testament, b.chapter_count
     FROM papaleki.bible_translations t
     JOIN papaleki.bible_book_names bn ON bn.translation_id = t.id
     JOIN papaleki.bible_books b ON b.code = bn.book_code
     WHERE t.code = $1 AND t.is_active = true AND t.is_complete = true
     ORDER BY b.canonical_order`,
    [req.params.translation],
  );
  if (!result.rowCount) throw new AppError(404, 'BIBLE_TRANSLATION_NOT_FOUND', 'Traduction biblique introuvable.');
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json({ success: true, data: camelize(result.rows) });
});

biblePublicRouter.get('/chapter/:translation/:book/:chapter', validate(bibleChapterSchema, 'params'), async (req, res) => {
  const result = await pool.query(
    `SELECT
       t.code AS translation_code, t.language_code, t.language_name,
       t.title AS translation_title, t.abbreviation, t.attribution, t.license_name, t.source_url,
       b.code AS book_code, bn.name AS book_name, b.testament, b.chapter_count,
       v.chapter, v.verse_start, v.verse_end, v.verse_text
     FROM papaleki.bible_translations t
     JOIN papaleki.bible_book_names bn ON bn.translation_id = t.id
     JOIN papaleki.bible_books b ON b.code = bn.book_code
     JOIN papaleki.bible_verses v ON v.translation_id = t.id AND v.book_code = b.code
     WHERE t.code = $1 AND b.code = $2 AND v.chapter = $3
       AND t.is_active = true AND t.is_complete = true
     ORDER BY v.verse_start`,
    [req.params.translation, req.params.book, req.params.chapter],
  );
  const first = result.rows[0];
  if (!first) throw new AppError(404, 'BIBLE_CHAPTER_NOT_FOUND', 'Chapitre biblique introuvable.');
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.json({
    success: true,
    data: {
      translation: camelize({
        code: first.translation_code,
        language_code: first.language_code,
        language_name: first.language_name,
        title: first.translation_title,
        abbreviation: first.abbreviation,
        attribution: first.attribution,
        license_name: first.license_name,
        source_url: first.source_url,
      }),
      book: camelize({
        code: first.book_code,
        name: first.book_name,
        testament: first.testament,
        chapter_count: first.chapter_count,
      }),
      chapter: Number(first.chapter),
      verses: result.rows.map((row) => ({
        verseStart: Number(row.verse_start),
        verseEnd: Number(row.verse_end),
        text: row.verse_text,
      })),
    },
  });
});

biblePublicRouter.get('/search', validate(bibleSearchSchema, 'query'), async (req, res) => {
  const { translation, q, page, limit } = req.query as unknown as {
    translation: string; q: string; page: number; limit: number;
  };
  const { offset } = pagination(page, limit);
  const result = await pool.query(
    `SELECT
       v.book_code, bn.name AS book_name, v.chapter,
       v.verse_start, v.verse_end, v.verse_text,
       count(*) OVER()::int AS total_count
     FROM papaleki.bible_translations t
     JOIN papaleki.bible_verses v ON v.translation_id = t.id
     JOIN papaleki.bible_books b ON b.code = v.book_code
     JOIN papaleki.bible_book_names bn ON bn.translation_id = t.id AND bn.book_code = b.code
     WHERE t.code = $1 AND t.is_active = true AND t.is_complete = true
       AND v.verse_text ILIKE '%' || $2 || '%'
     ORDER BY b.canonical_order, v.chapter, v.verse_start
     LIMIT $3 OFFSET $4`,
    [translation, q, limit, offset],
  );
  const total = result.rows[0]?.total_count ?? 0;
  res.json({
    success: true,
    data: result.rows.map(({ total_count: _total, ...row }) => camelize(row)),
    meta: pageMeta(page, limit, total),
  });
});

biblePublicRouter.get('/featured', async (_req, res) => {
  const passage = await getFeaturedBiblePassage();
  if (!passage) throw new AppError(404, 'FEATURED_BIBLE_PASSAGE_NOT_FOUND', 'Passage biblique d’accueil introuvable.');
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.json({ success: true, data: passage });
});

bibleAdminRouter.get('/status', requirePermission('bible.view'), async (_req, res) => {
  const [translations, featured] = await Promise.all([
    pool.query(
      `SELECT ${translationFields}, is_active
       FROM papaleki.bible_translations
       ORDER BY language_name`,
    ),
    getFeaturedBiblePassage(),
  ]);
  res.json({ success: true, data: { translations: camelize(translations.rows), featured } });
});

bibleAdminRouter.put('/featured', requirePermission('bible.manage'), validate(featuredBiblePassageSchema), async (req, res) => {
  const body = req.body as {
    translationCode: string; bookCode: string; chapter: number; verseStart: number; verseEnd: number;
  };
  const exists = await pool.query(
    `SELECT 1
     FROM papaleki.bible_translations t
     JOIN papaleki.bible_verses v ON v.translation_id = t.id
     WHERE t.code = $1 AND v.book_code = $2 AND v.chapter = $3
       AND v.verse_start BETWEEN $4 AND $5
       AND t.is_active = true AND t.is_complete = true
     LIMIT 1`,
    [body.translationCode, body.bookCode, body.chapter, body.verseStart, body.verseEnd],
  );
  if (!exists.rowCount) throw new AppError(400, 'INVALID_BIBLE_PASSAGE', 'Le passage choisi n’existe pas dans cette traduction.');
  await pool.query(
    `INSERT INTO papaleki.site_settings
       (setting_key, setting_group, value, description, is_public, updated_by)
     VALUES ('bible.featured_passage', 'bible', $1::jsonb,
             'Passage biblique affiché sur la page d’accueil.', true, $2)
     ON CONFLICT (setting_key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(body), req.auth!.userId],
  );
  res.json({ success: true, data: await getFeaturedBiblePassage(), message: 'Passage d’accueil mis à jour.' });
});

bibleAdminRouter.post('/import', requirePermission('bible.manage'), async (_req, res) => {
  await importBibleTranslations(pool);
  const result = await pool.query(
    `SELECT ${translationFields}, is_active
     FROM papaleki.bible_translations
     ORDER BY language_name`,
  );
  res.json({ success: true, data: camelize(result.rows), message: 'Traductions bibliques synchronisées.' });
});

