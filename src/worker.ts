import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { runAudioWorker } from './modules/worker/audio-processor.js';

const controller = new AbortController();

const shutdown = () => controller.abort();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
  await runAudioWorker(controller.signal);
} catch (error) {
  logger.fatal({ err: error }, 'Le worker audio s’est arrêté brutalement.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
