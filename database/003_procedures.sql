BEGIN;

SET search_path TO papaleki, public;

CREATE OR REPLACE FUNCTION fn_require_permission(p_user_id uuid, p_permission_code text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT fn_user_has_permission(p_user_id, p_permission_code) THEN
        RAISE EXCEPTION 'Permission refusée : %', p_permission_code
            USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_bootstrap_super_admin(
    IN p_email citext,
    IN p_password_hash text,
    IN p_first_name text,
    IN p_last_name text,
    INOUT p_user_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_role_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('papaleki.bootstrap'));

    IF EXISTS (SELECT 1 FROM users WHERE deleted_at IS NULL) THEN
        RAISE EXCEPTION 'L’initialisation est déjà terminée.';
    END IF;

    IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
        RAISE EXCEPTION 'Un hash Argon2id ou bcrypt valide est requis.';
    END IF;

    SELECT id INTO v_role_id
    FROM roles
    WHERE code = 'super_admin';

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Les rôles initiaux doivent être chargés avant l’initialisation.';
    END IF;

    INSERT INTO users (
        email, password_hash, first_name, last_name, status
    ) VALUES (
        lower(trim(p_email::text))::citext,
        p_password_hash,
        trim(p_first_name),
        trim(p_last_name),
        'active'
    )
    RETURNING id INTO p_user_id;

    INSERT INTO user_roles (user_id, role_id, granted_by)
    VALUES (p_user_id, v_role_id, p_user_id);

    INSERT INTO auth_events (user_id, email, event_name, succeeded, details)
    VALUES (p_user_id, p_email, 'bootstrap_super_admin', true, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_invite_user(
    IN p_actor_id uuid,
    IN p_email citext,
    IN p_first_name text,
    IN p_last_name text,
    IN p_role_code text,
    IN p_invitation_token_hash text,
    IN p_expires_at timestamptz DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
    INOUT p_user_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_role_id uuid;
    v_existing_status user_status;
    v_actor_is_super_admin boolean;
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'users.manage');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    IF p_expires_at <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'La date d’expiration de l’invitation doit être future.';
    END IF;

    IF p_invitation_token_hash IS NULL OR length(p_invitation_token_hash) < 32 THEN
        RAISE EXCEPTION 'Un hash de jeton d’invitation valide est requis.';
    END IF;

    SELECT id INTO v_role_id
    FROM roles
    WHERE code = p_role_code;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Rôle inconnu : %', p_role_code;
    END IF;

    IF p_role_code = 'super_admin' THEN
        SELECT EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = p_actor_id AND r.code = 'super_admin'
        ) INTO v_actor_is_super_admin;

        IF NOT v_actor_is_super_admin THEN
            RAISE EXCEPTION 'Seul un super administrateur peut inviter un autre super administrateur.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT id, status
    INTO p_user_id, v_existing_status
    FROM users
    WHERE email = lower(trim(p_email::text))::citext
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_status <> 'invited' THEN
            RAISE EXCEPTION 'Un utilisateur actif ou désactivé utilise déjà cette adresse.';
        END IF;

        UPDATE users
        SET first_name = trim(p_first_name),
            last_name = trim(p_last_name),
            status = 'invited'
        WHERE id = p_user_id;
    ELSE
        INSERT INTO users (email, first_name, last_name, status)
        VALUES (
            lower(trim(p_email::text))::citext,
            trim(p_first_name),
            trim(p_last_name),
            'invited'
        )
        RETURNING id INTO p_user_id;
    END IF;

    INSERT INTO user_roles (user_id, role_id, granted_by)
    VALUES (p_user_id, v_role_id, p_actor_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    DELETE FROM user_invitation_tokens
    WHERE user_id = p_user_id AND accepted_at IS NULL;

    INSERT INTO user_invitation_tokens (
        user_id, role_id, token_hash, invited_by, expires_at
    ) VALUES (
        p_user_id, v_role_id, p_invitation_token_hash, p_actor_id, p_expires_at
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_accept_user_invitation(
    IN p_invitation_token_hash text,
    IN p_password_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_invitation user_invitation_tokens%ROWTYPE;
BEGIN
    IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
        RAISE EXCEPTION 'Un hash Argon2id ou bcrypt valide est requis.';
    END IF;

    SELECT * INTO v_invitation
    FROM user_invitation_tokens
    WHERE token_hash = p_invitation_token_hash
      AND accepted_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation invalide ou expirée.';
    END IF;

    UPDATE users
    SET password_hash = p_password_hash,
        status = 'active',
        failed_login_count = 0,
        locked_until = NULL
    WHERE id = v_invitation.user_id
      AND status = 'invited'
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Le compte invité n’est plus disponible.';
    END IF;

    UPDATE user_invitation_tokens
    SET accepted_at = CURRENT_TIMESTAMP
    WHERE id = v_invitation.id;

    UPDATE user_invitation_tokens
    SET accepted_at = CURRENT_TIMESTAMP
    WHERE user_id = v_invitation.user_id
      AND accepted_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_deactivate_user(
    IN p_user_id uuid,
    IN p_actor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'users.manage');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    IF p_user_id = p_actor_id THEN
        RAISE EXCEPTION 'Un administrateur ne peut pas désactiver son propre compte.';
    END IF;

    UPDATE users
    SET status = 'disabled',
        deleted_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    UPDATE auth_sessions
    SET revoked_at = CURRENT_TIMESTAMP,
        revoke_reason = 'Compte désactivé'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_publish_sermon(
    IN p_sermon_id uuid,
    IN p_actor_id uuid,
    IN p_publish_at timestamptz DEFAULT CURRENT_TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_sermon sermons%ROWTYPE;
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'sermons.publish');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    SELECT * INTO v_sermon
    FROM sermons
    WHERE id = p_sermon_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prédication introuvable.';
    END IF;

    IF p_publish_at > CURRENT_TIMESTAMP THEN
        UPDATE sermons
        SET status = 'scheduled',
            scheduled_for = p_publish_at,
            published_at = NULL,
            updated_by = p_actor_id
        WHERE id = p_sermon_id;
    ELSE
        UPDATE sermons
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            scheduled_for = NULL,
            archived_at = NULL,
            updated_by = p_actor_id
        WHERE id = p_sermon_id;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_schedule_sermon(
    IN p_sermon_id uuid,
    IN p_actor_id uuid,
    IN p_scheduled_for timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF p_scheduled_for <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'La date programmée doit être future.';
    END IF;

    CALL sp_publish_sermon(p_sermon_id, p_actor_id, p_scheduled_for);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_archive_sermon(
    IN p_sermon_id uuid,
    IN p_actor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'sermons.archive');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    UPDATE sermons
    SET status = 'archived',
        scheduled_for = NULL,
        archived_at = CURRENT_TIMESTAMP,
        updated_by = p_actor_id
    WHERE id = p_sermon_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prédication introuvable.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_publish_due_content()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    UPDATE sermons
    SET status = 'published',
        published_at = scheduled_for,
        scheduled_for = NULL,
        archived_at = NULL
    WHERE status = 'scheduled'
      AND scheduled_for <= CURRENT_TIMESTAMP;

    UPDATE pages
    SET status = 'published',
        published_at = scheduled_for,
        scheduled_for = NULL
    WHERE status = 'scheduled'
      AND scheduled_for <= CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_publish_page(
    IN p_page_id uuid,
    IN p_actor_id uuid,
    IN p_publish_at timestamptz DEFAULT CURRENT_TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'pages.publish');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    IF p_publish_at > CURRENT_TIMESTAMP THEN
        UPDATE pages
        SET status = 'scheduled',
            scheduled_for = p_publish_at,
            published_at = NULL,
            updated_by = p_actor_id
        WHERE id = p_page_id;
    ELSE
        UPDATE pages
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            scheduled_for = NULL,
            updated_by = p_actor_id
        WHERE id = p_page_id;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Page introuvable.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_upsert_site_setting(
    IN p_setting_key text,
    IN p_setting_group text,
    IN p_value jsonb,
    IN p_description text,
    IN p_is_public boolean,
    IN p_actor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'settings.manage');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    IF coalesce(trim(p_setting_key), '') = '' THEN
        RAISE EXCEPTION 'La clé du paramètre est requise.';
    END IF;

    INSERT INTO site_settings (
        setting_key, setting_group, value,
        description, is_public, updated_by
    ) VALUES (
        trim(p_setting_key), coalesce(NULLIF(trim(p_setting_group), ''), 'general'),
        COALESCE(p_value, 'null'::jsonb), p_description, p_is_public, p_actor_id
    )
    ON CONFLICT (setting_key) DO UPDATE SET
        setting_group = EXCLUDED.setting_group,
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        is_public = EXCLUDED.is_public,
        updated_by = EXCLUDED.updated_by;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_claim_audio_job(
    IN p_worker_name text,
    INOUT p_job_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF coalesce(trim(p_worker_name), '') = '' THEN
        RAISE EXCEPTION 'Le nom du worker est requis.';
    END IF;

    SELECT id INTO p_job_id
    FROM audio_processing_jobs
    WHERE status = 'queued'
      AND attempt_count < max_attempts
    ORDER BY priority DESC, queued_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF p_job_id IS NOT NULL THEN
        UPDATE audio_processing_jobs
        SET status = 'processing',
            worker_name = trim(p_worker_name),
            started_at = CURRENT_TIMESTAMP,
            error_message = NULL
        WHERE id = p_job_id;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_audio_progress(
    IN p_job_id uuid,
    IN p_worker_name text,
    IN p_progress_percent smallint,
    IN p_partial_result jsonb DEFAULT '{}'::jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF p_progress_percent < 0 OR p_progress_percent > 99 THEN
        RAISE EXCEPTION 'La progression doit être comprise entre 0 et 99.';
    END IF;

    UPDATE audio_processing_jobs
    SET progress_percent = p_progress_percent,
        result = result || COALESCE(p_partial_result, '{}'::jsonb)
    WHERE id = p_job_id
      AND status = 'processing'
      AND worker_name = p_worker_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traitement actif introuvable pour ce worker.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_finish_audio_job(
    IN p_job_id uuid,
    IN p_success boolean,
    IN p_duration_seconds numeric DEFAULT NULL,
    IN p_result jsonb DEFAULT '{}'::jsonb,
    IN p_error_message text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_job audio_processing_jobs%ROWTYPE;
BEGIN
    SELECT * INTO v_job
    FROM audio_processing_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traitement audio introuvable.';
    END IF;

    IF v_job.status <> 'processing' THEN
        RAISE EXCEPTION 'Le traitement audio n’est pas actif.';
    END IF;

    IF p_success THEN
        IF p_duration_seconds IS NULL OR p_duration_seconds <= 0 THEN
            RAISE EXCEPTION 'Une durée audio valide est requise.';
        END IF;

        UPDATE media_files
        SET duration_seconds = p_duration_seconds,
            metadata = metadata || jsonb_build_object(
                'processing_result', COALESCE(p_result, '{}'::jsonb)
            ),
            processing_error = NULL
        WHERE id = v_job.media_file_id;

        UPDATE audio_processing_jobs
        SET status = 'completed',
            progress_percent = 100,
            result = COALESCE(p_result, '{}'::jsonb),
            error_message = NULL,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = p_job_id;
    ELSE
        IF coalesce(trim(p_error_message), '') = '' THEN
            RAISE EXCEPTION 'Le message d’erreur est requis en cas d’échec.';
        END IF;

        UPDATE audio_processing_jobs
        SET status = 'failed',
            error_message = p_error_message,
            result = COALESCE(p_result, '{}'::jsonb),
            completed_at = CURRENT_TIMESTAMP
        WHERE id = p_job_id;
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_requeue_audio_job(
    IN p_job_id uuid,
    IN p_actor_id uuid DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
DECLARE
    v_job audio_processing_jobs%ROWTYPE;
BEGIN
    IF p_actor_id IS NOT NULL THEN
        PERFORM fn_require_permission(p_actor_id, 'media.manage');
        PERFORM set_config('app.current_user_id', p_actor_id::text, true);
    END IF;

    SELECT * INTO v_job
    FROM audio_processing_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traitement audio introuvable.';
    END IF;

    IF v_job.status NOT IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'Seul un traitement échoué ou annulé peut être relancé.';
    END IF;

    IF v_job.attempt_count >= v_job.max_attempts THEN
        RAISE EXCEPTION 'Le nombre maximal de tentatives est atteint.';
    END IF;

    UPDATE audio_processing_jobs
    SET status = 'queued',
        worker_name = NULL,
        progress_percent = 0,
        error_message = NULL,
        queued_at = CURRENT_TIMESTAMP,
        started_at = NULL,
        completed_at = NULL
    WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_record_sermon_event(
    IN p_sermon_id uuid,
    IN p_event_type sermon_event_type,
    IN p_visitor_hash varchar DEFAULT NULL,
    IN p_session_identifier varchar DEFAULT NULL,
    IN p_seconds_listened integer DEFAULT 0,
    IN p_progress_percent numeric DEFAULT NULL,
    IN p_device_type varchar DEFAULT NULL,
    IN p_country_code char(2) DEFAULT NULL,
    IN p_city varchar DEFAULT NULL,
    IN p_referrer text DEFAULT NULL,
    IN p_metadata jsonb DEFAULT '{}'::jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sermons
        WHERE id = p_sermon_id
          AND status = 'published'
          AND published_at <= CURRENT_TIMESTAMP
    ) THEN
        RAISE EXCEPTION 'Prédication publique introuvable.';
    END IF;

    IF p_seconds_listened < 0 THEN
        RAISE EXCEPTION 'La durée écoutée ne peut pas être négative.';
    END IF;

    IF p_progress_percent IS NOT NULL
       AND (p_progress_percent < 0 OR p_progress_percent > 100) THEN
        RAISE EXCEPTION 'La progression doit être comprise entre 0 et 100.';
    END IF;

    INSERT INTO sermon_events (
        sermon_id, event_type, visitor_hash, session_identifier,
        seconds_listened, progress_percent, device_type,
        country_code, city, referrer, metadata
    ) VALUES (
        p_sermon_id, p_event_type, NULLIF(trim(p_visitor_hash), ''),
        NULLIF(trim(p_session_identifier), ''), p_seconds_listened,
        p_progress_percent, NULLIF(trim(p_device_type), ''),
        upper(NULLIF(trim(p_country_code), '')),
        NULLIF(trim(p_city), ''), p_referrer,
        COALESCE(p_metadata, '{}'::jsonb)
    );
END;
$$;

CREATE OR REPLACE PROCEDURE sp_toggle_sermon_like(
    IN p_sermon_id uuid,
    IN p_visitor_hash varchar,
    INOUT p_liked boolean DEFAULT NULL,
    INOUT p_like_count bigint DEFAULT 0
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF p_visitor_hash IS NULL OR length(trim(p_visitor_hash)) < 16 THEN
        RAISE EXCEPTION 'Identifiant visiteur invalide.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sermons
        WHERE id = p_sermon_id
          AND status = 'published'
          AND published_at <= CURRENT_TIMESTAMP
    ) THEN
        RAISE EXCEPTION 'Prédication publique introuvable.';
    END IF;

    DELETE FROM sermon_likes
    WHERE sermon_id = p_sermon_id AND visitor_hash = trim(p_visitor_hash);

    IF FOUND THEN
        p_liked := false;
    ELSE
        INSERT INTO sermon_likes (sermon_id, visitor_hash)
        VALUES (p_sermon_id, trim(p_visitor_hash));
        p_liked := true;
    END IF;

    SELECT like_count INTO p_like_count FROM sermons WHERE id = p_sermon_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_mark_contact_message(
    IN p_message_id uuid,
    IN p_status contact_status,
    IN p_actor_id uuid,
    IN p_assigned_to uuid DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'messages.manage');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    UPDATE contact_messages
    SET status = p_status,
        assigned_to = COALESCE(p_assigned_to, assigned_to)
    WHERE id = p_message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message introuvable.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_soft_delete_media(
    IN p_media_id uuid,
    IN p_actor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    PERFORM fn_require_permission(p_actor_id, 'media.manage');
    PERFORM set_config('app.current_user_id', p_actor_id::text, true);

    IF EXISTS (
        SELECT 1 FROM sermons
        WHERE (audio_media_id = p_media_id OR cover_media_id = p_media_id)
          AND status IN ('ready', 'scheduled', 'published')
    ) OR EXISTS (
        SELECT 1 FROM pages
        WHERE cover_media_id = p_media_id AND status IN ('scheduled', 'published')
    ) THEN
        RAISE EXCEPTION 'Le média est encore utilisé par un contenu actif.';
    END IF;

    UPDATE media_files
    SET processing_status = 'deleted',
        deleted_at = CURRENT_TIMESTAMP
    WHERE id = p_media_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Média introuvable ou déjà supprimé.';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_rebuild_sermon_statistics(
    IN p_from_date date DEFAULT DATE '1970-01-01'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    DELETE FROM sermon_daily_listeners
    WHERE stats_date >= p_from_date;

    DELETE FROM sermon_daily_stats
    WHERE stats_date >= p_from_date;

    INSERT INTO sermon_daily_listeners (stats_date, sermon_id, visitor_hash, first_seen_at)
    SELECT
        (e.occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date,
        e.sermon_id,
        e.visitor_hash,
        min(e.occurred_at)
    FROM sermon_events e
    WHERE e.event_type = 'play_start'
      AND e.visitor_hash IS NOT NULL
      AND (e.occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date >= p_from_date
    GROUP BY 1, 2, 3;

    INSERT INTO sermon_daily_stats (
        stats_date, sermon_id, play_starts, unique_listeners,
        completions, downloads, shares, total_listen_seconds
    )
    SELECT
        (e.occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date AS stats_date,
        e.sermon_id,
        count(*) FILTER (WHERE e.event_type = 'play_start'),
        count(DISTINCT e.visitor_hash) FILTER (
            WHERE e.event_type = 'play_start' AND e.visitor_hash IS NOT NULL
        ),
        count(*) FILTER (WHERE e.event_type = 'complete'),
        count(*) FILTER (WHERE e.event_type = 'download'),
        count(*) FILTER (WHERE e.event_type = 'share'),
        coalesce(sum(e.seconds_listened), 0)
    FROM sermon_events e
    WHERE (e.occurred_at AT TIME ZONE 'Africa/Lubumbashi')::date >= p_from_date
    GROUP BY 1, 2;

    UPDATE sermons s
    SET play_count = x.play_count,
        completion_count = x.completion_count,
        download_count = x.download_count,
        share_count = x.share_count,
        total_listen_seconds = x.total_listen_seconds
    FROM (
        SELECT
            s2.id,
            count(e.id) FILTER (WHERE e.event_type = 'play_start') AS play_count,
            count(e.id) FILTER (WHERE e.event_type = 'complete') AS completion_count,
            count(e.id) FILTER (WHERE e.event_type = 'download') AS download_count,
            count(e.id) FILTER (WHERE e.event_type = 'share') AS share_count,
            coalesce(sum(e.seconds_listened), 0)::bigint AS total_listen_seconds
        FROM sermons s2
        LEFT JOIN sermon_events e ON e.sermon_id = s2.id
        GROUP BY s2.id
    ) x
    WHERE s.id = x.id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_cleanup_expired_security_data(
    IN p_retention interval DEFAULT INTERVAL '30 days'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = papaleki, public
AS $$
BEGIN
    IF p_retention < INTERVAL '1 day' THEN
        RAISE EXCEPTION 'La rétention minimale est d’un jour.';
    END IF;

    DELETE FROM auth_sessions
    WHERE COALESCE(revoked_at, expires_at) < CURRENT_TIMESTAMP - p_retention;

    DELETE FROM password_reset_tokens
    WHERE COALESCE(used_at, expires_at) < CURRENT_TIMESTAMP - p_retention;

    DELETE FROM user_invitation_tokens
    WHERE COALESCE(accepted_at, expires_at) < CURRENT_TIMESTAMP - p_retention;

    DELETE FROM auth_events
    WHERE occurred_at < CURRENT_TIMESTAMP - INTERVAL '2 years';
END;
$$;

COMMIT;
