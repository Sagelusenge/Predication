BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

SET search_path TO papaleki, public;

CREATE TABLE IF NOT EXISTS bible_translations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                varchar(30) NOT NULL UNIQUE,
    language_code       varchar(10) NOT NULL,
    language_name       varchar(80) NOT NULL,
    title               varchar(180) NOT NULL,
    abbreviation        varchar(30) NOT NULL,
    source_url          text NOT NULL,
    license_name        varchar(120) NOT NULL,
    copyright_notice    text,
    attribution         text NOT NULL,
    access_mode         varchar(12) NOT NULL DEFAULT 'database'
                            CHECK (access_mode IN ('database', 'external')),
    external_url        text,
    text_direction      varchar(3) NOT NULL DEFAULT 'ltr'
                            CHECK (text_direction IN ('ltr', 'rtl')),
    is_active           boolean NOT NULL DEFAULT true,
    is_complete         boolean NOT NULL DEFAULT false,
    verse_count         integer NOT NULL DEFAULT 0 CHECK (verse_count >= 0),
    imported_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bible_translations
    ADD COLUMN IF NOT EXISTS access_mode varchar(12) NOT NULL DEFAULT 'database',
    ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE bible_translations DROP CONSTRAINT IF EXISTS bible_translations_access_mode_check;
ALTER TABLE bible_translations
    ADD CONSTRAINT bible_translations_access_mode_check
    CHECK (access_mode IN ('database', 'external'));

CREATE TABLE IF NOT EXISTS bible_books (
    code                varchar(3) PRIMARY KEY,
    canonical_order     smallint NOT NULL UNIQUE CHECK (canonical_order BETWEEN 1 AND 66),
    testament           varchar(3) NOT NULL CHECK (testament IN ('old', 'new')),
    chapter_count       smallint NOT NULL CHECK (chapter_count > 0)
);

CREATE TABLE IF NOT EXISTS bible_book_names (
    translation_id      uuid NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
    book_code           varchar(3) NOT NULL REFERENCES bible_books(code) ON DELETE CASCADE,
    name                varchar(120) NOT NULL,
    short_name          varchar(60) NOT NULL,
    PRIMARY KEY (translation_id, book_code)
);

CREATE TABLE IF NOT EXISTS bible_verses (
    translation_id      uuid NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
    book_code           varchar(3) NOT NULL REFERENCES bible_books(code) ON DELETE CASCADE,
    chapter             smallint NOT NULL CHECK (chapter > 0),
    verse_start         smallint NOT NULL CHECK (verse_start > 0),
    verse_end           smallint NOT NULL CHECK (verse_end >= verse_start),
    verse_text          text NOT NULL CHECK (length(trim(verse_text)) > 0),
    PRIMARY KEY (translation_id, book_code, chapter, verse_start)
);

CREATE INDEX IF NOT EXISTS idx_bible_book_names_translation
    ON bible_book_names (translation_id, book_code);
CREATE INDEX IF NOT EXISTS idx_bible_verses_chapter
    ON bible_verses (translation_id, book_code, chapter, verse_start);
CREATE INDEX IF NOT EXISTS idx_bible_verses_search
    ON bible_verses USING gin (verse_text gin_trgm_ops);

INSERT INTO bible_books (code, canonical_order, testament, chapter_count)
VALUES
    ('GEN', 1, 'old', 50), ('EXO', 2, 'old', 40), ('LEV', 3, 'old', 27),
    ('NUM', 4, 'old', 36), ('DEU', 5, 'old', 34), ('JOS', 6, 'old', 24),
    ('JDG', 7, 'old', 21), ('RUT', 8, 'old', 4), ('1SA', 9, 'old', 31),
    ('2SA', 10, 'old', 24), ('1KI', 11, 'old', 22), ('2KI', 12, 'old', 25),
    ('1CH', 13, 'old', 29), ('2CH', 14, 'old', 36), ('EZR', 15, 'old', 10),
    ('NEH', 16, 'old', 13), ('EST', 17, 'old', 10), ('JOB', 18, 'old', 42),
    ('PSA', 19, 'old', 150), ('PRO', 20, 'old', 31), ('ECC', 21, 'old', 12),
    ('SOL', 22, 'old', 8), ('ISA', 23, 'old', 66), ('JER', 24, 'old', 52),
    ('LAM', 25, 'old', 5), ('EZE', 26, 'old', 48), ('DAN', 27, 'old', 12),
    ('HOS', 28, 'old', 14), ('JOE', 29, 'old', 3), ('AMO', 30, 'old', 9),
    ('OBA', 31, 'old', 1), ('JON', 32, 'old', 4), ('MIC', 33, 'old', 7),
    ('NAH', 34, 'old', 3), ('HAB', 35, 'old', 3), ('ZEP', 36, 'old', 3),
    ('HAG', 37, 'old', 2), ('ZEC', 38, 'old', 14), ('MAL', 39, 'old', 4),
    ('MAT', 40, 'new', 28), ('MAR', 41, 'new', 16), ('LUK', 42, 'new', 24),
    ('JOH', 43, 'new', 21), ('ACT', 44, 'new', 28), ('ROM', 45, 'new', 16),
    ('1CO', 46, 'new', 16), ('2CO', 47, 'new', 13), ('GAL', 48, 'new', 6),
    ('EPH', 49, 'new', 6), ('PHI', 50, 'new', 4), ('COL', 51, 'new', 4),
    ('1TH', 52, 'new', 5), ('2TH', 53, 'new', 3), ('1TI', 54, 'new', 6),
    ('2TI', 55, 'new', 4), ('TIT', 56, 'new', 3), ('PHM', 57, 'new', 1),
    ('HEB', 58, 'new', 13), ('JAM', 59, 'new', 5), ('1PE', 60, 'new', 5),
    ('2PE', 61, 'new', 3), ('1JO', 62, 'new', 5), ('2JO', 63, 'new', 1),
    ('3JO', 64, 'new', 1), ('JUD', 65, 'new', 1), ('REV', 66, 'new', 22)
ON CONFLICT (code) DO UPDATE SET
    canonical_order = EXCLUDED.canonical_order,
    testament = EXCLUDED.testament,
    chapter_count = EXCLUDED.chapter_count;

INSERT INTO permissions (code, name, description)
VALUES
    ('bible.view', 'Voir la Bible', 'Consulter les traductions bibliques dans l’administration.'),
    ('bible.manage', 'Gérer la Bible', 'Configurer le passage d’accueil et synchroniser les traductions.')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'administrator')
  AND p.code IN ('bible.view', 'bible.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('editor', 'analyst')
  AND p.code = 'bible.view'
ON CONFLICT DO NOTHING;

INSERT INTO site_settings (setting_key, setting_group, value, description, is_public)
VALUES (
    'bible.featured_passage',
    'bible',
    '{"translationCode":"fraLSG","bookCode":"JOH","chapter":3,"verseStart":16,"verseEnd":16}'::jsonb,
    'Passage biblique affiché sur la page d’accueil.',
    true
)
ON CONFLICT (setting_key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_bible_translations_touch_updated_at ON bible_translations;
CREATE TRIGGER trg_bible_translations_touch_updated_at
BEFORE UPDATE ON bible_translations
FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

COMMENT ON TABLE bible_translations IS 'Métadonnées, licence et statut des traductions bibliques.';
COMMENT ON TABLE bible_verses IS 'Texte biblique importé depuis les sources eBible autorisées.';

COMMIT;
