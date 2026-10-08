BEGIN;

-- Les connexions applicatives n'utilisent pas forcement le schema papaleki par
-- defaut. Les fonctions et procedures doivent donc resoudre leurs tables dans
-- ce schema, notamment lorsqu'elles sont executees par un trigger.
DO $$
DECLARE
    v_routine regprocedure;
BEGIN
    FOR v_routine IN
        SELECT p.oid::regprocedure
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'papaleki'
          AND p.prokind IN ('f', 'p')
    LOOP
        EXECUTE format(
            'ALTER ROUTINE %s SET search_path TO papaleki, public',
            v_routine
        );
    END LOOP;
END;
$$;

COMMIT;
