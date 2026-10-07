import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import type { DatabaseError } from 'pg';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const postgresError = (error: DatabaseError): AppError | undefined => {
  if (error.code === '23505') {
    return new AppError(409, 'CONFLICT', 'Cette valeur existe déjà.');
  }
  if (error.code === '23503') {
    return new AppError(409, 'RELATION_CONFLICT', 'Cette ressource est encore utilisée.');
  }
  if (error.code === '23514' || error.code === '22P02') {
    return new AppError(422, 'INVALID_DATA', 'Les données ne respectent pas les règles métier.');
  }
  if (error.code === '42501') {
    return new AppError(403, 'FORBIDDEN', 'Permission refusée.');
  }
  if (error.code === 'P0001') {
    return new AppError(422, 'BUSINESS_RULE', error.message);
  }
  return undefined;
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route introuvable : ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let normalized: AppError;

  if (error instanceof AppError) {
    normalized = error;
  } else if (error instanceof ZodError) {
    normalized = new AppError(
      422,
      'VALIDATION_ERROR',
      'Les données envoyées sont invalides.',
      error.issues,
    );
  } else if (error instanceof MulterError) {
    normalized = new AppError(413, 'UPLOAD_ERROR', error.message);
  } else if (typeof error === 'object' && error !== null && 'code' in error) {
    normalized = postgresError(error as DatabaseError) ??
      new AppError(500, 'DATABASE_ERROR', 'Une erreur de base de données est survenue.');
  } else {
    normalized = new AppError(500, 'INTERNAL_ERROR', 'Une erreur inattendue est survenue.');
  }

  const log = normalized.statusCode >= 500 ? req.log?.error.bind(req.log) : req.log?.warn.bind(req.log);
  (log ?? logger.error.bind(logger))(
    { err: error, requestId: req.id, code: normalized.code },
    normalized.message,
  );

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined ? {} : { details: normalized.details }),
      ...(env.NODE_ENV === 'development' && error instanceof Error
        ? { stack: error.stack }
        : {}),
    },
    requestId: req.id,
  });
};
