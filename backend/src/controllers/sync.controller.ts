import type { Request, Response } from 'express';
import { queryMembers } from './members.controller';
import { querySessions } from './sessions.controller';


export async function snapshot(req: Request, res: Response) {
  const [members, sessions] = await Promise.all([queryMembers(req), querySessions(req)]);
  res.json({ members, sessions, serverTime: new Date().toISOString() });
}
