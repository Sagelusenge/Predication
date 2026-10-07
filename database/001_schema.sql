BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS papaleki;
SET search_path TO papaleki, public;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('invited', 'active', 'suspended', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE media_kind AS ENUM ('audio', 'image', 'document');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE media_status AS ENUM ('uploaded', 'queued', 'processing', 'ready', 'failed', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE processing_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sermon_status AS ENUM ('draft', 'processing', 'ready', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE content_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE contact_status AS ENUM ('unread', 'read', 'replied', 'archived', 'spam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sermon_event_type AS ENUM ('play_start', 'progress', 'complete', 'download', 'share');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               citext NOT NULL UNIQUE,
    password_hash       text,
    first_name          varchar(100) NOT NULL,
    last_name           varchar(100) NOT NULL,
    avatar_media_id     uuid,
    status              user_status NOT NULL DEFAULT 'invited',
    locale              varchar(10) NOT NULL DEFAULT 'fr',
    timezone            varchar(100) NOT NULL DEFAULT 'Africa/Lubumbashi',
    last_login_at       timestamptz,
    failed_login_count  integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          timestamptz,
    CONSTRAINT users_active_password_ck
        CHECK (status <> 'active' OR password_hash IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS roles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(60) NOT NULL UNIQUE,
    name            varchar(120) NOT NULL,
    description     text,
    is_system       boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(100) NOT NULL UNIQUE,
    name            varchar(150) NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    granted_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          text NOT NULL UNIQUE,
    refresh_token_hash  text UNIQUE,
    ip_address          inet,
    user_agent          text,
    expires_at          timestamptz NOT NULL,
    refresh_expires_at  timestamptz,
    last_seen_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          timestamptz,
    revoke_reason       varchar(255),
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT auth_sessions_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT auth_sessions_refresh_expiry_ck
        CHECK (refresh_expires_at IS NULL OR refresh_expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      text NOT NULL UNIQUE,
    expires_at      timestamptz NOT NULL,
    used_at         timestamptz,
    requested_ip    inet,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT password_reset_expiry_ck CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS user_invitation_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    token_hash      text NOT NULL UNIQUE,
    invited_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at      timestamptz NOT NULL,
    accepted_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_invitation_expiry_ck CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS auth_events (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    email           citext,
    event_name      varchar(80) NOT NULL,
    succeeded       boolean NOT NULL,
    ip_address      inet,
    user_agent      text,
    details         jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                media_kind NOT NULL,
    processing_status   media_status NOT NULL DEFAULT 'uploaded',
    storage_provider    varchar(50) NOT NULL DEFAULT 'local',
    storage_key         text NOT NULL UNIQUE,
    original_filename   text NOT NULL,
    mime_type           varchar(150) NOT NULL,
    file_size_bytes     bigint NOT NULL CHECK (file_size_bytes > 0),
    checksum_sha256     char(64),
    duration_seconds    numeric(12,3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    width_pixels        integer CHECK (width_pixels IS NULL OR width_pixels > 0),
    height_pixels       integer CHECK (height_pixels IS NULL OR height_pixels > 0),
    alt_text            varchar(255),
    caption             text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    processing_error    text,
    uploaded_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          timestamptz,
    CONSTRAINT media_dimensions_ck CHECK (
        kind <> 'image'
        OR processing_status <> 'ready'
        OR (width_pixels IS NOT NULL AND height_pixels IS NOT NULL)
    ),
    CONSTRAINT media_audio_duration_ck CHECK (
        kind <> 'audio' OR duration_seconds IS NULL OR duration_seconds > 0
    )
);

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_avatar_media_fk;
ALTER TABLE users
    ADD CONSTRAINT users_avatar_media_fk
    FOREIGN KEY (avatar_media_id) REFERENCES media_files(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS audio_processing_jobs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_file_id       uuid NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    status              processing_status NOT NULL DEFAULT 'queued',
    priority            smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    progress_percent    smallint NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    attempt_count       smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts        smallint NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
    worker_name         varchar(120),
    operations          jsonb NOT NULL DEFAULT '["validate", "normalize", "transcode", "waveform"]'::jsonb,
    result              jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message       text,
    queued_at           timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at          timestamptz,
    completed_at        timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audio_job_attempts_ck CHECK (attempt_count <= max_attempts)
);

CREATE TABLE IF NOT EXISTS preachers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    display_name    varchar(180) NOT NULL,
    title           varchar(120),
    biography       text,
    church_name     varchar(180),
    photo_media_id  uuid REFERENCES media_files(id) ON DELETE SET NULL,
    is_primary      boolean NOT NULL DEFAULT false,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sermon_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(120) NOT NULL UNIQUE,
    slug            varchar(150) NOT NULL UNIQUE,
    description     text,
    display_order   integer NOT NULL DEFAULT 0,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sermon_series (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           varchar(180) NOT NULL,
    slug            varchar(200) NOT NULL UNIQUE,
    description     text,
    cover_media_id  uuid REFERENCES media_files(id) ON DELETE SET NULL,
    start_date      date,
    end_date        date,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sermon_series_dates_ck
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS sermons (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   varchar(220) NOT NULL,
    slug                    varchar(240) NOT NULL UNIQUE,
    excerpt                 varchar(500),
    description             text,
    scripture_reference     varchar(255),
    preacher_id             uuid NOT NULL REFERENCES preachers(id) ON DELETE RESTRICT,
    category_id             uuid REFERENCES sermon_categories(id) ON DELETE SET NULL,
    series_id               uuid REFERENCES sermon_series(id) ON DELETE SET NULL,
    audio_media_id          uuid REFERENCES media_files(id) ON DELETE RESTRICT,
    cover_media_id          uuid REFERENCES media_files(id) ON DELETE SET NULL,
    preached_on             date NOT NULL DEFAULT CURRENT_DATE,
    duration_seconds        numeric(12,3) CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    status                  sermon_status NOT NULL DEFAULT 'draft',
    is_featured             boolean NOT NULL DEFAULT false,
    allow_download          boolean NOT NULL DEFAULT true,
    scheduled_for           timestamptz,
    published_at            timestamptz,
    archived_at             timestamptz,
    play_count              bigint NOT NULL DEFAULT 0 CHECK (play_count >= 0),
    like_count              bigint NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    completion_count        bigint NOT NULL DEFAULT 0 CHECK (completion_count >= 0),
    download_count          bigint NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    share_count             bigint NOT NULL DEFAULT 0 CHECK (share_count >= 0),
    total_listen_seconds    bigint NOT NULL DEFAULT 0 CHECK (total_listen_seconds >= 0),
    search_vector           tsvector GENERATED ALWAYS AS (
        to_tsvector(
            'french',
            coalesce(title, '') || ' ' ||
            coalesce(excerpt, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(scripture_reference, '')
        )
    ) STORED,
    created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by              uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sermons_schedule_ck CHECK (
        status <> 'scheduled' OR scheduled_for IS NOT NULL
    ),
    CONSTRAINT sermons_publish_ck CHECK (
        status <> 'published' OR published_at IS NOT NULL
    )
);

ALTER TABLE sermons
    ADD COLUMN IF NOT EXISTS like_count bigint NOT NULL DEFAULT 0 CHECK (like_count >= 0);

CREATE TABLE IF NOT EXISTS sermon_likes (
    sermon_id       uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    visitor_hash    varchar(128) NOT NULL,
    liked_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sermon_id, visitor_hash)
);

CREATE TABLE IF NOT EXISTS sermon_tags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(80) NOT NULL UNIQUE,
    slug            varchar(100) NOT NULL UNIQUE,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sermon_tag_links (
    sermon_id       uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    tag_id          uuid NOT NULL REFERENCES sermon_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (sermon_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sermon_events (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sermon_id           uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    event_type          sermon_event_type NOT NULL,
    visitor_hash        varchar(128),
    session_identifier  varchar(128),
    seconds_listened    integer NOT NULL DEFAULT 0 CHECK (seconds_listened >= 0),
    progress_percent    numeric(5,2) CHECK (
        progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100
    ),
    device_type         varchar(30),
    country_code        char(2),
    city                varchar(120),
    referrer            text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sermon_daily_listeners (
    stats_date      date NOT NULL,
    sermon_id       uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    visitor_hash    varchar(128) NOT NULL,
    first_seen_at   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stats_date, sermon_id, visitor_hash)
);

CREATE TABLE IF NOT EXISTS sermon_daily_stats (
    stats_date              date NOT NULL,
    sermon_id               uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    play_starts             bigint NOT NULL DEFAULT 0 CHECK (play_starts >= 0),
    unique_listeners        bigint NOT NULL DEFAULT 0 CHECK (unique_listeners >= 0),
    completions             bigint NOT NULL DEFAULT 0 CHECK (completions >= 0),
    downloads               bigint NOT NULL DEFAULT 0 CHECK (downloads >= 0),
    shares                  bigint NOT NULL DEFAULT 0 CHECK (shares >= 0),
    total_listen_seconds    bigint NOT NULL DEFAULT 0 CHECK (total_listen_seconds >= 0),
    updated_at              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stats_date, sermon_id)
);

CREATE TABLE IF NOT EXISTS pages (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                varchar(160) NOT NULL UNIQUE,
    title               varchar(220) NOT NULL,
    navigation_label    varchar(100),
    content             jsonb NOT NULL DEFAULT '{}'::jsonb,
    meta_title          varchar(255),
    meta_description    varchar(500),
    cover_media_id      uuid REFERENCES media_files(id) ON DELETE SET NULL,
    status              content_status NOT NULL DEFAULT 'draft',
    display_order       integer NOT NULL DEFAULT 0,
    show_in_navigation  boolean NOT NULL DEFAULT true,
    scheduled_for       timestamptz,
    published_at        timestamptz,
    created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pages_schedule_ck CHECK (
        status <> 'scheduled' OR scheduled_for IS NOT NULL
    ),
    CONSTRAINT pages_publish_ck CHECK (
        status <> 'published' OR published_at IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS testimonials (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name     varchar(150) NOT NULL,
    author_role     varchar(150),
    quote           text NOT NULL,
    photo_media_id  uuid REFERENCES media_files(id) ON DELETE SET NULL,
    status          content_status NOT NULL DEFAULT 'draft',
    display_order   integer NOT NULL DEFAULT 0,
    published_at    timestamptz,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       varchar(180) NOT NULL,
    email           citext NOT NULL,
    phone           varchar(40),
    subject         varchar(220) NOT NULL,
    message         text NOT NULL,
    status          contact_status NOT NULL DEFAULT 'unread',
    assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
    source_ip       inet,
    user_agent      text,
    read_at         timestamptz,
    replied_at      timestamptz,
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    setting_key     varchar(160) PRIMARY KEY,
    setting_group   varchar(80) NOT NULL DEFAULT 'general',
    value           jsonb NOT NULL,
    description     text,
    is_public       boolean NOT NULL DEFAULT false,
    updated_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          varchar(30) NOT NULL,
    entity_type     varchar(100) NOT NULL,
    entity_id       uuid,
    old_data        jsonb,
    new_data        jsonb,
    request_id      uuid,
    ip_address      inet,
    occurred_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_status_active
    ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_active
    ON auth_sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_active
    ON password_reset_tokens (user_id, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitation_active
    ON user_invitation_tokens (user_id, expires_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_events_email_time
    ON auth_events (email, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_kind_status
    ON media_files (kind, processing_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_checksum
    ON media_files (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_processing_active_job
    ON audio_processing_jobs (media_file_id)
    WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_audio_jobs_queue
    ON audio_processing_jobs (priority DESC, queued_at)
    WHERE status = 'queued';
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_preacher
    ON preachers (is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_sermons_publication
    ON sermons (published_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_sermons_status_schedule
    ON sermons (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sermons_preacher_date
    ON sermons (preacher_id, preached_on DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_category_date
    ON sermons (category_id, preached_on DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_series_date
    ON sermons (series_id, preached_on DESC);
CREATE INDEX IF NOT EXISTS idx_sermons_search
    ON sermons USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_sermon_events_sermon_time
    ON sermon_events (sermon_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sermon_events_time_type
    ON sermon_events (occurred_at DESC, event_type);
CREATE INDEX IF NOT EXISTS idx_sermon_likes_created
    ON sermon_likes (liked_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date
    ON sermon_daily_stats (stats_date DESC);
CREATE INDEX IF NOT EXISTS idx_pages_navigation
    ON pages (display_order, title) WHERE status = 'published' AND show_in_navigation = true;
CREATE INDEX IF NOT EXISTS idx_contact_messages_inbox
    ON contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_logs (actor_id, occurred_at DESC);

COMMENT ON SCHEMA papaleki IS 'Données du site pastoral PapaLeki.';
COMMENT ON TABLE sermons IS 'Prédications audio et cycle éditorial.';
COMMENT ON TABLE sermon_events IS 'Événements analytiques pseudonymisés liés aux prédications.';
COMMENT ON COLUMN sermon_events.visitor_hash IS 'Empreinte pseudonyme calculée par l’application; ne jamais stocker une donnée personnelle brute.';
COMMENT ON TABLE audit_logs IS 'Historique des modifications administratives; les secrets en sont exclus par les triggers.';

COMMIT;
