import type { Request, RequestHandler } from 'express';
import { ACCESS_COOKIE } from '../config/constants.js';
import { pool } from '../db/pool.js';
import { hashToken } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';

interface AuthRow {
  user_id: string;
  session_id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[] | null;
  permissions: string[] | null;
}

const extractAccessToken = (req: Request): string | undefined => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractAccessToken(req);
  if (!token) {
    next();
    return;
  }

  const result = await pool.query<AuthRow>(
    `SELECT
       u.id AS user_id,
       s.id AS session_id,
       u.email::text,
       u.first_name,
       u.last_name,
       array_remove(array_agg(DISTINCT r.code), NULL) AS roles,
       array_remove(array_agg(DISTINCT p.code), NULL) AS permissions
     FROM papaleki.auth_sessions s
     JOIN papaleki.users u ON u.id = s.user_id
     LEFT JOIN papaleki.user_roles ur ON ur.user_id = u.id
     LEFT JOIN papaleki.roles r ON r.id = ur.role_id
     LEFT JOIN papaleki.role_permissions rp ON rp.role_id = r.id
     LEFT JOIN papaleki.permissions p ON p.id = rp.permission_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.status = 'active'
       AND u.deleted_at IS NULL
     GROUP BY u.id, s.id`,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (row) {
    req.auth = {
      userId: row.user_id,
      sessionId: row.session_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
    };
    void pool.query(
      `UPDATE papaleki.auth_sessions
       SET last_seen_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND last_seen_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
      [row.session_id],
    );
  }

  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentification requise.'));
    return;
  }
  next();
};

export const requirePermission = (...permissions: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentification requise.'));
      return;
    }

    const allowed =
      req.auth.roles.includes('super_admin') ||
      permissions.every((permission) => req.auth?.permissions.includes(permission));

    if (!allowed) {
      next(new AppError(403, 'FORBIDDEN', 'Vous n’avez pas la permission requise.'));
      return;
    }
    next();
  };
