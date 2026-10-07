import argon2 from 'argon2';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, API_PREFIX, REFRESH_COOKIE } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { pool, withTransaction } from '../../db/pool.js';
import { createToken, hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { sendMail } from '../../lib/mailer.js';
import type { LoginInput } from './auth.schemas.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  status: string;
  locked_until: Date | null;
  roles: string[] | null;
  permissions: string[] | null;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$0MHFXkOuBah85daubrIkjw$j9GX81F75RvFpB91637LHsobE40lzKrgJQlWln4QFn4';

const cookieBase = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  signed: true,
});

export const setSessionCookies = (res: Response, tokens: SessionTokens): void => {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieBase(),
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60_000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieBase(),
    path: `${API_PREFIX}/auth`,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
};

export const clearSessionCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: `${API_PREFIX}/auth` });
};

const publicUser = (user: UserRow) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  roles: user.roles ?? [],
  permissions: user.permissions ?? [],
});

const recordFailedLogin = async (email: string, req: Request): Promise<void> => {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE papaleki.users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
             ELSE locked_until
           END
       WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    await client.query(
      `INSERT INTO papaleki.auth_events
       (email, event_name, succeeded, ip_address, user_agent)
       VALUES ($1, 'login', false, $2, $3)`,
      [email, req.ip, req.get('user-agent')],
    );
  });
};

export const login = async (input: LoginInput, req: Request) => {
  const result = await pool.query<UserRow>(
    `SELECT
       u.id, u.email::text, u.password_hash, u.first_name, u.last_name,
       u.status, u.locked_until,
       array_remove(array_agg(DISTINCT r.code), NULL) AS roles,
       array_remove(array_agg(DISTINCT p.code), NULL) AS permissions
     FROM papaleki.users u
     LEFT JOIN papaleki.user_roles ur ON ur.user_id = u.id
     LEFT JOIN papaleki.roles r ON r.id = ur.role_id
     LEFT JOIN papaleki.role_permissions rp ON rp.role_id = r.id
     LEFT JOIN papaleki.permissions p ON p.id = rp.permission_id
     WHERE u.email = $1 AND u.deleted_at IS NULL
     GROUP BY u.id`,
    [input.email],
  );

  const user = result.rows[0];
  const valid = await argon2.verify(user?.password_hash ?? DUMMY_PASSWORD_HASH, input.password);
  if (!user || !valid || user.status !== 'active') {
    await recordFailedLogin(input.email, req);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Adresse e-mail ou mot de passe incorrect.');
  }
  if (user.locked_until && user.locked_until > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Compte temporairement verrouillé. Réessayez plus tard.');
  }
  const accessToken = createToken();
  const refreshToken = createToken(64);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO papaleki.auth_sessions
       (user_id, token_hash, refresh_token_hash, ip_address, user_agent,
        expires_at, refresh_expires_at)
       VALUES (
         $1, $2, $3, $4, $5,
         CURRENT_TIMESTAMP + ($6 * INTERVAL '1 minute'),
         CURRENT_TIMESTAMP + ($7 * INTERVAL '1 day')
       )`,
      [
        user.id,
        hashToken(accessToken),
        hashToken(refreshToken),
        req.ip,
        req.get('user-agent'),
        env.ACCESS_TOKEN_TTL_MINUTES,
        env.REFRESH_TOKEN_TTL_DAYS,
      ],
    );
    await client.query(
      `UPDATE papaleki.users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id],
    );
    await client.query(
      `INSERT INTO papaleki.auth_events
       (user_id, email, event_name, succeeded, ip_address, user_agent)
       VALUES ($1, $2, 'login', true, $3, $4)`,
      [user.id, user.email, req.ip, req.get('user-agent')],
    );
  });

  return { user: publicUser(user), tokens: { accessToken, refreshToken } };
};

export const refreshSession = async (refreshToken: string, req: Request) => {
  const newAccessToken = createToken();
  const newRefreshToken = createToken(64);

  const user = await withTransaction(async (client) => {
    const sessionResult = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM papaleki.auth_sessions
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND refresh_expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [hashToken(refreshToken)],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expirée ou invalide.');
    }

    const result = await client.query<UserRow>(
      `SELECT
         u.id, u.email::text, u.password_hash, u.first_name, u.last_name,
         u.status, u.locked_until,
         array_remove(array_agg(DISTINCT r.code), NULL) AS roles,
         array_remove(array_agg(DISTINCT p.code), NULL) AS permissions
       FROM papaleki.users u
       LEFT JOIN papaleki.user_roles ur ON ur.user_id = u.id
       LEFT JOIN papaleki.roles r ON r.id = ur.role_id
       LEFT JOIN papaleki.role_permissions rp ON rp.role_id = r.id
       LEFT JOIN papaleki.permissions p ON p.id = rp.permission_id
       WHERE u.id = $1 AND u.status = 'active' AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [session.user_id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Le compte n’est plus actif.');
    }

    await client.query(
      `UPDATE papaleki.auth_sessions
       SET token_hash = $1,
           refresh_token_hash = $2,
           expires_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute'),
           refresh_expires_at = CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day'),
           last_seen_at = CURRENT_TIMESTAMP,
           ip_address = $5,
           user_agent = $6
       WHERE id = $7`,
      [
        hashToken(newAccessToken),
        hashToken(newRefreshToken),
        env.ACCESS_TOKEN_TTL_MINUTES,
        env.REFRESH_TOKEN_TTL_DAYS,
        req.ip,
        req.get('user-agent'),
        session.id,
      ],
    );
    return row;
  });

  return {
    user: publicUser(user),
    tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken },
  };
};

export const requestPasswordReset = async (email: string, req: Request): Promise<string | undefined> => {
  const userResult = await pool.query<{ id: string; email: string; first_name: string }>(
    `SELECT id, email::text, first_name
     FROM papaleki.users
     WHERE email = $1 AND status = 'active' AND deleted_at IS NULL`,
    [email],
  );
  const user = userResult.rows[0];
  if (!user) return undefined;

  const token = createToken(48);
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM papaleki.password_reset_tokens
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );
    await client.query(
      `INSERT INTO papaleki.password_reset_tokens
       (user_id, token_hash, expires_at, requested_ip)
       VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute'), $4)`,
      [user.id, hashToken(token), env.PASSWORD_RESET_TTL_MINUTES, req.ip],
    );
  });

  const url = `${env.APP_URL}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe PapaLeki',
    text: `Bonjour ${user.first_name}, utilisez ce lien pour réinitialiser votre mot de passe : ${url}`,
    html: `<p>Bonjour ${user.first_name},</p><p><a href="${url}">Réinitialiser mon mot de passe</a></p>`,
    developmentUrl: url,
  });
  return token;
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await withTransaction(async (client) => {
    const result = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM papaleki.password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [hashToken(token)],
    );
    const reset = result.rows[0];
    if (!reset) {
      throw new AppError(422, 'INVALID_RESET_TOKEN', 'Lien invalide ou expiré.');
    }

    await client.query(
      `UPDATE papaleki.users
       SET password_hash = $1, failed_login_count = 0, locked_until = NULL
       WHERE id = $2 AND status = 'active' AND deleted_at IS NULL`,
      [passwordHash, reset.user_id],
    );
    await client.query(
      `UPDATE papaleki.password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [reset.id],
    );
    await client.query(
      `UPDATE papaleki.auth_sessions
       SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'Mot de passe modifié'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [reset.user_id],
    );
  });
};

export const acceptInvitation = async (token: string, password: string): Promise<void> => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await pool.query('CALL papaleki.sp_accept_user_invitation($1, $2)', [
    hashToken(token),
    passwordHash,
  ]);
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string,
): Promise<void> => {
  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM papaleki.users WHERE id = $1',
    [userId],
  );
  const hash = result.rows[0]?.password_hash;
  if (!hash || !(await argon2.verify(hash, currentPassword))) {
    throw new AppError(422, 'INVALID_CURRENT_PASSWORD', 'Le mot de passe actuel est incorrect.');
  }
  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await withTransaction(async (client) => {
    await client.query('UPDATE papaleki.users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    await client.query(
      `UPDATE papaleki.auth_sessions
       SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'Mot de passe modifié'
       WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, currentSessionId],
    );
  }, { userId });
};
