import { readFile } from 'node:fs/promises';
import path from 'node:path';
import argon2 from 'argon2';
import pg from 'pg';
import { importBibleTranslations } from '../modules/bible/bible-import.service.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL est requis pour installer la base de données.');

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 2,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  application_name: 'papaleki-database-installer',
});

const files = [
  '001_schema.sql',
  '002_functions_triggers.sql',
  '003_procedures.sql',
  '004_views.sql',
  '005_seed.sql',
  '006_bible.sql',
];

try {
  for (const file of files) {
    const sql = await readFile(path.resolve(process.cwd(), 'database', file), 'utf8');
    await pool.query(sql);
    console.log(`[database] ${file} appliqué.`);
  }

  const admin = {
    email: process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.INITIAL_ADMIN_PASSWORD,
    firstName: process.env.INITIAL_ADMIN_FIRST_NAME?.trim(),
    lastName: process.env.INITIAL_ADMIN_LAST_NAME?.trim(),
  };
  const users = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM papaleki.users WHERE deleted_at IS NULL');
  if (users.rows[0]?.count === 0 && admin.email && admin.password && admin.firstName && admin.lastName) {
    if (admin.password.length < 10) throw new Error('INITIAL_ADMIN_PASSWORD doit contenir au moins 10 caractères.');
    const hash = await argon2.hash(admin.password, { type: argon2.argon2id });
    await pool.query('CALL papaleki.sp_bootstrap_super_admin($1, $2, $3, $4, NULL)', [
      admin.email,
      hash,
      admin.firstName,
      admin.lastName,
    ]);
    console.log(`[database] Administrateur initial créé pour ${admin.email}.`);
  } else if (users.rows[0]?.count === 0) {
    console.log('[database] Aucun administrateur initial configuré.');
  } else {
    console.log('[database] Administration déjà initialisée.');
  }

  await importBibleTranslations(pool);
} finally {
  await pool.end();
}
