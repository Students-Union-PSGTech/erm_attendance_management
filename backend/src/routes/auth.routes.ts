import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { credentialUpdateSchema, loginSchema } from '../validators/auth.validators';
import * as auth from '../controllers/auth.controller';

export const authRouter = Router();
authRouter.post('/login', validateBody(loginSchema), auth.login);
authRouter.get('/me', requireAuth, auth.me);

export const credentialsRouter = Router();
credentialsRouter.use(requireAuth, requireAdmin);
credentialsRouter.get('/', auth.listCredentials);
credentialsRouter.post('/reset', auth.resetCredentials);
credentialsRouter.patch('/:id', validateBody(credentialUpdateSchema), auth.updateCredential);
