import type { Request, Response } from 'express';
import { pingDb } from '../config/db';

   
export async function health(_req: Request, res: Response) {
  const db = await pingDb();
  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    db: db ? 'connected' : 'disconnected',
    serverTime: new Date().toISOString(),
  });
}
