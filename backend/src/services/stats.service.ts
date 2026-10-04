import { ROLES, TEAMS, type AttendanceStatus, type Team } from '../config/constants';
import { Member } from '../models/Member';
import { hasStarted, nowKey } from '../utils/sessionTime';
import { AttendanceSession } from '../models/Session';

type Entry = { status: AttendanceStatus; notes?: string; markedAt?: string };
type RecordsMap = Map<string, Entry> | Record<string, Entry> | undefined | null;

/** Mongoose Map or plain object -> plain object */
export function recordsToObject(records: RecordsMap): Record<string, Entry> {
  if (!records) return {};
  return records instanceof Map ? Object.fromEntries(records) : records;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

/**
 * Date-range filter only. Team matching is done in code with sessionTargets(),
 * because a session's team can be one vertical, ALL, or several ("TECH,AMBIANCE").
 */
function sessionFilter(from?: string, to?: string) {
  const filter: Record<string, unknown> = {};
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  return filter;
}

/** Does this session apply to a member of `team`? (ALL, or the member's own vertical) */
export function sessionTargets(sessionTeam: string | undefined, team: string): boolean {
  const teams = String(sessionTeam || 'ALL').split(',').map((t) => t.trim().toUpperCase());
  return teams.includes('ALL') || teams.includes(String(team).toUpperCase());
}

/**
 * Status of a member in a session. Not marked counts as ABSENT,
 * the same way the attendance screens show it.
 */
export function statusIn(records: RecordsMap, memberId: string): AttendanceStatus {
  return recordsToObject(records)[memberId]?.status ?? 'ABSENT';
}

/** Role order LEAD, CO-LEAD, COORDINATOR, CORE (then anything else), then name A-Z. */
export function byRoleThenName(a: { role?: string; name?: string }, b: { role?: string; name?: string }): number {
  const rank = (r?: string) => {
    const i = (ROLES as readonly string[]).indexOf(String(r ?? '').toUpperCase());
    return i === -1 ? ROLES.length : i;
  };
  return rank(a.role) - rank(b.role) || String(a.name ?? '').localeCompare(String(b.name ?? ''));
}

/** FR-6.1 / FR-6.2: totals and role breakdown for the visible members. */
export async function memberSummary(team?: Team) {
  const match = team ? { team } : {};
  const rows = await Member.aggregate<{ _id: { team: string; role: string }; count: number }>([
    { $match: match },
    { $group: { _id: { team: '$team', role: '$role' }, count: { $sum: 1 } } },
  ]);

  const byRole = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<string, number>;
  const byTeam: Record<string, { total: number; byRole: Record<string, number> }> = {};
  for (const t of team ? [team] : TEAMS) {
    byTeam[t] = { total: 0, byRole: Object.fromEntries(ROLES.map((r) => [r, 0])) };
  }

  let total = 0;
  for (const { _id, count } of rows) {
    total += count;
    byRole[_id.role] = (byRole[_id.role] ?? 0) + count;
    if (byTeam[_id.team]) {
      byTeam[_id.team].total += count;
      byTeam[_id.team].byRole[_id.role] = (byTeam[_id.team].byRole[_id.role] ?? 0) + count;
    }
  }
  return { total, byRole, byTeam };
}

/**
 * FR-3.9: per-member present/absent/informed counts and percentages.
 * total = every meeting for the member's vertical (ALL, their team's, and multi-team ones that include it),
 * so everyone in a vertical has the same total. Unmarked = absent. Upcoming meetings are left out.
 */
export async function memberAttendanceStats(team?: Team, from?: string, to?: string) {
  const [members, sessions] = await Promise.all([
    Member.find(team ? { team } : {}, { name: 1, team: 1, role: 1 }).sort({ name: 1 }).lean(),
    AttendanceSession.find(sessionFilter(from, to), { team: 1, date: 1, startTime: 1, records: 1 }).lean(),
  ]);
  // Upcoming meetings (not started yet) don't count
  const now = nowKey();
  const plain = sessions.filter((s) => hasStarted(s, now)).map((s) => ({ team: s.team as string, records: recordsToObject(s.records as RecordsMap) }));

  return members.sort(byRoleThenName).map((m) => {
    const id = m._id as string;
    const t = { PRESENT: 0, ABSENT: 0, INFORMED: 0 } as Record<AttendanceStatus, number>;
    let total = 0;
    for (const s of plain) {
      if (!sessionTargets(s.team, m.team)) continue;
      total++;
      t[s.records[id]?.status ?? 'ABSENT']++;
    }
    return {
      memberId: id,
      name: m.name,
      team: m.team,
      role: m.role,
      present: t.PRESENT,
      absent: t.ABSENT,
      informed: t.INFORMED,
      total,
      presentPct: pct(t.PRESENT, total),
      absentPct: pct(t.ABSENT, total),
      informedPct: pct(t.INFORMED, total),
    };
  });
}

/**
 * FR-2.8: one member's history over every meeting held for their vertical
 * (unmarked = ABSENT, marked: false). Same numbers as memberAttendanceStats.
 */
export async function memberHistory(member: { _id: unknown; team: string }) {
  const id = member._id as string;
  const sessions = await AttendanceSession.find(
    {},
    { date: 1, startTime: 1, endTime: 1, sessionSlot: 1, title: 1, team: 1, records: 1 },
  )
    .sort({ date: -1, startTime: -1 })
    .lean();

  const now = nowKey();
  const history = sessions
    .filter((s) => hasStarted(s, now) && sessionTargets(s.team as string, member.team))
    .map((s) => {
    const entry = recordsToObject(s.records as RecordsMap)[id];
    return {
      sessionId: s._id,
      date: s.date,
      startTime: s.startTime,
      ...(s.endTime && { endTime: s.endTime }),
      sessionSlot: s.sessionSlot,
      title: s.title,
      team: s.team,
      ...entry,
      status: entry?.status ?? 'ABSENT',
      marked: Boolean(entry),
    };
  });

  const count = (status: AttendanceStatus) => history.filter((h) => h.status === status).length;
  const total = history.length;
  const present = count('PRESENT');
  return {
    stats: { total, present, absent: count('ABSENT'), informed: count('INFORMED'), presentPct: pct(present, total) },
    history,
  };
}

/**
 * FR-3.7 / FR-3.8: per-day totals for the heatmap and trend chart.
 * Each session counts the visible members it applies to; unmarked = absent.
 */
export async function dailyAttendance(team?: Team, from?: string, to?: string) {
  const [members, sessions] = await Promise.all([
    Member.find(team ? { team } : {}, { _id: 1, team: 1 }).lean(),
    AttendanceSession.find(sessionFilter(from, to), { date: 1, startTime: 1, team: 1, records: 1 }).sort({ date: 1 }).lean(),
  ]);

  const byDate = new Map<string, { date: string; sessions: number; present: number; absent: number; informed: number }>();
  const now = nowKey();
  for (const s of sessions) {
    if (!hasStarted(s, now)) continue; // upcoming
    if (team && !sessionTargets(s.team as string, team)) continue;
    const day = byDate.get(s.date) ?? { date: s.date, sessions: 0, present: 0, absent: 0, informed: 0 };
    day.sessions++;
    const records = recordsToObject(s.records as RecordsMap);
    for (const m of members) {
      if (!sessionTargets(s.team as string, m.team)) continue;
      const status = records[m._id as string]?.status ?? 'ABSENT';
      if (status === 'PRESENT') day.present++;
      else if (status === 'INFORMED') day.informed++;
      else day.absent++;
    }
    byDate.set(s.date, day);
  }

  return [...byDate.values()].map((d) => {
    const marked = d.present + d.absent + d.informed;
    return { ...d, marked, presentPct: pct(d.present, marked) };
  });
}