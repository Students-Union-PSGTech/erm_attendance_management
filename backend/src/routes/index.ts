import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as stats from '../controllers/stats.controller';
import { snapshot } from '../controllers/sync.controller';
import { health } from '../controllers/health.controller';
import { authRouter, credentialsRouter } from './auth.routes';
import { membersRouter } from './members.routes';
import { sessionsRouter } from './sessions.routes';

export const apiRouter = Router();

apiRouter.get('/health', health);
apiRouter.use('/auth', authRouter);
apiRouter.use('/credentials', credentialsRouter);
apiRouter.use('/members', membersRouter);
apiRouter.use('/sessions', sessionsRouter);

apiRouter.get('/stats/summary', requireAuth, stats.summary);
apiRouter.get('/stats/attendance', requireAuth, stats.attendance);
apiRouter.get('/stats/daily', requireAuth, stats.daily);

apiRouter.get('/sync', requireAuth, snapshot);
