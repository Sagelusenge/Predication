import cron from 'node-cron';
import { app } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { ensureStorage } from './modules/media/storage.service.js';

await ensureStorage();
await checkDatabase();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'API PapaLeki démarrée.');
});

const publishTask = cron.schedule('* * * * *', async () => {
  await pool.query('CALL papaleki.sp_publish_due_content()').catch((error) => {
    logger.error({ err: error }, 'Échec de publication des contenus programmés.');
  });
});

const cleanupTask = cron.schedule('15 3 * * *', async () => {
  await pool.query('CALL papaleki.sp_cleanup_expired_security_data()').catch((error) => {
    logger.error({ err: error }, 'Échec du nettoyage des sessions expirées.');
  });
}, { timezone: 'Africa/Lubumbashi' });

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Arrêt gracieux en cours.');
  publishTask.stop();
  cleanupTask.stop();
  server.close(async () => {
    await pool.end();
    logger.info('API arrêtée.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
