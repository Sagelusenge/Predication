import webpush, { type PushSubscription } from 'web-push';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import { getDailyFrenchBiblePassage } from '../bible/bible.service.js';

type VapidKeys = { publicKey: string; privateKey: string };
type PushMessage = {
  kind: 'daily_verse' | 'sermon_published';
  dedupeKey: string;
  title: string;
  body: string;
  targetUrl: string;
  sermonId?: string;
  data?: Record<string, unknown>;
};

const getSetting = async <T>(key: string): Promise<T | null> => {
  const result = await pool.query<{ value: T }>(
    'SELECT value FROM papaleki.site_settings WHERE setting_key = $1',
    [key],
  );
  return result.rows[0]?.value ?? null;
};

export const getVapidKeys = async (): Promise<VapidKeys> => {
  const existing = await getSetting<VapidKeys>('notifications.vapid_keys');
  if (existing?.publicKey && existing.privateKey) return existing;

  const generated = webpush.generateVAPIDKeys();
  await pool.query(
    `INSERT INTO papaleki.site_settings
       (setting_key, setting_group, value, description, is_public)
     VALUES ('notifications.vapid_keys', 'notifications', $1::jsonb,
             'Clés privées VAPID générées pour Web Push.', false)
     ON CONFLICT (setting_key) DO NOTHING`,
    [JSON.stringify(generated)],
  );
  const saved = await getSetting<VapidKeys>('notifications.vapid_keys');
  if (!saved?.publicKey || !saved.privateKey) throw new Error('Les clés VAPID ne sont pas disponibles.');
  return saved;
};

const notificationEnabled = async (): Promise<boolean> =>
  (await getSetting<boolean>('notifications.enabled')) ?? true;

const pushOptions = async () => {
  const keys = await getVapidKeys();
  return {
    publicKey: keys.publicKey,
    options: {
      vapidDetails: {
        subject: env.APP_URL,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      },
      TTL: 86_400,
      urgency: 'normal' as const,
    },
  };
};

const broadcastPush = async (message: PushMessage): Promise<{ sent: number; failed: number; skipped: boolean }> => {
  if (!(await notificationEnabled())) return { sent: 0, failed: 0, skipped: true };

  const notification = await pool.query<{ id: string }>(
    `INSERT INTO papaleki.push_notifications
       (kind, dedupe_key, sermon_id, title, body, target_url, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [message.kind, message.dedupeKey, message.sermonId ?? null, message.title,
      message.body, message.targetUrl, JSON.stringify(message.data ?? {})],
  );
  const notificationId = notification.rows[0]?.id;
  if (!notificationId) return { sent: 0, failed: 0, skipped: true };

  const subscriptions = await pool.query<{
    id: string; endpoint: string; p256dh: string; auth_secret: string;
  }>(
    `SELECT id, endpoint, p256dh, auth_secret
     FROM papaleki.push_subscriptions
     WHERE is_active = true`,
  );
  const { options } = await pushOptions();
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.targetUrl,
    kind: message.kind,
    ...message.data,
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.rows.map(async (subscription) => {
    const target: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
    };
    try {
      await webpush.sendNotification(target, payload, options);
      sent += 1;
      await pool.query(
        `UPDATE papaleki.push_subscriptions
         SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0
         WHERE id = $1`,
        [subscription.id],
      );
    } catch (error) {
      failed += 1;
      const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0);
      await pool.query(
        `UPDATE papaleki.push_subscriptions
         SET last_failure_at = CURRENT_TIMESTAMP,
             failure_count = failure_count + 1,
             is_active = CASE WHEN $2 IN (404, 410) THEN false ELSE is_active END
         WHERE id = $1`,
        [subscription.id, statusCode],
      );
      logger.warn({ err: error, subscriptionId: subscription.id }, 'Échec d’envoi d’une notification push.');
    }
  }));

  await pool.query(
    `UPDATE papaleki.push_notifications
     SET recipient_count = $2, failure_count = $3, sent_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [notificationId, sent, failed],
  );
  return { sent, failed, skipped: false };
};

export const sendDailyVerseNotification = async (force = false) => {
  const clock = await pool.query<{ local_date: string; local_hour: number }>(
    `SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi', 'YYYY-MM-DD') AS local_date,
            extract(hour FROM CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lubumbashi')::int AS local_hour`,
  );
  const dailyHour = Number((await getSetting<number>('notifications.daily_hour')) ?? 7);
  const now = clock.rows[0];
  if (!now || (!force && now.local_hour < dailyHour)) return { sent: 0, failed: 0, skipped: true };

  const passage = await getDailyFrenchBiblePassage(now.local_date);
  if (!passage) return { sent: 0, failed: 0, skipped: true };
  const body = `« ${passage.text} » — ${passage.reference}`;
  return broadcastPush({
    kind: 'daily_verse',
    dedupeKey: `daily-verse:${now.local_date}`,
    title: 'Le verset du jour',
    body: body.length > 220 ? `${body.slice(0, 217)}…` : body,
    targetUrl: `/bible?translation=fraLSG&book=${passage.book.code}&chapter=${passage.chapter}&verse=${passage.verseStart}`,
    data: { reference: passage.reference, date: now.local_date },
  });
};

export const sendWelcomeNotification = async (subscription: PushSubscription) => {
  if (!(await notificationEnabled())) return;
  const passage = await getDailyFrenchBiblePassage();
  const body = passage
    ? `« ${passage.text} » — ${passage.reference}`
    : 'Vous recevrez le verset du jour et les nouvelles prédications.';
  const { options } = await pushOptions();
  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'Notifications activées',
    body: body.length > 220 ? `${body.slice(0, 217)}…` : body,
    url: passage ? `/bible?translation=fraLSG&book=${passage.book.code}&chapter=${passage.chapter}&verse=${passage.verseStart}` : '/',
    kind: 'welcome',
  }), { ...options, urgency: 'high' });
};

export const sendSermonPublishedNotification = async (sermonId: string) => {
  const result = await pool.query<{
    id: string; title: string; slug: string; scripture_reference: string | null; display_name: string;
  }>(
    `SELECT s.id, s.title, s.slug, s.scripture_reference, p.display_name
     FROM papaleki.sermons s
     JOIN papaleki.preachers p ON p.id = s.preacher_id
     WHERE s.id = $1 AND s.status = 'published' AND s.published_at <= CURRENT_TIMESTAMP`,
    [sermonId],
  );
  const sermon = result.rows[0];
  if (!sermon) return { sent: 0, failed: 0, skipped: true };
  const detail = sermon.scripture_reference ? ` · ${sermon.scripture_reference}` : '';
  return broadcastPush({
    kind: 'sermon_published',
    dedupeKey: `sermon-published:${sermon.id}`,
    sermonId: sermon.id,
    title: 'Nouvelle prédication disponible',
    body: `${sermon.title} — ${sermon.display_name}${detail}`,
    targetUrl: `/predications/${sermon.slug}`,
    data: { sermonId: sermon.id },
  });
};

export const dispatchPendingSermonNotifications = async () => {
  const result = await pool.query<{ id: string }>(
    `SELECT s.id
     FROM papaleki.sermons s
     WHERE s.status = 'published'
       AND s.published_at <= CURRENT_TIMESTAMP
       AND s.published_at >= coalesce(
         (SELECT (value #>> '{}')::timestamptz
          FROM papaleki.site_settings
          WHERE setting_key = 'notifications.sermon_push_started_at'),
         CURRENT_TIMESTAMP
       )
       AND NOT EXISTS (
         SELECT 1 FROM papaleki.push_notifications n
         WHERE n.sermon_id = s.id AND n.kind = 'sermon_published'
       )
     ORDER BY s.published_at
     LIMIT 20`,
  );
  for (const sermon of result.rows) await sendSermonPublishedNotification(sermon.id);
};
