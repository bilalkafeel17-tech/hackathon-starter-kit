import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required for Express to recognise this as an error handler
  next: NextFunction
): void {
  // Operational errors — expected, we have a clean message
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, req: { method: req.method, url: req.url } }, err.message);
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Mongoose CastError — invalid ObjectId
  if (err instanceof MongooseError.CastError) {
    sendError(res, 400, 'BAD_REQUEST', `Invalid value for field '${err.path}'`);
    return;
  }

  // Mongoose ValidationError — schema validation
  if (err instanceof MongooseError.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(res, 422, 'VALIDATION_ERROR', 'Database validation failed', details);
    return;
  }

  // Mongoose duplicate key (e.g. unique email already exists)
  if (isMongoError(err) && err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    sendError(res, 409, 'CONFLICT', `A record with that ${field} already exists`);
    return;
  }

  // Anything else is unexpected — log it, don't leak stack in production
  logger.error({ err }, 'Unhandled error');
  const message = env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (err as Error).message;
  sendError(res, 500, 'INTERNAL_ERROR', message);
}

interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

function isMongoError(err: unknown): err is MongoError {
  return err instanceof Error && 'code' in err;
}
