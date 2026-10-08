import cron from 'node-cron';
import { app } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { ensureStorage } from './modules/media/storage.service.js';
import { dispatchPendingSermonNotifications, sendDailyVerseNotification } from './modules/notifications/notifications.service.js';
import { runAudioWorker } from './modules/worker/audio-processor.js';

await ensureStorage();
await checkDatabase();

const workerController = new AbortController();
void runAudioWorker(workerController.signal).catch((error) => {
  logger.error({ err: error }, 'Le worker audio intégré s’est arrêté.');
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Application PapaLeki démarrée sur Render.');
});

const publishTask = cron.schedule('* * * * *', async () => {
  await pool.query('CALL papaleki.sp_publish_due_content()').catch((error) => {
    logger.error({ err: error }, 'Échec de publication des contenus programmés.');
  });
  await dispatchPendingSermonNotifications().catch((error) => {
    logger.error({ err: error }, 'Échec des notifications de prédications programmées.');
  });
});

const dailyVerseTask = cron.schedule('5 * * * *', async () => {
  await sendDailyVerseNotification().catch((error) => {
    logger.error({ err: error }, 'Échec de la notification du verset du jour.');
  });
}, { timezone: 'Africa/Lubumbashi' });

void Promise.all([
  dispatchPendingSermonNotifications(),
  sendDailyVerseNotification(),
]).catch((error) => logger.error({ err: error }, 'Échec de l’initialisation des notifications.'));

const cleanupTask = cron.schedule('15 3 * * *', async () => {
  await pool.query('CALL papaleki.sp_cleanup_expired_security_data()').catch((error) => {
    logger.error({ err: error }, 'Échec du nettoyage des sessions expirées.');
  });
}, { timezone: 'Africa/Lubumbashi' });

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Arrêt gracieux de l’application Render.');
  publishTask.stop();
  dailyVerseTask.stop();
  cleanupTask.stop();
  workerController.abort();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
