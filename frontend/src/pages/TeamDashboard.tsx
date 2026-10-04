import React, { useEffect, useState, useMemo } from 'react';
import type { User } from '../types';
import {
  Users,
  Calendar,
  BarChart2,
  Activity,
  LogOut,
  Grid3X3,
  RefreshCw,
  Search,
  X,
  UserCheck,
  UserX,
  Clock,
  Menu,
  AlertCircle,
  Eye,
  Edit3,
  Award,
  Filter,
  Plus,
  Trash2,
  Check,
  FileText,
  ArrowUp,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowUpDown,
  Minus
} from 'lucide-react';
import ReportsView from './ReportsView';

interface TeamDashboardProps {
  user: User;
  onLogout: () => void;
}

type NavKey = 'Overview' | 'Members' | 'Attendance' | 'Reports';

export interface Member {
  id: string;
  name: string;
  team: string;
  role: 'LEAD' | 'CO-LEAD' | 'COORDINATOR' | 'CORE' | string;
  rollNo?: string | null;
  department?: string | null;
  year?: string | null;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionRecord {
  status: 'PRESENT' | 'ABSENT' | 'INFORMED';
  notes?: string;
  markedAt?: string;
}

export interface AttendanceSession {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  sessionSlot?: string;
  title: string;
  team: string;
  records?: Record<string, SessionRecord>;
  notes?: string;
  createdBy?: string;
}

export interface MemberAttendanceStat {
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
}

export interface StatsSummary {
  total: number;
  byRole: Record<string, number>;
  byTeam?: Record<string, { total: number; byRole: Record<string, number> }>;
}

export interface MemberHistoryDetail {
  member: Member;
  stats: {
    total: number;
    present: number;
    absent: number;
    informed: number;
    presentPct: number;
  };
  history: Array<{
    sessionId: string;
    date: string;
    startTime?: string;
    endTime?: string;
    sessionSlot?: string;
    title: string;
    team: string;
    status: 'PRESENT' | 'ABSENT' | 'INFORMED';
    markedAt?: string;
  }>;
}

const NAV: { icon: React.ElementType; label: NavKey }[] = [
  { icon: Grid3X3, label: 'Overview' },
  { icon: Users, label: 'Members' },
  { icon: UserCheck, label: 'Attendance' },
  { icon: BarChart2, label: 'Reports' },
];

const ROLE_STYLE: Record<string, string> = {
  LEAD: 'bg-amber-50 text-amber-700 border border-amber-200',
  'CO-LEAD': 'bg-purple-50 text-purple-700 border border-purple-200',
  COORDINATOR: 'bg-blue-50 text-blue-700 border border-blue-200',
  CORE: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  PRESENT: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Present' },
  ABSENT: { badge: 'bg-rose-50 text-rose-700 border border-rose-200', label: 'Absent' },
  INFORMED: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Informed' },
  UNMARKED: { badge: 'bg-slate-50 text-slate-500 border border-slate-200', label: 'Unmarked' },
};

const avatarColor = (name: string) => {
  const colors = ['#1D4ED8', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];
  return colors[name.charCodeAt(0) % colors.length];
};

const sortSessions = (list: AttendanceSession[]) =>
  [...list].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aTime = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const bTime = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (b.startTime || '').localeCompare(a.startTime || '');
  });

export default function TeamDashboard({ user, onLogout }: TeamDashboardProps) {
  const teamName = user.team || 'TECH';
  const [activeNav, setActiveNav] = useState<NavKey>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core data states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<MemberAttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recent Absentees for Last 3 Sessions
  const [recentAbsentees, setRecentAbsentees] = useState<any[]>([]);
  const [absenteesLoading, setAbsenteesLoading] = useState(true);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});

  // Members View Filters & Search
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [sortConfigs, setSortConfigs] = useState<{ key: keyof Member | 'presentPct'; direction: 'asc' | 'desc' }[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  const requestSort = (key: keyof Member | 'presentPct') => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(c => c.key === key);
      let newConfigs = [...prev];
      if (existingIndex === 0) {
        newConfigs[0] = { ...newConfigs[0], direction: newConfigs[0].direction === 'asc' ? 'desc' : 'asc' };
      } else {
        let direction: 'asc' | 'desc' = 'asc';
        if (existingIndex > 0) {
          direction = newConfigs[existingIndex].direction;
          newConfigs.splice(existingIndex, 1);
        }
        newConfigs.unshift({ key, direction });
      }
      return newConfigs;
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    const sortIndex = sortConfigs.findIndex(c => c.key === columnKey);
    if (sortIndex === -1) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    const config = sortConfigs[sortIndex];
    return (
      <div className="flex items-center ml-1">
        {config.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />}
        {sortIndex > 0 && <span className="text-[9px] font-bold text-indigo-600 ml-0.5">{sortIndex + 1}</span>}
      </div>
    );
  };

  // Meetings View Filters
  const [searchMeetingQuery, setSearchMeetingQuery] = useState('');

  // Attendance View Selected Session
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Member History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberHistoryDetail | null>(null);

  // Edit Member Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<{
    rollNo: string;
    department: string;
    year: string;
    phone: string;
  }>({ rollNo: '', department: '', year: '', phone: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Meeting create / edit modal (team logins manage their own team's meetings)
  const emptyMeetingForm = () => ({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '',
    sessionSlot: 'FN',
    notes: '',
  });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<AttendanceSession | null>(null);
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm);
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);

  // Delete confirmation
  const [deletingMeeting, setDeletingMeeting] = useState<AttendanceSession | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Attendance marking
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [bulkMarking, setBulkMarking] = useState(false);

  // User login name
  const loginName = user.username;

  // Short-lived message for actions (marking, deleting...)
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const flash = (type: 'error' | 'success', text: string) => {
    setActionMessage({ type, text });
    window.setTimeout(() => setActionMessage((m) => (m?.text === text ? null : m)), 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSortConfigs([]);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [membersRes, sessionsRes, statsRes] = await Promise.all([
        fetch('/api/members', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/stats/attendance', { headers }),
      ]);

      // Parse members
      if (membersRes.ok) {
        const text = await membersRes.text();
        const data = text ? JSON.parse(text) : {};
        // Extra safeguard: guarantee only members of logged-in team are visible
        const teamMembers = (data.members || []).filter((m: Member) => !user.team || m.team === user.team);
        setMembers(teamMembers);
      } else {
        throw new Error(`Failed to load team members (${membersRes.status})`);
      }

      // Parse sessions
      if (sessionsRes.ok) {
        const text = await sessionsRes.text();
        const data = text ? JSON.parse(text) : {};
        // Scoped to team or ALL
        const teamSessions = (data.sessions || []).filter(
          (s: AttendanceSession) => s.team === 'ALL' || s.team.split(',').map((t) => t.trim()).includes(teamName)
        );
        setSessions(sortSessions(teamSessions));
      }

      // Parse attendance stats
      if (statsRes.ok) {
        const text = await statsRes.text();
        const data = text ? JSON.parse(text) : {};
        const teamStats = (data.members || []).filter(
          (m: MemberAttendanceStat) => !user.team || m.team === user.team
        );
        setAttendanceStats(teamStats);
      }

      fetchRecentAbsentees();
    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError(err.message || 'Unable to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.team]);

  // Combine member records with their attendance statistics
  const membersWithStats = useMemo(() => {
    const statsMap = new Map<string, MemberAttendanceStat>();
    attendanceStats.forEach((s) => statsMap.set(s.memberId, s));

    return members.map((m) => {
      const stat = statsMap.get(m.id);
      return {
        ...m,
        present: stat ? stat.present : 0,
        absent: stat ? stat.absent : 0,
        informed: stat ? stat.informed : 0,
        totalSessions: stat ? stat.total : 0,
        presentPct: stat ? stat.presentPct : 0,
      };
    });
  }, [members, attendanceStats]);

  // Filtered members for Members tab
  const filteredMembers = useMemo(() => {
    return membersWithStats.filter((m) => {
      if (filterRole !== 'ALL' && m.role !== filterRole) return false;
      if (searchMemberQuery) {
        const q = searchMemberQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.rollNo && m.rollNo.toLowerCase().includes(q)) ||
          (m.department && m.department.toLowerCase().includes(q)) ||
          (m.phone && m.phone.includes(q))
        );
      }
      return true;
    });
  }, [membersWithStats, filterRole, searchMemberQuery]);


  const sortedMembers = useMemo(() => {
    if (sortConfigs.length === 0) return filteredMembers;
    return [...filteredMembers].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        let aVal = a[key as keyof typeof a];
        let bVal = b[key as keyof typeof b];
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredMembers, sortConfigs]);


  // Selected session for Attendance tab
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Attendance breakdown for active session
  const activeSessionStats = useMemo(() => {
    if (!activeSession) {
      return { present: 0, absent: members.length, informed: 0, unmarked: 0, total: members.length };
    }
    const recs = activeSession.records || {};
    let present = 0;
    let absent = 0;
    let informed = 0;

    members.forEach((m) => {
      const rec = recs[m.id];
      const status = rec ? rec.status : 'ABSENT';
      if (status === 'PRESENT') present++;
      else if (status === 'INFORMED') informed++;
      else absent++;
    });

    return { present, absent, informed, unmarked: 0, total: members.length };
  }, [activeSession, members]);

  // Members list with status for active session
  const sessionMembersList = useMemo(() => {
    if (!activeSession) return [];
    const records = activeSession.records || {};

    let targetMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

    return targetMembers.map((m) => {
      const rec = records[m.id];
      const status: 'PRESENT' | 'ABSENT' | 'INFORMED' = rec ? (rec.status as any) : 'ABSENT';
      return {
        ...m,
        status,
        markedAt: rec?.markedAt,
        notes: rec?.notes,
      };
    });
  }, [activeSession, members]);

  // Member History Handler
  const handleOpenHistory = async (member: Member) => {
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/members/${member.id}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        setSelectedMemberHistory(data);
      } else {
        setSelectedMemberHistory(null);
      }
    } catch (err) {
      console.error('Failed to load member history:', err);
      setSelectedMemberHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Edit Member Modal Open Handler
  const handleOpenEdit = (member: Member) => {
    setEditingMember(member);
    setEditForm({
      rollNo: member.rollNo || '',
      department: member.department || '',
      year: member.year || '',
      phone: member.phone || '',
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  // Edit Member Save Handler
  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);

    const payload: Record<string, string | undefined> = {};
    if (editForm.rollNo.trim()) payload.rollNo = editForm.rollNo.trim();
    if (editForm.department.trim()) payload.department = editForm.department.trim();
    if (editForm.year.trim()) payload.year = editForm.year.trim();
    if (editForm.phone.trim()) payload.phone = editForm.phone.trim();

    try {
      const res = await fetch(`/api/members/${editingMember.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let resData: any = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch { }

      if (res.ok) {
        setEditSuccess('Member details updated successfully');
        setMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? { ...m, ...payload } : m))
        );
        setTimeout(() => {
          setEditModalOpen(false);
        }, 1200);
      } else {
        if (res.status === 403) {
          setEditError(
            'Backend note: Member modification currently requires Administrator permissions. Field changes cannot be written to database directly by Team role.'
          );
        } else {
          setEditError(resData.error || resData.message || `Update failed (${res.status})`);
        }
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error updating member');
    } finally {
      setEditSaving(false);
    }
  };

  // ─────────────────────────── Meetings & attendance actions ───────────────────────────

  /** Team logins can edit/delete only their own team's meetings (not ALL sessions). */
  const canManage = (s: AttendanceSession) => s.team === teamName;

  /** Parse a JSON body safely and turn error responses into a readable message. */
  const readJson = async (res: Response) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  };
  const errorText = (data: any, status: number) => {
    if (Array.isArray(data?.details) && data.details.length) {
      return data.details.map((d: any) => (d.path ? `${d.path}: ${d.message}` : d.message)).join('; ');
    }
    return data?.error || `Request failed (${status})`;
  };



  const openCreateMeeting = () => {
    setEditingMeeting(null);
    setMeetingForm(emptyMeetingForm());
    setMeetingError(null);
    setMeetingModalOpen(true);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingForm.endTime && meetingForm.endTime <= meetingForm.startTime) {
      setMeetingError('End time must be after start time');
      return;
    }
    setMeetingSaving(true);
    setMeetingError(null);

    // Slot is worked out by the backend from the start time (before 12:00 = FN)
    const body: Record<string, unknown> = {
      title: meetingForm.title.trim(),
      date: meetingForm.date,
      startTime: meetingForm.startTime,
      sessionSlot: meetingForm.sessionSlot,
      notes: meetingForm.notes.trim(),
    };
    if (editingMeeting) {
      body.endTime = meetingForm.endTime || null; // null clears it
    } else {
      body.team = teamName;
      if (meetingForm.endTime) body.endTime = meetingForm.endTime;
    }

    try {
      const res = await fetch(editingMeeting ? `/api/sessions/${editingMeeting.id}` : '/api/sessions', {
        method: editingMeeting ? 'PATCH' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setMeetingError(errorText(data, res.status));
        return;
      }
      const saved: AttendanceSession = data.session;
      setSessions((prev) =>
        sortSessions(editingMeeting ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]),
      );
      if (!editingMeeting) setSelectedSessionId(saved.id);
      setMeetingModalOpen(false);
      flash('success', editingMeeting ? 'Meeting updated' : 'Meeting created');
    } catch (err: any) {
      setMeetingError(err.message || 'Network error');
    } finally {
      setMeetingSaving(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!deletingMeeting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/sessions/${deletingMeeting.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        flash('error', errorText(await readJson(res), res.status));
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== deletingMeeting.id));
      if (selectedSessionId === deletingMeeting.id) setSelectedSessionId('');
      fetchRecentAbsentees(); // the deleted session may be one of the last 3
      flash('success', 'Meeting deleted');
      setDeletingMeeting(null);
    } catch (err: any) {
      flash('error', err.message || 'Network error');
    } finally {
      setDeleteBusy(false);
    }
  };

  /** Replace one member's record in a session locally (undefined = clear). */
  const setLocalRecord = (sessionId: string, memberId: string, rec: SessionRecord | undefined) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const records = { ...(s.records || {}) };
        if (rec) records[memberId] = rec;
        else delete records[memberId];
        return { ...s, records };
      }),
    );
  };

  /** Mark (or clear, with status null) one member. Optimistic, rolls back on failure. */
  const markMember = async (
    session: AttendanceSession,
    memberId: string,
    status: SessionRecord['status'] | null,
  ): Promise<boolean> => {
    const previous = session.records?.[memberId];
    setLocalRecord(
      session.id,
      memberId,
      status ? { status, markedAt: new Date().toISOString() } : undefined,
    );
    setMarkingIds((prev) => new Set(prev).add(memberId));
    try {
      const res = await fetch(`/api/sessions/${session.id}/records/${memberId}`, {
        method: status ? 'PUT' : 'DELETE',
        headers: getAuthHeaders(),
        ...(status && { body: JSON.stringify({ status }) }),
      });
      if (!res.ok) throw new Error(errorText(await readJson(res), res.status));
      const data = await readJson(res);
      // Keep the server's markedAt for this member
      const serverRec = data.session?.records?.[memberId];
      if (status && serverRec) setLocalRecord(session.id, memberId, serverRec);
      return true;
    } catch (err: any) {
      setLocalRecord(session.id, memberId, previous);
      flash('error', err.message || 'Could not save attendance');
      return false;
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const handleUpdateSessionRemarks = async (notes: string) => {
    if (!activeSession) return;
    if (activeSession.notes === notes) return;

    const previousSession = { ...activeSession };
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, notes } : s));

    try {
      const res = await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes })
      });
      if (!res.ok) throw new Error('Failed to update remarks');
    } catch (err) {
      console.error(err);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? previousSession : s));
      flash('error', 'Could not update remarks');
    }
  };

  /** Bulk mark all members in the current view. */
  const handleBulkMark = async (status: SessionRecord['status']) => {
    if (!activeSession) return;
    const targets = sessionMembersList;
    if (targets.length === 0) return;
    
    setBulkMarking(true);
    
    const now = new Date().toISOString();
    const updatedRecords = { ...(activeSession.records || {}) };
    targets.forEach(m => {
      updatedRecords[m.id] = { status, markedAt: now };
    });

    const previousSession = { ...activeSession };
    
    // Optimistic UI update
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, records: updatedRecords } : s));

    try {
      const res = await fetch(`/api/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ records: updatedRecords })
      });
      
      if (!res.ok) throw new Error(`Bulk mark failed (${res.status})`);
      
      flash('success', `Marked ${targets.length} member${targets.length === 1 ? '' : 's'} ${status.toLowerCase()}`);
    } catch (err: any) {
      console.error(err);
      // Revert optimistic
      setSessions(prev => prev.map(s => s.id === activeSession.id ? previousSession : s));
      flash('error', err.message || 'Could not save bulk attendance');
    } finally {
      setBulkMarking(false);
    }
  };

  // Overall attendance rate across team
  const overallTeamAttendancePct = useMemo(() => {
    if (!attendanceStats.length) return 0;
    const totalMarked = attendanceStats.reduce((sum, s) => sum + s.total, 0);
    const totalPresent = attendanceStats.reduce((sum, s) => sum + s.present, 0);
    return totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;
  }, [attendanceStats]);



  // Leaders count (LEAD, CO-LEAD, COORDINATOR)
  const leaderCount = useMemo(() => {
    return members.filter((m) => ['LEAD', 'CO-LEAD', 'COORDINATOR'].includes(m.role.toUpperCase())).length;
  }, [members]);

  return (
    <div className="flex h-dvh bg-[#F7F8FC] overflow-hidden text-slate-900">
      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-100 py-6 px-3 shrink-0 transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? 'w-60 translate-x-0 opacity-100 shadow-xl md:shadow-none'
            : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden opacity-0 p-0 border-0 pointer-events-none'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <img
            src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
            alt="Logo"
            className="w-9 h-9 rounded-xl object-cover shadow-xs shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-slate-900 font-semibold text-sm leading-tight truncate">Students Union</p>
            <p className="text-indigo-600 font-medium text-[10px] tracking-wide uppercase">
              {teamName} Team Portal
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ icon: Icon, label }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                onClick={() => {
                  setActiveNav(label);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={`nav-item ${isActive ? 'nav-active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ background: avatarColor(loginName) }}
            >
              {loginName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{loginName}</p>
              <p className="text-[10px] text-slate-400 truncate">{teamName} Team</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchData}
                disabled={loading}
                title="Refresh Data"
                className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ${loading ? 'animate-spin opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Content Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7">
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-indigo-600 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">{activeNav}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {teamName} Team
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchData}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Action feedback (marking, saving, deleting) */}
          {actionMessage && (
            <div
              className={`mb-6 p-3.5 rounded-2xl border flex items-center justify-between text-sm ${actionMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
            >
              <div className="flex items-center gap-3">
                {actionMessage.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                ) : (
                  <Check className="w-5 h-5 shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </div>
              <button onClick={() => setActionMessage(null)} className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs font-medium">Loading {teamName} team data...</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 1: OVERVIEW
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Overview' && (
            <div className="space-y-6">
              {/* Hero Banner */}
              <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-indigo-600/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-medium text-indigo-100 mb-2">
                    <Award className="w-3.5 h-3.5" />
                    <span>Students Union • {teamName} Team</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    {members.length}{' '}
                    <span className="text-xl sm:text-2xl font-normal text-indigo-100">Team Members</span>
                  </h2>
                  <p className="text-xs text-indigo-100 mt-1 max-w-md">
                    Overview of your team's roster, active meetings, and overall attendance metrics.
                  </p>
                </div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20 self-start sm:self-auto shrink-0">
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Members
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{members.length}</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {leaderCount} in leadership roles
                  </p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Meetings
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{sessions.length}</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {sessions.length === 0 ? 'No meetings yet' : 'Team & Union sessions'}
                  </p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Avg Attendance
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{overallTeamAttendancePct}%</div>
                  <p className="text-[11px] text-slate-400 mt-1">Across all recorded sessions</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Team Domain
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{teamName}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Team-scoped access</p>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 2: MEMBERS
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Members' && (
            <div className="space-y-5">
              {/* Filter Controls Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Search by name, roll no, department, phone..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                  {searchMemberQuery && (
                    <button
                      onClick={() => setSearchMemberQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Role Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Role:
                  </span>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px top 50%', backgroundSize: '8px auto' }}
                  >
                    {['ALL', 'LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Members Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {teamName} Roster ({sortedMembers.length})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Showing only members registered in your team
                    </p>
                  </div>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-sm font-semibold text-slate-600">
                      {members.length === 0
                        ? 'No members in your team yet.'
                        : 'No members match the current filter.'}
                    </p>
                    {searchMemberQuery && (
                      <button
                        onClick={() => {
                          setSearchMemberQuery('');
                          setFilterRole('ALL');
                        }}
                        className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                        <tr>
                          {['Member', 'Role', 'Roll Number', 'Department', 'Year', 'Phone']
                            .filter(header => !hiddenColumns.includes(header))
                            .map((header) => {
                              const keyMap: Record<string, string> = {
                                'Member': 'name', 'Role': 'role', 'Roll Number': 'rollNo', 'Department': 'department', 'Year': 'year', 'Phone': 'phone'
                              };
                              const colKey = keyMap[header];
                              return (
                                <th
                                  key={header}
                                  className="px-6 py-3.5 group hover:bg-slate-100 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div
                                      className="flex items-center cursor-pointer flex-1"
                                      onClick={() => requestSort(colKey as any)}
                                    >
                                      {header}
                                      <SortIcon columnKey={colKey} />
                                    </div>
                                    <button
                                      onClick={() => setHiddenColumns(prev => [...prev, header])}
                                      className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                      title={`Hide ${header}`}
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </th>
                              );
                            })}
                          <th className="px-4 sm:px-6 py-3.5 text-right w-24 sticky right-0 bg-slate-50">
                            {hiddenColumns.length > 0 ? (
                              <div className="relative group inline-block text-left">
                                <button className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Restore columns">
                                  <Plus className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Restore</div>
                                  {hiddenColumns.map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setHiddenColumns(prev => prev.filter(c => c !== col))}
                                      className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg flex items-center justify-between group/btn transition-colors cursor-pointer"
                                    >
                                      {col}
                                      <Plus className="w-3 h-3 opacity-0 group-hover/btn:opacity-100" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
                            {!hiddenColumns.includes('Member') && (
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                                    style={{ background: avatarColor(m.name) }}
                                  >
                                    {m.name[0].toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-slate-900">{m.name}</span>
                                </div>
                              </td>
                            )}
                            {!hiddenColumns.includes('Role') && (
                              <td className="px-6 py-3.5">
                                <span className={`badge ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
                                  {m.role}
                                </span>
                              </td>
                            )}
                            {!hiddenColumns.includes('Roll Number') && (
                              <td className="px-6 py-3.5 font-mono text-slate-600">
                                {m.rollNo || <span className="text-slate-300">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Department') && (
                              <td className="px-6 py-3.5 text-slate-600">
                                {m.department || <span className="text-slate-300">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Year') && (
                              <td className="px-6 py-3.5 text-slate-600">
                                {m.year || <span className="text-slate-300">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Phone') && (
                              <td className="px-6 py-3.5 font-mono text-slate-600">
                                {m.phone || <span className="text-slate-300">—</span>}
                              </td>
                            )}

                            <td className="px-3 sm:px-6 py-3.5 text-right sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)] md:shadow-none">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenHistory(m)}
                                  title="View Attendance History"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(m)}
                                  title="Edit Member Details"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 4: ATTENDANCE
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Attendance' && (
            <div className="flex flex-col gap-4 md:h-full md:max-h-[calc(100vh-100px)] animate-in fade-in duration-500">
              {!activeSession ? (
                <>
                  {/* ── Last 3 Sessions Absentees Section ── */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-4">
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
                            Overview of absent members across the three most recent attendance sessions
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
                                      className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-0.5"
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
                                        {s.absentees.map((ab: any) => (
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
                                onClick={() => setSelectedSessionId(s.id)}
                                className="w-full mt-2 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                View & Manage Session
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-900">Recent Sessions</h2>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search sessions..." 
                          value={searchMeetingQuery}
                          onChange={(e) => setSearchMeetingQuery(e.target.value)}
                          className="w-full sm:w-64 pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                        />
                        {searchMeetingQuery && (
                          <button onClick={() => setSearchMeetingQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={openCreateMeeting}
                        className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-indigo-600/20 flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Session</span><span className="sm:hidden">New</span>
                      </button>
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center flex-1 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">No Sessions Yet</h3>
                      <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm">
                        You haven't created any attendance sessions yet. Click "New Session" to start tracking.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {sortSessions(sessions).filter(s => {
                        if (!searchMeetingQuery) return true;
                        const q = searchMeetingQuery.toLowerCase();
                        return s.title.toLowerCase().includes(q) || 
                               s.team.toLowerCase().includes(q) || 
                               s.date.includes(q) || 
                               (s.sessionSlot || '').toLowerCase().includes(q);
                      }).map(session => {
                        const targetCount = members.filter(m => session.team.split(',').map(t=>t.trim()).includes(m.team)).length;
                        const markedCount = session.records ? Object.keys(session.records).filter(id => members.some(m => m.id === id)).length : 0;
                        const progress = targetCount === 0 ? 0 : Math.round((markedCount / targetCount) * 100);
                        
                        return (
                          <div 
                            key={session.id} 
                            onClick={() => setSelectedSessionId(session.id)}
                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
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
                                    {session.sessionSlot || 'FN'}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {session.title}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {canManage(session) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeletingMeeting(session); }}
                                    title="Delete session"
                                    aria-label={`Delete ${session.title}`}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
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
                                  className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                  style={{ width: `${progress}%` }} 
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                {/* Detailed Session View Header */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedSessionId('')}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-1">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold tracking-wider uppercase">
                            {activeSession.team.split(',').join(', ')}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {activeSession.date}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {activeSession.startTime} {activeSession.endTime ? `- ${activeSession.endTime}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold text-slate-900">{activeSession.title}</h2>
                          {canManage(activeSession) && (
                            <button
                              onClick={() => setDeletingMeeting(activeSession)}
                              title="Delete session"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage(activeSession) ? (
                      <div className="mt-2 w-full lg:w-3/4">
                        <textarea
                          placeholder="Add session remarks here... (e.g. Special instructions, delays)"
                          defaultValue={activeSession.notes}
                          onBlur={(e) => handleUpdateSessionRemarks(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none h-[44px] focus:h-20"
                        />
                      </div>
                    ) : (
                      activeSession.notes && (
                        <div className="flex items-center gap-2 mt-2 w-full lg:w-3/4">
                          <div className="w-full text-sm text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm leading-relaxed whitespace-pre-wrap">
                            <span className="font-bold text-slate-700 mr-2">Remarks:</span>
                            {activeSession.notes}
                          </div>
                        </div>
                      )
                    )}
                  </div>

                    {/* Selected Session Stats Banner */}
                    {activeSession && (
                      <div className="pt-4 grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                            Present
                          </span>
                          <div className="text-xl font-bold text-emerald-700">
                            {activeSessionStats.present}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                          <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                            Absent
                          </span>
                          <div className="text-xl font-bold text-rose-700">
                            {activeSessionStats.absent}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                            Informed
                          </span>
                          <div className="text-xl font-bold text-amber-700">
                            {activeSessionStats.informed}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Session Members Attendance Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mt-2">
                    <div className="overflow-auto flex-1 p-0">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                            <th className="hidden sm:table-cell px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                            <th className="px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              <div className="flex flex-col sm:flex-row items-end sm:items-center justify-center gap-2 sm:gap-4">
                                <span className={canManage(activeSession) ? 'hidden md:inline' : ''}>{canManage(activeSession) ? 'Mark Attendance (Click Present to toggle)' : 'Status'}</span>
                                {canManage(activeSession) && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleBulkMark('PRESENT')} disabled={bulkMarking} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors disabled:opacity-50">All Present</button>
                                    <button onClick={() => handleBulkMark('ABSENT')} disabled={bulkMarking} className="px-2 py-1 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors disabled:opacity-50">All Absent</button>
                                  </div>
                                )}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sessionMembersList.map(m => {
                            const status = m.status;
                            return (
                              <tr key={m.id} className="hover:bg-slate-50/50">
                                <td className="px-3 sm:px-6 py-3 sm:whitespace-nowrap">
                                  <p className="font-medium text-slate-900">{m.name}</p>
                                  <p className="text-xs text-slate-500">{m.rollNo || 'No Roll No'}<span className="sm:hidden"> · {m.role}</span></p>
                                </td>
                                <td className="hidden sm:table-cell px-6 py-3 whitespace-nowrap">
                                  <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">{m.role}</span>
                                </td>
                                <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                  <div className="flex items-center justify-end sm:justify-center gap-1.5 sm:gap-2">
                                    {canManage(activeSession) ? (
                                      <>
                                        <button 
                                          onClick={() => markMember(activeSession, m.id, status === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                                          disabled={markingIds.has(m.id)}
                                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            status === 'PRESENT' 
                                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                              : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                          }`}
                                        >
                                          <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Present</span>
                                        </button>
                                        <button 
                                          onClick={() => markMember(activeSession, m.id, 'ABSENT')}
                                          disabled={markingIds.has(m.id)}
                                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            status === 'ABSENT' 
                                              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                                              : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                                          }`}
                                        >
                                          <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Absent</span>
                                        </button>
                                        <button 
                                          onClick={() => markMember(activeSession, m.id, 'INFORMED')}
                                          disabled={markingIds.has(m.id)}
                                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            status === 'INFORMED' 
                                              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                                              : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'
                                          }`}
                                        >
                                          <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Informed</span>
                                        </button>
                                      </>
                                    ) : (
                                      <span className={`px-4 py-1.5 rounded-xl text-xs font-bold ${
                                        status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                                        status === 'ABSENT' ? 'bg-rose-100 text-rose-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {status.charAt(0) + status.slice(1).toLowerCase()}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 5: REPORTS
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Reports' && (
            <ReportsView members={members as any} />
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════
          MEMBER ATTENDANCE HISTORY MODAL
         ══════════════════════════════════════════════ */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed session attendance record for member
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Loading attendance details...</p>
                </div>
              ) : selectedMemberHistory ? (
                <div className="space-y-5">
                  {/* Member Profile Card */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: avatarColor(selectedMemberHistory.member.name) }}
                    >
                      {selectedMemberHistory.member.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {selectedMemberHistory.member.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`badge text-[10px] ${ROLE_STYLE[selectedMemberHistory.member.role] || ''}`}>
                          {selectedMemberHistory.member.role}
                        </span>
                        {selectedMemberHistory.member.rollNo && (
                          <span className="text-[11px] font-mono text-slate-500">
                            {selectedMemberHistory.member.rollNo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-indigo-600">
                        {selectedMemberHistory.stats.presentPct}%
                      </span>
                      <p className="text-[10px] text-slate-400">Overall Rate</p>
                    </div>
                  </div>

                  {/* Detailed Member Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Department</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedMemberHistory.member.department || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Year</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedMemberHistory.member.year || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Phone</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedMemberHistory.member.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Team</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedMemberHistory.member.team || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Joined</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {selectedMemberHistory.member.createdAt
                      ? new Date(selectedMemberHistory.member.createdAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Summary Metric Counters */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs font-bold text-slate-700">
                    {selectedMemberHistory.stats.total}
                  </div>
                  <span className="text-[10px] text-slate-400">Total</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-xs font-bold text-emerald-700">
                    {selectedMemberHistory.stats.present}
                  </div>
                  <span className="text-[10px] text-emerald-600">Present</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="text-xs font-bold text-rose-700">
                    {selectedMemberHistory.stats.absent}
                  </div>
                  <span className="text-[10px] text-rose-600">Absent</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-xs font-bold text-amber-700">
                    {selectedMemberHistory.stats.informed}
                  </div>
                  <span className="text-[10px] text-amber-600">Informed</span>
                </div>
              </div>

              {/* History Timeline List */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Meeting Logs
                </h4>
                {selectedMemberHistory.history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No meeting attendance recorded for this member yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedMemberHistory.history.map((h, i) => {
                      const statusStyle = STATUS_STYLE[h.status] || STATUS_STYLE.UNMARKED;
                      return (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{h.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {h.date} • Slot: {h.sessionSlot || 'FN'}
                            </p>
                          </div>
                          <span className={`badge ${statusStyle.badge}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              Unable to load attendance details for this member.
            </p>
              )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-right">
            <button
              onClick={() => setHistoryModalOpen(false)}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
        </div>
  )
}

{/* ══════════════════════════════════════════════
          EDIT MEMBER DETAILS MODAL
         ══════════════════════════════════════════════ */}
{
  editModalOpen && editingMember && (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-xl border border-slate-200 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Member Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update contact or academic info for {editingMember.name}
            </p>
          </div>
          <button
            onClick={() => setEditModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSaveMemberEdit} className="p-6 space-y-4">
          {/* Member & Locked Team Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800">{editingMember.name}</span>
              <span className={`ml-2 badge ${ROLE_STYLE[editingMember.role] || ''}`}>
                {editingMember.role}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Team: {teamName} (Locked)
            </span>
          </div>

          {/* Status / Notice Messages */}
          {editError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{editError}</span>
            </div>
          )}
          {editSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              {editSuccess}
            </div>
          )}

          {/* Roll Number */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Roll Number
            </label>
            <input
              type="text"
              value={editForm.rollNo}
              onChange={(e) => setEditForm((prev) => ({ ...prev, rollNo: e.target.value }))}
              placeholder="e.g. 21B001"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Department
            </label>
            <input
              type="text"
              value={editForm.department}
              onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="e.g. Computer Science"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Year of Study
            </label>
            <input
              type="text"
              value={editForm.year}
              onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
              placeholder="e.g. 2 or 3"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Phone
            </label>
            <input
              type="text"
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* ══════════════════════════════════════════════
          CREATE / EDIT MEETING MODAL
         ══════════════════════════════════════════════ */}
{
  meetingModalOpen && (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-xl border border-slate-200 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {editingMeeting ? 'Edit Meeting' : 'New Meeting'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">For the {teamName} team</p>
          </div>
          <button
            onClick={() => setMeetingModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMeeting} className="p-6 space-y-4">
          {meetingError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{meetingError}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={meetingForm.title}
              onChange={(e) => setMeetingForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={`e.g. ${teamName} weekly meeting`}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={meetingForm.date}
                onChange={(e) => setMeetingForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Slot
              </label>
              <select
                value={meetingForm.sessionSlot}
                onChange={e => {
                  const slot = e.target.value;
                  let startTime = meetingForm.startTime;
                  if (slot === 'FN') startTime = '09:00';
                  else if (slot === 'AN') startTime = '13:00';
                  else if (slot === 'EV') startTime = '17:00';
                  setMeetingForm((p) => ({ ...p, sessionSlot: slot, startTime }));
                }}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="FN">FN (Morning)</option>
                <option value="AN">AN (Afternoon)</option>
                <option value="EV">EV (Evening)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                value={meetingForm.startTime}
                onChange={(e) => setMeetingForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                End Time <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={meetingForm.endTime}
                onChange={(e) => setMeetingForm((p) => ({ ...p, endTime: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">
            Slot is set from the start time: before 12:00 is FN, otherwise AN.
          </p>

          {editingMeeting && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Notes <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={meetingForm.notes}
                onChange={(e) => setMeetingForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Venue, agenda..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMeetingModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={meetingSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {meetingSaving ? 'Saving...' : editingMeeting ? 'Save Changes' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* ══════════════════════════════════════════════
          CHANGE LOGIN MODAL
         ══════════════════════════════════════════════ */}

{/* ══════════════════════════════════════════════
          DELETE MEETING CONFIRMATION
         ══════════════════════════════════════════════ */}
{
  deletingMeeting && (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Delete this meeting?</h3>
        <p className="text-xs text-slate-500 mt-1.5">
          <span className="font-semibold text-slate-700">{deletingMeeting.title}</span> on {deletingMeeting.date}
          {Object.keys(deletingMeeting.records || {}).length > 0 &&
            ` and its ${Object.keys(deletingMeeting.records || {}).length} attendance mark(s)`}{' '}
          will be removed permanently.
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={() => setDeletingMeeting(null)}
            disabled={deleteBusy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteMeeting}
            disabled={deleteBusy}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {deleteBusy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
    </div >
  );
}