import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { API_PREFIX } from './config/constants.js';
import { env } from './config/env.js';
import { checkDatabase } from './db/pool.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { optionalAuth } from './middleware/auth.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { mediaPublicRouter } from './modules/media/media.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { workerRouter } from './modules/worker/worker.routes.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', 'strong');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const supplied = req.headers['x-request-id'];
      const id = typeof supplied === 'string' && supplied.length <= 100 ? supplied : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
  }));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  app.use(cors({
    origin: env.APP_URL,
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'ETag', 'X-Request-Id'],
  }));
  app.use(compression({
    filter: (req, res) => req.path.includes('/media/') ? false : compression.filter(req, res),
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(optionalAuth);

  app.get(`${API_PREFIX}/health/live`, (_req, res) => {
    res.json({ success: true, data: { status: 'alive', version: '1.0.0' } });
  });
  app.get(`${API_PREFIX}/health/ready`, async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ success: true, data: { status: 'ready', database: 'connected' } });
    } catch {
      res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'PostgreSQL indisponible.' } });
    }
  });

  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/media`, mediaPublicRouter);
  app.use(`${API_PREFIX}/admin`, adminRouter);
  app.use(`${API_PREFIX}/worker`, workerRouter);
  app.use(API_PREFIX, publicRouter);

  const frontendRoot = path.resolve(process.cwd(), 'frontend', 'dist');
  if (env.NODE_ENV !== 'test' && existsSync(path.join(frontendRoot, 'index.html'))) {
    app.use(express.static(frontendRoot, {
      index: false,
      maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
    }));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/openapi.json' || req.path.startsWith('/docs')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendRoot, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

export const app = createApp();
