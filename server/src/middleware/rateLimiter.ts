import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response';

// General API limiter — 200 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'RATE_LIMITED', 'Too many requests — please slow down');
  },
});

// Strict limiter for auth endpoints — 10 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only counts failed attempts
  handler: (_req, res) => {
    sendError(
      res,
      429,
      'RATE_LIMITED',
      'Too many login attempts — try again in 15 minutes'
    );
  },
});
