BEGIN;

SET search_path TO papaleki, public;

CREATE OR REPLACE VIEW v_public_sermons AS
SELECT
    s.id,
    s.title,
    s.slug,
    s.excerpt,
    s.description,
    s.scripture_reference,
    s.preached_on,
    s.duration_seconds,
    s.is_featured,
    s.allow_download,
    s.published_at,
    s.play_count,
    s.like_count,
    s.completion_count,
    s.download_count,
    s.share_count,
    p.id AS preacher_id,
    p.display_name AS preacher_name,
    p.title AS preacher_title,
    c.id AS category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    sr.id AS series_id,
    sr.title AS series_title,
    sr.slug AS series_slug,
    audio.id AS audio_media_id,
    audio.storage_key AS audio_storage_key,
    audio.mime_type AS audio_mime_type,
    audio.file_size_bytes AS audio_file_size_bytes,
    audio.metadata AS audio_metadata,
    cover.id AS cover_media_id,
    cover.storage_key AS cover_storage_key,
    cover.alt_text AS cover_alt_text,
    cover.width_pixels AS cover_width_pixels,
    cover.height_pixels AS cover_height_pixels,
    COALESCE(tag_data.tags, ARRAY[]::text[]) AS tags
FROM sermons s
JOIN preachers p ON p.id = s.preacher_id
LEFT JOIN sermon_categories c ON c.id = s.category_id
LEFT JOIN sermon_series sr ON sr.id = s.series_id
JOIN media_files audio
    ON audio.id = s.audio_media_id
   AND audio.processing_status = 'ready'
   AND audio.deleted_at IS NULL
LEFT JOIN media_files cover
    ON cover.id = s.cover_media_id
   AND cover.processing_status = 'ready'
   AND cover.deleted_at IS NULL
LEFT JOIN LATERAL (
    SELECT array_agg(t.name ORDER BY t.name) AS tags
    FROM sermon_tag_links stl
    JOIN sermon_tags t ON t.id = stl.tag_id
    WHERE stl.sermon_id = s.id
) tag_data ON true
WHERE s.status = 'published'
  AND s.published_at <= CURRENT_TIMESTAMP;

CREATE OR REPLACE VIEW v_latest_sermons AS
SELECT *
FROM v_public_sermons
ORDER BY published_at DESC, preached_on DESC;

CREATE OR REPLACE VIEW v_sermon_admin_overview AS
SELECT
    s.id,
    s.title,
    s.slug,
    s.status,
    s.preached_on,
    s.scheduled_for,
    s.published_at,
    s.archived_at,
    s.duration_seconds,
    s.is_featured,
    s.allow_download,
    s.play_count,
    s.like_count,
    s.completion_count,
    s.download_count,
    s.share_count,
    s.total_listen_seconds,
    p.display_name AS preacher_name,
    c.name AS category_name,
    sr.title AS series_title,
    audio.original_filename AS audio_filename,
    audio.processing_status AS audio_status,
    audio.processing_error AS audio_error,
    cover.original_filename AS cover_filename,
    job.id AS latest_job_id,
    job.status AS latest_job_status,
    job.progress_percent,
    job.attempt_count,
    job.max_attempts,
    job.error_message AS job_error,
    s.created_at,
    s.updated_at
FROM sermons s
JOIN preachers p ON p.id = s.preacher_id
LEFT JOIN sermon_categories c ON c.id = s.category_id
LEFT JOIN sermon_series sr ON sr.id = s.series_id
LEFT JOIN media_files audio ON audio.id = s.audio_media_id
LEFT JOIN media_files cover ON cover.id = s.cover_media_id
LEFT JOIN LATERAL (
    SELECT apj.*
    FROM audio_processing_jobs apj
    WHERE apj.media_file_id = s.audio_media_id
    ORDER BY apj.queued_at DESC
    LIMIT 1
) job ON true;

CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    (SELECT count(*) FROM sermons) AS total_sermons,
    (SELECT count(*) FROM sermons WHERE status = 'published') AS published_sermons,
    (SELECT count(*) FROM sermons WHERE status = 'draft') AS draft_sermons,
    (SELECT count(*) FROM sermons WHERE status = 'processing') AS processing_sermons,
    (SELECT count(*) FROM sermons WHERE status = 'scheduled') AS scheduled_sermons,
    (SELECT count(*) FROM sermons WHERE status = 'archived') AS archived_sermons,
    (SELECT coalesce(sum(play_count), 0) FROM sermons) AS total_plays,
    (SELECT coalesce(sum(like_count), 0) FROM sermons) AS total_likes,
    (SELECT coalesce(sum(download_count), 0) FROM sermons) AS total_downloads,
    (SELECT coalesce(sum(total_listen_seconds), 0) FROM sermons) AS total_listen_seconds,
    (
        SELECT coalesce(sum(play_starts), 0)
        FROM sermon_daily_stats
        WHERE stats_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 6
    ) AS plays_last_7_days,
    (
        SELECT coalesce(sum(play_starts), 0)
        FROM sermon_daily_stats
        WHERE stats_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 29
    ) AS plays_last_30_days,
    (
        SELECT coalesce(sum(unique_listeners), 0)
        FROM sermon_daily_stats
        WHERE stats_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 29
    ) AS daily_unique_listeners_last_30_days,
    (SELECT count(*) FROM contact_messages WHERE status = 'unread') AS unread_messages,
    (
        SELECT count(*)
        FROM audio_processing_jobs
        WHERE status IN ('queued', 'processing')
    ) AS active_audio_jobs,
    (
        SELECT id
        FROM sermons
        WHERE status = 'published'
        ORDER BY play_count DESC, published_at DESC
        LIMIT 1
    ) AS most_played_sermon_id,
    (
        SELECT title
        FROM sermons
        WHERE status = 'published'
        ORDER BY play_count DESC, published_at DESC
        LIMIT 1
    ) AS most_played_sermon_title;

CREATE OR REPLACE VIEW v_sermon_performance_30d AS
SELECT
    s.id AS sermon_id,
    s.title,
    s.slug,
    s.published_at,
    p.display_name AS preacher_name,
    coalesce(sum(ds.play_starts), 0) AS play_starts,
    coalesce(sum(ds.unique_listeners), 0) AS summed_daily_unique_listeners,
    coalesce(sum(ds.completions), 0) AS completions,
    coalesce(sum(ds.downloads), 0) AS downloads,
    coalesce(sum(ds.shares), 0) AS shares,
    coalesce(sum(ds.total_listen_seconds), 0) AS total_listen_seconds,
    CASE
        WHEN coalesce(sum(ds.play_starts), 0) = 0 THEN 0
        ELSE round(
            100.0 * sum(ds.completions)::numeric / sum(ds.play_starts)::numeric,
            2
        )
    END AS completion_rate_percent
FROM sermons s
JOIN preachers p ON p.id = s.preacher_id
LEFT JOIN sermon_daily_stats ds
    ON ds.sermon_id = s.id
   AND ds.stats_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 29
WHERE s.status = 'published'
GROUP BY s.id, s.title, s.slug, s.published_at, p.display_name;

CREATE OR REPLACE VIEW v_daily_platform_performance_90d AS
SELECT
    d.stats_date,
    sum(d.play_starts) AS play_starts,
    sum(d.unique_listeners) AS summed_daily_unique_listeners,
    sum(d.completions) AS completions,
    sum(d.downloads) AS downloads,
    sum(d.shares) AS shares,
    sum(d.total_listen_seconds) AS total_listen_seconds
FROM sermon_daily_stats d
WHERE d.stats_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::date - 89
GROUP BY d.stats_date
ORDER BY d.stats_date;

CREATE OR REPLACE VIEW v_audio_processing_queue AS
SELECT
    j.id AS job_id,
    j.status,
    j.priority,
    j.progress_percent,
    j.attempt_count,
    j.max_attempts,
    j.worker_name,
    j.operations,
    j.error_message,
    j.queued_at,
    j.started_at,
    j.completed_at,
    m.id AS media_id,
    m.original_filename,
    m.storage_key,
    m.mime_type,
    m.file_size_bytes,
    m.duration_seconds,
    s.id AS sermon_id,
    s.title AS sermon_title
FROM audio_processing_jobs j
JOIN media_files m ON m.id = j.media_file_id
LEFT JOIN sermons s ON s.audio_media_id = m.id
WHERE j.status IN ('queued', 'processing', 'failed');

CREATE OR REPLACE VIEW v_media_library AS
SELECT
    m.id,
    m.kind,
    m.processing_status,
    m.storage_provider,
    m.storage_key,
    m.original_filename,
    m.mime_type,
    m.file_size_bytes,
    m.duration_seconds,
    m.width_pixels,
    m.height_pixels,
    m.alt_text,
    m.caption,
    m.metadata,
    m.processing_error,
    m.uploaded_by,
    concat_ws(' ', u.first_name, u.last_name) AS uploaded_by_name,
    m.created_at,
    m.updated_at,
    EXISTS (
        SELECT 1 FROM sermons s
        WHERE s.audio_media_id = m.id OR s.cover_media_id = m.id
    ) OR EXISTS (
        SELECT 1 FROM pages p WHERE p.cover_media_id = m.id
    ) AS is_in_use
FROM media_files m
LEFT JOIN users u ON u.id = m.uploaded_by
WHERE m.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_contact_inbox AS
SELECT
    cm.id,
    cm.full_name,
    cm.email,
    cm.phone,
    cm.subject,
    cm.message,
    cm.status,
    cm.assigned_to,
    concat_ws(' ', u.first_name, u.last_name) AS assigned_to_name,
    cm.read_at,
    cm.replied_at,
    cm.archived_at,
    cm.created_at,
    cm.updated_at
FROM contact_messages cm
LEFT JOIN users u ON u.id = cm.assigned_to
WHERE cm.status <> 'spam';

CREATE OR REPLACE VIEW v_public_pages AS
SELECT
    p.id,
    p.slug,
    p.title,
    p.navigation_label,
    p.content,
    p.meta_title,
    p.meta_description,
    p.display_order,
    p.show_in_navigation,
    p.published_at,
    cover.id AS cover_media_id,
    cover.storage_key AS cover_storage_key,
    cover.alt_text AS cover_alt_text
FROM pages p
LEFT JOIN media_files cover
    ON cover.id = p.cover_media_id
   AND cover.processing_status = 'ready'
   AND cover.deleted_at IS NULL
WHERE p.status = 'published'
  AND p.published_at <= CURRENT_TIMESTAMP;

CREATE OR REPLACE VIEW v_public_testimonials AS
SELECT
    t.id,
    t.author_name,
    t.author_role,
    t.quote,
    t.display_order,
    t.published_at,
    photo.id AS photo_media_id,
    photo.storage_key AS photo_storage_key,
    photo.alt_text AS photo_alt_text
FROM testimonials t
LEFT JOIN media_files photo
    ON photo.id = t.photo_media_id
   AND photo.processing_status = 'ready'
   AND photo.deleted_at IS NULL
WHERE t.status = 'published'
ORDER BY t.display_order, t.published_at DESC;

CREATE OR REPLACE VIEW v_public_site_settings AS
SELECT setting_key, setting_group, value, description
FROM site_settings
WHERE is_public = true;

CREATE OR REPLACE VIEW v_content_calendar AS
SELECT
    s.id,
    'sermon'::text AS content_type,
    s.title,
    s.status::text AS status,
    s.scheduled_for,
    s.published_at,
    s.created_at
FROM sermons s
WHERE s.status IN ('scheduled', 'published')
UNION ALL
SELECT
    p.id,
    'page'::text AS content_type,
    p.title,
    p.status::text AS status,
    p.scheduled_for,
    p.published_at,
    p.created_at
FROM pages p
WHERE p.status IN ('scheduled', 'published');

CREATE OR REPLACE VIEW v_user_permissions AS
SELECT DISTINCT
    u.id AS user_id,
    u.email,
    concat_ws(' ', u.first_name, u.last_name) AS full_name,
    u.status,
    r.code AS role_code,
    r.name AS role_name,
    p.code AS permission_code,
    p.name AS permission_name
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE u.deleted_at IS NULL;

COMMIT;
