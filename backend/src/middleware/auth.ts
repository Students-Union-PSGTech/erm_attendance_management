import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { TEAMS, type Team, type UserRole } from '../config/constants';
import { User } from '../models/User';
import type { AuthUser } from '../types/express';
import { forbidden, unauthorized } from '../utils/httpError';

interface TokenPayload {
  sub: string;
  role: UserRole;
  team?: Team;
  tv: number; // token version
}

export function signToken(user: { _id: unknown; role: UserRole; team?: Team | null; tokenVersion: number }): string {
  const payload: TokenPayload = {
    sub: String(user._id),
    role: user.role,
    team: user.team ?? undefined,
    tv: user.tokenVersion,
  };
  // FR-1.1 / FR-1.5: a single short-lived access token, no refresh token
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as TokenPayload;
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || user.tokenVersion !== payload.tv) throw unauthorized('Session no longer valid');

  req.user = {
    id: String(user._id),
    username: user.username,
    role: user.role,
    team: (user.team ?? undefined) as Team | undefined,
  };
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') throw forbidden('Admin access required');
  next();
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * FR-1.3 / FR-1.4: team users are always locked to their own team;
 * admins may optionally narrow to one team via ?team=.
 * Returns undefined for "all teams".
 */
export function resolveTeamScope(req: Request): Team | undefined {
  const user = currentUser(req);
  if (user.role === 'team') {
    if (!user.team) throw forbidden('Team account has no team assigned');
    return user.team;
  }
  const requested = typeof req.query.team === 'string' ? req.query.team.toUpperCase() : undefined;
  return requested && (TEAMS as readonly string[]).includes(requested) ? (requested as Team) : undefined;
}
