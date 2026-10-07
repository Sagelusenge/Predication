import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool, types } = pg;

types.setTypeParser(20, (value) => Number.parseInt(value, 10));
types.setTypeParser(1700, (value) => Number.parseFloat(value));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'test' ? 2 : 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  application_name: 'papaleki-api',
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Erreur inattendue sur une connexion PostgreSQL inactive.');
});

export const checkDatabase = async (): Promise<void> => {
  await pool.query('SELECT 1');
};

export interface AuditContext {
  userId?: string;
  requestId?: string;
  ipAddress?: string;
}

export const withTransaction = async <T>(
  callback: (client: pg.PoolClient) => Promise<T>,
  context: AuditContext = {},
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (context.userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [context.userId]);
    }
    if (context.requestId) {
      await client.query("SELECT set_config('app.request_id', $1, true)", [context.requestId]);
    }
    if (context.ipAddress) {
      await client.query("SELECT set_config('app.ip_address', $1, true)", [context.ipAddress]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
