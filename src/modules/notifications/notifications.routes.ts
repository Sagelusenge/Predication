import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import { validate } from '../../middleware/validate.js';
import { getVapidKeys, sendWelcomeNotification } from './notifications.service.js';

export const notificationsRouter = Router();

const subscriptionSchema = z.object({
  endpoint: z.url().max(3000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(1000),
    auth: z.string().min(8).max(1000),
  }),
  locale: z.string().min(2).max(20).default('fr'),
  timezone: z.string().min(2).max(80).default('Africa/Lubumbashi'),
});

const endpointSchema = z.object({ endpoint: z.url().max(3000) });
const pushLimit = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

notificationsRouter.get('/config', async (_req, res) => {
  const [keys, settings] = await Promise.all([
    getVapidKeys(),
    pool.query<{ setting_key: string; value: unknown }>(
      `SELECT setting_key, value FROM papaleki.site_settings
       WHERE setting_key IN ('notifications.enabled', 'notifications.daily_hour')`,
    ),
  ]);
  const values = Object.fromEntries(settings.rows.map((row) => [row.setting_key, row.value]));
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    success: true,
    data: {
      enabled: values['notifications.enabled'] !== false,
      publicKey: keys.publicKey,
      dailyHour: Number(values['notifications.daily_hour'] ?? 7),
      timezone: 'Africa/Lubumbashi',
    },
  });
});

notificationsRouter.post('/subscribe', pushLimit, validate(subscriptionSchema), async (req, res) => {
  const body = req.body as z.infer<typeof subscriptionSchema>;
  await pool.query(
    `INSERT INTO papaleki.push_subscriptions
       (endpoint, p256dh, auth_secret, user_id, locale, timezone, user_agent, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth_secret = EXCLUDED.auth_secret,
       user_id = coalesce(EXCLUDED.user_id, push_subscriptions.user_id),
       locale = EXCLUDED.locale,
       timezone = EXCLUDED.timezone,
       user_agent = EXCLUDED.user_agent,
       is_active = true,
       failure_count = 0,
       last_failure_at = NULL`,
    [body.endpoint, body.keys.p256dh, body.keys.auth, req.auth?.userId ?? null,
      body.locale, body.timezone, req.get('user-agent') ?? null],
  );
  void sendWelcomeNotification({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  }).catch((error) => logger.warn({ err: error }, 'La notification de bienvenue n’a pas pu être envoyée.'));
  res.status(201).json({ success: true, message: 'Notifications activées sur cet appareil.' });
});

notificationsRouter.delete('/subscribe', pushLimit, validate(endpointSchema), async (req, res) => {
  await pool.query(
    `UPDATE papaleki.push_subscriptions
     SET is_active = false WHERE endpoint = $1`,
    [req.body.endpoint],
  );
  res.status(204).send();
});
