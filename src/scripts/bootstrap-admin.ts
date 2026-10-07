import argon2 from 'argon2';
import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const firstName = process.env.INITIAL_ADMIN_FIRST_NAME?.trim();
const lastName = process.env.INITIAL_ADMIN_LAST_NAME?.trim();

if (!email || !password || !firstName || !lastName) {
  logger.error(
    'Définissez INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_FIRST_NAME et INITIAL_ADMIN_LAST_NAME.',
  );
  process.exitCode = 1;
} else if (password.length < 10) {
  logger.error('INITIAL_ADMIN_PASSWORD doit contenir au moins 10 caractères.');
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await pool.query<{ p_user_id: string }>(
      'CALL papaleki.sp_bootstrap_super_admin($1, $2, $3, $4, NULL)',
      [email, passwordHash, firstName, lastName],
    );
    logger.info({ userId: result.rows[0]?.p_user_id, email }, 'Super administrateur créé.');
  } catch (error) {
    logger.error({ err: error }, 'Création du super administrateur impossible.');
    process.exitCode = 1;
  }
}

await pool.end();
