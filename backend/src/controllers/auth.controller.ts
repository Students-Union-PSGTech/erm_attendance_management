import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { signToken, currentUser } from '../middleware/auth';
import { resetAllCredentials } from '../services/credentials.service';
import { badRequest, conflict, notFound, unauthorized } from '../utils/httpError';
import type { Team } from '../config/constants';

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username: string; password: string };
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid username or password');
  }
  const token = signToken({
    _id: user._id,
    role: user.role,
    team: (user.team ?? undefined) as Team | undefined,
    tokenVersion: user.tokenVersion,
  });
  res.json({ token, user: user.toJSON() });
}

// GET /api/auth/me
export async function me(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}

// PATCH /api/auth/me/credentials  (any logged-in user, their own login)
// Needs the current password. Old tokens stop working; a fresh token is returned
// so the caller stays logged in.
export async function updateOwnCredentials(req: Request, res: Response) {
  const { currentPassword, username, newPassword } = req.body as {
    currentPassword: string;
    username?: string;
    newPassword?: string;
  };
  const user = await User.findById(currentUser(req).id);
  if (!user) throw unauthorized('Session no longer valid');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Validation failed', [{ path: 'currentPassword', message: 'Current password is incorrect' }]);
  }

  if (username && username !== user.username) {
    if (await User.exists({ username })) throw conflict('Username already taken');
    user.username = username;
  }
  if (newPassword) user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion += 1; // log out other sessions using the old credentials
  await user.save();

  const token = signToken({
    _id: user._id,
    role: user.role,
    team: (user.team ?? undefined) as Team | undefined,
    tokenVersion: user.tokenVersion,
  });
  res.json({ token, user: user.toJSON() });
}

// GET /api/credentials  (admin)
export async function listCredentials(_req: Request, res: Response) {
  const users = await User.find().sort({ role: 1, username: 1 });
  res.json({ users: users.map((u) => u.toJSON()) });
}

// PATCH /api/credentials/:id  (admin, FR-1.6)
export async function updateCredential(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw badRequest('invalid id');
  const { username, password } = req.body as { username?: string; password?: string };

  const user = await User.findById(id);
  if (!user) throw notFound('Login not found');

  if (username && username !== user.username) {
    if (await User.exists({ username })) throw conflict('Username already taken');
    user.username = username;
  }
  if (password) user.passwordHash = await bcrypt.hash(password, 10);
  user.tokenVersion += 1; // log out sessions using the old credentials
  await user.save();

  res.json({ user: user.toJSON() });
}

// POST /api/credentials/reset  (admin, FR-1.7)
export async function resetCredentials(_req: Request, res: Response) {
  const count = await resetAllCredentials();
  res.json({ message: 'All credentials reset to factory defaults. Please log in again.', count });
}