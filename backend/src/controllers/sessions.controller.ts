import type { Request, Response } from 'express';
import { AttendanceSession } from '../models/Session';
import { Member } from '../models/Member';
import { currentUser, resolveTeamScope } from '../middleware/auth';
import { recordsToObject } from '../services/stats.service';
import { newId } from '../utils/ids';
import { slotFromTime } from '../utils/normalize';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { idParamSchema } from '../validators/member.validators';
import {
  attendanceEntrySchema,
  sessionQuerySchema,
  type SessionCreateInput,
  type SessionUpdateInput,
} from '../validators/session.validators';
import type { Team } from '../config/constants';
import type { AuthUser } from '../types/express';

type Records = SessionCreateInput['records'];

/**
 * Fill in markedAt and reject member ids that don't exist.
 * With `team`, every member must also belong to that team (team logins).
 */
async function prepareRecords(records: Records, team?: Team): Promise<Records> {
  const ids = Object.keys(records);
  if (ids.length === 0) return records;
  const found = await Member.find({ _id: { $in: ids } }, { _id: 1, team: 1 }).lean();
  const known = new Set(found.map((m) => m._id as string));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw badRequest('Unknown member ids in records', { unknown });
  if (team) {
    const otherTeam = found.filter((m) => m.team !== team).map((m) => m._id as string);
    if (otherTeam.length) throw forbidden(`You can only mark members of ${team}`);
  }

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

/**
 * Who may change a session:
 *   admin - any session
 *   team  - only sessions of their own team (not ALL sessions, not other teams)
 */
function assertCanManage(user: AuthUser, session: { team: string }) {
  if (user.role === 'admin') return;
  if (session.team !== user.team) {
    throw forbidden(
      session.team === 'ALL'
        ? 'Only admin can edit or delete ALL-team sessions'
        : "You can only manage your own team's sessions",
    );
  }
}

/**
 * Who may mark a member in a session:
 *   admin - anyone, any session
 *   team  - their own members, in their own team's sessions and in ALL sessions
 */
async function assertCanMark(user: AuthUser, session: { team: string }, memberId: string) {
  if (user.role === 'admin') return;
  if (session.team !== user.team && session.team !== 'ALL') {
    throw forbidden("You can only mark attendance in your own team's or ALL sessions");
  }
  const member = await Member.findById(memberId, { team: 1 }).lean();
  if (!member) throw badRequest('Unknown member ids in records', { unknown: [memberId] });
  if (member.team !== user.team) throw forbidden(`You can only mark members of ${user.team}`);
}

/**
 * Session as returned to the caller. Team logins only get their own members' marks back,
 * e.g. after marking someone in an ALL session.
 */
async function sessionForUser(user: AuthUser, doc: { toJSON(): unknown }) {
  const json = doc.toJSON() as Record<string, unknown>;
  return user.role === 'team' ? scopeSession(json, user.team) : json;
}

/** Team logins: the team they act for. undefined for admin. */
const teamOf = (user: AuthUser): Team | undefined => (user.role === 'team' ? user.team : undefined);

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
  if (user.role === 'team') {
    filter.$or = [{ team: 'ALL' }, { team: { $regex: new RegExp(`(?:^|,)\\s*${scope}\\s*(?:,|$)`, 'i') } }];
  } else if (q.team) {
    if (q.team === 'ALL') filter.team = 'ALL';
    else filter.$or = [{ team: 'ALL' }, { team: { $regex: new RegExp(`(?:^|,)\\s*${q.team}\\s*(?:,|$)`, 'i') } }];
  }
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

// POST /api/sessions   (admin: any team; team login: own team only)
export async function createSession(req: Request, res: Response) {
  const user = currentUser(req);
  const { id, records, endTime, ...data } = req.body as SessionCreateInput;

  // Team logins always create sessions for their own team. "ALL" (the default) becomes
  // their team; asking for a different team is refused.
  if (user.role === 'team') {
    if (data.team !== 'ALL' && data.team !== user.team) throw forbidden("You can only create your own team's sessions");
    data.team = user.team!;
  }

  const _id = id ?? newId('session');
  if (await AttendanceSession.exists({ _id })) throw conflict('Session id already exists');

  const session = await AttendanceSession.create({
    _id,
    ...data,
    ...(endTime && { endTime }),
    records: await prepareRecords(records, teamOf(user)),
    createdBy: user.username,
  });
  res.status(201).json({ session: await sessionForUser(user, session) });
}

// PATCH /api/sessions/:id   (admin: any; team login: own team's) — `records` replaces the whole map
export async function updateSession(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const user = currentUser(req);
  const { records, endTime, ...data } = req.body as SessionUpdateInput;

  const existing = await AttendanceSession.findById(id, { startTime: 1, endTime: 1, team: 1 }).lean();
  if (!existing) throw notFound('Session not found');
  assertCanManage(user, existing);
  if (user.role === 'team' && data.team && data.team !== user.team) {
    throw forbidden("You can't move a session to another team");
  }

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
  if (records) $set.records = await prepareRecords(records, teamOf(user));
  const update: Record<string, unknown> = { $set };
  if (endTime === null) update.$unset = { endTime: '' };

  const session = await AttendanceSession.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!session) throw notFound('Session not found');
  res.json({ session: await sessionForUser(currentUser(req), session) });
}

// PUT /api/sessions/:id/records/:memberId   (admin; team login: own members) — mark a single member
export async function markAttendance(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const memberId = idParamSchema.parse(req.params.memberId);
  const entry = attendanceEntrySchema.parse(req.body);
  const user = currentUser(req);

  const existing = await AttendanceSession.findById(id, { team: 1 }).lean();
  if (!existing) throw notFound('Session not found');
  await assertCanMark(user, existing, memberId);
  const [prepared] = Object.values(await prepareRecords({ [memberId]: entry }));

  const session = await AttendanceSession.findByIdAndUpdate(
    id,
    { $set: { [`records.${memberId}`]: prepared } },
    { new: true, runValidators: true },
  );
  if (!session) throw notFound('Session not found');
  res.json({ session: await sessionForUser(currentUser(req), session) });
}

// DELETE /api/sessions/:id/records/:memberId   (admin; team login: own members) — clear a single mark
export async function clearAttendance(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const memberId = idParamSchema.parse(req.params.memberId);
  const existing = await AttendanceSession.findById(id, { team: 1 }).lean();
  if (!existing) throw notFound('Session not found');
  await assertCanMark(currentUser(req), existing, memberId);
  const session = await AttendanceSession.findByIdAndUpdate(
    id,
    { $unset: { [`records.${memberId}`]: '' } },
    { new: true },
  );
  if (!session) throw notFound('Session not found');
  res.json({ session: await sessionForUser(currentUser(req), session) });
}

// DELETE /api/sessions/:id   (admin: any; team login: own team's)
export async function deleteSession(req: Request, res: Response) {
  const id = idParamSchema.parse(req.params.id);
  const existing = await AttendanceSession.findById(id, { team: 1 }).lean();
  if (!existing) throw notFound('Session not found');
  assertCanManage(currentUser(req), existing);
  const deleted = await AttendanceSession.findByIdAndDelete(id);
  if (!deleted) throw notFound('Session not found');
  res.status(204).end();
}