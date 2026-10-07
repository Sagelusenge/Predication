import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { REFRESH_COOKIE } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} from './auth.schemas.js';
import {
  acceptInvitation,
  changePassword,
  clearSessionCookies,
  login,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  setSessionCookies,
} from './auth.service.js';

export const authRouter = Router();

const strictLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

authRouter.post('/login', strictLimit, validate(loginSchema), async (req, res) => {
  const result = await login(req.body, req);
  setSessionCookies(res, result.tokens);
  res.json({ success: true, data: { user: result.user } });
});

authRouter.post('/refresh', strictLimit, validate(refreshSchema), async (req, res) => {
  const refreshToken =
    (req.signedCookies?.[REFRESH_COOKIE] as string | undefined) ?? req.body.refreshToken;
  if (!refreshToken) {
    throw new AppError(401, 'MISSING_REFRESH_TOKEN', 'Jeton de renouvellement absent.');
  }
  const result = await refreshSession(refreshToken, req);
  setSessionCookies(res, result.tokens);
  res.json({ success: true, data: { user: result.user } });
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await pool.query(
    `UPDATE papaleki.auth_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'Déconnexion'
     WHERE id = $1`,
    [req.auth?.sessionId],
  );
  clearSessionCookies(res);
  res.status(204).send();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.auth });
});

authRouter.post('/forgot-password', strictLimit, validate(forgotPasswordSchema), async (req, res) => {
  const developmentToken = await requestPasswordReset(req.body.email, req);
  res.json({
    success: true,
    message: 'Si cette adresse existe, un lien de réinitialisation a été envoyé.',
    ...(env.NODE_ENV === 'development' && developmentToken ? { developmentToken } : {}),
  });
});

authRouter.post('/reset-password', strictLimit, validate(resetPasswordSchema), async (req, res) => {
  await resetPassword(req.body.token, req.body.password);
  clearSessionCookies(res);
  res.json({ success: true, message: 'Mot de passe modifié.' });
});

authRouter.post('/accept-invitation', strictLimit, validate(acceptInvitationSchema), async (req, res) => {
  await acceptInvitation(req.body.token, req.body.password);
  res.json({ success: true, message: 'Compte activé. Vous pouvez maintenant vous connecter.' });
});

authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res) => {
  await changePassword(
    req.auth!.userId,
    req.body.currentPassword,
    req.body.newPassword,
    req.auth!.sessionId,
  );
  res.json({ success: true, message: 'Mot de passe modifié.' });
});
