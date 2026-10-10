BEGIN;

SET search_path TO papaleki, public;

CREATE OR REPLACE PROCEDURE sp_create_user(
    IN p_actor_id uuid,
    IN p_email citext,
    IN p_password_hash text,
    IN p_first_name text,
    IN p_last_name text,
    IN p_role_code text,
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

    IF p_password_hash IS NULL OR length(p_password_hash) < 20 THEN
        RAISE EXCEPTION 'Un hash Argon2id valide est requis.';
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
            RAISE EXCEPTION 'Seul un super administrateur peut créer un autre super administrateur.'
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
            RAISE EXCEPTION 'Un utilisateur utilise déjà cette adresse e-mail.';
        END IF;

        UPDATE users
        SET password_hash = p_password_hash,
            first_name = trim(p_first_name),
            last_name = trim(p_last_name),
            status = 'active',
            failed_login_count = 0,
            locked_until = NULL
        WHERE id = p_user_id;

        DELETE FROM user_roles WHERE user_id = p_user_id;
    ELSE
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
    END IF;

    DELETE FROM user_invitation_tokens WHERE user_id = p_user_id;

    INSERT INTO user_roles (user_id, role_id, granted_by)
    VALUES (p_user_id, v_role_id, p_actor_id);

    INSERT INTO auth_events (user_id, email, event_name, succeeded, details)
    VALUES (
        p_user_id,
        lower(trim(p_email::text))::citext,
        'admin_created_user',
        true,
        jsonb_build_object('actor_id', p_actor_id, 'role_code', p_role_code)
    );
END;
$$;

COMMENT ON PROCEDURE sp_create_user(uuid, citext, text, text, text, text, uuid) IS
    'Crée et active directement un utilisateur avec un mot de passe déjà hashé.';

COMMIT;
