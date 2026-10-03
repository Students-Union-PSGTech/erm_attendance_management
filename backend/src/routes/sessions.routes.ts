import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sessionCreateSchema, sessionUpdateSchema } from '../validators/session.validators';
import * as sessions from '../controllers/sessions.controller';

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

sessionsRouter.get('/', sessions.listSessions);
sessionsRouter.get('/:id', sessions.getSession);


sessionsRouter.post('/', validateBody(sessionCreateSchema), sessions.createSession);
sessionsRouter.patch('/:id', validateBody(sessionUpdateSchema), sessions.updateSession);
sessionsRouter.delete('/:id', sessions.deleteSession);

sessionsRouter.put('/:id/records/:memberId', sessions.markAttendance);
sessionsRouter.delete('/:id/records/:memberId', sessions.clearAttendance);