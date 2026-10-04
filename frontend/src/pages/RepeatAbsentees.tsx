import { UserX, CalendarClock } from 'lucide-react';
import { isUpcoming, nowKey } from './sessionTime';

/**
 * "Last 3 sessions absentees", one card per vertical that has members.
 *
 * Each vertical uses its OWN 3 most recent meetings that have started, picked from every meeting
 * created so far: admin-created or team-created, the vertical's own, multi-team ones that include
 * it, and union-wide ones. The card shows how the vertical did in each of those meetings and
 * lists the members who were absent in all three.
 * Not marked counts as absent; INFORMED (excused) is never counted as absent.
 */

type SessionLike = {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  team: string;
  records?: Record<string, { status: string } | undefined>;
};
type MemberLike = { id: string; name: string; team: string; role: string; rollNo?: string | null };

interface RepeatAbsenteesProps {
  sessions: SessionLike[];
  members: MemberLike[];
  /** Only these verticals (team portal passes its own). Default: every vertical that has members. */
  teams?: string[];
  /** Number of most recent meetings per vertical. */
  count?: number;
  /** Show the small "Absent in last 3 meetings" heading above the cards. */
  showTitle?: boolean;
}

const TEAM_ORDER = ['ERM', 'TECH', 'PR', 'DESIGN', 'AMBIANCE', 'MEDIA'];
const ROLE_ORDER = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
const rankIn = (order: string[], v?: string) => {
  const i = order.indexOf((v || '').toUpperCase());
  return i === -1 ? order.length : i;
};
const ROLE_SHORT: Record<string, string> = { 'LEAD': 'Lead', 'CO-LEAD': 'Co-Lead', 'COORDINATOR': 'Coord', 'CORE': 'Core' };

const sessionTeams = (team?: string) => (team || 'ALL').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
const statusIn = (s: SessionLike, memberId: string) => s.records?.[memberId]?.status || 'ABSENT';

/** One entry per vertical that has members (in vertical order). */
export function repeatAbsenteesByTeam(sessions: SessionLike[], members: MemberLike[], teams?: string[], count = 3) {
  const now = nowKey();
  const held = sessions
    .filter(s => !isUpcoming(s, now)) // upcoming meetings don't count yet
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || ''));

  const withMembers = Array.from(new Set(members.map(m => (m.team || '').toUpperCase()).filter(Boolean)));
  const verticals = (teams && teams.length ? teams.map(t => t.toUpperCase()).filter(t => withMembers.includes(t)) : withMembers)
    .sort((a, b) => rankIn(TEAM_ORDER, a) - rankIn(TEAM_ORDER, b) || a.localeCompare(b));

  return verticals.map(team => {
    const meetings = held.filter(s => {
      const ts = sessionTeams(s.team);
      return ts.includes('ALL') || ts.includes(team);
    });
    const last = meetings.slice(0, count);
    const teamMembers = members.filter(m => (m.team || '').toUpperCase() === team);
    const perMeeting = last.map(s => {
      const present = teamMembers.filter(m => statusIn(s, m.id) === 'PRESENT').length;
      const absent = teamMembers.filter(m => statusIn(s, m.id) === 'ABSENT').length;
      return { id: s.id, title: s.title, date: s.date, present, absent, total: teamMembers.length };
    });
    const eligible = last.length >= count;
    const absentees = !eligible
      ? []
      : teamMembers
          .filter(m => last.every(s => statusIn(s, m.id) === 'ABSENT'))
          .sort((a, b) => rankIn(ROLE_ORDER, a.role) - rankIn(ROLE_ORDER, b.role) || a.name.localeCompare(b.name));
    return { team, heldCount: meetings.length, last, perMeeting, members: teamMembers.length, absentees, eligible };
  });
}

/** The cards that will be shown (empty = the component renders nothing). */
export function repeatAbsenteeCards(sessions: SessionLike[], members: MemberLike[], teams?: string[], count = 3) {
  return repeatAbsenteesByTeam(sessions, members, teams, count);
}

export default function RepeatAbsentees({ sessions, members, teams, count = 3, showTitle = true }: RepeatAbsenteesProps) {
  const cards = repeatAbsenteeCards(sessions, members, teams, count);
  if (cards.length === 0) return null;
  const single = cards.length === 1;

  return (
    <div>
      {showTitle && (
        <div className="flex items-center gap-2 mb-3">
          <UserX className="w-4 h-4 text-rose-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Absent in last {count} meetings</h4>
        </div>
      )}

      <div className={`grid gap-4 ${single ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {cards.map(c => (
          <div
            key={c.team}
            className={`rect-card p-4 flex flex-col border-l-4 ${
              !c.eligible ? 'border-l-slate-600' : c.absentees.length ? 'border-l-rose-500' : 'border-l-emerald-500'
            }`}
          >
            {/* Vertical name + how many missed all 3 */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-lg font-black text-white uppercase tracking-widest">{c.team}</span>
              {c.eligible ? (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                    c.absentees.length
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  }`}
                  title={`Members absent in all of ${c.team}'s last ${count} meetings`}
                >
                  {c.absentees.length} / {c.members} missed all {count}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-mono">{c.members} members</span>
              )}
            </div>

            {/* This vertical's last meetings (admin- or team-created) */}
            {c.perMeeting.length === 0 ? (
              <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mb-1">
                <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                No meetings held yet
              </p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {c.perMeeting.map(pm => {
                  const pct = pm.total ? Math.round((pm.present / pm.total) * 100) : 0;
                  return (
                    <div key={pm.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-slate-500 w-11 shrink-0">{pm.date.slice(5)}</span>
                      <span className="text-slate-200 truncate flex-1 min-w-0" title={pm.title}>{pm.title}</span>
                      <span className="font-mono text-slate-300 shrink-0">
                        {pm.present}<span className="text-slate-600">/{pm.total}</span>
                      </span>
                      <span className={`font-mono font-bold w-10 text-right shrink-0 ${pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Members absent in all of the last 3 */}
            {!c.eligible ? (
              c.heldCount > 0 && (
                <p className="text-[11px] text-slate-500 font-mono">
                  Repeat absentees show after {count} meetings ({c.heldCount} held so far)
                </p>
              )
            ) : c.absentees.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2.5 text-center text-xs text-emerald-400 font-medium">
                Nobody missed all {count}
              </div>
            ) : (
              <>
                <p className="text-[11px] font-medium text-slate-400 mb-1.5">Absent in all {count}</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 rounded-md border border-white/10 bg-[#050B14]/80 p-2">
                  {c.absentees.map(m => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded hover:bg-white/[0.04]">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 truncate">{m.name}</p>
                        {m.rollNo && <p className="text-[10px] text-slate-500 font-mono truncate">{m.rollNo}</p>}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 text-slate-300 rounded font-medium shrink-0">
                        {ROLE_SHORT[m.role] || m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}