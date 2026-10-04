import { useEffect, useState } from 'react';
import { Download, Users, TrendingUp, CalendarDays, Activity, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Member } from './AdminDashboard';

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
  presentPct: number;
};

export default function ReportsView({ members }: ReportsViewProps) {
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDefaulters, setShowDefaulters] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
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
          setAttendanceStats(attData.members || []);
        }

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const computedStats = (sessionsData.sessions || []).map((s: any) => {
            let present = 0, absent = 0, informed = 0;
            if (s.records) {
              Object.values(s.records).forEach((r: any) => {
                if (r.status === 'PRESENT') present++;
                else if (r.status === 'ABSENT') absent++;
                else if (r.status === 'INFORMED') informed++;
              });
            }
            const marked = present + absent + informed;
            return {
              id: s.id,
              date: s.date,
              title: s.title,
              present,
              absent,
              informed,
              marked,
              presentPct: marked === 0 ? 0 : Math.round((present / marked) * 1000) / 10
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
  }, []);

  const downloadMembersPDF = () => {
    if (!members.length) return;
    const doc = new jsPDF();
    doc.text('Member Directory Report', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 22);

    const headers = [['Name', 'Team', 'Role', 'Roll No', 'Department', 'Year', 'Phone']];
    const data = members.map(m => [
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
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-purple-500/20"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-12 text-slate-100">

      {/* Tab Navigation */}
      <div className="rect-card p-1.5 flex gap-1 rounded-md w-full max-w-fit self-center border border-white/10 bg-[#120F1D]/80 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex-1 sm:flex-none cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.35)]'
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
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.35)]'
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
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.35)]'
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
              <Download className="w-4 h-4 text-purple-400" />
              Data Exports & Reports
            </h2>
            <p className="text-xs text-slate-400 mb-6">Export detailed member and attendance reports in clean PDF format.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={downloadMembersPDF}
                className="btn-purple-glow flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
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
                  <div className="p-1.5 bg-purple-950/60 text-purple-400 border border-purple-500/30 rounded-md">
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
                    className="rect-card p-4 flex items-center justify-between gap-3 hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(147,51,234,0.12)] transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-md bg-[#1B1430] border border-purple-500/30 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-purple-400 uppercase leading-none mb-0.5">
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
                          {d.present} of {d.marked} present
                        </p>
                      </div>
                    </div>

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
                <div className="flex items-center gap-1 bg-[#0A0713] p-1 rounded-md border border-white/10 shrink-0">
                  <button
                    onClick={() => setShowDefaulters(false)}
                    className={`px-3 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      !showDefaulters ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
                let displayedMembers = showDefaulters ? activeMembers.filter(s => s.presentPct < 75) : activeMembers;

                if (memberSearchQuery) {
                  const q = memberSearchQuery.toLowerCase();
                  displayedMembers = displayedMembers.filter(s =>
                    s.name.toLowerCase().includes(q) ||
                    s.team.toLowerCase().includes(q) ||
                    s.role.toLowerCase().includes(q)
                  );
                }

                if (displayedMembers.length === 0) {
                  return <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-xs">No members match this criteria.</div>;
                }

                return displayedMembers.map((s) => (
                  <div
                    key={s.memberId}
                    className="rect-card p-4 flex items-center justify-between gap-3 hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(147,51,234,0.12)] transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-semibold text-white truncate text-sm mb-1">{s.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#1B1430] text-purple-300 border border-purple-500/30 text-[9px] font-bold uppercase tracking-wider rounded-sm font-mono">
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
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}