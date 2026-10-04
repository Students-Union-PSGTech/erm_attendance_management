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
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-12">
      
      {/* Tab Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full max-w-fit self-center border border-slate-200">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-none ${
            activeTab === 'performance' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Member Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-none ${
            activeTab === 'stats' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">Meeting Stats</span>
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-none ${
            activeTab === 'exports' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Data Exports</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        {activeTab === 'exports' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Download className="w-5 h-5 text-blue-600" />
              Data Exports
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={downloadMembersPDF}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl font-medium transition-all"
              >
                <Users className="w-4 h-4" />
                Download Members PDF
              </button>
              <button 
                onClick={downloadAttendancePDF}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-medium transition-all"
              >
                <Activity className="w-4 h-4" />
                Download Attendance PDF
              </button>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[650px] min-h-[300px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-100/50 shrink-0 flex items-center justify-between bg-white/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  Session Pulse
                </h2>
                <p className="text-sm text-slate-500 mt-1.5 ml-[52px] font-medium">Daily attendance aggregates & trends</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-5 pb-8">
              <div className="space-y-4">
                {sessionStats.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 font-medium">No session data available.</div>
                ) : (
                  sessionStats.map((d, i) => (
                    <div key={d.id} className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-[0_8px_20px_rgb(0,0,0,0.04)] hover:border-purple-200 hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shrink-0 group-hover:bg-purple-50 group-hover:border-purple-100 transition-colors">
                          <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1 group-hover:text-purple-400 transition-colors">{new Date(d.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-xl font-black text-slate-700 leading-none group-hover:text-purple-700 transition-colors">{new Date(d.date).getDate()}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base group-hover:text-purple-700 transition-colors truncate max-w-[200px] sm:max-w-[300px]">{d.title}</p>
                          <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {d.present} of {d.marked} present
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 w-20">
                        <span className={`text-xl font-black tracking-tight ${
                          d.presentPct >= 75 ? 'text-emerald-500' :
                          d.presentPct >= 50 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {d.presentPct}%
                        </span>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              d.presentPct >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                              d.presentPct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'
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
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[650px] min-h-[300px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-100/50 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  Member Performance
                </h2>
                <p className="text-sm text-slate-500 mt-1.5 ml-[52px] font-medium">Cumulative individual statistics</p>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-3">
                <div className="relative w-full lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, team, role..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setShowDefaulters(false)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!showDefaulters ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    All Members
                  </button>
                  <button
                    onClick={() => setShowDefaulters(true)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${showDefaulters ? 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-rose-600'}`}
                  >
                    &lt; 75% Attendance
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-5 pb-8">
              <div className="space-y-4">
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
                    return <div className="flex items-center justify-center h-40 text-slate-400 font-medium">No members match this criteria.</div>;
                  }

                  return displayedMembers.map((s, i) => (
                    <div key={s.memberId} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-[0_8px_20px_rgb(0,0,0,0.04)] hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors text-sm mb-1.5">{s.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-wider rounded-md border border-slate-100">{s.team}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{s.role}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attended</span>
                          <span className="text-sm font-black text-slate-700">
                            {s.present} <span className="text-slate-300 mx-0.5">/</span> {s.total}
                          </span>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 w-16 border-l border-slate-100 pl-5">
                          <span className={`text-lg font-black tracking-tight ${
                            s.presentPct >= 75 ? 'text-emerald-500' :
                            s.presentPct >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {s.presentPct}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                s.presentPct >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                s.presentPct >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'
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
          </div>
        )}
      </div>
    </div>
  );
}
