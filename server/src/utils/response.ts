import { Response } from 'express';

export interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Meta
) {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) (body.error as Record<string, unknown>).details = details;
  return res.status(statusCode).json(body);
}
