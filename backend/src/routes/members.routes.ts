import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { memberCreateSchema, memberUpdateSchema } from '../validators/member.validators';
import * as members from '../controllers/members.controller';

export const membersRouter = Router();
membersRouter.use(requireAuth);

// Static paths before /:id
membersRouter.get('/export.csv', members.exportMembers);
membersRouter.post('/import', members.importMembersCsv);

membersRouter.get('/', members.listMembers);
membersRouter.get('/:id', members.getMember);
membersRouter.get('/:id/attendance', members.getMemberAttendance);

membersRouter.post('/', validateBody(memberCreateSchema), members.createMember);
membersRouter.patch('/:id', validateBody(memberUpdateSchema), members.updateMember);
membersRouter.delete('/:id', members.deleteMember);
