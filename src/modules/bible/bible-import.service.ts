import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import type { Pool, PoolClient } from 'pg';

const unzip = promisify(gunzip);

export type BibleVerseImport = {
  bookCode: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
};

const bookCodes = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI',
  '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SOL', 'ISA', 'JER',
  'LAM', 'EZE', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAH', 'HAB', 'ZEP',
  'HAG', 'ZEC', 'MAL', 'MAT', 'MAR', 'LUK', 'JOH', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
  'EPH', 'PHI', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAM', '1PE',
  '2PE', '1JO', '2JO', '3JO', 'JUD', 'REV',
] as const;

const bookNames: Record<string, readonly string[]> = {
  fraLSG: [
    'Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome', 'Josué', 'Juges', 'Ruth',
    '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras',
    'Néhémie', 'Esther', 'Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des cantiques',
    'Ésaïe', 'Jérémie', 'Lamentations', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias',
    'Jonas', 'Michée', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie',
    'Matthieu', 'Marc', 'Luc', 'Jean', 'Actes', 'Romains', '1 Corinthiens', '2 Corinthiens',
    'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Thessaloniciens',
    '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux', 'Jacques', '1 Pierre', '2 Pierre',
    '1 Jean', '2 Jean', '3 Jean', 'Jude', 'Apocalypse',
  ],
  engwebp: [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah',
    'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
    'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation',
  ],
  swhulb: [
    'Mwanzo', 'Kutoka', 'Mambo ya Walawi', 'Hesabu', 'Kumbukumbu la Torati', 'Yoshua',
    'Waamuzi', 'Ruth', '1 Samweli', '2 Samweli', '1 Wafalme', '2 Wafalme',
    '1 Mambo ya Nyakati', '2 Mambo ya Nyakati', 'Ezra', 'Nehemia', 'Esta', 'Ayubu', 'Zaburi',
    'Mithali', 'Mhubiri', 'Wimbo wa Sulemani', 'Isaya', 'Yeremia', 'Maombolezo', 'Ezekieli',
    'Danieli', 'Hosea', 'Joeli', 'Amosi', 'Obadia', 'Yona', 'Mika', 'Nahumu', 'Habakuki',
    'Sefania', 'Hagai', 'Zekaria', 'Malaki', 'Mathayo', 'Marko', 'Luka', 'Yohana',
    'Matendo ya Mitume', 'Warumi', '1 Wakorintho', '2 Wakorintho', 'Wagalatia', 'Waefeso',
    'Wafilipi', 'Wakolosai', '1 Wathesalonike', '2 Wathesalonike', '1 Timotheo', '2 Timotheo',
    'Tito', 'Filemoni', 'Wahebrania', 'Yakobo', '1 Petro', '2 Petro', '1 Yohana', '2 Yohana',
    '3 Yohana', 'Yuda', 'Ufunuo',
  ],
};

const sources = [
  {
    code: 'fraLSG', file: 'fraLSG.vpl.txt.gz', expectedVerseCount: 31_170,
    languageCode: 'fr', languageName: 'Français', title: 'Louis Segond 1910', abbreviation: 'LSG 1910',
    sourceUrl: 'https://ebible.org/bible/details.php?id=fraLSG', licenseName: 'Domaine public',
    copyrightNotice: 'Cette Bible est dans le domaine public.',
    attribution: 'Louis Segond 1910 — domaine public. Texte fourni par eBible.org.',
  },
  {
    code: 'engwebp', file: 'engwebp.vpl.txt.gz', expectedVerseCount: 31_098,
    languageCode: 'en', languageName: 'English', title: 'World English Bible', abbreviation: 'WEB',
    sourceUrl: 'https://ebible.org/bible/details.php?id=engwebp', licenseName: 'Public Domain',
    copyrightNotice: 'The World English Bible text is in the Public Domain. “World English Bible” is a trademark of eBible.org.',
    attribution: 'World English Bible — Public Domain. Source: eBible.org.',
  },
  {
    code: 'swhulb', file: 'swhulb.vpl.txt.gz', expectedVerseCount: 31_101,
    languageCode: 'sw', languageName: 'Kiswahili', title: 'Biblia Takatifu', abbreviation: 'SWH-ULB',
    sourceUrl: 'https://ebible.org/bible/details.php?id=swhulb', licenseName: 'CC BY-SA 4.0',
    copyrightNotice: 'Copyright © 2019 Door43 World Missions Community.',
    attribution: 'Swahili Unlocked Literal Bible, Door43 World Missions Community — CC BY-SA 4.0. Source: eBible.org.',
  },
] as const;

export const parseVpl = (content: string): BibleVerseImport[] => content
  .split(/\r?\n/)
  .map((line) => line.match(/^([1-3A-Z]{3}) (\d+):(\d+)(?:-(\d+))?\s*(.*)$/))
  .filter((match): match is RegExpMatchArray => Boolean(match?.[5]?.trim()))
  .map((match) => ({
    bookCode: match[1],
    chapter: Number(match[2]),
    verseStart: Number(match[3]),
    verseEnd: Number(match[4] ?? match[3]),
    text: match[5].trim(),
  }));

const insertBookNames = async (client: PoolClient, translationId: string, sourceCode: string) => {
  const names = bookNames[sourceCode];
  if (!names || names.length !== bookCodes.length) {
    throw new Error(`Noms de livres incomplets pour ${sourceCode}.`);
  }
  await client.query(
    `INSERT INTO papaleki.bible_book_names (translation_id, book_code, name, short_name)
     SELECT $1::uuid, book_code, book_name, book_name
     FROM unnest($2::text[], $3::text[]) AS source(book_code, book_name)
     ON CONFLICT (translation_id, book_code) DO UPDATE SET
       name = EXCLUDED.name,
       short_name = EXCLUDED.short_name`,
    [translationId, bookCodes, names],
  );
};

const insertVerseBatch = async (client: PoolClient, translationId: string, verses: BibleVerseImport[]) => {
  await client.query(
    `INSERT INTO papaleki.bible_verses
       (translation_id, book_code, chapter, verse_start, verse_end, verse_text)
     SELECT $1::uuid, book_code, chapter, verse_start, verse_end, verse_text
     FROM unnest(
       $2::text[], $3::smallint[], $4::smallint[], $5::smallint[], $6::text[]
     ) AS source(book_code, chapter, verse_start, verse_end, verse_text)
     ON CONFLICT (translation_id, book_code, chapter, verse_start) DO UPDATE SET
       verse_end = EXCLUDED.verse_end,
       verse_text = EXCLUDED.verse_text`,
    [
      translationId,
      verses.map((verse) => verse.bookCode),
      verses.map((verse) => verse.chapter),
      verses.map((verse) => verse.verseStart),
      verses.map((verse) => verse.verseEnd),
      verses.map((verse) => verse.text),
    ],
  );
};

export const importBibleTranslations = async (pool: Pool): Promise<void> => {
  for (const source of sources) {
    const metadata = await pool.query<{ id: string; is_complete: boolean; verse_count: number }>(
      `INSERT INTO papaleki.bible_translations
         (code, language_code, language_name, title, abbreviation, source_url,
          license_name, copyright_notice, attribution, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (code) DO UPDATE SET
         language_code = EXCLUDED.language_code,
         language_name = EXCLUDED.language_name,
         title = EXCLUDED.title,
         abbreviation = EXCLUDED.abbreviation,
         source_url = EXCLUDED.source_url,
         license_name = EXCLUDED.license_name,
         copyright_notice = EXCLUDED.copyright_notice,
         attribution = EXCLUDED.attribution
       RETURNING id, is_complete, verse_count`,
      [
        source.code, source.languageCode, source.languageName, source.title, source.abbreviation,
        source.sourceUrl, source.licenseName, source.copyrightNotice, source.attribution,
      ],
    );
    const translation = metadata.rows[0];
    if (!translation) throw new Error(`Impossible de préparer la traduction ${source.code}.`);

    if (translation.is_complete && translation.verse_count >= source.expectedVerseCount) {
      console.log(`[bible] ${source.code} déjà synchronisée (${translation.verse_count} versets).`);
      continue;
    }

    const filePath = path.resolve(process.cwd(), 'database', 'bible-sources', source.file);
    const content = (await unzip(await readFile(filePath))).toString('utf8');
    const verses = parseVpl(content);
    if (verses.length < source.expectedVerseCount) {
      throw new Error(`Source biblique incomplète pour ${source.code}: ${verses.length} versets.`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM papaleki.bible_verses WHERE translation_id = $1', [translation.id]);
      await insertBookNames(client, translation.id, source.code);
      for (let start = 0; start < verses.length; start += 1_000) {
        await insertVerseBatch(client, translation.id, verses.slice(start, start + 1_000));
      }
      await client.query(
        `UPDATE papaleki.bible_translations
         SET is_complete = true, verse_count = $2, imported_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [translation.id, verses.length],
      );
      await client.query('COMMIT');
      console.log(`[bible] ${source.code} synchronisée (${verses.length} versets).`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

