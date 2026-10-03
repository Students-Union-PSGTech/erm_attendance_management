import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sessionCreateSchema, sessionUpdateSchema } from '../validators/session.validators';
import * as sessions from '../controllers/sessions.controller';

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

sessionsRouter.get('/', sessions.listSessions);
sessionsRouter.get('/:id', sessions.getSession);

sessionsRouter.post('/', requireAdmin, validateBody(sessionCreateSchema), sessions.createSession);
sessionsRouter.patch('/:id', requireAdmin, validateBody(sessionUpdateSchema), sessions.updateSession);
sessionsRouter.delete('/:id', requireAdmin, sessions.deleteSession);

sessionsRouter.put('/:id/records/:memberId', requireAdmin, sessions.markAttendance);
sessionsRouter.delete('/:id/records/:memberId', requireAdmin, sessions.clearAttendance);
