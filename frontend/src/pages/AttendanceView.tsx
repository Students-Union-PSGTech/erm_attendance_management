import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, Users, ChevronLeft, Check, X, Search, UserX, Trash2, AlertCircle, Download, Eye, Edit3 } from 'lucide-react';
import type { Member } from './AdminDashboard';
import { isUpcoming, opensLabel } from './sessionTime';
import RepeatAbsentees, { repeatAbsenteeCards } from './RepeatAbsentees';

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

// Verticals are always shown in this order; members inside by role, then name
const TEAM_ORDER = ['ERM', 'TECH', 'PR', 'DESIGN', 'AMBIANCE', 'MEDIA'];
const ROLE_ORDER = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
const rankIn = (order: string[], v?: string) => {
  const i = order.indexOf((v || '').toUpperCase());
  return i === -1 ? order.length : i;
};
const teamRank = (t?: string) => rankIn(TEAM_ORDER, t);
const byRoleThenName = (a: { role?: string; name?: string }, b: { role?: string; name?: string }) =>
  rankIn(ROLE_ORDER, a.role) - rankIn(ROLE_ORDER, b.role) || (a.name || '').localeCompare(b.name || '');
const byTeam = (a: string, b: string) => teamRank(a) - teamRank(b) || a.localeCompare(b);

/** Teams a session is for: ['ALL'] or e.g. ['TECH', 'AMBIANCE'] */
const sessionTeams = (team?: string) => (team || 'ALL').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
/** Members a session applies to */
const targetsOf = (session: { team: string }, members: Member[]) => {
  const teams = sessionTeams(session.team);
  return teams.includes('ALL') ? members : members.filter(m => teams.includes((m.team || '').toUpperCase()));
};

interface AttendanceViewProps {
  members: Member[];
}

export default function AttendanceView({ members }: AttendanceViewProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionPermissionMode, setSessionPermissionMode] = useState<'view' | 'edit'>('view');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [detailTeam, setDetailTeam] = useState<string | null>(null); // vertical shown inside a session (null = first)
  const [sessionTeamFilter, setSessionTeamFilter] = useState('ALL_SESSIONS'); // vertical filter on the sessions list
  const [bulkBusy, setBulkBusy] = useState<string | null>(null); // status being bulk-saved
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Delete session (confirmation dialog)
  const [deletingSession, setDeletingSession] = useState<AttendanceSession | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);

  const openSession = (session: AttendanceSession, mode: 'view' | 'edit') => {
    setActiveSession(session);
    setSessionPermissionMode(mode);
  };

  /** Team picker: ALL on its own, or any mix of verticals (saved as e.g. "TECH,DESIGN" in vertical order). */
  const toggleCreateTeam = (team: string) => {
    setCreateError(null);
    setCreateForm(prev => {
      if (team === 'ALL') return { ...prev, team: 'ALL' };
      const current = sessionTeams(prev.team).filter(t => t !== 'ALL');
      const next = current.includes(team) ? current.filter(t => t !== team) : [...current, team];
      return { ...prev, team: next.length ? next.sort(byTeam).join(',') : 'ALL' };
    });
  };

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

  useEffect(() => {
    fetchSessions();
  }, []);

  // Opening a session starts on its first vertical with an empty search
  useEffect(() => {
    setDetailTeam(null);
    setMemberSearchQuery('');
    setBulkError(null);
  }, [activeSession?.id]);

  const handleMarkAttendance = async (memberId: string, targetStatus: string) => {
    if (!activeSession || isUpcoming(activeSession) || sessionPermissionMode === 'view') return;

    const currentStatus = activeSession.records[memberId]?.status;
    const willUnmark = currentStatus === targetStatus;
    const updatedRecords = { ...activeSession.records };

    if (!willUnmark) {
      updatedRecords[memberId] = { status: targetStatus, markedAt: new Date().toISOString() };
    } else {
      delete updatedRecords[memberId];
    }

    setActiveSession({ ...activeSession, records: updatedRecords });
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, records: updatedRecords } : s));

    try {
      if (!willUnmark) {
        await fetch(`/api/sessions/${activeSession.id}/records/${memberId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ status: targetStatus })
        });
      } else {
        await fetch(`/api/sessions/${activeSession.id}/records/${memberId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      fetchSessions(); // revert on fail
    }
  };

  const handleExitSession = () => {
    setActiveSession(null);
  };

  const downloadSessionCSV = () => {
    if (!activeSession) return;
    const allTargets = targetsOf(activeSession, members);
    const statusOf = (id: string) => activeSession.records[id]?.status || 'UNMARKED';

    const headers = ['Name', 'Team', 'Role', 'Roll No', 'Department', 'Year', 'Phone', 'Status'];
    const data = allTargets.sort((a, b) => byTeam(a.team, b.team) || byRoleThenName(a, b)).map(m => [
      `"${m.name || ''}"`,
      `"${m.team || ''}"`,
      `"${m.role || ''}"`,
      `"${m.rollNo || '-'}"`,
      `"${m.department || '-'}"`,
      `"${m.year || '-'}"`,
      `"${m.phone || '-'}"`,
      `"${statusOf(m.id)}"`
    ]);

    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `session_${activeSession.title}_${activeSession.date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleBulkMark = async (action: 'PRESENT' | 'ABSENT' | 'INFORMED' | 'CLEAR' | 'UNMARKED_TO_ABSENT', list: Member[], label: string) => {
    if (!activeSession || list.length === 0 || isUpcoming(activeSession) || sessionPermissionMode === 'view') return;
    
    let confirmMsg = '';
    if (action === 'CLEAR') confirmMsg = `Reset all ${list.length} members of ${label} to unmarked?`;
    else if (action === 'UNMARKED_TO_ABSENT') confirmMsg = `Mark all currently unmarked members of ${label} as absent?`;
    else confirmMsg = `Mark all ${list.length} members of ${label} as ${action.toLowerCase()}?`;
    
    if (list.length > 60 && !window.confirm(confirmMsg)) return;
    setBulkBusy(action);
    setBulkError(null);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
    const known = new Set(members.map(m => m.id));
    try {
      const latestRes = await fetch(`/api/sessions/${activeSession.id}`, { headers });
      const latest = latestRes.ok ? (await latestRes.json()).session : null;
      const base: AttendanceSession['records'] = latest?.records || activeSession.records || {};
      const now = new Date().toISOString();
      const records: AttendanceSession['records'] = {};
      Object.entries(base).forEach(([id, r]) => { if (known.has(id)) records[id] = r; });
      if (action === 'UNMARKED_TO_ABSENT') {
        list.forEach(m => {
          if (!records[m.id]?.status) {
            records[m.id] = { status: 'ABSENT', markedAt: now };
          }
        });
      } else if (action !== 'CLEAR') {
        list.forEach(m => { records[m.id] = { status: action, markedAt: now }; });
      } else {
        // Reset to neutral / unmarked
        list.forEach(m => { delete records[m.id]; });
      }

      const res = await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ records }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Could not save (${res.status})`);
      }
      setActiveSession(prev => (prev && prev.id === activeSession.id ? { ...prev, records } : prev));
      setSessions(prev => prev.map(s => (s.id === activeSession.id ? { ...s, records } : s)));
    } catch (err: any) {
      console.error('Bulk mark failed:', err);
      setBulkError(err.message || 'Could not save attendance');
    } finally {
      setBulkBusy(null);
    }
  };

  const handleUpdateSessionRemarks = async (notes: string) => {
    if (!activeSession) return;
    const updatedSession = { ...activeSession, notes };
    setActiveSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));

    try {
      await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
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
    setCreateError(null);
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
        if (data.session) setActiveSession(data.session);
      } else {
        setCreateError(data?.error || `Could not create the session (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
      setCreateError('Network error, could not create the session');
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || `Failed to delete the session (${res.status})`);
      return;
    }

    const deletedId = deletingSession.id;
    setSessions(prev => prev.filter(s => s.id !== deletedId));
    if (activeSession?.id === deletedId) setActiveSession(null);
    setDeletingSession(null);
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
    const allTargets = targetsOf(activeSession, members);
    const upcoming = isUpcoming(activeSession);
    const statusOf = (id: string) => activeSession.records[id]?.status || 'UNMARKED';

    // Header numbers are for the whole session
    const presentCount = allTargets.filter(m => statusOf(m.id) === 'PRESENT').length;
    const absentCount = allTargets.length - presentCount;
    const totalCount = allTargets.length;

    // One card per vertical in this session
    const detailTeams = Array.from(new Set(allTargets.map(m => m.team))).sort(byTeam);
    const showTeamCards = detailTeams.length > 1;
    const currentTeam = !showTeamCards
      ? 'ALL'
      : detailTeam && (detailTeam === 'ALL' || detailTeams.includes(detailTeam)) ? detailTeam : detailTeams[0];
    const teamCards = detailTeams.map(team => {
      const list = allTargets.filter(m => m.team === team);
      const present = list.filter(m => statusOf(m.id) === 'PRESENT').length;
      return { team, total: list.length, present, absent: list.length - present };
    });

    let targetMembers = currentTeam === 'ALL' ? allTargets : allTargets.filter(m => m.team === currentTeam);
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
    targetMembers = [...targetMembers].sort((a, b) => byTeam(a.team, b.team) || byRoleThenName(a, b));

    // In "All", rows are grouped under a bold header per vertical
    const memberGroups = currentTeam === 'ALL' && showTeamCards
      ? detailTeams.map(team => ({ team: team as string | null, rows: targetMembers.filter(m => m.team === team) })).filter(g => g.rows.length > 0)
      : [{ team: null as string | null, rows: targetMembers }];

    return (
      <div className="flex flex-col pb-6 animate-in fade-in duration-300">
        {/* Permission Mode Banner */}
        <div className="rect-card p-3 mb-3 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#071326]">
          <div className="flex items-center gap-2.5">
            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 ${
              sessionPermissionMode === 'view'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 shadow-[0_0_12px_rgba(14,165,233,0.2)]'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
            }`}>
              {sessionPermissionMode === 'view' ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {sessionPermissionMode === 'view' ? 'View Mode (Read-Only)' : 'Edit Mode (Read + Write)'}
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline">
              {sessionPermissionMode === 'view'
                ? 'Preview mode · Attendance records cannot be edited'
                : 'Editing enabled · Mark members Present or reset records'}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {sessionPermissionMode === 'view' ? (
              <button
                onClick={() => setSessionPermissionMode('edit')}
                className="px-3 py-1.5 rounded-md text-xs font-bold border border-sky-500/50 bg-sky-500/20 hover:bg-sky-500 hover:text-white text-sky-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Switch to Edit</span>
              </button>
            ) : (
              <button
                onClick={() => setSessionPermissionMode('view')}
                className="px-3 py-1.5 rounded-md text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Switch to View</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Session Header Card */}
        <div className="rect-card p-5 mb-4 shrink-0">
          <div className="flex flex-col gap-4">
            {/* Top Row: Info & Stats */}
            <div className="flex flex-wrap items-start gap-3 sm:gap-4">
              <button
                onClick={handleExitSession}
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
                  onClick={downloadSessionCSV}
                  title="Download CSV"
                  className="p-2.5 rounded-md border border-white/10 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>
                {sessionPermissionMode === 'edit' && (
                  <button
                    onClick={() => openDeleteSession(activeSession)}
                    title="Delete session"
                    className="p-2.5 rounded-md border border-white/10 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-md px-3 sm:px-4 py-2 text-center min-w-[70px]">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Present</p>
                  <p className="text-2xl font-black text-emerald-300 leading-none">{upcoming ? '—' : presentCount}</p>
                </div>
                <div className="bg-rose-500/15 border border-rose-500/30 rounded-md px-3 sm:px-4 py-2 text-center min-w-[70px]">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">Absent</p>
                  <p className="text-2xl font-black text-rose-300 leading-none">{upcoming ? '—' : absentCount}</p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Remarks & Search */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 sm:ml-9">
              <div className="flex-1">
                <textarea
                  placeholder={sessionPermissionMode === 'view' ? "No session remarks." : "Add session remarks here... (e.g. Special instructions, delays)"}
                  defaultValue={activeSession.notes || ''}
                  readOnly={sessionPermissionMode === 'view'}
                  onBlur={(e) => handleUpdateSessionRemarks(e.target.value)}
                  className={`rect-input w-full px-3.5 py-2 text-xs resize-none h-[42px] focus:h-20 ${
                    sessionPermissionMode === 'view' ? 'opacity-80 cursor-default bg-black/20' : ''
                  }`}
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

        {upcoming && (
          <div className="mb-4 shrink-0 px-4 py-3 rounded-md border border-indigo-500/40 bg-indigo-950/40 text-xs text-indigo-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-300 shrink-0" />
            <span>
              <span className="font-bold uppercase tracking-wider mr-1.5">Upcoming</span>
              Attendance can be marked once the meeting starts ({opensLabel(activeSession)}). It isn't counted in any stats until then.
            </span>
          </div>
        )}

        {/* Vertical cards */}
        {showTeamCards && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-4 shrink-0">
            {[{ team: 'ALL', total: totalCount, present: presentCount }, ...teamCards].map(c => {
              const active = currentTeam === c.team;
              const pct = c.total ? Math.round((c.present / c.total) * 100) : 0;
              return (
                <button
                  key={c.team}
                  onClick={() => setDetailTeam(c.team)}
                  className={`rect-card text-left px-3.5 py-3 cursor-pointer transition-all border ${
                    active ? 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_18px_rgba(14,165,233,0.18)]' : 'border-white/10 hover:border-sky-500/40'
                  }`}
                  title={c.team === 'ALL' ? 'All verticals, grouped by team' : `Filter ${c.team}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${active ? 'text-sky-300' : 'text-slate-300'}`}>
                      {c.team === 'ALL' ? 'All' : c.team}
                    </span>
                    <span className="text-sm font-bold font-mono leading-none text-white">
                      {c.present}<span className="text-slate-500">/{c.total}</span>
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                    {upcoming ? 'Upcoming' : `${pct}% present`}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Bulk marking / actions */}
        {(() => {
          const scope = currentTeam === 'ALL' ? allTargets : allTargets.filter(m => m.team === currentTeam);
          const label = currentTeam === 'ALL' ? (showTeamCards ? 'all verticals' : 'this session') : currentTeam;
          const scopePresent = scope.filter(m => statusOf(m.id) === 'PRESENT').length;
          return (
            <div className="rect-card px-4 py-3 mb-3 shrink-0 flex flex-wrap items-center gap-2 sm:gap-3">
              <p className="text-xs text-slate-300 mr-auto">
                <span className="font-bold text-white uppercase tracking-wider">{label}</span>
                <span className="text-slate-500 font-mono ml-2">{scopePresent} / {scope.length} present</span>
              </p>

              {sessionPermissionMode === 'edit' ? (
                <>
                  <button
                    onClick={() => handleBulkMark('PRESENT', scope, label)}
                    disabled={!!bulkBusy || scope.length === 0 || upcoming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {bulkBusy === 'PRESENT' ? 'Saving…' : <>All Present<span className="hidden sm:inline">&nbsp;({scope.length})</span></>}
                  </button>
                  <button
                    onClick={() => handleBulkMark('ABSENT', scope, label)}
                    disabled={!!bulkBusy || scope.length === 0 || upcoming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {bulkBusy === 'ABSENT' ? 'Saving…' : <>All Absent<span className="hidden sm:inline">&nbsp;({scope.length})</span></>}
                  </button>
                  <button
                    onClick={() => handleBulkMark('INFORMED', scope, label)}
                    disabled={!!bulkBusy || scope.length === 0 || upcoming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {bulkBusy === 'INFORMED' ? 'Saving…' : <>All Informed<span className="hidden sm:inline">&nbsp;({scope.length})</span></>}
                  </button>
                  <button
                    onClick={() => handleBulkMark('CLEAR', scope, label)}
                    disabled={!!bulkBusy || scope.length === 0 || upcoming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {bulkBusy === 'CLEAR' ? 'Saving…' : <>Reset to Unmarked<span className="hidden sm:inline">&nbsp;({scope.length})</span></>}
                  </button>
                  <button
                    onClick={() => handleBulkMark('UNMARKED_TO_ABSENT', scope, label)}
                    disabled={!!bulkBusy || scope.length === 0 || upcoming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {bulkBusy === 'UNMARKED_TO_ABSENT' ? 'Saving…' : <>Mark Unmarked as Absent</>}
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400 font-mono italic flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  Read-only view · Bulk actions locked
                </span>
              )}

              {bulkError && (
                <p className="w-full text-xs text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {bulkError}
                </p>
              )}
            </div>
          );
        })()}

        {/* Member Marking Table */}
        <div className="rect-card overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[calc(100dvh-120px)] min-h-[320px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#100D1B]/95 sticky top-0 z-10 border-b border-white/[0.08] backdrop-blur-md">
                <tr>
                  <th className="px-4 sm:px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Member Details</th>
                  <th className="hidden sm:table-cell px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Domain</th>
                  <th className="hidden sm:table-cell px-6 py-3 font-semibold text-[#9490A6] uppercase tracking-wider">Role</th>
                  <th className="px-4 sm:px-6 py-3 text-right font-semibold text-[#9490A6] uppercase tracking-wider">
                    {sessionPermissionMode === 'edit' ? 'Attendance Action' : 'Attendance Status'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {targetMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">No members match this filter.</td>
                  </tr>
                )}
                {memberGroups.map(group => (
                  <React.Fragment key={group.team || 'rows'}>
                    {group.team && (
                      <tr className="bg-[#0C1E38]">
                        <td colSpan={4} className="px-4 sm:px-6 py-3 border-l-4 border-l-sky-400">
                          <div className="flex items-center gap-3">
                            <span className="text-sm sm:text-base font-black text-white uppercase tracking-widest">{group.team}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {group.rows.filter(m => statusOf(m.id) === 'PRESENT').length} / {group.rows.length} present
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                {group.rows.map(member => {
                  const record = activeSession.records[member.id];
                  const status = record?.status;

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
                        <div className="inline-flex items-center justify-end gap-2">
                          {/* Neutral / Marked Status Badge */}
                          {(upcoming || sessionPermissionMode === 'view') && (
                            <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider font-mono ${
                              upcoming
                                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-500/30'
                                : status === 'PRESENT'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : status === 'ABSENT'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : status === 'INFORMED'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}>
                              {upcoming ? 'Upcoming' : status ? status : 'Unmarked'}
                            </span>
                          )}

                          {/* Action Button Group: only visible and clickable in Edit mode */}
                          {sessionPermissionMode === 'edit' && !upcoming && (
                            <div className="flex bg-[#0A1628] rounded border border-white/10 overflow-hidden">
                              <button
                                onClick={() => handleMarkAttendance(member.id, 'PRESENT')}
                                className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer ${
                                  status === 'PRESENT'
                                    ? 'bg-emerald-500 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-emerald-400'
                                }`}
                                title="Mark Present"
                              >
                                Pre
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(member.id, 'ABSENT')}
                                className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer border-l border-white/10 ${
                                  status === 'ABSENT'
                                    ? 'bg-rose-500 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-rose-400'
                                }`}
                                title="Mark Absent"
                              >
                                Abs
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(member.id, 'INFORMED')}
                                className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer border-l border-white/10 ${
                                  status === 'INFORMED'
                                    ? 'bg-amber-500 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-amber-400'
                                }`}
                                title="Mark Informed"
                              >
                                Inf
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
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
                  {repeatAbsenteeCards(sessions, members).length} verticals
                </span>
              </div>
              <p className="text-xs text-[#9490A6] mt-0.5">
                Each vertical's last 3 meetings (admin- and team-created) and who missed all three
              </p>
            </div>
          </div>
        </div>

        {/* One card per vertical (with members): its own last 3 meetings, admin- or team-created */}
        {repeatAbsenteeCards(sessions, members).length === 0 ? (
          <div className="py-8 text-center bg-white/[0.02] rounded-md border border-dashed border-white/10">
            <UserX className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
            <p className="text-sm font-semibold text-slate-300">No members or meetings yet.</p>
            <p className="text-xs text-slate-500 mt-0.5">Each vertical's last 3 meetings will show here once meetings are recorded.</p>
          </div>
        ) : (
          <RepeatAbsentees sessions={sessions} members={members} showTitle={false} />
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
            onClick={() => { setCreateError(null); setIsCreateModalOpen(true); }}
            className="btn-sky-glow shrink-0 px-3.5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Filter sessions by vertical */}
      {sessions.length > 0 && (() => {
        // A vertical's chip = every meeting that vertical attends (its own, multi-team ones, and union-wide)
        const attends = (s: AttendanceSession, t: string) => { const ts = sessionTeams(s.team); return ts.includes(t) || ts.includes('ALL'); };
        const chipTeams = Array.from(new Set([...members.map(m => (m.team || '').toUpperCase()), ...sessions.flatMap(s => sessionTeams(s.team))].filter(t => t && t !== 'ALL'))).sort(byTeam);
        const chips = [
          { key: 'ALL_SESSIONS', label: 'All', count: sessions.length },
          { key: 'ALL', label: 'Union-wide', count: sessions.filter(s => sessionTeams(s.team).includes('ALL')).length },
          ...chipTeams.map(t => ({ key: t, label: t, count: sessions.filter(s => attends(s, t)).length })),
        ].filter(c => c.count > 0 || c.key === 'ALL_SESSIONS');
        return (
          <div className="flex flex-wrap gap-2 -mt-2">
            {chips.map(c => {
              const active = sessionTeamFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setSessionTeamFilter(c.key)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    active ? 'bg-sky-500/15 border-sky-400/70 text-sky-300' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                  }`}
                >
                  {c.label} <span className="font-mono text-slate-500 ml-1">{c.count}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

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
            if (sessionTeamFilter === 'ALL' && !sessionTeams(s.team).includes('ALL')) return false;
            if (sessionTeamFilter !== 'ALL_SESSIONS' && sessionTeamFilter !== 'ALL') {
              const ts = sessionTeams(s.team);
              if (!ts.includes(sessionTeamFilter) && !ts.includes('ALL')) return false;
            }
            if (!sessionSearchQuery) return true;
            const q = sessionSearchQuery.toLowerCase();
            return s.title.toLowerCase().includes(q) ||
              s.team.toLowerCase().includes(q) ||
              s.date.includes(q) ||
              s.sessionSlot.toLowerCase().includes(q);
          }).map(session => {
            const sessionTargets = targetsOf(session, members);
            const targetCount = sessionTargets.length;
            const markedCount = sessionTargets.filter(m => session.records?.[m.id]).length;
            const progress = targetCount === 0 ? 0 : Math.round((markedCount / targetCount) * 100);

            return (
              <div
                key={session.id}
                onClick={() => openSession(session, 'view')}
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
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openSession(session, 'view')}
                      title="View session (Read-only)"
                      className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-white/10 bg-white/5 hover:bg-sky-500/15 hover:border-sky-500/40 text-slate-300 hover:text-sky-300 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => openSession(session, 'edit')}
                      title="Edit attendance (Read + Write)"
                      className="px-2.5 py-1.5 rounded-md text-xs font-semibold border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500 hover:text-white text-sky-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => openDeleteSession(session)}
                      title="Delete session"
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

                {isUpcoming(session) ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                      Upcoming
                    </span>
                    <span className="text-[#9490A6]">{opensLabel(session)}</span>
                  </div>
                ) : (
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
                )}
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
                    onChange={(e) => {
                      const newSlot = e.target.value;
                      let newTime = createForm.startTime;
                      if (newSlot === 'FN') newTime = '09:00';
                      else if (newSlot === 'AN') newTime = '12:50';
                      else if (newSlot === 'EV') newTime = '17:30';
                      setCreateForm({ ...createForm, sessionSlot: newSlot, startTime: newTime });
                    }}
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
                <label className="block font-semibold text-slate-300 mb-1">Target Teams</label>
                <p className="text-[10px] text-slate-500 mb-2">Pick ALL, or one or more verticals (e.g. TECH + DESIGN)</p>
                {(() => {
                  const selected = sessionTeams(createForm.team);
                  const verticals = Array.from(new Set([...TEAM_ORDER, ...members.map(m => (m.team || '').toUpperCase())].filter(Boolean)))
                    .filter(t => TEAM_ORDER.includes(t) || members.some(m => (m.team || '').toUpperCase() === t))
                    .sort(byTeam);
                  const chip = (team: string, label: string) => {
                    const on = selected.includes(team);
                    return (
                      <button
                        type="button"
                        key={team}
                        onClick={() => toggleCreateTeam(team)}
                        aria-pressed={on}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 ${
                          on ? 'bg-sky-500/15 border-sky-400/70 text-sky-300' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                        {label}
                      </button>
                    );
                  };
                  const count = selected.includes('ALL')
                    ? members.length
                    : members.filter(m => selected.includes((m.team || '').toUpperCase())).length;
                  return (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {chip('ALL', 'All (entire union)')}
                        {verticals.map(t => chip(t, t))}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-2">
                        {selected.includes('ALL') ? 'Everyone' : selected.join(' + ')} · {count} members
                      </p>
                    </>
                  );
                })()}
              </div>

              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

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