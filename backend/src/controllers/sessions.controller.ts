import type { Request, Response } from 'express';
import { AttendanceSession } from '../models/Session';
import { Member } from '../models/Member';
import { currentUser, resolveTeamScope } from '../middleware/auth';
import { recordsToObject } from '../services/stats.service';
import { newId } from '../utils/ids';
import { slotFromTime } from '../utils/normalize';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { idParamSchema } from '../validators/member.validators';
import {
  attendanceEntrySchema,
  sessionQuerySchema,
  type SessionCreateInput,
  type SessionUpdateInput,
} from '../validators/session.validators';
import type { Team } from '../config/constants';

type Records = SessionCreateInput['records'];

/** Fill in markedAt and reject member ids that don't exist. */
async function prepareRecords(records: Records): Promise<Records> {
  const ids = Object.keys(records);
  if (ids.length === 0) return records;
  const found = await Member.find({ _id: { $in: ids } }, { _id: 1 }).lean();
  const known = new Set(found.map((m) => m._id as string));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw badRequest('Unknown member ids in records', { unknown });

  const now = new Date().toISOString();
  return Object.fromEntries(
    Object.entries(records).map(([id, entry]) => [id, { ...entry, markedAt: entry.markedAt ?? now }]),
  );
}

/** Team users only see their own members' entries inside a session. */
async function scopeSession<T extends { records?: unknown }>(session: T, team?: Team): Promise<T> {
  if (!team) return session;
  const ids = new Set((await Member.find({ team }, { _id: 1 }).lean()).map((m) => m._id as string));
  const records = Object.fromEntries(
    Object.entries(recordsToObject(session.records as never)).filter(([id]) => ids.has(id)),
  );
  return { ...session, records };
}

function sessionToJSON(s: Record<string, unknown>) {
  const { _id, ...rest } = s;
  return { id: _id, ...rest, records: recordsToObject(rest.records as never) };
}

/** Sessions visible to the caller, honouring ?from=, ?to=, ?team=. */
export async function querySessions(req: Request) {
  const q = sessionQuerySchema.parse(req.query);
  const user = currentUser(req);
  const scope = resolveTeamScope(req);

  const filter: Record<string, unknown> = {};
  if (user.role === 'team') filter.team = { $in: [scope, 'ALL'] };
  else if (q.team) filter.team = q.team === 'ALL' ? 'ALL' : { $in: [q.team, 'ALL'] };
  if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };

  const sessions = await AttendanceSession.find(filter).sort({ date: -1, startTime: -1 }).lean();
  const teamUserScope = user.role === 'team' ? scope : undefined;
  const scoped = await Promise.all(sessions.map((s) => scopeSession(s, teamUserScope)));
  return scoped.map((s) => sessionToJSON(s as never));
}

// GET /api/sessions?from=&to=&team=
export async function listSessions(req: Request, res: Response) {
  res.json({ sessions: await querySessions(req) });
}

// GET /api/sessions/:id
export async function getSession(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const user = currentUser(req);
  const session = await AttendanceSession.findById(id).lean();
  if (!session) throw notFound('Session not found');
  if (user.role === 'team' && session.team !== 'ALL' && session.team !== user.team) {
    throw notFound('Session not found');
  }
  const scoped = await scopeSession(session, user.role === 'team' ? user.team : undefined);
  res.json({ session: sessionToJSON(scoped as never) });
}

// POST /api/sessions   (admin, FR-3.6)
export async function createSession(req: Request, res: Response) {
  const { id, records, endTime, ...data } = req.body as SessionCreateInput;
  const _id = id ?? newId('session');
  if (await AttendanceSession.exists({ _id })) throw conflict('Session id already exists');

  const session = await AttendanceSession.create({
    _id,
    ...data,
    ...(endTime && { endTime }),
    records: await prepareRecords(records),
    createdBy: currentUser(req).username,
  });
  res.status(201).json({ session: session.toJSON() });
}

// PATCH /api/sessions/:id   (admin, FR-3.6) — `records` here replaces the whole map
export async function updateSession(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const { records, endTime, ...data } = req.body as SessionUpdateInput;

  const existing = await AttendanceSession.findById(id, { startTime: 1, endTime: 1 }).lean();
  if (!existing) throw notFound('Session not found');

  // endTime must stay after startTime once merged with what's stored
  const start = data.startTime ?? existing.startTime;
  const end = endTime === null ? undefined : (endTime ?? existing.endTime ?? undefined);
  if (start && end && end <= start) {
    throw badRequest('Validation failed', [{ path: 'endTime', message: 'endTime must be after startTime' }]);
  }
  // Moving the start time moves the slot too, unless a slot was sent explicitly
  if (data.startTime && !data.sessionSlot) data.sessionSlot = slotFromTime(data.startTime);

  const $set: Record<string, unknown> = { ...data };
  if (endTime) $set.endTime = endTime;
  if (records) $set.records = await prepareRecords(records);
  const update: Record<string, unknown> = { $set };
  if (endTime === null) update.$unset = { endTime: '' };

  const session = await AttendanceSession.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!session) throw notFound('Session not found');
  res.json({ session: session.toJSON() });
}

// PUT /api/sessions/:id/records/:memberId   (admin) — mark a single member
export async function markAttendance(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const memberId = idParamSchema.parse(req.params.memberId);
  const entry = attendanceEntrySchema.parse(req.body);
  const [prepared] = Object.values(await prepareRecords({ [memberId]: entry }));

  const session = await AttendanceSession.findByIdAndUpdate(
    id,
    { $set: { [`records.${memberId}`]: prepared } },
    { new: true, runValidators: true },
  );
  if (!session) throw notFound('Session not found');
  res.json({ session: session.toJSON() });
}

// DELETE /api/sessions/:id/records/:memberId   (admin) — clear a single mark
export async function clearAttendance(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const memberId = idParamSchema.parse(req.params.memberId);
  const session = await AttendanceSession.findByIdAndUpdate(
    id,
    { $unset: { [`records.${memberId}`]: '' } },
    { new: true },
  );
  if (!session) throw notFound('Session not found');
  res.json({ session: session.toJSON() });
}


export async function deleteSession(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const deleted = await AttendanceSession.findByIdAndDelete(id);
  if (!deleted) throw notFound('Session not found');
  res.status(204).end();
}