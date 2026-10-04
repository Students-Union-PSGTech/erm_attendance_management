import { useEffect, useState } from 'react';
import { Download, Users, TrendingUp, CalendarDays, Activity, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Member } from './AdminDashboard';
import { isUpcoming, opensLabel } from './sessionTime';

interface ReportsViewProps {
  members: Member[];
}

type AttendanceStat = {
  memberId: string;
  name: string;
  team: string;
  role: string;
  present: number;
  absent: number;
  informed: number;
  total: number;
  presentPct: number;
  absentPct: number;
  informedPct: number;
};

type SessionStat = {
  id: string;
  date: string;
  title: string;
  present: number;
  absent: number;
  informed: number;
  marked: number;
  targetCount: number;
  presentPct: number;
  upcoming: boolean;
  startTime?: string;
};

// Lists are shown LEAD → CO-LEAD → COORDINATOR → CORE, then by name
const ROLE_ORDER = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
const roleRank = (role?: string) => {
  const i = ROLE_ORDER.indexOf((role || '').toUpperCase());
  return i === -1 ? ROLE_ORDER.length : i;
};
const byRoleThenName = (a: { role?: string; name?: string }, b: { role?: string; name?: string }) =>
  roleRank(a.role) - roleRank(b.role) || (a.name || '').localeCompare(b.name || '');

// Verticals are always shown in this order
const TEAM_ORDER = ['ERM', 'TECH', 'PR', 'DESIGN', 'AMBIANCE', 'MEDIA'];
const teamRank = (team?: string) => {
  const i = TEAM_ORDER.indexOf((team || '').toUpperCase());
  return i === -1 ? TEAM_ORDER.length : i;
};
const byTeamRoleName = (a: { team?: string; role?: string; name?: string }, b: { team?: string; role?: string; name?: string }) =>
  teamRank(a.team) - teamRank(b.team) || (a.team || '').localeCompare(b.team || '') || byRoleThenName(a, b);
const pctColor = (p: number) => (p >= 75 ? 'text-emerald-400' : p >= 50 ? 'text-amber-400' : 'text-rose-400');

export default function ReportsView({ members }: ReportsViewProps) {
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDefaulters, setShowDefaulters] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // null = first vertical
  const [activeTab, setActiveTab] = useState<'exports' | 'performance' | 'stats'>('performance');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

        const [attRes, sessionsRes] = await Promise.all([
          fetch('/api/stats/attendance', { headers }),
          fetch('/api/sessions', { headers })
        ]);

        if (attRes.ok) {
          const attData = await attRes.json();
          setAttendanceStats([...(attData.members || [])].sort(byTeamRoleName));
        }

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const computedStats = (sessionsData.sessions || []).map((s: any) => {
            // Count only the members this meeting is for (ALL or the session's vertical).
            // Unmarked members count as absent, the same way the attendance screens show them.
            const teams = (s.team || 'ALL').split(',').map((t: string) => t.trim().toUpperCase());
            const targetMembers = teams.includes('ALL')
              ? members
              : members.filter((m: any) => teams.includes(m.team?.toUpperCase() || ''));
            const records = s.records || {};
            let present = 0, absent = 0, informed = 0, marked = 0;
            targetMembers.forEach((m: any) => {
              const status = records[m.id]?.status;
              if (status) marked++;
              if (status === 'PRESENT') present++;
              else if (status === 'INFORMED') informed++;
              else absent++;
            });
            const targetCount = targetMembers.length;
            const presentPct = targetCount ? Math.round((present / targetCount) * 1000) / 10 : 0;
            return {
              id: s.id,
              date: s.date,
              title: s.title,
              team: s.team || 'ALL',
              present,
              absent,
              informed,
              marked,
              targetCount,
              presentPct,
              startTime: s.startTime,
              upcoming: isUpcoming(s), // not started: shown as upcoming, never counted
            };
          });
          setSessionStats(computedStats);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [members]);

  const downloadMembersPDF = () => {
    if (!members.length) return;
    const doc = new jsPDF();
    doc.text('Member Directory Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);

    const headers = [['Name', 'Team', 'Role', 'Roll No', 'Department', 'Year', 'Phone']];
    const data = [...members].sort(byTeamRoleName).map(m => [
      m.name,
      m.team,
      m.role,
      m.rollNo || '-',
      m.department || '-',
      m.year || '-',
      m.phone || '-'
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 28 }
    });

    doc.save(`members_export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const downloadAttendancePDF = () => {
    if (!attendanceStats.length) return;
    const doc = new jsPDF();
    doc.text('Cumulative Attendance Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);

    const headers = [['Name', 'Team', 'Role', 'Present', 'Absent', 'Informed', 'Total Meets', 'Attendance %']];
    const data = attendanceStats.map(s => [
      s.name,
      s.team,
      s.role,
      s.present,
      s.absent,
      s.informed,
      s.total,
      `${s.presentPct}%`
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 28 }
    });

    doc.save(`attendance_export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-sky-500/20"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-12 text-slate-100">

      {/* Tab Navigation */}
      <div className="rect-card p-1.5 flex gap-1 rounded-md w-full max-w-fit self-center border border-white/10 bg-[#0B172B]/80 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex-1 sm:flex-none cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.35)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Member Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex-1 sm:flex-none cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.35)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">Meeting Stats</span>
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex-1 sm:flex-none cursor-pointer ${
            activeTab === 'exports'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.35)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Data Exports</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        {activeTab === 'exports' && (
          <div className="rect-card-elevated p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2 tracking-wide uppercase">
              <Download className="w-4 h-4 text-sky-400" />
              Data Exports & Reports
            </h2>
            <p className="text-xs text-slate-400 mb-6">Export detailed member and attendance reports in clean PDF format.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={downloadMembersPDF}
                className="btn-sky-glow flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Download Members PDF
              </button>
              <button
                onClick={downloadAttendancePDF}
                className="btn-rect-secondary flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                Download Attendance PDF
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="rect-card-elevated flex flex-col max-h-[650px] min-h-[300px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-5 border-b border-white/10 shrink-0 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2.5 uppercase tracking-wide">
                  <div className="p-1.5 bg-sky-950/60 text-sky-400 border border-sky-500/30 rounded-md">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  Session Pulse
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">Daily attendance aggregates & trends</p>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
              {sessionStats.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-xs">No session data available.</div>
              ) : (
                sessionStats.map((d) => (
                  <div
                    key={d.id}
                    className="rect-card p-4 flex items-center justify-between gap-3 hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)] transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-md bg-[#0C1E38] border border-sky-500/30 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-sky-400 uppercase leading-none mb-0.5">
                          {new Date(d.date).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-lg font-black text-white leading-none font-mono">
                          {new Date(d.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{d.title}</p>
                        <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
                          {d.upcoming ? opensLabel(d) : `${d.present} of ${d.targetCount} present`}
                        </p>
                      </div>
                    </div>

                    {d.upcoming ? (
                      <span className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 shrink-0">
                        Upcoming
                      </span>
                    ) : (
                    <div className="flex flex-col items-end gap-1.5 w-20 shrink-0">
                      <span className={`text-base font-bold font-mono tracking-tight ${
                        d.presentPct >= 75 ? 'text-emerald-400' :
                        d.presentPct >= 50 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {d.presentPct}%
                      </span>
                      <div className="w-full h-1.5 bg-slate-900 rounded-none overflow-hidden border border-white/5">
                        <div
                          className={`h-full transition-all duration-700 ${
                            d.presentPct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                            d.presentPct >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-rose-500 to-red-400'
                          }`}
                          style={{ width: `${d.presentPct}%` }}
                        />
                      </div>
                    </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="rect-card-elevated flex flex-col max-h-[650px] min-h-[300px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-5 border-b border-white/10 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2.5 uppercase tracking-wide">
                  <div className="p-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-md">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  Member Performance
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">Cumulative individual attendance metrics</p>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-3">
                <div className="relative w-full lg:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search name, team, role..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="rect-input w-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
                <div className="flex items-center gap-1 bg-[#050B14] p-1 rounded-md border border-white/10 shrink-0">
                  <button
                    onClick={() => setShowDefaulters(false)}
                    className={`px-3 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      !showDefaulters ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Members
                  </button>
                  <button
                    onClick={() => setShowDefaulters(true)}
                    className={`px-3 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      showDefaulters ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    &lt; 75% Attendance
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
              {(() => {
                const activeMembers = attendanceStats.filter(s => s.total > 0);
                const q = memberSearchQuery.toLowerCase();
                const matches = (s: AttendanceStat) =>
                  (!showDefaulters || s.presentPct < 75) &&
                  (!q || s.name.toLowerCase().includes(q) || s.team.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));

                // One card per vertical (team logins only see their own, so no cards there)
                const teams = Array.from(new Set(activeMembers.map(s => s.team))).sort((a, b) => teamRank(a) - teamRank(b) || a.localeCompare(b));
                const teamCards = teams.map(team => {
                  const list = activeMembers.filter(s => s.team === team);
                  const present = list.reduce((n, s) => n + s.present, 0);
                  const total = list.reduce((n, s) => n + s.total, 0);
                  return {
                    team,
                    members: list.length,
                    avg: total ? Math.round((present / total) * 1000) / 10 : 0,
                    below: list.filter(s => s.presentPct < 75).length,
                    shown: list.filter(matches).length,
                  };
                });
                const showCards = teams.length > 1;
                const current = !showCards ? 'ALL' : selectedTeam && (selectedTeam === 'ALL' || teams.includes(selectedTeam)) ? selectedTeam : teams[0];

                const displayed = activeMembers.filter(s => matches(s) && (current === 'ALL' || s.team === current));
                const groups = current === 'ALL' && showCards
                  ? teams.map(team => ({ team: team as string | null, rows: displayed.filter(s => s.team === team) })).filter(g => g.rows.length > 0)
                  : [{ team: null as string | null, rows: displayed }];

                const renderMember = (s: AttendanceStat) => (
                  <div
                    key={s.memberId}
                    className="rect-card p-4 flex items-center justify-between gap-3 hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)] transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-semibold text-white truncate text-sm mb-1">{s.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#0C1E38] text-sky-300 border border-sky-500/30 text-[9px] font-bold uppercase tracking-wider rounded-sm font-mono">
                          {s.team}
                        </span>
                        <span className="text-[11px] text-slate-400">{s.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Attended</span>
                        <span className="text-xs font-bold text-slate-200 font-mono">
                          {s.present} <span className="text-slate-600">/</span> {s.total}
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 w-20 border-l border-white/10 pl-4">
                        <span className={`text-base font-bold font-mono tracking-tight ${
                          s.presentPct >= 75 ? 'text-emerald-400' :
                          s.presentPct >= 50 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {s.presentPct}%
                        </span>
                        <div className="w-full h-1.5 bg-slate-900 rounded-none overflow-hidden border border-white/5">
                          <div
                            className={`h-full transition-all duration-700 ${
                              s.presentPct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                              s.presentPct >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-rose-500 to-red-400'
                            }`}
                            style={{ width: `${s.presentPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>);

                return (
                  <>
                    {showCards && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-1">
                        {[{ team: 'ALL', members: activeMembers.length, avg: (() => {
                            const p = activeMembers.reduce((n, s) => n + s.present, 0);
                            const t = activeMembers.reduce((n, s) => n + s.total, 0);
                            return t ? Math.round((p / t) * 1000) / 10 : 0;
                          })(), below: activeMembers.filter(s => s.presentPct < 75).length, shown: activeMembers.filter(matches).length }, ...teamCards].map(c => {
                          const active = current === c.team;
                          return (
                            <button
                              key={c.team}
                              onClick={() => setSelectedTeam(c.team)}
                              className={`rect-card text-left px-3.5 py-3 cursor-pointer transition-all border ${
                                active ? 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_18px_rgba(14,165,233,0.18)]' : 'border-white/10 hover:border-sky-500/40'
                              }`}
                              title={c.team === 'ALL' ? 'All verticals, grouped by team' : `Show ${c.team}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${active ? 'text-sky-300' : 'text-slate-300'}`}>
                                  {c.team === 'ALL' ? 'All' : c.team}
                                </span>
                                <span className={`text-base font-bold font-mono leading-none ${pctColor(c.avg)}`}>{c.avg}%</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                                {c.members} members · <span className={c.below ? 'text-rose-400/80' : ''}>{c.below} &lt;75%</span>
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {displayed.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-xs">No members match this criteria.</div>
                    ) : groups.map((g, i) => {
                      const card = teamCards.find(c => c.team === g.team);
                      return (
                        <div key={g.team || 'rows'} className={`space-y-3 ${g.team && i > 0 ? 'pt-5' : ''}`}>
                          {g.team && (
                            // Bold vertical header: stays pinned while scrolling through that team
                            <div className="sticky top-0 z-10 -mx-1 px-4 py-3 rounded-md border border-sky-500/40 border-l-4 border-l-sky-400 bg-[#0C1E38]/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex items-center gap-3">
                              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-widest">{g.team}</h3>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {g.rows.length} {g.rows.length === 1 ? 'member' : 'members'}
                              </span>
                              {card && (
                                <span className="ml-auto flex items-center gap-3 text-[11px] font-mono">
                                  {card.below > 0 && <span className="text-rose-400/90">{card.below} &lt;75%</span>}
                                  <span className={`text-sm font-bold ${pctColor(card.avg)}`}>{card.avg}% avg</span>
                                </span>
                              )}
                            </div>
                          )}
                          {g.rows.map(renderMember)}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}