import express from 'express';
import cors from 'cors';
import './types/express';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '2mb' }));
  // CSV import sends the raw file as the body
  app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
