BEGIN;

SET search_path TO papaleki, public;

CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_slugify(p_value text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(
            trim(BOTH '-' FROM regexp_replace(
                lower(unaccent(coalesce(p_value, ''))),
                '[^a-z0-9]+',
                '-',
                'g'
            )),
            ''
        ),
        'element'
    );
$$;

CREATE OR REPLACE FUNCTION fn_assign_unique_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_source_value text;
    v_base         text;
    v_candidate    text;
    v_exists       boolean;
    v_suffix       integer := 1;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.slug IS NOT DISTINCT FROM OLD.slug THEN
        RETURN NEW;
    END IF;

    v_source_value := COALESCE(NULLIF(NEW.slug, ''), to_jsonb(NEW) ->> TG_ARGV[0]);
    v_base := fn_slugify(v_source_value);
    v_candidate := v_base;

    LOOP
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE slug = $1 AND id <> $2)',
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME
        ) INTO v_exists USING v_candidate, NEW.id;

        EXIT WHEN NOT v_exists;
        v_suffix := v_suffix + 1;
        v_candidate := v_base || '-' || v_suffix::text;
    END LOOP;

    NEW.slug := v_candidate;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_normalize_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.email := lower(trim(NEW.email::text))::citext;
    NEW.first_name := trim(NEW.first_name);
    NEW.last_name := trim(NEW.last_name);

    IF NEW.password_hash IS NOT NULL AND length(NEW.password_hash) < 20 THEN
        RAISE EXCEPTION 'Le mot de passe doit être transmis sous forme de hash sécurisé.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_user_has_permission(p_user_id uuid, p_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = p_user_id
          AND u.status = 'active'
          AND u.deleted_at IS NULL
          AND (r.code = 'super_admin' OR p.code = p_permission_code)
    );
$$;

CREATE OR REPLACE FUNCTION fn_protect_last_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_code text;
    v_user_active boolean;
    v_active_super_admins bigint;
BEGIN
    SELECT r.code, (u.status = 'active' AND u.deleted_at IS NULL)
    INTO v_role_code, v_user_active
    FROM roles r
    JOIN users u ON u.id = OLD.user_id
    WHERE r.id = OLD.role_id;

    IF v_role_code = 'super_admin' AND v_user_active THEN
        PERFORM pg_advisory_xact_lock(hashtext('papaleki.last_super_admin'));

        SELECT count(*)
        INTO v_active_super_admins
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id AND r.code = 'super_admin'
        JOIN users u ON u.id = ur.user_id
        WHERE u.status = 'active' AND u.deleted_at IS NULL;

        IF v_active_super_admins <= 1 THEN
            RAISE EXCEPTION 'Impossible de retirer le dernier super administrateur actif.';
        END IF;
    END IF;

    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION fn_protect_last_super_admin_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_super_admin boolean;
    v_active_super_admins bigint;
BEGIN
    IF OLD.status = 'active'
       AND OLD.deleted_at IS NULL
       AND (NEW.status <> 'active' OR NEW.deleted_at IS NOT NULL) THEN

        SELECT EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = OLD.id AND r.code = 'super_admin'
        ) INTO v_is_super_admin;

        IF v_is_super_admin THEN
            PERFORM pg_advisory_xact_lock(hashtext('papaleki.last_super_admin'));

            SELECT count(*)
            INTO v_active_super_admins
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id AND r.code = 'super_admin'
            JOIN users u ON u.id = ur.user_id
            WHERE u.status = 'active' AND u.deleted_at IS NULL;

            IF v_active_super_admins <= 1 THEN
                RAISE EXCEPTION 'Impossible de désactiver le dernier super administrateur actif.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La suppression physique d’un utilisateur est interdite; utilisez la désactivation.';
END;
$$;

CREATE OR REPLACE FUNCTION fn_media_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_protected boolean;
BEGIN
    NEW.original_filename := trim(NEW.original_filename);
    NEW.mime_type := lower(trim(NEW.mime_type));

    IF NEW.kind = 'audio' AND NEW.mime_type NOT LIKE 'audio/%' THEN
        RAISE EXCEPTION 'Le type MIME % ne correspond pas à un fichier audio.', NEW.mime_type;
    ELSIF NEW.kind = 'image' AND NEW.mime_type NOT LIKE 'image/%' THEN
        RAISE EXCEPTION 'Le type MIME % ne correspond pas à une image.', NEW.mime_type;
    END IF;

    IF NEW.processing_status = 'ready' AND NEW.kind = 'audio'
       AND (NEW.duration_seconds IS NULL OR NEW.duration_seconds <= 0) THEN
        RAISE EXCEPTION 'Un audio prêt doit avoir une durée valide.';
    END IF;

    IF NEW.processing_status = 'ready' AND NEW.kind = 'image'
       AND (NEW.width_pixels IS NULL OR NEW.height_pixels IS NULL) THEN
        RAISE EXCEPTION 'Une image prête doit avoir des dimensions valides.';
    END IF;

    IF NEW.processing_status = 'failed' AND coalesce(trim(NEW.processing_error), '') = '' THEN
        RAISE EXCEPTION 'Un média en échec doit contenir un message d’erreur.';
    END IF;

    IF NEW.processing_status = 'ready' THEN
        NEW.processing_error := NULL;
    END IF;

    IF NEW.processing_status = 'deleted' THEN
        NEW.deleted_at := COALESCE(NEW.deleted_at, CURRENT_TIMESTAMP);
    ELSIF TG_OP = 'UPDATE' AND OLD.processing_status = 'deleted'
          AND NEW.processing_status <> 'deleted' THEN
        NEW.deleted_at := NULL;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.processing_status = 'ready'
       AND NEW.processing_status <> 'ready' THEN
        SELECT EXISTS (
            SELECT 1
            FROM sermons s
            WHERE (s.audio_media_id = OLD.id OR s.cover_media_id = OLD.id)
              AND s.status IN ('scheduled', 'published')
            UNION ALL
            SELECT 1
            FROM pages p
            WHERE p.cover_media_id = OLD.id
              AND p.status IN ('scheduled', 'published')
            UNION ALL
            SELECT 1
            FROM testimonials t
            WHERE t.photo_media_id = OLD.id
              AND t.status = 'published'
            UNION ALL
            SELECT 1
            FROM sermon_series ss
            WHERE ss.cover_media_id = OLD.id
              AND ss.is_active = true
            UNION ALL
            SELECT 1
            FROM preachers p
            WHERE p.photo_media_id = OLD.id
              AND p.is_active = true
        ) INTO v_is_protected;

        IF v_is_protected THEN
            RAISE EXCEPTION 'Ce média est utilisé par une prédication programmée ou publiée.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_enqueue_new_audio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.kind = 'audio' AND NEW.processing_status = 'uploaded' THEN
        INSERT INTO audio_processing_jobs (media_file_id)
        VALUES (NEW.id)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_audio_job_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_kind media_kind;
    v_duration numeric(12,3);
BEGIN
    SELECT kind, duration_seconds
    INTO v_kind, v_duration
    FROM media_files
    WHERE id = NEW.media_file_id AND deleted_at IS NULL;

    IF NOT FOUND OR v_kind <> 'audio' THEN
        RAISE EXCEPTION 'Le traitement audio doit référencer un média audio existant.';
    END IF;

    IF NEW.status = 'processing' THEN
        NEW.started_at := COALESCE(NEW.started_at, CURRENT_TIMESTAMP);
        IF TG_OP = 'INSERT' THEN
            NEW.attempt_count := NEW.attempt_count + 1;
        ELSIF OLD.status <> 'processing' THEN
            NEW.attempt_count := NEW.attempt_count + 1;
        END IF;
    END IF;

    IF NEW.status = 'completed' THEN
        IF v_duration IS NULL OR v_duration <= 0 THEN
            RAISE EXCEPTION 'La durée du média doit être enregistrée avant de terminer le traitement.';
        END IF;
        NEW.progress_percent := 100;
        NEW.completed_at := COALESCE(NEW.completed_at, CURRENT_TIMESTAMP);
        NEW.error_message := NULL;
    ELSIF NEW.status IN ('failed', 'cancelled') THEN
        NEW.completed_at := COALESCE(NEW.completed_at, CURRENT_TIMESTAMP);
        IF NEW.status = 'failed' AND coalesce(trim(NEW.error_message), '') = '' THEN
            RAISE EXCEPTION 'Un traitement en échec doit contenir un message d’erreur.';
        END IF;
    ELSIF NEW.status = 'queued' THEN
        NEW.started_at := NULL;
        NEW.completed_at := NULL;
        NEW.progress_percent := 0;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_sync_media_from_audio_job()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'queued' THEN
        UPDATE media_files
        SET processing_status = 'queued', processing_error = NULL
        WHERE id = NEW.media_file_id;
    ELSIF NEW.status = 'processing' THEN
        UPDATE media_files
        SET processing_status = 'processing', processing_error = NULL
        WHERE id = NEW.media_file_id;
    ELSIF NEW.status = 'completed' THEN
        UPDATE media_files
        SET processing_status = 'ready', processing_error = NULL
        WHERE id = NEW.media_file_id;
    ELSIF NEW.status = 'failed' THEN
        UPDATE media_files
        SET processing_status = 'failed', processing_error = NEW.error_message
        WHERE id = NEW.media_file_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_sermon_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_audio_kind       media_kind;
    v_audio_status     media_status;
    v_audio_duration   numeric(12,3);
    v_cover_kind       media_kind;
BEGIN
    NEW.title := trim(NEW.title);

    IF NEW.audio_media_id IS NOT NULL THEN
        SELECT kind, processing_status, duration_seconds
        INTO v_audio_kind, v_audio_status, v_audio_duration
        FROM media_files
        WHERE id = NEW.audio_media_id AND deleted_at IS NULL;

        IF NOT FOUND OR v_audio_kind <> 'audio' THEN
            RAISE EXCEPTION 'La prédication doit référencer un fichier audio valide.';
        END IF;

        IF NEW.status IN ('ready', 'scheduled', 'published')
           AND v_audio_status <> 'ready' THEN
            RAISE EXCEPTION 'L’audio doit être entièrement traité avant cette opération.';
        END IF;

        IF NEW.status IN ('ready', 'scheduled', 'published')
           AND (v_audio_duration IS NULL OR v_audio_duration <= 0) THEN
            RAISE EXCEPTION 'L’audio traité ne possède pas de durée valide.';
        END IF;

        NEW.duration_seconds := COALESCE(v_audio_duration, NEW.duration_seconds);
    ELSIF NEW.status IN ('ready', 'scheduled', 'published') THEN
        RAISE EXCEPTION 'Une prédication prête, programmée ou publiée doit avoir un audio.';
    END IF;

    IF NEW.cover_media_id IS NOT NULL THEN
        SELECT kind INTO v_cover_kind
        FROM media_files
        WHERE id = NEW.cover_media_id
          AND deleted_at IS NULL
          AND processing_status = 'ready';

        IF NOT FOUND OR v_cover_kind <> 'image' THEN
            RAISE EXCEPTION 'La couverture doit être une image prête et valide.';
        END IF;
    END IF;

    IF NEW.status = 'scheduled' THEN
        IF NEW.scheduled_for IS NULL THEN
            RAISE EXCEPTION 'Une date de publication est requise.';
        END IF;
        NEW.published_at := NULL;
    ELSIF NEW.status = 'published' THEN
        NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
        NEW.scheduled_for := NULL;
        NEW.archived_at := NULL;
    ELSIF NEW.status = 'archived' THEN
        NEW.archived_at := COALESCE(NEW.archived_at, CURRENT_TIMESTAMP);
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'archived' THEN
        NEW.archived_at := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_sync_sermons_from_media()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.kind = 'audio' AND NEW.processing_status = 'ready' THEN
        UPDATE sermons
        SET duration_seconds = NEW.duration_seconds,
            status = CASE WHEN status = 'processing' THEN 'ready' ELSE status END
        WHERE audio_media_id = NEW.id;
    ELSIF NEW.kind = 'audio' AND NEW.processing_status IN ('queued', 'processing', 'failed') THEN
        UPDATE sermons
        SET status = 'processing'
        WHERE audio_media_id = NEW.id
          AND status IN ('processing', 'ready');
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_page_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.title := trim(NEW.title);

    IF NEW.status = 'scheduled' THEN
        IF NEW.scheduled_for IS NULL THEN
            RAISE EXCEPTION 'Une page programmée doit avoir une date de publication.';
        END IF;
        NEW.published_at := NULL;
    ELSIF NEW.status = 'published' THEN
        NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
        NEW.scheduled_for := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_testimonial_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'published' THEN
        NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
    ELSIF NEW.status <> 'published' THEN
        NEW.published_at := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_contact_message_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.email := lower(trim(NEW.email::text))::citext;
    NEW.full_name := trim(NEW.full_name);
    NEW.subject := trim(NEW.subject);

    IF NEW.status = 'unread' THEN
        NEW.read_at := NULL;
        NEW.replied_at := NULL;
        NEW.archived_at := NULL;
    ELSIF NEW.status = 'read' THEN
        NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP);
        NEW.archived_at := NULL;
    ELSIF NEW.status = 'replied' THEN
        NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP);
        NEW.replied_at := COALESCE(NEW.replied_at, CURRENT_TIMESTAMP);
        NEW.archived_at := NULL;
    ELSIF NEW.status = 'archived' THEN
        NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP);
        NEW.archived_at := COALESCE(NEW.archived_at, CURRENT_TIMESTAMP);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_aggregate_sermon_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_stats_date date;
    v_inserted integer;
BEGIN
    v_stats_date := (NEW.occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date;

    INSERT INTO sermon_daily_stats (
        stats_date,
        sermon_id,
        play_starts,
        completions,
        downloads,
        shares,
        total_listen_seconds
    ) VALUES (
        v_stats_date,
        NEW.sermon_id,
        CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'complete' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'download' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'share' THEN 1 ELSE 0 END,
        NEW.seconds_listened
    )
    ON CONFLICT (stats_date, sermon_id) DO UPDATE SET
        play_starts = sermon_daily_stats.play_starts + EXCLUDED.play_starts,
        completions = sermon_daily_stats.completions + EXCLUDED.completions,
        downloads = sermon_daily_stats.downloads + EXCLUDED.downloads,
        shares = sermon_daily_stats.shares + EXCLUDED.shares,
        total_listen_seconds = sermon_daily_stats.total_listen_seconds + EXCLUDED.total_listen_seconds,
        updated_at = CURRENT_TIMESTAMP;

    IF NEW.event_type = 'play_start' AND NEW.visitor_hash IS NOT NULL THEN
        INSERT INTO sermon_daily_listeners (stats_date, sermon_id, visitor_hash, first_seen_at)
        VALUES (v_stats_date, NEW.sermon_id, NEW.visitor_hash, NEW.occurred_at)
        ON CONFLICT DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;

        IF v_inserted = 1 THEN
            UPDATE sermon_daily_stats
            SET unique_listeners = unique_listeners + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE stats_date = v_stats_date AND sermon_id = NEW.sermon_id;
        END IF;
    END IF;

    UPDATE sermons
    SET play_count = play_count + CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
        completion_count = completion_count + CASE WHEN NEW.event_type = 'complete' THEN 1 ELSE 0 END,
        download_count = download_count + CASE WHEN NEW.event_type = 'download' THEN 1 ELSE 0 END,
        share_count = share_count + CASE WHEN NEW.event_type = 'share' THEN 1 ELSE 0 END,
        total_listen_seconds = total_listen_seconds + NEW.seconds_listened
    WHERE id = NEW.sermon_id;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_actor_id     uuid;
    v_request_id   uuid;
    v_ip_address   inet;
    v_old_data     jsonb;
    v_new_data     jsonb;
    v_entity_id    uuid;
BEGIN
    BEGIN
        v_actor_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    BEGIN
        v_request_id := NULLIF(current_setting('app.request_id', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_request_id := NULL;
    END;

    BEGIN
        v_ip_address := NULLIF(current_setting('app.ip_address', true), '')::inet;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;

    IF TG_OP <> 'INSERT' THEN
        v_old_data := to_jsonb(OLD) - ARRAY[
            'password_hash', 'token_hash', 'refresh_token_hash'
        ];
    END IF;

    IF TG_OP <> 'DELETE' THEN
        v_new_data := to_jsonb(NEW) - ARRAY[
            'password_hash', 'token_hash', 'refresh_token_hash'
        ];
    END IF;

    IF TG_TABLE_NAME = 'sermons' AND TG_OP = 'UPDATE'
       AND (v_old_data - ARRAY[
            'play_count', 'like_count', 'completion_count', 'download_count',
            'share_count', 'total_listen_seconds', 'updated_at'
       ]) = (v_new_data - ARRAY[
            'play_count', 'like_count', 'completion_count', 'download_count',
            'share_count', 'total_listen_seconds', 'updated_at'
       ]) THEN
        RETURN NEW;
    END IF;

    BEGIN
        v_entity_id := COALESCE(v_new_data ->> 'id', v_old_data ->> 'id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_entity_id := NULL;
    END;

    INSERT INTO audit_logs (
        actor_id, action, entity_type, entity_id,
        old_data, new_data, request_id, ip_address
    ) VALUES (
        v_actor_id, lower(TG_OP), TG_TABLE_NAME, v_entity_id,
        v_old_data, v_new_data, v_request_id, v_ip_address
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_aggregate_sermon_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sermons SET like_count = like_count + 1 WHERE id = NEW.sermon_id;
        RETURN NEW;
    END IF;

    UPDATE sermons SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.sermon_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_normalize ON users;
CREATE TRIGGER trg_users_normalize
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_normalize_user();

DROP TRIGGER IF EXISTS trg_users_protect_last_super_admin ON users;
CREATE TRIGGER trg_users_protect_last_super_admin
BEFORE UPDATE OF status, deleted_at ON users
FOR EACH ROW EXECUTE FUNCTION fn_protect_last_super_admin_user();

DROP TRIGGER IF EXISTS trg_users_prevent_hard_delete ON users;
CREATE TRIGGER trg_users_prevent_hard_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_hard_delete();

DROP TRIGGER IF EXISTS trg_user_roles_protect_last_super_admin ON user_roles;
CREATE TRIGGER trg_user_roles_protect_last_super_admin
BEFORE DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION fn_protect_last_super_admin_role();

DROP TRIGGER IF EXISTS trg_media_lifecycle ON media_files;
CREATE TRIGGER trg_media_lifecycle
BEFORE INSERT OR UPDATE ON media_files
FOR EACH ROW EXECUTE FUNCTION fn_media_lifecycle();

DROP TRIGGER IF EXISTS trg_media_enqueue_audio ON media_files;
CREATE TRIGGER trg_media_enqueue_audio
AFTER INSERT ON media_files
FOR EACH ROW EXECUTE FUNCTION fn_enqueue_new_audio();

DROP TRIGGER IF EXISTS trg_audio_job_lifecycle ON audio_processing_jobs;
CREATE TRIGGER trg_audio_job_lifecycle
BEFORE INSERT OR UPDATE ON audio_processing_jobs
FOR EACH ROW EXECUTE FUNCTION fn_audio_job_lifecycle();

DROP TRIGGER IF EXISTS trg_audio_job_sync_media ON audio_processing_jobs;
CREATE TRIGGER trg_audio_job_sync_media
AFTER INSERT OR UPDATE OF status, error_message ON audio_processing_jobs
FOR EACH ROW EXECUTE FUNCTION fn_sync_media_from_audio_job();

DROP TRIGGER IF EXISTS trg_media_sync_sermons ON media_files;
CREATE TRIGGER trg_media_sync_sermons
AFTER UPDATE OF processing_status, duration_seconds ON media_files
FOR EACH ROW
WHEN (
    OLD.processing_status IS DISTINCT FROM NEW.processing_status
    OR OLD.duration_seconds IS DISTINCT FROM NEW.duration_seconds
)
EXECUTE FUNCTION fn_sync_sermons_from_media();

DROP TRIGGER IF EXISTS trg_sermon_slug ON sermons;
CREATE TRIGGER trg_sermon_slug
BEFORE INSERT OR UPDATE OF slug ON sermons
FOR EACH ROW EXECUTE FUNCTION fn_assign_unique_slug('title');

DROP TRIGGER IF EXISTS trg_category_slug ON sermon_categories;
CREATE TRIGGER trg_category_slug
BEFORE INSERT OR UPDATE OF slug ON sermon_categories
FOR EACH ROW EXECUTE FUNCTION fn_assign_unique_slug('name');

DROP TRIGGER IF EXISTS trg_series_slug ON sermon_series;
CREATE TRIGGER trg_series_slug
BEFORE INSERT OR UPDATE OF slug ON sermon_series
FOR EACH ROW EXECUTE FUNCTION fn_assign_unique_slug('title');

DROP TRIGGER IF EXISTS trg_tag_slug ON sermon_tags;
CREATE TRIGGER trg_tag_slug
BEFORE INSERT OR UPDATE OF slug ON sermon_tags
FOR EACH ROW EXECUTE FUNCTION fn_assign_unique_slug('name');

DROP TRIGGER IF EXISTS trg_page_slug ON pages;
CREATE TRIGGER trg_page_slug
BEFORE INSERT OR UPDATE OF slug ON pages
FOR EACH ROW EXECUTE FUNCTION fn_assign_unique_slug('title');

DROP TRIGGER IF EXISTS trg_sermon_lifecycle ON sermons;
CREATE TRIGGER trg_sermon_lifecycle
BEFORE INSERT OR UPDATE ON sermons
FOR EACH ROW EXECUTE FUNCTION fn_sermon_lifecycle();

DROP TRIGGER IF EXISTS trg_page_lifecycle ON pages;
CREATE TRIGGER trg_page_lifecycle
BEFORE INSERT OR UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION fn_page_lifecycle();

DROP TRIGGER IF EXISTS trg_testimonial_lifecycle ON testimonials;
CREATE TRIGGER trg_testimonial_lifecycle
BEFORE INSERT OR UPDATE ON testimonials
FOR EACH ROW EXECUTE FUNCTION fn_testimonial_lifecycle();

DROP TRIGGER IF EXISTS trg_contact_lifecycle ON contact_messages;
CREATE TRIGGER trg_contact_lifecycle
BEFORE INSERT OR UPDATE ON contact_messages
FOR EACH ROW EXECUTE FUNCTION fn_contact_message_lifecycle();

DROP TRIGGER IF EXISTS trg_sermon_event_aggregate ON sermon_events;
CREATE TRIGGER trg_sermon_event_aggregate
AFTER INSERT ON sermon_events
FOR EACH ROW EXECUTE FUNCTION fn_aggregate_sermon_event();

DROP TRIGGER IF EXISTS trg_sermon_like_aggregate ON sermon_likes;
CREATE TRIGGER trg_sermon_like_aggregate
AFTER INSERT OR DELETE ON sermon_likes
FOR EACH ROW EXECUTE FUNCTION fn_aggregate_sermon_like();

DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'users', 'roles', 'media_files', 'audio_processing_jobs',
        'preachers', 'sermon_categories', 'sermon_series', 'sermons',
        'pages', 'testimonials', 'contact_messages', 'site_settings'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON %I', v_table, v_table);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at()',
            v_table,
            v_table
        );
    END LOOP;
END;
$$;

DO $$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'users', 'roles', 'user_roles', 'role_permissions',
        'media_files', 'preachers', 'sermon_categories', 'sermon_series',
        'sermons', 'sermon_tags', 'sermon_tag_links', 'pages',
        'testimonials', 'site_settings'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON %I', v_table, v_table);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change()',
            v_table,
            v_table
        );
    END LOOP;
END;
$$;

COMMIT;
