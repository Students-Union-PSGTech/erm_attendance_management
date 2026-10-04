import { ROLES, TEAMS, type AttendanceStatus, type Team } from '../config/constants';
import { Member } from '../models/Member';
import { AttendanceSession } from '../models/Session';

type Entry = { status: AttendanceStatus; notes?: string; markedAt?: string };
type RecordsMap = Map<string, Entry> | Record<string, Entry> | undefined | null;

/** Mongoose Map or plain object -> plain object */
export function recordsToObject(records: RecordsMap): Record<string, Entry> {
  if (!records) return {};
  return records instanceof Map ? Object.fromEntries(records) : records;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

function sessionFilter(team: Team | undefined, from?: string, to?: string) {
  const filter: Record<string, unknown> = {};
  if (team) {
    filter.$or = [
      { team: 'ALL' },
      { team: { $regex: new RegExp(`(?:^|,)\\s*${team}\\s*(?:,|$)`, 'i') } }
    ];
  }
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  return filter;
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

/** FR-3.9: per-member present/absent/informed counts and percentages. */
export async function memberAttendanceStats(team?: Team, from?: string, to?: string) {
  const [members, sessions] = await Promise.all([
    Member.find(team ? { team } : {}, { name: 1, team: 1, role: 1 }).sort({ name: 1 }).lean(),
    AttendanceSession.find(sessionFilter(team, from, to), { records: 1 }).lean(),
  ]);

  const tally = new Map<string, Record<AttendanceStatus, number>>();
  for (const s of sessions) {
    for (const [memberId, entry] of Object.entries(recordsToObject(s.records as RecordsMap))) {
      const t = tally.get(memberId) ?? { PRESENT: 0, ABSENT: 0, INFORMED: 0 };
      t[entry.status]++;
      tally.set(memberId, t);
    }
  }

  return members.map((m) => {
    const t = tally.get(m._id as string) ?? { PRESENT: 0, ABSENT: 0, INFORMED: 0 };
    const total = t.PRESENT + t.ABSENT + t.INFORMED;
    return {
      memberId: m._id,
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
 * FR-3.7 / FR-3.8: per-day totals for the heatmap and trend chart.
 * Only counts entries for members visible in the given scope.
 */
export async function dailyAttendance(team?: Team, from?: string, to?: string) {
  const [members, sessions] = await Promise.all([
    Member.find(team ? { team } : {}, { _id: 1 }).lean(),
    AttendanceSession.find(sessionFilter(team, from, to), { date: 1, records: 1 }).sort({ date: 1 }).lean(),
  ]);
  const visible = new Set(members.map((m) => m._id as string));

  const byDate = new Map<string, { date: string; sessions: number; present: number; absent: number; informed: number }>();
  for (const s of sessions) {
    const day = byDate.get(s.date) ?? { date: s.date, sessions: 0, present: 0, absent: 0, informed: 0 };
    day.sessions++;
    for (const [memberId, entry] of Object.entries(recordsToObject(s.records as RecordsMap))) {
      if (!visible.has(memberId)) continue;
      if (entry.status === 'PRESENT') day.present++;
      else if (entry.status === 'ABSENT') day.absent++;
      else day.informed++;
    }
    byDate.set(s.date, day);
  }

  return [...byDate.values()].map((d) => {
    const marked = d.present + d.absent + d.informed;
    return { ...d, marked, presentPct: pct(d.present, marked) };
  });
}
