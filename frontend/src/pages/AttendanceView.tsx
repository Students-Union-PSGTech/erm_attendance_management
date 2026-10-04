import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Users, ArrowRight, ChevronLeft, Check, X, FileText, Search, UserX, ChevronDown, ChevronUp, Trash2, AlertCircle } from 'lucide-react';
import type { Member } from './AdminDashboard';

type AttendanceSession = {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  sessionSlot: string;
  title: string;
  team: string;
  notes?: string;
  records: Record<string, { status: string; notes?: string; markedAt?: string }>;
  createdAt?: string;
};

type RecentAbsenteeSession = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  sessionSlot: string;
  team: string;
  notes?: string | null;
  totalTargetCount: number;
  absentCount: number;
  presentCount: number;
  absentees: Array<{
    id: string;
    name: string;
    rollNo?: string | null;
    team: string;
    role: string;
    department?: string | null;
    notes?: string | null;
  }>;
};

interface AttendanceViewProps {
  members: Member[];
}

export default function AttendanceView({ members }: AttendanceViewProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [recentAbsentees, setRecentAbsentees] = useState<RecentAbsenteeSession[]>([]);
  const [absenteesLoading, setAbsenteesLoading] = useState(true);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});

  // Delete session (confirmation dialog)
  const [deletingSession, setDeletingSession] = useState<AttendanceSession | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '', sessionSlot: 'FN', team: 'ALL'
  });

  const sortSessionsDesc = (list: AttendanceSession[]) =>
    [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setSessions(sortSessionsDesc(data.sessions || []));
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentAbsentees = async () => {
    setAbsenteesLoading(true);
    try {
      const res = await fetch('/api/sessions/recent-absentees', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentAbsentees(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent absentees:', err);
    } finally {
      setAbsenteesLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchRecentAbsentees();
  }, []);

  const handleMarkAttendance = async (memberId: string, status: string) => {
    if (!activeSession) return;

    // Optimistic update
    const updatedRecords = { ...activeSession.records, [memberId]: { status, markedAt: new Date().toISOString() } };
    setActiveSession({ ...activeSession, records: updatedRecords });
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, records: updatedRecords } : s));

    try {
      await fetch(`/api/sessions/${activeSession.id}/records/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      fetchRecentAbsentees();
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      fetchSessions(); // revert on fail
    }
  };

  const handleUpdateSessionRemarks = async (notes: string) => {
    if (!activeSession) return;
    const updatedSession = { ...activeSession, notes };
    setActiveSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));

    try {
      await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes })
      });
    } catch (err) {
      console.error('Failed to update session remarks:', err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (res.ok) {
        setIsCreateModalOpen(false);
        setCreateForm({
          title: '',
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '',
          sessionSlot: 'FN',
          team: 'ALL',
        });
        await fetchSessions();
        await fetchRecentAbsentees();
        if (data.session) setActiveSession(data.session);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const openDeleteSession = (session: AttendanceSession) => {
    setDeleteError(null);
    setDeletingSession(session);
  };

  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/sessions/${deletingSession.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete the session');
        return;
      }
      setSessions(prev => prev.filter(s => s.id !== deletingSession.id));
      if (activeSession?.id === deletingSession.id) {
        setActiveSession(null);
      }
      setDeletingSession(null);
      fetchRecentAbsentees();
    } catch (err) {
      console.error('Network error deleting session:', err);
      setDeleteError('Network error, could not delete the session');
    } finally {
      setDeleteBusy(false);
    }
  };

  const deleteDialog = deletingSession && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="rect-card-elevated max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="w-11 h-11 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-white">Delete this session?</h3>
        <p className="text-xs text-[#9490A6] mt-1.5 leading-relaxed">
          <span className="font-semibold text-white">{deletingSession.title}</span> ({deletingSession.team.split(',').join(', ')}) on {deletingSession.date}
          {Object.keys(deletingSession.records || {}).length > 0 &&
            ` and its ${Object.keys(deletingSession.records || {}).length} attendance mark(s)`}{' '}
          will be removed permanently.
        </p>
        {deleteError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setDeletingSession(null)}
            disabled={deleteBusy}
            className="flex-1 btn-rect-secondary py-2 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteSession}
            disabled={deleteBusy}
            className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-md text-xs transition-colors shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
          >
            {deleteBusy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );

  if (activeSession) {
    let targetMembers = activeSession.team === 'ALL'
      ? members
      : members.filter(m => activeSession.team.split(',').includes(m.team));

    if (memberSearchQuery) {
      const q = memberSearchQuery.toLowerCase();
      targetMembers = targetMembers.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.rollNo && m.rollNo.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q)) ||
        m.role.toLowerCase().includes(q)
      );
    }

    targetMembers = [...targetMembers].sort((a, b) => a.name.localeCompare(b.name));

    const presentCount = targetMembers.filter(m => activeSession.records[m.id]?.status === 'PRESENT').length;
    const absentCount = targetMembers.filter(m => {
      const status = activeSession.records[m.id]?.status || 'ABSENT';
      return status === 'ABSENT' || status === 'INFORMED';
    }).length;
    const totalCount = targetMembers.length;

    return (
      <div className="flex flex-col md:h-full md:max-h-[calc(100vh-100px)] animate-in fade-in duration-300">
        {/* Active Session Header Card (Perfect Rectangular) */}
        <div className="rect-card p-5 mb-4 shrink-0">
          <div className="flex flex-col gap-4">
            {/* Top Row: Info & Stats */}
            <div className="flex flex-wrap items-start gap-3 sm:gap-4">
              <button
                onClick={() => setActiveSession(null)}
                className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                title="Back to Sessions"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1.5">
                  <span className="badge-reactbits-new">
                    {activeSession.team.split(',').join(', ')}
                  </span>
                  <span className="text-xs font-medium text-[#9490A6] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    {activeSession.date}
                  </span>
                  <span className="text-xs font-medium text-[#9490A6] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    {activeSession.startTime} - {activeSession.endTime || 'Ongoing'}
                  </span>
                  <span className="text-xs font-medium text-[#9490A6] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    {totalCount} Target Members
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">{activeSession.title}</h2>
              </div>

              <div className="flex gap-2 sm:gap-3 items-center shrink-0 ml-auto">
                <button
                  onClick={() => openDeleteSession(activeSession)}
                  title="Delete session"
                  className="p-2.5 rounded-md border border-white/10 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 sm:px-4 py-2 text-center min-w-[70px]">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Present</p>
                  <p className="text-2xl font-black text-emerald-300 leading-none">{presentCount}</p>
                </div>
                <div className="bg-rose-500/15 border border-rose-500/30 rounded-md px-3 sm:px-4 py-2 text-center min-w-[70px]">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Absent</p>
                  <p className="text-2xl font-black text-rose-300 leading-none">{absentCount}</p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Remarks & Search */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 sm:ml-9">
              <div className="flex-1">
                <textarea
                  placeholder="Add session remarks here... (e.g. Special instructions, delays)"
                  defaultValue={activeSession.notes || ''}
                  onBlur={(e) => handleUpdateSessionRemarks(e.target.value)}
                  className="rect-input w-full px-3.5 py-2 text-xs resize-none h-[42px] focus:h-20"
                />
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter student list..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="rect-input w-full pl-9 pr-8 py-2 text-xs"
                />
                {memberSearchQuery && (
                  <button onClick={() => setMemberSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Member Marking Table (Crisp Rectangular Container) */}
        <div className="rect-card overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#100D1B]/95 sticky top-0 z-10 border-b border-white/[0.08] backdrop-blur-md">
                <tr>
                  <th className="px-4 sm:px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Member Details</th>
                  <th className="hidden sm:table-cell px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Domain</th>
                  <th className="hidden sm:table-cell px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Role</th>
                  <th className="px-4 sm:px-6 py-3 text-right font-semibold text-[#9490A6] uppercase tracking-wider">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {targetMembers.map(member => {
                  const record = activeSession.records[member.id];
                  const status = record?.status || 'ABSENT'; // Default is ABSENT
                  const isPresent = status === 'PRESENT';
                  const isAbsent = status === 'ABSENT';
                  const isInformed = status === 'INFORMED';

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3">
                        <p className="font-semibold text-white">{member.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{member.rollNo || member.department || 'No Roll No'}</p>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-3">
                        <span className="badge-reactbits-new">{member.team}</span>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-3">
                        <span className="text-slate-300 font-medium">{member.role}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 p-1 bg-[#0B172B] border border-white/10 rounded-md">
                          <button
                            onClick={() => handleMarkAttendance(member.id, isPresent ? 'ABSENT' : 'PRESENT')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                              isPresent
                                ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                                : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(member.id, 'ABSENT')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                              isAbsent
                                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                                : 'text-slate-400 hover:text-rose-300 hover:bg-rose-500/10'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(member.id, 'INFORMED')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                              isInformed
                                ? 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]'
                                : 'text-slate-400 hover:text-sky-300 hover:bg-sky-500/10'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Informed</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:h-full md:max-h-[calc(100vh-100px)]">
      {/* ── LAST 3 SESSIONS ABSENTEES SECTION (Perfect Rectangular Cards) ── */}
      <section className="rect-card p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Last 3 Sessions Absentees</h3>
                <span className="badge-reactbits-new">
                  {recentAbsentees.length} {recentAbsentees.length === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <p className="text-xs text-[#9490A6] mt-0.5">
                Overview of absent members across the three most recent attendance sessions
              </p>
            </div>
          </div>
        </div>

        {absenteesLoading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentAbsentees.length === 0 ? (
          <div className="py-8 text-center bg-white/[0.02] rounded-md border border-dashed border-white/10">
            <UserX className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
            <p className="text-sm font-semibold text-slate-300">No previous sessions available.</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Absentees will automatically be displayed here once sessions are recorded.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentAbsentees.map((s) => {
              const isExpanded = expandedSessionIds[s.id] ?? true;
              return (
                <div
                  key={s.id}
                  className="rect-card p-4 flex flex-col justify-between hover:border-sky-500/40 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="badge-reactbits-new">
                            {s.team.split(',').join(', ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            s.sessionSlot === 'FN' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                            s.sessionSlot === 'AN' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' :
                            'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}>
                            {s.sessionSlot}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm leading-snug line-clamp-1" title={s.title}>
                          {s.title}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold rounded text-xs whitespace-nowrap shrink-0">
                        {s.absentCount} Absent
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#9490A6] mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                        {s.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        {s.startTime} {s.endTime ? `- ${s.endTime}` : ''}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] font-medium text-[#9490A6] mb-1.5">
                        <span>Absentee List ({s.absentees.length})</span>
                        <button
                          onClick={() => setExpandedSessionIds(prev => ({ ...prev, [s.id]: !isExpanded }))}
                          className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-0.5"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      {isExpanded && (
                        s.absentees.length === 0 ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2.5 text-center text-xs text-emerald-400 font-medium">
                            🎉 100% Attendance — Zero Absentees!
                          </div>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 rounded-md border border-white/10 bg-[#050B14]/80 p-2">
                            {s.absentees.map(ab => (
                              <div key={ab.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-white/[0.04]">
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-semibold text-slate-200 truncate">{ab.name}</p>
                                  <p className="text-[10px] text-[#9490A6] truncate">{ab.rollNo || ab.department || 'No Roll No'}</p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 text-slate-300 rounded font-medium shrink-0">
                                  {ab.team}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const match = sessions.find(sess => sess.id === s.id);
                      if (match) setActiveSession(match);
                    }}
                    className="w-full mt-2 py-2 px-3 btn-rect-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    View & Manage Session
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Main Sessions List Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Recent Sessions</h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={sessionSearchQuery}
              onChange={(e) => setSessionSearchQuery(e.target.value)}
              className="rect-input w-full sm:w-64 pl-10 pr-10 py-2 text-xs"
            />
            {sessionSearchQuery && (
              <button onClick={() => setSessionSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-sky-glow shrink-0 px-3.5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rect-card p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-md flex items-center justify-center mb-4 mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Sessions Yet</h3>
          <p className="text-[#9490A6] max-w-sm mx-auto mb-6 text-xs">
            You haven't created any attendance sessions yet. Click "New Session" to start tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortSessionsDesc(sessions).filter(s => {
            if (!sessionSearchQuery) return true;
            const q = sessionSearchQuery.toLowerCase();
            return s.title.toLowerCase().includes(q) ||
              s.team.toLowerCase().includes(q) ||
              s.date.includes(q) ||
              s.sessionSlot.toLowerCase().includes(q);
          }).map(session => {
            const targetCount = session.team === 'ALL' ? members.length : members.filter(m => session.team.split(',').includes(m.team)).length;
            const markedCount = Object.keys(session.records).length;
            const progress = targetCount === 0 ? 0 : Math.round((markedCount / targetCount) * 100);

            return (
              <div
                key={session.id}
                onClick={() => setActiveSession(session)}
                className="rect-card p-5 hover:border-sky-500/40 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge-reactbits-new">
                        {session.team.split(',').join(', ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                        session.sessionSlot === 'FN' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                        session.sessionSlot === 'AN' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' :
                        'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}>
                        {session.sessionSlot}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                      {session.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDeleteSession(session); }}
                      title="Delete session"
                      className="p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="btn-rect-secondary p-2 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-[#9490A6] mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    {session.date}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    {session.startTime} {session.endTime ? `- ${session.endTime}` : ''}
                  </div>
                </div>

                {session.notes && (
                  <p className="text-xs text-slate-300 mb-4 line-clamp-2 bg-white/[0.02] p-2.5 rounded-md border border-white/10">
                    {session.notes}
                  </p>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300">Marking Progress</span>
                    <span className="text-[#9490A6]">{markedCount} / {targetCount} Marked</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-sky-500 to-cyan-400'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE SESSION MODAL (Crisp Rectangular) ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="rect-card-elevated max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-bold text-white">Create Attendance Session</h3>
                <p className="text-xs text-[#9490A6] mt-0.5">Initialize attendance tracking for members</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Meeting or All-Hands"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="rect-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="rect-input w-full px-3 py-2 text-xs [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Slot</label>
                  <select
                    value={createForm.sessionSlot}
                    onChange={(e) => setCreateForm({ ...createForm, sessionSlot: e.target.value })}
                    className="rect-input w-full px-3 py-2 text-xs bg-[#0B172B] text-slate-200 cursor-pointer"
                  >
                    <option value="FN">FN (Forenoon / Morning)</option>
                    <option value="AN">AN (Afternoon)</option>
                    <option value="EV">EV (Evening)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="rect-input w-full px-3 py-2 text-xs [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">End Time (Optional)</label>
                  <input
                    type="time"
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="rect-input w-full px-3 py-2 text-xs [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Target Team / Domain</label>
                <select
                  value={createForm.team}
                  onChange={(e) => setCreateForm({ ...createForm, team: e.target.value })}
                  className="rect-input w-full px-3 py-2 text-xs bg-[#0B172B] text-slate-200 cursor-pointer"
                >
                  <option value="ALL">ALL (Entire Students Union)</option>
                  {Array.from(new Set(members.map(m => m.team))).sort().map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 btn-rect-secondary py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-sky-glow py-2 text-xs font-semibold cursor-pointer"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteDialog}
    </div>
  );
}