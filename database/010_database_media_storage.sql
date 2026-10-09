BEGIN;

SET search_path TO papaleki, public;

CREATE TABLE IF NOT EXISTS media_file_chunks (
    media_file_id  uuid NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    chunk_index    integer NOT NULL CHECK (chunk_index >= 0),
    data           bytea NOT NULL CHECK (octet_length(data) > 0),
    created_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (media_file_id, chunk_index)
);

CREATE OR REPLACE VIEW v_database_media_storage AS
SELECT
    COALESCE(sum(octet_length(data)), 0)::bigint AS bytes_used,
    count(DISTINCT media_file_id)::integer AS media_count
FROM media_file_chunks;

COMMENT ON TABLE media_file_chunks IS
    'Contenu binaire persistant des medias, decoupe en blocs pour limiter la memoire du serveur.';
COMMENT ON VIEW v_database_media_storage IS
    'Utilisation du stockage PostgreSQL par les fichiers medias.';

COMMIT;
