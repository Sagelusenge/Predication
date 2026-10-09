BEGIN;

SET search_path TO papaleki, public;

ALTER TABLE sermons
    ADD COLUMN IF NOT EXISTS publish_when_ready boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sermons.publish_when_ready IS
    'Publie automatiquement la predication des que son audio compresse est pret.';

CREATE OR REPLACE FUNCTION fn_sync_sermons_from_media()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = papaleki, public
AS $$
BEGIN
    IF NEW.kind = 'audio' AND NEW.processing_status = 'ready' THEN
        UPDATE sermons
        SET duration_seconds = NEW.duration_seconds,
            status = CASE
                WHEN status = 'processing' AND publish_when_ready THEN 'published'::sermon_status
                WHEN status = 'processing' THEN 'ready'::sermon_status
                ELSE status
            END,
            published_at = CASE
                WHEN status = 'processing' AND publish_when_ready
                    THEN COALESCE(published_at, CURRENT_TIMESTAMP)
                ELSE published_at
            END,
            publish_when_ready = CASE
                WHEN status = 'processing' AND publish_when_ready THEN false
                ELSE publish_when_ready
            END
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

COMMIT;
