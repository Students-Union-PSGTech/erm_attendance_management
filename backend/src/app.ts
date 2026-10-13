import express from 'express';
import cors from 'cors';
import './types/express';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  const allowedOrigins = new Set([
    ...env.corsOrigins,
    'https://erm-attendance-management-six.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (
          allowedOrigins.has(cleanOrigin) ||
          allowedOrigins.has('*') ||
          /^https:\/\/erm-attendance-management.*\.vercel\.app$/.test(cleanOrigin)
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '2mb' }));
  // CSV import sends the raw file as the body
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
