import React, { useEffect, useState, useMemo } from 'react';
import { type User, DEPARTMENTS } from '../types';
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
  ArrowDown,
  ArrowUpDown,
  Minus,
  ChevronRight,
  Sparkles,
  Upload,
  Download,
  Lock
} from 'lucide-react';
import ReportsView from './ReportsView';
import { isUpcoming, opensLabel } from './sessionTime';
import RepeatAbsentees, { repeatAbsenteeCards } from './RepeatAbsentees';
import TopographyBackground from '../components/TopographyBackground';
import { apiFetch } from '../api';

interface TeamDashboardProps {
  user: User;
  onLogout: () => void;
}

type NavKey = 'Overview' | 'Members' | 'Attendance' | 'Reports' | 'Leads' | 'Coordinators' | 'Core';

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

/** Bulk actions available in edit mode (same set as the admin view). */
type BulkAction = 'PRESENT' | 'ABSENT' | 'INFORMED' | 'CLEAR' | 'UNMARKED_TO_ABSENT';

const NAV: { icon: React.ElementType; label: NavKey }[] = [
  { icon: Grid3X3, label: 'Overview' },
  { icon: Users, label: 'Members' },
  { icon: UserCheck, label: 'Attendance' },
  { icon: BarChart2, label: 'Reports' },
];

const ROLE_STYLE: Record<string, string> = {
  LEAD: 'bg-[#082F49] text-[#7DD3FC] border border-sky-500/40',
  'CO-LEAD': 'bg-[#1E1B4B] text-[#A5B4FC] border border-indigo-500/40',
  COORDINATOR: 'bg-[#064E3B] text-[#6EE7B7] border border-emerald-500/40',
  CORE: 'bg-[#1E1E2E] text-[#CBD5E1] border border-white/10',
};

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  PRESENT: { badge: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30', label: 'Present' },
  ABSENT: { badge: 'bg-rose-950/60 text-rose-400 border border-rose-500/30', label: 'Absent' },
  INFORMED: { badge: 'bg-sky-950/60 text-sky-300 border border-sky-500/30', label: 'Informed' },
  UNMARKED: { badge: 'bg-slate-900/60 text-slate-400 border border-slate-700/50', label: 'Unmarked' },
};

const avatarColor = (name: string) => {
  const colors = ['#0EA5E9', '#0284C7', '#06B6D4', '#0D9488', '#38BDF8', '#3B82F6'];
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

// Members are listed LEAD → CO-LEAD → COORDINATOR → CORE, then by name
const ROLE_ORDER = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
const roleRank = (role?: string) => {
  const i = ROLE_ORDER.indexOf((role || '').toUpperCase());
  return i === -1 ? ROLE_ORDER.length : i;
};
const byRoleThenName = (a: { role?: string; name?: string }, b: { role?: string; name?: string }) =>
  roleRank(a.role) - roleRank(b.role) || (a.name || '').localeCompare(b.name || '');

export default function TeamDashboard({ user, onLogout }: TeamDashboardProps) {
  const teamName = user.team || 'TECH';
  const [activeNav, setActiveNav] = useState<NavKey>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigateTo = (nav: NavKey, replace = false) => {
    setActiveNav(nav);
    const hash = `#${nav.toLowerCase()}`;
    if (window.location.hash !== hash) {
      if (replace) {
        window.history.replaceState({ nav }, '', hash);
      } else {
        window.history.pushState({ nav }, '', hash);
      }
    }
  };

  useEffect(() => {
    const parseNav = (): NavKey => {
      const h = window.location.hash.replace('#', '').toLowerCase();
      const map: Record<string, NavKey> = {
        overview: 'Overview',
        members: 'Members',
        attendance: 'Attendance',
        reports: 'Reports',
        leads: 'Leads',
        coordinators: 'Coordinators',
        core: 'Core',
      };
      return map[h] || 'Overview';
    };

    const initialNav = parseNav();
    setActiveNav(initialNav);
    window.history.replaceState({ nav: initialNav }, '', `#${initialNav.toLowerCase()}`);

    const onPopState = (e: PopStateEvent) => {
      if (e.state?.nav) {
        setActiveNav(e.state.nav);
      } else {
        setActiveNav(parseNav());
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Core data states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<MemberAttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


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
        {config.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-400" /> : <ArrowDown className="w-3 h-3 text-sky-400" />}
        {sortIndex > 0 && <span className="text-[9px] font-bold text-sky-400 ml-0.5">{sortIndex + 1}</span>}
      </div>
    );
  };

  // Meetings View Filters
  const [searchMeetingQuery, setSearchMeetingQuery] = useState('');

  // Attendance View Selected Session
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionPermissionMode, setSessionPermissionMode] = useState<'view' | 'edit'>('view');

  const openSession = (sessionId: string, mode: 'view' | 'edit') => {
    setSelectedSessionId(sessionId);
    setSessionPermissionMode(mode);
  };

  // Member History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberHistoryDetail | null>(null);

  // Edit Member Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<Partial<Member>>({ rollNo: '', department: '', year: '', phone: '' });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
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
  const [bulkBusy, setBulkBusy] = useState<BulkAction | null>(null); // action being bulk-saved
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'INFORMED' | 'UNMARKED'>('ALL');

  // Each session opens showing everyone
  useEffect(() => {
    setStatusFilter('ALL');
  }, [selectedSessionId]);

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSortConfigs([]);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [membersRes, sessionsRes, statsRes] = await Promise.all([
        apiFetch('/api/members', { headers }),
        apiFetch('/api/sessions', { headers }),
        apiFetch('/api/stats/attendance', { headers }),
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

  // Filtered members for Members tab & specific role directories
  const filteredMembers = useMemo(() => {
    return membersWithStats.filter((m) => {
      let matchesRole = true;
      if (activeNav === 'Leads') {
        matchesRole = m.role === 'LEAD' || m.role === 'CO-LEAD';
      } else if (activeNav === 'Coordinators') {
        matchesRole = m.role === 'COORDINATOR';
      } else if (activeNav === 'Core') {
        matchesRole = m.role === 'CORE';
      } else {
        matchesRole = filterRole === 'ALL' || m.role === filterRole;
      }
      if (!matchesRole) return false;

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
  }, [membersWithStats, filterRole, searchMemberQuery, activeNav]);


  // Default order: role (LEAD → CO-LEAD → COORDINATOR → CORE), then name.
  // Column sorts apply first; sorting by Role uses the same role order, not A-Z.
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        if (key === 'role') {
          const diff = roleRank(a.role) - roleRank(b.role);
          if (diff !== 0) return direction === 'asc' ? diff : -diff;
          continue;
        }
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
      return byRoleThenName(a, b);
    });
  }, [filteredMembers, sortConfigs]);


  // Selected session for Attendance tab
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Attendance breakdown for active session (Absent = Total - Present - Informed)
  const activeSessionStats = useMemo(() => {
    const total = members.length;
    if (!activeSession) {
      return { present: 0, informed: 0, absent: total, total };
    }
    const recs = activeSession.records || {};
    let present = 0;
    let informed = 0;

    members.forEach((m) => {
      const rec = recs[m.id];
      if (rec?.status === 'PRESENT') present++;
      else if (rec?.status === 'INFORMED') informed++;
    });

    // Absent = everyone who is neither present nor informed (marked absent or still unmarked)
    const absent = total - present - informed;
    return { present, informed, absent, total };
  }, [activeSession, members]);

  // Members list with their real status for the active session (UNMARKED until marked)
  const sessionMembersList = useMemo(() => {
    if (!activeSession) return [];
    const records = activeSession.records || {};

    return [...members].sort(byRoleThenName).map((m) => {
      const rec = records[m.id];
      const status = (rec?.status || 'UNMARKED') as 'PRESENT' | 'ABSENT' | 'INFORMED' | 'UNMARKED';
      return {
        ...m,
        status,
        markedAt: rec?.markedAt,
        notes: rec?.notes,
      };
    });
  }, [activeSession, members]);

  // Members shown in the session table, based on the clicked stat card
  const filteredSessionMembers = useMemo(() => {
    switch (statusFilter) {
      case 'PRESENT':
        return sessionMembersList.filter((m) => m.status === 'PRESENT');
      case 'INFORMED':
        return sessionMembersList.filter((m) => m.status === 'INFORMED');
      case 'ABSENT':
        // matches the Absent count: marked absent + still unmarked
        return sessionMembersList.filter((m) => m.status === 'ABSENT' || m.status === 'UNMARKED');
      case 'UNMARKED':
        return sessionMembersList.filter((m) => m.status === 'UNMARKED');
      default:
        return sessionMembersList;
    }
  }, [sessionMembersList, statusFilter]);

  // Everyone who informed in the open session
  const informedMembers = useMemo(
    () => sessionMembersList.filter((m) => m.status === 'INFORMED'),
    [sessionMembersList],
  );

  // Member History Handler
  const handleOpenHistory = async (member: Member) => {
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/api/members/${member.id}/attendance`, {
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
      name: member.name,
      role: member.role,
      rollNo: member.rollNo || '',
      department: member.department || '',
      year: member.year ? String(member.year) : '',
      phone: member.phone || '',
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  // Edit Member Save Handler
  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);

    const payload: Record<string, string | undefined> = {};
    if (editForm.rollNo?.trim()) payload.rollNo = editForm.rollNo.trim();
    if (editForm.department?.trim()) payload.department = editForm.department.trim();
    if (editForm.year?.trim()) payload.year = editForm.year.trim();
    if (editForm.phone?.trim()) payload.phone = editForm.phone.trim();
    if (editForm.name?.trim()) payload.name = editForm.name.trim();
    if (editForm.role?.trim()) payload.role = editForm.role.trim();
    if (!editingMember) payload.team = teamName;

    try {
      const method = editingMember ? 'PATCH' : 'POST';
      const url = editingMember ? `/api/members/${editingMember.id}` : '/api/members';

      const res = await apiFetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let resData: any = {};
      try {
        resData = text ? JSON.parse(text) : {};
      } catch { }

      if (res.ok) {
        setEditSuccess(editingMember ? 'Member details updated successfully' : 'Member added successfully');
        if (editingMember) {
          setMembers((prev) =>
            prev.map((m) => (m.id === editingMember.id ? { ...m, ...payload } : m))
          );
        } else {
          setMembers((prev) => [...prev, resData.member]);
        }
        setTimeout(() => {
          setEditModalOpen(false);
        }, 1200);
      } else {
        setEditError(resData.error || resData.message || `Update failed (${res.status})`);
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

  /**
   * Team logins can mark their OWN members in every meeting their team attends:
   * their own meetings and admin-created ALL / multi-team ones (e.g. TECH,DESIGN).
   */
  const canMark = (s: AttendanceSession) => {
    const ts = (s.team || 'ALL').split(',').map((t) => t.trim().toUpperCase());
    return ts.includes('ALL') || ts.includes(teamName.toUpperCase());
  };

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
      const res = await apiFetch(editingMeeting ? `/api/sessions/${editingMeeting.id}` : '/api/sessions', {
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
      const res = await apiFetch(`/api/sessions/${deletingMeeting.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        flash('error', errorText(await readJson(res), res.status));
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== deletingMeeting.id));
      if (selectedSessionId === deletingMeeting.id) setSelectedSessionId('');
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
    if (sessionPermissionMode === 'view') {
      flash('error', 'Cannot mark attendance in View Mode (Read-Only). Switch to Edit Mode.');
      return false;
    }
    if (isUpcoming(session)) {
      flash('error', `This meeting hasn't started yet. ${opensLabel(session)}.`);
      return false;
    }
    const previous = session.records?.[memberId];
    setLocalRecord(
      session.id,
      memberId,
      status ? { status, markedAt: new Date().toISOString() } : undefined,
    );
    setMarkingIds((prev) => new Set(prev).add(memberId));
    try {
      const res = await apiFetch(`/api/sessions/${session.id}/records/${memberId}`, {
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
    if (!activeSession || sessionPermissionMode === 'view') return;
    if (activeSession.notes === notes) return;

    const previousSession = { ...activeSession };
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, notes } : s));

    try {
      const res = await apiFetch(`/api/sessions/${activeSession.id}`, {
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

  /**
   * Bulk mark this team's members in the open session.
   * Always saves member by member (a few at a time), so only this team's marks are ever
   * written, even in admin-created ALL / multi-team meetings.
   */
  const handleBulkMark = async (action: BulkAction) => {
    if (!activeSession || isUpcoming(activeSession) || sessionPermissionMode === 'view') return;
    if (!canMark(activeSession)) return;

    const targets =
      action === 'UNMARKED_TO_ABSENT'
        ? sessionMembersList.filter((m) => m.status === 'UNMARKED')
        : sessionMembersList;
    if (targets.length === 0) {
      flash('error', action === 'UNMARKED_TO_ABSENT' ? 'No unmarked members' : 'No members to update');
      return;
    }

    const isClear = action === 'CLEAR';
    const newStatus: SessionRecord['status'] | null = isClear
      ? null
      : action === 'UNMARKED_TO_ABSENT'
      ? 'ABSENT'
      : action;
    const n = targets.length;
    const plural = n === 1 ? '' : 's';
    const doneMsg = isClear
      ? `Reset ${n} member${plural} to unmarked`
      : `Marked ${n} member${plural} ${newStatus!.toLowerCase()}`;

    setBulkBusy(action);

    const sessionId = activeSession.id;
    const previousRecords = { ...(activeSession.records || {}) };
    const now = new Date().toISOString();

    // Optimistic UI update
    targets.forEach((m) => {
      setLocalRecord(sessionId, m.id, newStatus ? { status: newStatus, markedAt: now } : undefined);
    });

    const failed: string[] = [];
    try {
      for (let i = 0; i < targets.length; i += 6) {
        await Promise.all(
          targets.slice(i, i + 6).map(async (m) => {
            try {
              const res = await apiFetch(`/api/sessions/${sessionId}/records/${m.id}`, {
                method: newStatus ? 'PUT' : 'DELETE',
                headers: getAuthHeaders(),
                ...(newStatus && { body: JSON.stringify({ status: newStatus }) }),
              });
              if (!res.ok) throw new Error(errorText(await readJson(res), res.status));
            } catch {
              failed.push(m.id);
            }
          }),
        );
      }

      // Put back the previous mark for anyone that didn't save
      failed.forEach((id) => setLocalRecord(sessionId, id, previousRecords[id]));

      if (failed.length === 0) flash('success', doneMsg);
      else flash('error', `Saved ${n - failed.length} of ${n}; ${failed.length} could not be saved. Try again.`);
    } finally {
      setBulkBusy(null);
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

  const teamLeads = useMemo(() => {
    return members.filter((m) => m.role === 'LEAD' || m.role === 'CO-LEAD');
  }, [members]);

  const teamCoords = useMemo(() => {
    return members.filter((m) => m.role === 'COORDINATOR');
  }, [members]);

  const teamCore = useMemo(() => {
    return members.filter((m) => m.role === 'CORE');
  }, [members]);

  return (
    <div className="flex h-dvh text-slate-100 overflow-hidden relative">
      <TopographyBackground />

      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-[#081220]/95 backdrop-blur-2xl border-r border-white/[0.08] py-6 px-3 shrink-0 transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? 'w-64 translate-x-0 opacity-100 shadow-2xl'
            : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden opacity-0 p-0 border-0 pointer-events-none'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-10 h-10 rounded-lg p-0.5 bg-gradient-to-tr from-sky-600 via-cyan-400 to-blue-500 shrink-0 shadow-[0_0_20px_rgba(14,165,233,0.5)]">
            <img
              src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
              alt="Logo"
              className="w-full h-full rounded-[6px] object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-white font-bold text-sm leading-tight truncate">Students Union</p>
            </div>
            <p className="text-[#94A3B8] text-[11px] mt-0.5">{teamName} Team</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer shrink-0"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5">
          {NAV.map(({ icon: Icon, label }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                onClick={() => {
                  navigateTo(label);
                  setSidebarOpen(false);
                }}
                className={`w-full nav-item-rect ${isActive ? 'nav-item-rect-active' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-left truncate">{label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-white/[0.08] pt-4 mt-auto">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-[#0C1A30] border border-white/[0.06]">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
              style={{ background: avatarColor(loginName) }}
            >
              {loginName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{loginName}</p>
              <p className="text-[10px] text-sky-300 font-medium truncate">{teamName} Lead</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchData}
                disabled={loading}
                title="Refresh Data"
                className={`p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ${
                  loading ? 'animate-spin opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
        {/* Content Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="btn-rect-secondary p-2.5 cursor-pointer flex items-center justify-center shrink-0"
              title={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5 text-sky-300" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-white uppercase tracking-wide">
                  {activeNav === 'Leads'
                    ? 'Domain Leads & Co-Leads'
                    : activeNav === 'Coordinators'
                    ? 'Coordinators'
                    : activeNav === 'Core'
                    ? 'Core Members'
                    : activeNav}
                </h1>
                {['Leads', 'Coordinators', 'Core'].includes(activeNav) && (
                  <button
                    onClick={() => navigateTo('Overview')}
                    className="text-xs px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    ← Overview
                  </button>
                )}
                <span className="badge-reactbits-new">
                  {teamName} Team
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
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
            <div className="mb-6 p-4 rounded-md bg-rose-950/70 border border-rose-500/40 text-rose-300 flex items-center justify-between text-xs font-mono backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchData}
                className="btn-rect-secondary px-3 py-1 text-xs cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Action feedback (marking, saving, deleting) */}
          {actionMessage && (
            <div
              className={`mb-6 p-3.5 rounded-md border flex items-center justify-between text-xs font-mono backdrop-blur-xl ${
                actionMessage.type === 'error'
                  ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {actionMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                ) : (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
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
              <div className="w-9 h-9 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(14,165,233,0.35)]"></div>
              <p className="text-xs font-mono text-sky-300">Loading {teamName} team data...</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 1: OVERVIEW
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Overview' && (
            <div className="space-y-8 pb-12">
              {/* ── Hero Banner (Enlarged with Live Status & Quick Action Buttons) ── */}
              <div className="rect-card rect-card-hover-pop p-6 sm:p-9 border-sky-500/30 bg-gradient-to-r from-[#0C1E38]/95 via-[#102747]/90 to-[#0A172B]/95 shadow-[0_0_40px_rgba(14,165,233,0.2)]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <span className="badge-reactbits-new flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                        {teamName} Operations Portal
                      </span>
                      <span className="text-xs text-sky-300 font-mono flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        Students Union Domain Control
                      </span>
                      <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                        • Verified Session Access
                      </span>
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-3.5 font-mono">
                      {members.length}{' '}
                      <span className="text-base sm:text-xl font-normal text-sky-300">
                        {teamName} Team Members
                      </span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 font-mono mt-2 max-w-xl">
                      Central command for {teamName} domain: mark meeting attendance, track member consistency, review absentees, and inspect team rosters.
                    </p>
                  </div>

                  {/* Fast Action Buttons on Hero */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                    <button
                      onClick={() => navigateTo('Attendance')}
                      className="btn-sky-glow px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Mark Attendance</span>
                    </button>
                    <button
                      onClick={() => navigateTo('Reports')}
                      className="btn-rect-secondary px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                    >
                      <BarChart2 className="w-4 h-4 text-sky-300" />
                      <span>Team Reports</span>
                    </button>
                    <button
                      onClick={() => navigateTo('Members')}
                      className="btn-rect-secondary px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-indigo-300" />
                      <span>Team Roster</span>
                    </button>
                  </div>
                </div>

                {/* Summary Metric Ribbon inside Hero */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-white/10">
                  <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                    <p className="text-[10px] uppercase font-mono text-slate-400">Total Members</p>
                    <p className="text-lg font-bold text-white font-mono mt-0.5">{members.length} Enrolled</p>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                    <p className="text-[10px] uppercase font-mono text-slate-400">Active Meetings</p>
                    <p className="text-lg font-bold text-sky-300 font-mono mt-0.5">{sessions.filter(s => !isUpcoming(s)).length} Held</p>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                    <p className="text-[10px] uppercase font-mono text-slate-400">Attendance Rate</p>
                    <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{overallTeamAttendancePct}% Average</p>
                  </div>
                  <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                    <p className="text-[10px] uppercase font-mono text-slate-400">Team Leads</p>
                    <p className="text-lg font-bold text-pink-300 font-mono mt-0.5">{leaderCount} Leaders</p>
                  </div>
                </div>
              </div>

              {/* ── Stat Cards Grid (BIGGER Cards + Hover Pop) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => navigateTo('Members')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group min-h-[160px] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Team Roster
                    </span>
                    <div className="w-10 h-10 rounded-md bg-sky-950/60 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono group-hover:text-sky-300 transition-colors">
                      {members.length}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {leaderCount} in leadership roles
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-sky-300 mt-3 pt-2 border-t border-white/5">
                    <span>Explore members</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => navigateTo('Attendance')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group min-h-[160px] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Sessions
                    </span>
                    <div className="w-10 h-10 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono group-hover:text-indigo-300 transition-colors">
                      {sessions.length}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {sessions.length === 0
                        ? 'No meetings created'
                        : `Team & Union sessions${sessions.some(s => isUpcoming(s)) ? ` · ${sessions.filter(s => isUpcoming(s)).length} upcoming` : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-300 mt-3 pt-2 border-t border-white/5">
                    <span>Manage meetings</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => navigateTo('Attendance')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group min-h-[160px] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Consistency
                    </span>
                    <div className="w-10 h-10 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-emerald-400 font-mono group-hover:text-emerald-300 transition-colors">
                      {overallTeamAttendancePct}%
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Average member attendance
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-300 mt-3 pt-2 border-t border-white/5">
                    <span>Check attendance register</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                  className="rect-card rect-card-hover-pop p-6 group min-h-[160px] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Domain
                    </span>
                    <div className="w-10 h-10 rounded-md bg-pink-950/60 border border-pink-500/30 text-pink-400 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-sky-300 font-mono">
                      {teamName}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Team-scoped access portal
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-2 border-t border-white/5">
                    <span className="text-emerald-400">Authenticated</span>
                    <span>Role: {user.role}</span>
                  </div>
                </div>
              </div>

              {/* ── Team Role Breakdown & Leadership Architecture ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-sky-400" />
                    {teamName} Team Structure & Roles
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{members.length} Total Registered</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    onClick={() => {
                      navigateTo('Leads');
                    }}
                    className="rect-card rect-card-hover-pop p-5 bg-sky-950/40 border-sky-500/30 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase font-mono text-sky-300">
                        Domain Leads & Co-Leads
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-300 px-2 py-0.5 rounded bg-sky-900/50">
                        {teamLeads.length}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {teamLeads.length} Assigned
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-2">
                      Responsible for meeting coordination and team directives
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      navigateTo('Coordinators');
                    }}
                    className="rect-card rect-card-hover-pop p-5 bg-emerald-950/40 border-emerald-500/30 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase font-mono text-emerald-300">
                        Coordinators
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-900/50">
                        {teamCoords.length}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {teamCoords.length} Assigned
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-2">
                      Assisting leads in day-to-day session tracking
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      navigateTo('Core');
                    }}
                    className="rect-card rect-card-hover-pop p-5 bg-[#0B172B] border-white/10 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase font-mono text-slate-300">
                        Core Members
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/60">
                        {teamCore.length}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {teamCore.length} Active Members
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-2">
                      Active participants in domain operations and tasks
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Last 3 Sessions Absentees Pulse (Team Scoped) ── */}
              <div className="rect-card-elevated p-6 border-sky-500/25">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-white/10">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                      <Activity className="w-5 h-5 text-pink-400" />
                      Recent Meetings Attendance Pulse
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Latest recorded sessions and absent students in {teamName} domain
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav('Attendance')}
                    className="btn-rect-secondary px-3.5 py-1.5 text-xs font-mono flex items-center gap-2 cursor-pointer self-start sm:self-auto"
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>View All Meetings</span>
                  </button>
                </div>

                {/* One card per vertical (with members): its own last 3 meetings, admin- or team-created */}
                {repeatAbsenteeCards(sessions as any, members as any, [teamName]).length === 0 ? (
                  <div className="py-8 text-center bg-white/[0.02] rounded-md border border-dashed border-white/10">
                    <UserX className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
                    <p className="text-sm font-semibold text-slate-300">No members or meetings yet.</p>
                    <p className="text-xs text-slate-500 mt-0.5">Each vertical's last 3 meetings will show here once meetings are recorded.</p>
                  </div>
                ) : (
                  <RepeatAbsentees sessions={sessions as any} members={members as any} teams={[teamName]} showTitle={false} />
                )}
              </div>

              {/* ── Operations & Fast Navigation Launchpad (3 Big Cards) ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div
                  onClick={() => navigateTo('Attendance')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group border-sky-500/20 hover:border-sky-500/60 flex flex-col justify-between min-h-[170px]"
                >
                  <div>
                    <div className="w-10 h-10 rounded-md bg-sky-950/60 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                      Attendance Marking Desk
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Quickly mark Present, Absent, or Informed status for your team members with live counts.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-sky-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Open Attendance</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div
                  onClick={() => navigateTo('Reports')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group border-pink-500/20 hover:border-pink-500/60 flex flex-col justify-between min-h-[170px]"
                >
                  <div>
                    <div className="w-10 h-10 rounded-md bg-pink-950/60 border border-pink-500/30 text-pink-400 flex items-center justify-center mb-3">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors">
                      Team Attendance Analytics
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Inspect overall attendance rate, multi-session breakdowns, and download Excel reports.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-pink-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>View Analytics</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div
                  onClick={() => navigateTo('Members')}
                  className="rect-card rect-card-hover-pop p-6 cursor-pointer group border-indigo-500/20 hover:border-indigo-500/60 flex flex-col justify-between min-h-[170px]"
                >
                  <div>
                    <div className="w-10 h-10 rounded-md bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Team Member Directory
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Search roster, view member contact details, and check detailed individual attendance histories.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono text-indigo-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Open Team Roster</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 2: MEMBERS & SPECIFIC ROLE DIRECTORIES
             ══════════════════════════════════════════════ */}
          {!loading && ['Members', 'Leads', 'Coordinators', 'Core'].includes(activeNav) && (
            <div className="space-y-5">
              {/* Filter Controls Card */}
              <div className="rect-card p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Search by name, roll no, department, phone..."
                    className="rect-input w-full pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500"
                  />
                  {searchMemberQuery && (
                    <button
                      onClick={() => setSearchMemberQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Role Controls */}
                {activeNav === 'Members' ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-sky-300 flex items-center gap-1 uppercase tracking-wider">
                        <Filter className="w-3 h-3 text-sky-400" /> Role:
                      </span>
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="rect-input py-2 px-3 text-xs text-slate-200 cursor-pointer bg-[#050B14]"
                      >
                        {['ALL', 'LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map(role => (
                          <option key={role} value={role} className="bg-[#0B172B] text-slate-200">{role}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                      <button
                        onClick={() => {
                          setEditingMember(null);
                          setEditForm({ team: teamName });
                          setEditModalOpen(true);
                        }}
                        className="btn-sky flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Member
                      </button>
                      <button
                        onClick={() => setImportModalOpen(true)}
                        className="btn-rect-secondary flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" /> Bulk Import
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="badge-sky text-xs font-mono">
                      Filtered: {activeNav === 'Leads' ? 'Domain Leads & Co-Leads' : activeNav === 'Coordinators' ? 'Coordinators' : 'Core Members'}
                    </span>
                    <button
                      onClick={() => navigateTo('Members')}
                      className="text-xs text-slate-400 hover:text-white underline font-mono cursor-pointer"
                    >
                      View All Members
                    </button>
                  </div>
                )}
              </div>

              {/* Members Table Card */}
              <div className="rect-card-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                      {activeNav === 'Leads'
                        ? `${teamName} Leads & Co-Leads`
                        : activeNav === 'Coordinators'
                        ? `${teamName} Coordinators`
                        : activeNav === 'Core'
                        ? `${teamName} Core Members`
                        : `${teamName} Roster`} ({sortedMembers.length})
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {activeNav === 'Leads'
                        ? 'Leadership directory for meeting coordination & directives'
                        : activeNav === 'Coordinators'
                        ? 'Assisting coordinators for day-to-day session tracking'
                        : activeNav === 'Core'
                        ? 'Active team contributors and operations members'
                        : 'Showing registered members in your team'}
                    </p>
                  </div>
                  {['Leads', 'Coordinators', 'Core'].includes(activeNav) && (
                    <button
                      onClick={() => navigateTo('Overview')}
                      className="btn-rect-secondary px-3 py-1.5 text-xs font-mono text-sky-400 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>← Back to Overview</span>
                    </button>
                  )}
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="py-16 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-slate-600 stroke-1" />
                    <p className="text-sm font-mono text-slate-400">
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
                        className="mt-3 text-xs font-mono text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#050B14]/90 border-b border-white/10 text-slate-400 uppercase tracking-wider font-mono">
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
                                  className="px-6 py-3.5 group hover:bg-white/[0.03] transition-colors"
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
                                      className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                      title={`Hide ${header}`}
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </th>
                              );
                            })}
                          <th className="px-4 sm:px-6 py-3.5 text-right w-24 sticky right-0 bg-[#050B14]/90">
                            {hiddenColumns.length > 0 ? (
                              <div className="relative group inline-block text-left">
                                <button className="p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-all cursor-pointer" title="Restore columns">
                                  <Plus className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 rect-card-elevated p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5 font-mono">Restore</div>
                                  {hiddenColumns.map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setHiddenColumns(prev => prev.filter(c => c !== col))}
                                      className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-sky-950/40 hover:text-sky-300 rounded flex items-center justify-between group/btn transition-colors cursor-pointer"
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
                      <tbody className="divide-y divide-white/5">
                        {sortedMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-sky-950/20 transition-colors">
                            {!hiddenColumns.includes('Member') && (
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-semibold shrink-0"
                                    style={{ background: avatarColor(m.name) }}
                                  >
                                    {m.name[0].toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-white">{m.name}</span>
                                </div>
                              </td>
                            )}
                            {!hiddenColumns.includes('Role') && (
                              <td className="px-6 py-3.5">
                                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-wider ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-[#1E1E2E] text-slate-300 border border-white/10'}`}>
                                  {m.role}
                                </span>
                              </td>
                            )}
                            {!hiddenColumns.includes('Roll Number') && (
                              <td className="px-6 py-3.5 font-mono text-slate-300">
                                {m.rollNo || <span className="text-slate-600">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Department') && (
                              <td className="px-6 py-3.5 text-slate-300">
                                {m.department || <span className="text-slate-600">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Year') && (
                              <td className="px-6 py-3.5 text-slate-300 font-mono">
                                {m.year || <span className="text-slate-600">—</span>}
                              </td>
                            )}
                            {!hiddenColumns.includes('Phone') && (
                              <td className="px-6 py-3.5 font-mono text-slate-300">
                                {m.phone || <span className="text-slate-600">—</span>}
                              </td>
                            )}

                            <td className="px-3 sm:px-6 py-3.5 text-right sticky right-0 bg-[#050B14]/90 backdrop-blur-md">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenHistory(m)}
                                  title="View Attendance History (Read-Only)"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(m)}
                                  title="Edit Member Details (Read + Write)"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
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
            <div className="flex flex-col gap-4 pb-6 animate-in fade-in duration-500">
              {!activeSession ? (
                <>
                  {/* ── Last 3 Sessions Absentees Section ── */}
                  <div className="rect-card-elevated p-5 mb-2">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                          <UserX className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white uppercase tracking-wide">Last 3 Sessions Absentees</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-sky-950/60 text-sky-300 border border-sky-500/30 font-mono font-bold uppercase">
                              {teamName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            Your vertical's last 3 meetings (admin- and team-created) and who missed all three
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* One card per vertical (with members): its own last 3 meetings, admin- or team-created */}
                    {repeatAbsenteeCards(sessions as any, members as any, [teamName]).length === 0 ? (
                      <div className="py-8 text-center bg-white/[0.02] rounded-md border border-dashed border-white/10">
                        <UserX className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
                        <p className="text-sm font-semibold text-slate-300">No members or meetings yet.</p>
                        <p className="text-xs text-slate-500 mt-0.5">Each vertical's last 3 meetings will show here once meetings are recorded.</p>
                      </div>
                    ) : (
                      <RepeatAbsentees sessions={sessions as any} members={members as any} teams={[teamName]} showTitle={false} />
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <h2 className="text-base font-bold text-white uppercase tracking-wide">Recent Sessions</h2>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search sessions..."
                          value={searchMeetingQuery}
                          onChange={(e) => setSearchMeetingQuery(e.target.value)}
                          className="rect-input w-full sm:w-64 pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500"
                        />
                        {searchMeetingQuery && (
                          <button onClick={() => setSearchMeetingQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={openCreateMeeting}
                        className="btn-sky-glow shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Session</span>
                      </button>
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="rect-card-elevated p-8 text-center flex-1 flex flex-col items-center justify-center">
                      <div className="w-14 h-14 bg-sky-950/60 text-sky-400 border border-sky-500/30 rounded-md flex items-center justify-center mb-4 mx-auto">
                        <Calendar className="w-7 h-7" />
                      </div>
                      <h3 className="text-base font-bold text-white mb-2 uppercase tracking-wide">No Sessions Yet</h3>
                      <p className="text-slate-400 max-w-sm mx-auto mb-6 text-xs font-mono">
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
                        const sessionTeams = session.team.split(',').map(t => t.trim().toUpperCase());
                        const targetMembers = sessionTeams.includes('ALL') ? members : members.filter(m => sessionTeams.includes(m.team));
                        const targetCount = targetMembers.length;
                        const markedCount = targetMembers.filter(m => session.records?.[m.id]).length;
                        const progress = targetCount === 0 ? 0 : Math.round((markedCount / targetCount) * 100);

                        return (
                          <div
                            key={session.id}
                            onClick={() => openSession(session.id, 'view')}
                            className="rect-card p-5 hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)] transition-all cursor-pointer group"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-0.5 bg-[#0C1E38] text-sky-300 border border-sky-500/30 rounded-sm text-[9px] font-bold font-mono uppercase">
                                    {session.team.split(',').join(', ')}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase ${
                                    session.sessionSlot === 'FN' ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' :
                                    session.sessionSlot === 'AN' ? 'bg-orange-950/60 text-orange-300 border border-orange-500/30' :
                                    'bg-indigo-950/60 text-indigo-300 border border-indigo-500/30'
                                  }`}>
                                    {session.sessionSlot || 'FN'}
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                                  {session.title}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => openSession(session.id, 'view')}
                                  title="View Attendance (Read-Only)"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                                {canMark(session) && (
                                  <button
                                    onClick={() => openSession(session.id, 'edit')}
                                    title="Edit Attendance (Read + Write)"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                )}
                                {canManage(session) && (
                                  <button
                                    onClick={() => setDeletingMeeting(session)}
                                    title="Delete session"
                                    aria-label={`Delete ${session.title}`}
                                    className="p-1.5 rounded-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer ml-0.5"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-6 text-xs text-slate-400 font-mono mb-4">
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
                              <p className="text-xs text-slate-300 mb-5 line-clamp-2 bg-[#050B14] p-2.5 rounded-sm border border-white/5 font-mono">
                                {session.notes}
                              </p>
                            )}

                            {isUpcoming(session) ? (
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">Upcoming</span>
                                <span className="text-slate-400">{opensLabel(session)}</span>
                              </div>
                            ) : (
                            <div>
                              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                                <span className="text-slate-400">Attendance Progress</span>
                                <span className="text-sky-300 font-bold">{markedCount} / {targetCount} Marked</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-900 rounded-none overflow-hidden border border-white/5">
                                <div
                                  className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-sky-500 to-cyan-400'}`}
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
                </>
              ) : (
                <>
                  {/* Detailed Session View Header */}
                  <div className="rect-card-elevated p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setSelectedSessionId('')}
                          className="btn-rect-secondary p-2 cursor-pointer"
                        >
                          <ChevronLeft className="w-5 h-5 text-sky-300" />
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-1">
                            <span className="px-2 py-0.5 bg-[#0C1E38] text-sky-300 border border-sky-500/30 rounded-sm text-[9px] font-bold font-mono uppercase">
                              {activeSession.team.split(',').join(', ')}
                            </span>
                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-sky-400" />
                              {activeSession.date}
                            </span>
                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-sky-400" />
                              {activeSession.startTime} {activeSession.endTime ? `- ${activeSession.endTime}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-white uppercase tracking-wide">{activeSession.title}</h2>
                            {canManage(activeSession) && sessionPermissionMode === 'edit' && (
                              <button
                                onClick={() => setDeletingMeeting(activeSession)}
                                title="Delete session"
                                className="p-1.5 rounded-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mode indicator & Permission Switcher */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">Current Access:</span>
                          {sessionPermissionMode === 'view' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 font-bold font-mono text-xs">
                              <Eye className="w-3.5 h-3.5" /> View Mode (Read-Only)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold font-mono text-xs">
                              <Edit3 className="w-3.5 h-3.5" /> Edit Mode (Read + Write)
                            </span>
                          )}
                        </div>
                        {canMark(activeSession) && (
                          <button
                            onClick={() => setSessionPermissionMode(m => m === 'view' ? 'edit' : 'view')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold cursor-pointer transition-colors"
                          >
                            {sessionPermissionMode === 'view' ? (
                              <>
                                <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Switch to Edit
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-sky-400" /> Switch to View
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Remarks section */}
                    <div className="pt-3">
                      {sessionPermissionMode === 'edit' && canManage(activeSession) ? (
                        <div className="w-full">
                          <textarea
                            placeholder="Add session remarks here... (e.g. Special instructions, delays)"
                            defaultValue={activeSession.notes}
                            onBlur={(e) => handleUpdateSessionRemarks(e.target.value)}
                            className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500 resize-none h-[44px] focus:h-20"
                          />
                        </div>
                      ) : (
                        activeSession.notes && (
                          <div className="w-full text-xs text-slate-300 bg-[#050B14] px-3 py-2 rounded-sm border border-white/5 font-mono leading-relaxed whitespace-pre-wrap">
                            <span className="font-bold text-sky-300 mr-2 uppercase">Remarks:</span>
                            {activeSession.notes}
                          </div>
                        )
                      )}
                    </div>

                    {/* Selected Session Stats Banner (click a card to filter the table) */}
                    {activeSession && (
                      <>
                        <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(
                            [
                              { key: 'ALL', label: 'Total Members', value: sessionMembersList.length, box: 'bg-white/[0.03] border-white/10', labelCls: 'text-slate-400', valCls: 'text-white', ring: 'ring-slate-400' },
                              { key: 'PRESENT', label: 'Present', value: activeSessionStats.present, box: 'bg-emerald-950/40 border-emerald-500/30', labelCls: 'text-emerald-400', valCls: 'text-emerald-300', ring: 'ring-emerald-400' },
                              { key: 'INFORMED', label: 'Informed', value: activeSessionStats.informed, box: 'bg-amber-950/40 border-amber-500/30', labelCls: 'text-amber-400', valCls: 'text-amber-300', ring: 'ring-amber-400' },
                              { key: 'ABSENT', label: 'Absent', value: activeSessionStats.absent, box: 'bg-rose-950/40 border-rose-500/30', labelCls: 'text-rose-400', valCls: 'text-rose-300', ring: 'ring-rose-400' },
                            ] as const
                          ).map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setStatusFilter(statusFilter === c.key ? 'ALL' : c.key)}
                              title={c.key === 'ALL' ? 'Show everyone' : `Show ${c.label.toLowerCase()} members`}
                              className={`p-3 rounded-md border text-left cursor-pointer transition-all hover:brightness-125 ${c.box} ${
                                statusFilter === c.key && c.key !== 'ALL' ? `ring-2 ${c.ring}` : ''
                              }`}
                            >
                              <span className={`text-[10px] font-mono font-bold uppercase tracking-wide ${c.labelCls}`}>
                                {c.label}
                              </span>
                              <div className={`text-xl font-black font-mono ${c.valCls}`}>
                                {c.key !== 'ALL' && isUpcoming(activeSession) ? '—' : c.value}
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Who informed */}
                        {!isUpcoming(activeSession) && informedMembers.length > 0 && (
                          <div className="mt-3 p-3 rounded-md bg-amber-950/30 border border-amber-500/20">
                            <p className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wide mb-2">
                              Informed ({informedMembers.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {informedMembers.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-1 rounded-sm text-[11px] font-mono text-amber-200 bg-amber-500/10 border border-amber-500/30"
                                >
                                  {m.name}
                                  {m.rollNo ? <span className="text-amber-400/70"> · {m.rollNo}</span> : null}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {isUpcoming(activeSession) && (
                    <div className="mt-2 px-4 py-3 rounded-md border border-indigo-500/40 bg-indigo-950/40 text-xs text-indigo-200 flex items-center gap-2 font-mono">
                      <Clock className="w-4 h-4 text-indigo-300 shrink-0" />
                      <span>
                        <span className="font-bold uppercase tracking-wider mr-1.5">Upcoming</span>
                        Attendance can be marked once the meeting starts ({opensLabel(activeSession)}). It isn't counted in any stats until then.
                      </span>
                    </div>
                  )}

                  {/* Bulk marking / actions */}
                  <div className="rect-card px-4 py-3 mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    <p className="text-xs text-slate-300 mr-auto">
                      <span className="font-bold text-white uppercase tracking-wider">{teamName}</span>
                      <span className="text-slate-500 font-mono ml-2">
                        {sessionMembersList.filter(m => m.status === 'PRESENT').length} / {sessionMembersList.length} present
                      </span>
                    </p>

                    {sessionPermissionMode === 'edit' && canMark(activeSession) ? (
                      <>
                        <button
                          onClick={() => handleBulkMark('PRESENT')}
                          disabled={!!bulkBusy || sessionMembersList.length === 0 || isUpcoming(activeSession)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {bulkBusy === 'PRESENT' ? 'Saving…' : <>All Present<span className="hidden sm:inline">&nbsp;({sessionMembersList.length})</span></>}
                        </button>
                        <button
                          onClick={() => handleBulkMark('ABSENT')}
                          disabled={!!bulkBusy || sessionMembersList.length === 0 || isUpcoming(activeSession)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {bulkBusy === 'ABSENT' ? 'Saving…' : <>All Absent<span className="hidden sm:inline">&nbsp;({sessionMembersList.length})</span></>}
                        </button>
                        <button
                          onClick={() => handleBulkMark('INFORMED')}
                          disabled={!!bulkBusy || sessionMembersList.length === 0 || isUpcoming(activeSession)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {bulkBusy === 'INFORMED' ? 'Saving…' : <>All Informed<span className="hidden sm:inline">&nbsp;({sessionMembersList.length})</span></>}
                        </button>
                        <button
                          onClick={() => handleBulkMark('CLEAR')}
                          disabled={!!bulkBusy || sessionMembersList.length === 0 || isUpcoming(activeSession)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          {bulkBusy === 'CLEAR' ? 'Saving…' : <>Reset to Unmarked<span className="hidden sm:inline">&nbsp;({sessionMembersList.length})</span></>}
                        </button>
                        <button
                          onClick={() => handleBulkMark('UNMARKED_TO_ABSENT')}
                          disabled={!!bulkBusy || sessionMembersList.length === 0 || isUpcoming(activeSession)}
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
                  </div>

                  {/* Session Members Attendance Table */}
                  <div className="rect-card-elevated overflow-hidden flex flex-col mt-2">
                    <div className="overflow-auto max-h-[calc(100dvh-120px)] min-h-[320px] p-0 custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#050B14]/90 sticky top-0 z-10 border-b border-white/10 font-mono">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-slate-400 uppercase tracking-wider">Member</th>
                            <th className="hidden sm:table-cell px-6 py-3 text-slate-400 uppercase tracking-wider">Role</th>
                            <th className="px-3 sm:px-6 py-3 text-right text-slate-400 uppercase tracking-wider">
                              {sessionPermissionMode === 'edit' && canMark(activeSession) ? 'Attendance Action' : 'Attendance Status'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredSessionMembers.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-10 text-center text-xs font-mono text-slate-500">
                                No {statusFilter.toLowerCase()} members in this session.
                                <button onClick={() => setStatusFilter('ALL')} className="ml-2 text-sky-400 underline cursor-pointer">
                                  Show all
                                </button>
                              </td>
                            </tr>
                          )}
                          {filteredSessionMembers.map(m => {
                            const status = m.status;
                            const upcoming = isUpcoming(activeSession);
                            const canEditRow = sessionPermissionMode === 'edit' && canMark(activeSession);
                            return (
                              <tr key={m.id} className="hover:bg-sky-950/20 transition-colors">
                                <td className="px-3 sm:px-6 py-3 sm:whitespace-nowrap">
                                  <p className="font-semibold text-white">{m.name}</p>
                                  <p className="text-xs text-slate-400 font-mono">{m.rollNo || 'No Roll No'}<span className="sm:hidden"> · {m.role}</span></p>
                                </td>
                                <td className="hidden sm:table-cell px-6 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-wider ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-[#1E1E2E] text-slate-300 border border-white/10'}`}>
                                    {m.role}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-right">
                                  <div className="inline-flex items-center justify-end gap-2">
                                    {/* Status badge: view mode, upcoming, or no permission to mark */}
                                    {(upcoming || !canEditRow) && (
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
                                        {upcoming ? 'Upcoming' : status === 'UNMARKED' ? 'Unmarked' : STATUS_STYLE[status].label}
                                      </span>
                                    )}

                                    {/* Pre / Abs / Inf buttons: edit mode only. Clicking the active one clears it. */}
                                    {canEditRow && !upcoming && (
                                      <div className="flex bg-[#0A1628] rounded border border-white/10 overflow-hidden">
                                        <button
                                          onClick={() => markMember(activeSession, m.id, status === 'PRESENT' ? null : 'PRESENT')}
                                          disabled={markingIds.has(m.id)}
                                          title="Mark Present"
                                          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer disabled:opacity-40 ${
                                            status === 'PRESENT'
                                              ? 'bg-emerald-500 text-white'
                                              : 'text-slate-400 hover:bg-white/5 hover:text-emerald-400'
                                          }`}
                                        >
                                          Pre
                                        </button>
                                        <button
                                          onClick={() => markMember(activeSession, m.id, status === 'ABSENT' ? null : 'ABSENT')}
                                          disabled={markingIds.has(m.id)}
                                          title="Mark Absent"
                                          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer border-l border-white/10 disabled:opacity-40 ${
                                            status === 'ABSENT'
                                              ? 'bg-rose-500 text-white'
                                              : 'text-slate-400 hover:bg-white/5 hover:text-rose-400'
                                          }`}
                                        >
                                          Abs
                                        </button>
                                        <button
                                          onClick={() => markMember(activeSession, m.id, status === 'INFORMED' ? null : 'INFORMED')}
                                          disabled={markingIds.has(m.id)}
                                          title="Mark Informed"
                                          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer border-l border-white/10 disabled:opacity-40 ${
                                            status === 'INFORMED'
                                              ? 'bg-amber-500 text-white'
                                              : 'text-slate-400 hover:bg-white/5 hover:text-amber-400'
                                          }`}
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">Attendance History</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-mono font-bold">
                    <Eye className="w-3 h-3" /> View Mode (Read-Only)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Detailed session attendance record for member
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-2 shadow-[0_0_12px_rgba(14,165,233,0.4)]" />
                  <p className="text-xs font-mono text-sky-300">Loading attendance details...</p>
                </div>
              ) : selectedMemberHistory ? (
                <div className="space-y-4">
                  {/* Member Profile Card */}
                  <div className="flex items-center gap-3 p-4 rounded-md rect-card bg-[#0B172B]/70">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: avatarColor(selectedMemberHistory.member.name) }}
                    >
                      {selectedMemberHistory.member.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {selectedMemberHistory.member.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider ${ROLE_STYLE[selectedMemberHistory.member.role] || ''}`}>
                          {selectedMemberHistory.member.role}
                        </span>
                        {selectedMemberHistory.member.rollNo && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {selectedMemberHistory.member.rollNo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono text-sky-400">
                        {selectedMemberHistory.stats.presentPct}%
                      </span>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Overall Rate</p>
                    </div>
                  </div>

                  {/* Detailed Member Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-md rect-card bg-[#050B14]">
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Department</p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5">{selectedMemberHistory.member.department || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Year</p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">{selectedMemberHistory.member.year || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Phone</p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">{selectedMemberHistory.member.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Team</p>
                      <p className="text-xs font-semibold text-sky-300 mt-0.5 font-mono">{selectedMemberHistory.member.team || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Joined</p>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">
                        {selectedMemberHistory.member.createdAt
                          ? new Date(selectedMemberHistory.member.createdAt).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-2.5 rounded-sm rect-card bg-white/[0.02]">
                      <div className="text-xs font-bold text-slate-200">
                        {selectedMemberHistory.stats.total}
                      </div>
                      <span className="text-[9px] text-slate-500 uppercase">Total</span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                      <div className="text-xs font-bold">
                        {selectedMemberHistory.stats.present}
                      </div>
                      <span className="text-[9px] uppercase">Present</span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-rose-950/40 border border-rose-500/30 text-rose-400">
                      <div className="text-xs font-bold">
                        {selectedMemberHistory.stats.absent}
                      </div>
                      <span className="text-[9px] uppercase">Absent</span>
                    </div>
                  </div>

                  {/* History Timeline List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                      Meeting Logs
                    </h4>
                    {selectedMemberHistory.history.length === 0 ? (
                      <p className="text-xs text-slate-500 font-mono py-6 text-center">
                        No meeting attendance recorded for this member yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedMemberHistory.history.map((h, i) => {
                          const statusStyle = STATUS_STYLE[h.status] || STATUS_STYLE.UNMARKED;
                          return (
                            <div
                              key={i}
                              className="p-3 rounded-md rect-card hover:border-sky-500/30 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-white">{h.title}</p>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  {h.date} • Slot: {h.sessionSlot || 'FN'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase ${statusStyle.badge}`}>
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
                <p className="text-xs text-slate-500 font-mono text-center py-6">
                  Unable to load attendance details for this member.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] text-right">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="btn-rect-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          EDIT MEMBER DETAILS MODAL
         ══════════════════════════════════════════════ */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-md w-full max-h-[90dvh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    {editingMember ? 'Edit Member Details' : 'Add New Member'}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
                    <Edit3 className="w-3 h-3" /> Edit Mode (Read + Write)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {editingMember ? `Update contact or academic info for ${editingMember.name}` : `Add a new member to ${teamName} team`}
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMemberEdit} className="p-6 space-y-4">
              {/* Member & Locked Team Info */}
              {editingMember ? (
                <div className="p-3 bg-[#050B14] rounded-md border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{editingMember.name}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase ${ROLE_STYLE[editingMember.role] || ''}`}>
                      {editingMember.role}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-sky-950/60 text-sky-300 border border-sky-500/30 uppercase">
                    Team: {teamName}
                  </span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Role
                      </label>
                      <select
                        value={editForm.role || ''}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500 bg-[#0C1A30]"
                        required
                      >
                        <option value="">Select Role</option>
                        <option value="CORE">CORE</option>
                        <option value="COORDINATOR">COORDINATOR</option>
                        <option value="CO-LEAD">CO-LEAD</option>
                        <option value="LEAD">LEAD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Team
                      </label>
                      <div className="rect-input w-full px-3 py-2 text-xs text-sky-300 bg-sky-950/30 border-sky-900/50 flex items-center gap-2 select-none cursor-not-allowed">
                        <Lock className="w-3.5 h-3.5 text-sky-500/50" />
                        {teamName}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Status / Notice Messages */}
              {editError && (
                <div className="p-3 bg-amber-950/70 border border-amber-500/40 rounded-md text-xs text-amber-300 font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-md text-xs text-emerald-300 font-mono">
                  {editSuccess}
                </div>
              )}

              {/* Roll Number */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={editForm.rollNo || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, rollNo: e.target.value }))}
                  placeholder="e.g. 21B001"
                  className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Department
                </label>
                <select
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500 bg-[#0C1A30]"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Year of Study
                </label>
                <select
                  value={editForm.year || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                  className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500 bg-[#0C1A30]"
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="5th Year">5th Year</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-rect-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn-sky-glow px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          CREATE / EDIT MEETING MODAL
         ══════════════════════════════════════════════ */}
      {meetingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-md w-full max-h-[90dvh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  {editingMeeting ? 'Edit Meeting' : 'New Meeting'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">For the {teamName} team</p>
              </div>
              <button
                onClick={() => setMeetingModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMeeting} className="p-6 space-y-4">
              {meetingError && (
                <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-md text-xs text-rose-300 font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{meetingError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={`e.g. ${teamName} weekly meeting`}
                  className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, date: e.target.value }))}
                    className="rect-input w-full px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
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
                    className="rect-input w-full px-3 py-2 text-xs text-slate-200 bg-[#050B14] cursor-pointer"
                  >
                    <option value="FN" className="bg-[#0B172B] text-slate-200">FN (Morning)</option>
                    <option value="AN" className="bg-[#0B172B] text-slate-200">AN (Afternoon)</option>
                    <option value="EV" className="bg-[#0B172B] text-slate-200">EV (Evening)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={meetingForm.startTime}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="rect-input w-full px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                    End Time <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="time"
                    value={meetingForm.endTime}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="rect-input w-full px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {editingMeeting && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Notes <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={meetingForm.notes}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Venue, agenda..."
                    className="rect-input w-full px-3 py-2 text-xs text-white placeholder-slate-500 resize-none"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMeetingModalOpen(false)}
                  className="btn-rect-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={meetingSaving}
                  className="btn-sky-glow px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {meetingSaving ? 'Saving...' : editingMeeting ? 'Save Changes' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DELETE MEETING CONFIRMATION
         ══════════════════════════════════════════════ */}
      {deletingMeeting && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated border border-rose-500/30 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-md bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Delete this meeting?</h3>
            <p className="text-xs text-slate-400 font-mono mt-1.5 leading-relaxed">
              <span className="font-semibold text-rose-300">{deletingMeeting.title}</span> on {deletingMeeting.date}
              {Object.keys(deletingMeeting.records || {}).length > 0 &&
                ` and its ${Object.keys(deletingMeeting.records || {}).length} attendance mark(s)`}{' '}
              will be permanently removed.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingMeeting(null)}
                disabled={deleteBusy}
                className="btn-rect-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMeeting}
                disabled={deleteBusy}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-mono font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.4)] disabled:opacity-50 cursor-pointer"
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════
          BULK IMPORT MODAL
         ══════════════════════════════════════════════ */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#050B14]/80 backdrop-blur-sm"
            onClick={() => !importSaving && setImportModalOpen(false)}
          />
          <div className="rect-card bg-[#0B172B] w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wide">Bulk Import Members</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Paste CSV data (Name, Role, Roll No, Department, Year, Phone)
                </p>
              </div>
              <button
                onClick={() => !importSaving && setImportModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!importCsvText.trim()) return;
                setImportSaving(true);
                setImportError(null);
                setImportSuccess(null);
                try {
                  const lines = importCsvText.split('\n').filter(l => l.trim() !== '');
                  if (lines.length > 0) {
                    const header = lines[0].toLowerCase();
                    if (!header.includes('team')) {
                      lines[0] = lines[0].trim() + ',"Team"';
                      for (let i = 1; i < lines.length; i++) {
                        lines[i] = lines[i].trim() + `,"${teamName}"`;
                      }
                    }
                  }
                  const finalCsvText = lines.join('\n');

                  const res = await apiFetch('/api/members/import', {
                    method: 'POST',
                    headers: { ...getAuthHeaders(), 'Content-Type': 'text/csv' },
                    body: finalCsvText,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Import failed');
                  if (data.invalid > 0) {
                    setImportError(`Imported ${data.valid}, but failed ${data.invalid}. Check your data.`);
                  } else {
                    setImportSuccess(`Successfully imported ${data.valid} members! Reloading...`);
                    setTimeout(() => window.location.reload(), 1500);
                  }
                } catch (err: any) {
                  setImportError(err.message || 'Error importing members');
                } finally {
                  setImportSaving(false);
                }
              }}
              className="p-6 flex flex-col gap-4 flex-1 min-h-0"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <label className="btn-rect-secondary flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-dashed border-sky-500/30 hover:border-sky-400">
                  <Upload className="w-3.5 h-3.5" /> Select CSV File
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) setImportCsvText(ev.target.result as string);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const content = `"Name","Role","Roll No","Department","Year","Phone"\n`;
                    const blob = new Blob([content], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'erm_team_template.csv';
                    a.click();
                  }}
                  className="btn-rect-secondary flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>
              <div className="flex-1 bg-[#0C1A30] border border-white/10 p-4 font-mono text-xs text-slate-300 flex flex-col justify-center items-center rounded-md min-h-[150px]">
                {importCsvText ? (
                  <div className="flex flex-col items-center gap-2 text-sky-400">
                    <FileText className="w-8 h-8" />
                    <span>File loaded. {importCsvText.split('\n').length} rows detected.</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <span>No file selected</span>
                    <span className="text-[10px] uppercase tracking-wide mt-2">Required Headers:</span>
                    <span className="text-[10px] uppercase tracking-wide text-sky-500/70">"Name", "Role", "Roll No", "Department", "Year", "Phone"</span>
                  </div>
                )}
              </div>

              {importError && (
                <div className="p-3 bg-rose-950/70 border border-rose-500/40 rounded-md text-xs text-rose-300 font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
              {importSuccess && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-md text-xs text-emerald-300 font-mono flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  disabled={importSaving}
                  className="px-4 py-2 text-xs font-bold font-mono text-slate-300 hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importSaving || !importCsvText.trim()}
                  className="btn-sky-glow px-6 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {importSaving ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}