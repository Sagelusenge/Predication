import type { Pool } from 'pg';
import { pool } from '../../db/pool.js';
import { camelize } from '../../lib/serialize.js';

export type FeaturedBiblePassage = {
  translation: Record<string, unknown>;
  book: Record<string, unknown>;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  reference: string;
  text: string;
  verses: Array<Record<string, unknown>>;
};

export const getFeaturedBiblePassage = async (database: Pool = pool): Promise<FeaturedBiblePassage | null> => {
  const result = await database.query(
    `WITH featured AS (
       SELECT
         value ->> 'translationCode' AS translation_code,
         value ->> 'bookCode' AS book_code,
         (value ->> 'chapter')::smallint AS chapter,
         (value ->> 'verseStart')::smallint AS verse_start,
         (value ->> 'verseEnd')::smallint AS verse_end
       FROM papaleki.site_settings
       WHERE setting_key = 'bible.featured_passage'
     )
     SELECT
       t.code AS translation_code, t.language_code, t.language_name,
       t.title AS translation_title, t.abbreviation, t.license_name,
       t.attribution, t.source_url,
       b.code AS book_code, bn.name AS book_name, b.testament,
       f.chapter, f.verse_start AS configured_verse_start,
       f.verse_end AS configured_verse_end,
       v.verse_start, v.verse_end, v.verse_text
     FROM featured f
     JOIN papaleki.bible_translations t
       ON t.code = f.translation_code AND t.is_active = true AND t.is_complete = true
     JOIN papaleki.bible_books b ON b.code = f.book_code
     JOIN papaleki.bible_book_names bn
       ON bn.translation_id = t.id AND bn.book_code = b.code
     JOIN papaleki.bible_verses v
       ON v.translation_id = t.id
      AND v.book_code = b.code
      AND v.chapter = f.chapter
      AND v.verse_start BETWEEN f.verse_start AND f.verse_end
     ORDER BY v.verse_start`,
  );
  const first = result.rows[0];
  if (!first) return null;
  const verses = result.rows.map((row) => ({
    verseStart: Number(row.verse_start),
    verseEnd: Number(row.verse_end),
    text: row.verse_text,
  }));
  const verseStart = Number(first.configured_verse_start);
  const verseEnd = Number(first.configured_verse_end);
  return {
    translation: camelize({
      code: first.translation_code,
      language_code: first.language_code,
      language_name: first.language_name,
      title: first.translation_title,
      abbreviation: first.abbreviation,
      license_name: first.license_name,
      attribution: first.attribution,
      source_url: first.source_url,
    }),
    book: camelize({ code: first.book_code, name: first.book_name, testament: first.testament }),
    chapter: Number(first.chapter),
    verseStart,
    verseEnd,
    reference: `${first.book_name} ${first.chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`,
    text: verses.map((verse) => verse.text).join(' '),
    verses,
  };
};

export const getDailyFrenchBiblePassage = async (
  localDate?: string,
  database: Pool = pool,
): Promise<FeaturedBiblePassage | null> => {
  const result = await database.query(
    `SELECT
       t.code AS translation_code, t.language_code, t.language_name,
       t.title AS translation_title, t.abbreviation, t.license_name,
       t.attribution, t.source_url,
       b.code AS book_code, bn.name AS book_name, b.testament,
       v.chapter, v.verse_start, v.verse_end, v.verse_text
     FROM papaleki.bible_translations t
     JOIN papaleki.bible_verses v ON v.translation_id = t.id
     JOIN papaleki.bible_books b ON b.code = v.book_code
     JOIN papaleki.bible_book_names bn
       ON bn.translation_id = t.id AND bn.book_code = b.code
     WHERE t.code = 'fraLSG' AND t.is_active = true AND t.is_complete = true
       AND length(v.verse_text) BETWEEN 45 AND 260
     ORDER BY md5(coalesce($1::text,
       to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi', 'YYYY-MM-DD'))
       || ':' || v.book_code || ':' || v.chapter || ':' || v.verse_start)
     LIMIT 1`,
    [localDate ?? null],
  );
  const row = result.rows[0];
  if (!row) return null;
  const verseStart = Number(row.verse_start);
  const verseEnd = Number(row.verse_end);
  return {
    translation: camelize({
      code: row.translation_code,
      language_code: row.language_code,
      language_name: row.language_name,
      title: row.translation_title,
      abbreviation: row.abbreviation,
      license_name: row.license_name,
      attribution: row.attribution,
      source_url: row.source_url,
    }),
    book: camelize({ code: row.book_code, name: row.book_name, testament: row.testament }),
    chapter: Number(row.chapter),
    verseStart,
    verseEnd,
    reference: `${row.book_name} ${row.chapter}:${verseStart}${verseEnd > verseStart ? `-${verseEnd}` : ''}`,
    text: row.verse_text,
    verses: [{ verseStart, verseEnd, text: row.verse_text }],
  };
};

