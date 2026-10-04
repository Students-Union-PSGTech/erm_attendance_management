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

  const handleBulkMark = async (status: string) => {
    if (!activeSession) return;
    const targetMembers = activeSession.team === 'ALL'
      ? members
      : members.filter(m => activeSession.team.split(',').includes(m.team));
    
    const now = new Date().toISOString();
    const updatedRecords = { ...activeSession.records };
    targetMembers.forEach(m => {
      updatedRecords[m.id] = { status, markedAt: now };
    });

    setActiveSession({ ...activeSession, records: updatedRecords });
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, records: updatedRecords } : s));

    try {
      await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ records: updatedRecords })
      });
      fetchRecentAbsentees();
    } catch (err) {
      console.error('Failed to bulk mark attendance:', err);
      fetchSessions();
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...createForm };
      if (!payload.endTime) delete payload.endTime;
      
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsCreateModalOpen(false);
        fetchSessions();
        fetchRecentAbsentees();
        setCreateForm({ title: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '', sessionSlot: 'FN', team: 'ALL' });
      } else {
        const errorData = await res.json();
        console.error('Failed to create session:', errorData);
      }
    } catch (err) {
      console.error('Network error creating session:', err);
    }
  };

  const openDeleteSession = (session: AttendanceSession) => {
    setDeleteError(null);
    setDeletingSession(session);
  };

  // DELETE /api/sessions/:id — also removes the session's attendance marks
  const handleDeleteSession = async () => {
    if (!deletingSession) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/sessions/${deletingSession.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        let message = `Delete failed (${res.status})`;
        try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
        setDeleteError(message);
        return;
      }
      // 404 means it was already gone; treat as deleted
      setSessions(prev => prev.filter(s => s.id !== deletingSession.id));
      if (activeSession?.id === deletingSession.id) setActiveSession(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
        <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Delete this session?</h3>
        <p className="text-sm text-slate-500 mt-1.5">
          <span className="font-semibold text-slate-700">{deletingSession.title}</span> ({deletingSession.team.split(',').join(', ')}) on {deletingSession.date}
          {Object.keys(deletingSession.records || {}).length > 0 &&
            ` and its ${Object.keys(deletingSession.records || {}).length} attendance mark(s)`}{' '}
          will be removed permanently.
        </p>
        {deleteError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setDeletingSession(null)}
            disabled={deleteBusy}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteSession}
            disabled={deleteBusy}
            className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
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
      <div className="flex flex-col h-full max-h-[calc(100vh-100px)] animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-4 shrink-0">
          <div className="flex flex-col gap-5">
            {/* Top Row: Info & Stats */}
            <div className="flex items-start gap-4">
              <button 
                onClick={() => setActiveSession(null)}
                className="p-2 -ml-2 mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold tracking-wider uppercase">
                    {activeSession.team.split(',').join(', ')}
                  </span>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {activeSession.date}
                  </span>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {activeSession.startTime} - {activeSession.endTime || 'Ongoing'}
                  </span>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {totalCount} Target Members
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">{activeSession.title}</h2>
              </div>
              
              <div className="flex gap-3 items-start shrink-0">
                <button
                  onClick={() => openDeleteSession(activeSession)}
                  title="Delete session"
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Present</p>
                  <p className="text-2xl font-black text-emerald-700 leading-none">{presentCount}</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">Absent</p>
                  <p className="text-2xl font-black text-rose-700 leading-none">{absentCount}</p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Remarks & Search */}
            <div className="flex flex-col lg:flex-row gap-4 ml-11">
              <div className="flex-1">
                <textarea 
                  placeholder="Add session remarks here... (e.g. Special instructions, delays)"
                  defaultValue={activeSession.notes}
                  onBlur={(e) => handleUpdateSessionRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none h-[44px] focus:h-20"
                />
              </div>
              <div className="relative w-full lg:w-80 shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search members..." 
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all h-[44px]"
                />
                {memberSearchQuery && (
                  <button onClick={() => setMemberSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-4">
                      <span>Mark Attendance (Click Present to toggle)</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleBulkMark('PRESENT')} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-semibold">All Present</button>
                        <button onClick={() => handleBulkMark('ABSENT')} className="px-2 py-1 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors cursor-pointer text-xs font-semibold">All Absent</button>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {targetMembers.map(m => {
                  const status = activeSession.records[m.id]?.status || 'ABSENT';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <p className="font-medium text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.rollNo || 'No Roll No'}</p>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">{m.role}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleMarkAttendance(m.id, status === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              status === 'PRESENT' 
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Present
                          </button>
                          <button 
                            onClick={() => handleMarkAttendance(m.id, 'ABSENT')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              status === 'ABSENT' 
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                                : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" /> Absent
                          </button>
                          <button 
                            onClick={() => handleMarkAttendance(m.id, 'INFORMED')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              status === 'INFORMED' 
                                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                                : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" /> Informed
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
    <div className="flex flex-col gap-5 h-full max-h-[calc(100vh-100px)] animate-in fade-in duration-500 overflow-y-auto pb-8">
      {/* ── Last 3 Sessions Absentees Section ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs shrink-0">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Last 3 Sessions Absentees</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  {recentAbsentees.length} {recentAbsentees.length === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of absent members from the three most recently completed/created sessions
              </p>
            </div>
          </div>
        </div>

        {absenteesLoading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : recentAbsentees.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <UserX className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-sm font-semibold text-slate-700">No previous sessions available.</p>
            <p className="text-xs text-slate-400 mt-0.5">
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
                  className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded text-[10px] font-bold tracking-wider uppercase">
                            {s.team.split(',').join(', ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            s.sessionSlot === 'FN' ? 'bg-amber-100 text-amber-800' :
                            s.sessionSlot === 'AN' ? 'bg-orange-100 text-orange-800' :
                            'bg-indigo-100 text-indigo-800'
                          }`}>
                            {s.sessionSlot}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1" title={s.title}>
                          {s.title}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg text-xs whitespace-nowrap shrink-0">
                        {s.absentCount} {s.absentCount === 1 ? 'Absent' : 'Absent'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {s.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {s.startTime} {s.endTime ? `- ${s.endTime}` : ''}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1.5">
                        <span>Absentee List ({s.absentees.length})</span>
                        <button 
                          onClick={() => setExpandedSessionIds(prev => ({ ...prev, [s.id]: !isExpanded }))}
                          className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-0.5"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      {isExpanded && (
                        s.absentees.length === 0 ? (
                          <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-2.5 text-center text-xs text-emerald-800 font-medium">
                            🎉 100% Attendance — Zero Absentees!
                          </div>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 rounded-lg border border-slate-200 bg-white p-2">
                            {s.absentees.map(ab => (
                              <div key={ab.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50">
                                <div className="min-w-0 flex-1 pr-2">
                                  <p className="font-semibold text-slate-800 truncate">{ab.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{ab.rollNo || ab.department || 'No Roll No'}</p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium shrink-0">
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
                    className="w-full mt-2 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 hover:text-blue-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Recent Sessions</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search sessions..." 
              value={sessionSearchQuery}
              onChange={(e) => setSessionSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
            />
            {sessionSearchQuery && (
              <button onClick={() => setSessionSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-blue-600/20 flex items-center gap-2 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Sessions Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm">
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
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold tracking-wider uppercase">
                        {session.team.split(',').join(', ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${
                        session.sessionSlot === 'FN' ? 'bg-amber-50 text-amber-600' :
                        session.sessionSlot === 'AN' ? 'bg-orange-50 text-orange-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        {session.sessionSlot}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {session.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDeleteSession(session); }}
                      title="Delete session"
                      aria-label={`Delete ${session.title}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {session.date}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {session.startTime} {session.endTime ? `- ${session.endTime}` : ''}
                  </div>
                </div>
                
                {session.notes && (
                  <p className="text-sm text-slate-600 mb-5 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {session.notes}
                  </p>
                )}
                
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">Attendance Progress</span>
                    <span className="text-slate-500">{markedCount} / {targetCount} Marked</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Create New Session</h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Session Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Weekly Media Meeting"
                  value={createForm.title}
                  onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                  <input 
                    type="date" 
                    required
                    value={createForm.date}
                    onChange={e => setCreateForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Slot</label>
                  <select 
                    value={createForm.sessionSlot}
                    onChange={e => {
                      const slot = e.target.value;
                      let startTime = createForm.startTime;
                      if (slot === 'FN') startTime = '09:00';
                      else if (slot === 'AN') startTime = '13:00';
                      else if (slot === 'EV') startTime = '17:00';
                      setCreateForm(prev => ({ ...prev, sessionSlot: slot, startTime }));
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer"
                  >
                    <option value="FN">FN (Morning)</option>
                    <option value="AN">AN (Afternoon)</option>
                    <option value="EV">EV (Evening)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={createForm.startTime}
                    onChange={e => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Time (Optional)</label>
                  <input 
                    type="time" 
                    value={createForm.endTime}
                    onChange={e => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Target Teams</label>
                <div className="flex flex-wrap gap-2">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${createForm.team === 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={createForm.team === 'ALL'}
                      onChange={() => setCreateForm(prev => ({ ...prev, team: 'ALL' }))}
                    />
                    <span className="text-sm font-medium">Entire Organization</span>
                  </label>
                  {Array.from(new Set(members.map(m => m.team))).sort().map(t => {
                    const isChecked = createForm.team !== 'ALL' && createForm.team.split(',').includes(t);
                    return (
                      <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={isChecked}
                          onChange={(e) => {
                            let newTeams = createForm.team === 'ALL' ? [] : createForm.team.split(',').filter(Boolean);
                            if (e.target.checked) {
                              newTeams.push(t);
                            } else {
                              newTeams = newTeams.filter(team => team !== t);
                            }
                            setCreateForm(prev => ({ ...prev, team: newTeams.length > 0 ? newTeams.join(',') : 'ALL' }));
                          }}
                        />
                        <span className="text-sm font-medium">{t}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 mt-6 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-600/20"
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