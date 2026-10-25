import './config/env'; // validate env first — crashes early if misconfigured
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { connectDB, closeDB } from './config/db';
import { logger } from './utils/logger';
import { generalLimiter } from './middleware/rateLimiter';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { setupService } from './modules/setup/setup.service';
import apiRoutes from './routes/index';

const app = express();

// Security headers
app.use(helmet());
app.disable('x-powered-by');

// CORS — only allow the configured client origin
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Response compression
app.use(compression());

// Body parsing with strict size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL injection guard — strips $ and . from request data
app.use(mongoSanitize());

// HTTP parameter pollution guard
app.use(hpp());

// Request logging via pino-http
app.use(
  pinoHttp({
    logger,
    // Don't log health checks — they would flood the logs
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
  })
);

// General rate limiter applied to all routes
app.use(generalLimiter);

// API routes
app.use('/api', apiRoutes);

// Root — useful during development
app.get('/', (_req, res) => {
  res.json({ name: 'HCM Lite API', version: '1.0.0', health: '/api/health' });
});

// 404 and error handlers — must be last
app.use(notFoundHandler);
app.use(globalErrorHandler);

let server: ReturnType<typeof app.listen>;

async function start(): Promise<void> {
  server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  try {
    await connectDB();
    await setupService.autoSetupFromEnv();
  } catch (err: any) {
    logger.error({ err }, 'Error during background DB initialization');
  }
}

// Graceful shutdown — close HTTP server then MongoDB before exiting
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  server?.close(async () => {
    await closeDB();
    logger.info('Server and database connections closed');
    process.exit(0);
  });

  // Force-exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch unhandled rejections — log and exit so the process manager can restart
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

if (env.NODE_ENV !== 'test') {
  start();
}

// Export app (without starting) for test use
export { app };
