import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { safeEqual } from '../lib/crypto.js';

export const requireWorkerKey: RequestHandler = (req, _res, next) => {
  const key = req.header('x-worker-key');
  if (!key || !safeEqual(key, env.WORKER_API_KEY)) {
    next(new AppError(401, 'INVALID_WORKER_KEY', 'Clé worker invalide.'));
    return;
  }
  next();
};
