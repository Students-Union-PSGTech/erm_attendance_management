import type { Request, Response } from 'express';
import { resolveTeamScope } from '../middleware/auth';
import { dailyAttendance, memberAttendanceStats, memberSummary } from '../services/stats.service';
import { sessionQuerySchema } from '../validators/session.validators';


export async function summary(req: Request, res: Response) {
  res.json(await memberSummary(resolveTeamScope(req)));
}


export async function attendance(req: Request, res: Response) {
  const { from, to } = sessionQuerySchema.parse(req.query);
  res.json({ members: await memberAttendanceStats(resolveTeamScope(req), from, to) });
}


export async function daily(req: Request, res: Response) {
  const { from, to } = sessionQuerySchema.parse(req.query);
  res.json({ days: await dailyAttendance(resolveTeamScope(req), from, to) });
}
