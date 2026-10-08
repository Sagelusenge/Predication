import pg from 'pg';
import { importBibleTranslations } from '../modules/bible/bible-import.service.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL est requis pour importer la Bible.');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 2,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  application_name: 'papaleki-bible-importer',
});

try {
  await importBibleTranslations(pool);
} finally {
  await pool.end();
}

