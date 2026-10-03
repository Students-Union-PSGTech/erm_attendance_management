import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { signToken, currentUser } from '../middleware/auth';
import { resetAllCredentials } from '../services/credentials.service';
import { badRequest, conflict, notFound, unauthorized } from '../utils/httpError';
import type { Team } from '../config/constants';


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


export async function me(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}


export async function listCredentials(_req: Request, res: Response) {
  const users = await User.find().sort({ role: 1, username: 1 });
  res.json({ users: users.map((u) => u.toJSON()) });
}


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
  user.tokenVersion += 1; 
  await user.save();

  res.json({ user: user.toJSON() });
}


export async function resetCredentials(_req: Request, res: Response) {
  const count = await resetAllCredentials();
  res.json({ message: 'All credentials reset to factory defaults. Please log in again.', count });
}
