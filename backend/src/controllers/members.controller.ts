import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Member } from '../models/Member';
import { resolveTeamScope, currentUser } from '../middleware/auth';
import { importMembers, removeMembersFromSessions } from '../services/member.service';
import { memberHistory } from '../services/stats.service';
import { membersToCsv, parseMembersCsv } from '../utils/csv';
import { newId } from '../utils/ids';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { idParamSchema, type MemberCreateInput, type MemberUpdateInput } from '../validators/member.validators';
import { ROLES } from '../config/constants';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Fetch one member, 404 if it doesn't exist or is outside the caller's team. */
async function findVisibleMember(req: Request) {
  const id = idParamSchema.parse(req.params.id);
  const team = resolveTeamScope(req);
  const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;
  const member = await Member.findOne({ _id, ...(team && { team }) });
  if (!member) throw notFound('Member not found');
  return member;
}

/** Members visible to the caller, honouring ?team=, ?role=, ?search= (FR-2.7, FR-1.3). */
export async function queryMembers(req: Request) {
  const team = resolveTeamScope(req);
  const filter: Record<string, unknown> = {};
  if (team) filter.team = team;

  const role = typeof req.query.role === 'string' ? req.query.role.toUpperCase() : undefined;
  if (role && (ROLES as readonly string[]).includes(role)) filter.role = role;

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: re }, { rollNo: re }, { department: re }, { phone: re }];
  }

  const members = await Member.find(filter).sort({ name: 1 });
  return members.map((m) => m.toJSON());
}

// GET /api/members?team=&role=&search=
export async function listMembers(req: Request, res: Response) {
  res.json({ members: await queryMembers(req) });
}

// GET /api/members/:id
export async function getMember(req: Request, res: Response) {
  const member = await findVisibleMember(req);
  res.json({ member: member.toJSON() });
}

// GET /api/members/:id/attendance   (FR-2.8: attendance history for the detail drawer)
// Every meeting held for the member's vertical; unmarked = ABSENT (same numbers as /stats/attendance)
export async function getMemberAttendance(req: Request, res: Response) {
  const member = await findVisibleMember(req);
  res.json({ member: member.toJSON(), ...(await memberHistory(member)) });
}

// POST /api/members   (admin, FR-2.4)
export async function createMember(req: Request, res: Response) {
  const { id, ...data } = req.body as MemberCreateInput;
  const user = currentUser(req);
  if (user.role === 'team' && user.team) {
    data.team = user.team as any;
  }
  const _id = id ?? newId('custom');
  if (await Member.exists({ _id })) throw conflict('Member id already exists');
  const member = await Member.create({ _id, ...data });
  res.status(201).json({ member: member.toJSON() });
}

// PATCH /api/members/:id
export async function updateMember(req: Request, res: Response) {
  await findVisibleMember(req); // 404 if missing or outside the caller's team
  const id = idParamSchema.parse(req.params.id);
  const update = req.body as MemberUpdateInput;
  const user = currentUser(req);
  if (user.role === 'team' && user.team && update.team) {
    update.team = user.team as any;
  }
  const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;
  const member = await Member.findOneAndUpdate({ _id }, { $set: update }, { new: true, runValidators: true });
  if (!member) throw notFound('Member not found');
  res.json({ member: member.toJSON() });
}

// DELETE /api/members/:id
export async function deleteMember(req: Request, res: Response) {
  await findVisibleMember(req);
  const id = idParamSchema.parse(req.params.id);
  const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;
  const deleted = await Member.findOneAndDelete({ _id });
  if (!deleted) throw notFound('Member not found');
  await removeMembersFromSessions([id]);
  res.status(204).end();
}

// GET /api/members/export.csv   (FR-2.9)
export async function exportMembers(req: Request, res: Response) {
  const team = resolveTeamScope(req);
  const members = await Member.find(team ? { team } : {}).sort({ team: 1, name: 1 }).lean();
  const stamp = new Date().toISOString().slice(0, 10);
  res
    .type('text/csv')
    .attachment(`erm-members-${team ?? 'ALL'}-${stamp}.csv`)
    .send(membersToCsv(members));
}

// POST /api/members/import   (admin, FR-2.10)
// Body: raw CSV text (Content-Type: text/csv). Add ?replace=true to wipe existing members first.
export async function importMembersCsv(req: Request, res: Response) {
  if (typeof req.body !== 'string' || !req.body.trim()) {
    throw badRequest('Send the CSV file contents as the request body with Content-Type: text/csv');
  }
  const { members, errors } = parseMembersCsv(req.body);
  const user = currentUser(req);
  if (user.role === 'team' && user.team) {
    members.forEach(m => m.team = user.team as any);
  }
  const dryRun = req.query.dryRun === 'true';
  const result = await importMembers(members, { replace: req.query.replace === 'true', dryRun });
  res.json({ ...result, valid: members.length, invalid: errors.length, errors, dryRun });
}