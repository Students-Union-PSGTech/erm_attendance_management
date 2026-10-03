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
  Download,
  X,
  UserCheck,
  UserX,
  Clock,
  Menu,
  ChevronRight,
  AlertCircle,
  Eye,
  Edit3,
  Award,
  Filter,
} from 'lucide-react';

interface TeamDashboardProps {
  user: User;
  onLogout: () => void;
}

type NavKey = 'Overview' | 'Members' | 'Meetings' | 'Attendance' | 'Reports';

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
  { icon: Calendar, label: 'Meetings' },
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

export default function TeamDashboard({ user, onLogout }: TeamDashboardProps) {
  const teamName = user.team || 'TECH';
  const [activeNav, setActiveNav] = useState<NavKey>('Overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core data states
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [statsSummary, setStatsSummary] = useState<StatsSummary | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<MemberAttendanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Members View Filters & Search
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  // Meetings View Filters
  const [searchMeetingQuery, setSearchMeetingQuery] = useState('');
  const [filterMeetingSlot, setFilterMeetingSlot] = useState('ALL');

  // Attendance View Selected Session & Filter
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('ALL');

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

  // CSV Export loading
  const [exportingCsv, setExportingCsv] = useState(false);

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
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [membersRes, sessionsRes, summaryRes, statsRes] = await Promise.all([
        fetch('/api/members', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/stats/summary', { headers }),
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
        setSessions(teamSessions);
        if (teamSessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(teamSessions[0].id);
        }
      }

      // Parse summary
      if (summaryRes.ok) {
        const text = await summaryRes.text();
        const data = text ? JSON.parse(text) : {};
        setStatsSummary(data);
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

  // Filtered meetings for Meetings tab
  const filteredMeetings = useMemo(() => {
    return sessions.filter((s) => {
      if (filterMeetingSlot !== 'ALL' && s.sessionSlot !== filterMeetingSlot) return false;
      if (searchMeetingQuery) {
        const q = searchMeetingQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.date.includes(q);
      }
      return true;
    });
  }, [sessions, filterMeetingSlot, searchMeetingQuery]);

  // Selected session for Attendance tab
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  // Attendance breakdown for active session
  const activeSessionStats = useMemo(() => {
    if (!activeSession || !activeSession.records) {
      return { present: 0, absent: 0, informed: 0, unmarked: members.length, total: members.length };
    }
    const memberIds = new Set(members.map((m) => m.id));
    let present = 0;
    let absent = 0;
    let informed = 0;
    let marked = 0;

    Object.entries(activeSession.records).forEach(([id, rec]) => {
      if (memberIds.has(id)) {
        marked++;
        if (rec.status === 'PRESENT') present++;
        else if (rec.status === 'ABSENT') absent++;
        else if (rec.status === 'INFORMED') informed++;
      }
    });

    const unmarked = Math.max(0, members.length - marked);
    return { present, absent, informed, unmarked, total: members.length };
  }, [activeSession, members]);

  // Members list with status for active session
  const sessionMembersList = useMemo(() => {
    if (!activeSession) return [];
    const records = activeSession.records || {};

    const list = members.map((m) => {
      const rec = records[m.id];
      const status: 'PRESENT' | 'ABSENT' | 'INFORMED' | 'UNMARKED' = rec ? rec.status : 'UNMARKED';
      return {
        ...m,
        status,
        markedAt: rec?.markedAt,
        notes: rec?.notes,
      };
    });

    if (attendanceStatusFilter === 'ALL') return list;
    return list.filter((m) => m.status === attendanceStatusFilter);
  }, [activeSession, members, attendanceStatusFilter]);

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
      } catch {}

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

  // CSV Export Handler
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/members/export.csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `erm-${teamName.toLowerCase()}-members-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingCsv(false);
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
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden text-slate-900">
      {/* ── Mobile Sidebar Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-60 flex flex-col bg-white border-r border-slate-100 py-6 px-3 shrink-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <img
            src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
            alt="Logo"
            className="w-9 h-9 rounded-xl object-cover shadow-xs"
          />
          <div className="min-w-0">
            <p className="text-slate-900 font-semibold text-sm leading-tight truncate">Students Union</p>
            <p className="text-indigo-600 font-medium text-[10px] tracking-wide uppercase">
              {teamName} Team Portal
            </p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden ml-auto p-1 text-slate-400 hover:text-slate-600 rounded-lg"
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
                  setMobileMenuOpen(false);
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
              style={{ background: avatarColor(user.username) }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user.username}</p>
              <p className="text-[10px] text-slate-400 truncate">{teamName} Team</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchData}
                disabled={loading}
                title="Refresh Data"
                className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ${
                  loading ? 'animate-spin opacity-50 cursor-not-allowed' : ''
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
        {/* Top Mobile Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Students Union</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {teamName}
            </span>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-7">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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

            {/* Quick Export on Members or Reports */}
            {(activeNav === 'Members' || activeNav === 'Reports') && (
              <button
                onClick={handleExportCsv}
                disabled={exportingCsv || members.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                {exportingCsv ? 'Exporting...' : 'Export Team CSV'}
              </button>
            )}
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

              {/* Two Column Layout: Recent Meetings & Role Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Meetings Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Recent Meetings</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Meetings and attendance sessions scheduled for {teamName}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav('Meetings')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      View All <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <Calendar className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No meetings scheduled for your team yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Upcoming meetings created by administrators will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sessions.slice(0, 5).map((s) => {
                        const recordsCount = Object.keys(s.records || {}).length;
                        return (
                          <div
                            key={s.id}
                            className="py-3.5 flex items-center justify-between hover:bg-slate-50/70 rounded-xl px-3 transition-colors"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center shrink-0 border border-indigo-100">
                                <span className="text-[10px] font-bold uppercase leading-none">
                                  {new Date(s.date).toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                                <span className="text-sm font-bold leading-tight">
                                  {new Date(s.date).getDate()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {s.startTime || '09:00'}
                                    {s.endTime ? ` - ${s.endTime}` : ''}
                                  </span>
                                  <span>•</span>
                                  <span className="font-medium text-slate-600">{s.sessionSlot || 'FN'}</span>
                                  <span>•</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                    {s.team === 'ALL' ? 'Organization (ALL)' : s.team}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                {recordsCount} marked
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedSessionId(s.id);
                                  setActiveNav('Attendance');
                                }}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                Attendance
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Role Breakdown & Team Info */}
                <div className="space-y-6">
                  {/* Role Distribution Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Role Composition</h3>
                    <p className="text-xs text-slate-500 mb-4">{teamName} domain hierarchy</p>

                    {members.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No members in your team yet</p>
                    ) : (
                      <div className="space-y-3">
                        {['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map((role) => {
                          const count = members.filter((m) => m.role.toUpperCase() === role).length;
                          const pct = members.length > 0 ? Math.round((count / members.length) * 100) : 0;
                          return (
                            <div key={role}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={`badge ${ROLE_STYLE[role] || 'bg-slate-100 text-slate-600'}`}>
                                  {role}
                                </span>
                                <span className="font-semibold text-slate-700">
                                  {count} <span className="font-normal text-slate-400">({pct}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Team Leads Roster Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Team Leaders</h3>
                    <p className="text-xs text-slate-500 mb-4">Leads & Coordinators</p>

                    <div className="space-y-3">
                      {members
                        .filter((m) => ['LEAD', 'CO-LEAD', 'COORDINATOR'].includes(m.role.toUpperCase()))
                        .slice(0, 4)
                        .map((m) => (
                          <div key={m.id} className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                              style={{ background: avatarColor(m.name) }}
                            >
                              {m.name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {m.department || 'PSG Tech'} {m.year ? `• Year ${m.year}` : ''}
                              </p>
                            </div>
                            <span className={`badge text-[10px] ${ROLE_STYLE[m.role.toUpperCase()] || ''}`}>
                              {m.role}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
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

                {/* Role Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Role:
                  </span>
                  {['ALL', 'LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setFilterRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterRole === role
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Members Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {teamName} Roster ({filteredMembers.length})
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
                          <th className="px-6 py-3.5">Member</th>
                          <th className="px-6 py-3.5">Role</th>
                          <th className="px-6 py-3.5">Roll Number</th>
                          <th className="px-6 py-3.5">Department</th>
                          <th className="px-6 py-3.5">Year</th>
                          <th className="px-6 py-3.5">Phone</th>
                          <th className="px-6 py-3.5">Attendance</th>
                          <th className="px-6 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
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
                            <td className="px-6 py-3.5">
                              <span className={`badge ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
                                {m.role}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 font-mono text-slate-600">
                              {m.rollNo || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">
                              {m.department || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">
                              {m.year ? `Year ${m.year}` : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-6 py-3.5 font-mono text-slate-600">
                              {m.phone || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{m.presentPct}%</span>
                                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      m.presentPct >= 75
                                        ? 'bg-emerald-500'
                                        : m.presentPct >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${m.presentPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right">
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
              VIEW 3: MEETINGS
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Meetings' && (
            <div className="space-y-5">
              {/* Meeting Filters Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchMeetingQuery}
                    onChange={(e) => setSearchMeetingQuery(e.target.value)}
                    placeholder="Search meetings by title or date (YYYY-MM-DD)..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                  {searchMeetingQuery && (
                    <button
                      onClick={() => setSearchMeetingQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Slot:
                  </span>
                  {['ALL', 'FN', 'AN'].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setFilterMeetingSlot(slot)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        filterMeetingSlot === slot
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {slot === 'ALL' ? 'All Slots' : slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meetings List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">
                    {teamName} Meetings & Sessions ({filteredMeetings.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing meetings scheduled specifically for {teamName} or organization-wide (ALL)
                  </p>
                </div>

                {filteredMeetings.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-sm font-semibold text-slate-600">No meetings scheduled for your team.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      New sessions created by administrators for {teamName} will be displayed here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredMeetings.map((s) => {
                      const records = s.records || {};
                      let present = 0;
                      let absent = 0;
                      let informed = 0;
                      Object.values(records).forEach((r) => {
                        if (r.status === 'PRESENT') present++;
                        else if (r.status === 'ABSENT') absent++;
                        else if (r.status === 'INFORMED') informed++;
                      });
                      const totalMarked = present + absent + informed;

                      return (
                        <div
                          key={s.id}
                          className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                                {new Date(s.date).toLocaleDateString('en-US', { month: 'short' })}
                              </span>
                              <span className="text-base font-bold leading-tight">
                                {new Date(s.date).getDate()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-bold text-slate-900">{s.title}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    s.team === 'ALL'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}
                                >
                                  {s.team === 'ALL' ? 'Organization (ALL)' : s.team}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                  {s.sessionSlot || 'FN'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {s.startTime || '09:00'}
                                  {s.endTime ? ` - ${s.endTime}` : ''}
                                </span>
                                <span>•</span>
                                <span>Date: {s.date}</span>
                                {s.notes && (
                                  <>
                                    <span>•</span>
                                    <span className="italic text-slate-400 truncate max-w-xs">{s.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-semibold">
                                {present} Present
                              </span>
                              <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs font-semibold">
                                {absent} Absent
                              </span>
                              <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-xs font-semibold">
                                {informed} Informed
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedSessionId(s.id);
                                setActiveNav('Attendance');
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              View Attendance
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 4: ATTENDANCE
             ══════════════════════════════════════════════ */}
          {!loading && activeNav === 'Attendance' && (
            <div className="space-y-5">
              {sessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
                  <p className="text-base font-bold text-slate-700">No attendance records available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    There are no recorded sessions for your team yet. Once a meeting is held and attendance is recorded, you will be able to review attendance details here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Session Selector & Metrics Header Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Select Meeting / Session
                        </label>
                        <select
                          value={activeSession?.id || ''}
                          onChange={(e) => setSelectedSessionId(e.target.value)}
                          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                        >
                          {sessions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.date} — {s.title} ({s.sessionSlot || 'FN'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {activeSession && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-400 mr-1">Status:</span>
                            {['ALL', 'PRESENT', 'ABSENT', 'INFORMED', 'UNMARKED'].map((status) => (
                              <button
                                key={status}
                                onClick={() => setAttendanceStatusFilter(status)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  attendanceStatusFilter === status
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected Session Stats Banner */}
                    {activeSession && (
                      <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Unmarked
                          </span>
                          <div className="text-xl font-bold text-slate-700">
                            {activeSessionStats.unmarked}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Session Members Attendance Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {teamName} Attendance: {activeSession?.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {sessionMembersList.length} of {members.length} members matching filter
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="px-6 py-3.5">Member</th>
                            <th className="px-6 py-3.5">Role</th>
                            <th className="px-6 py-3.5">Roll Number</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5">Marked Time</th>
                            <th className="px-6 py-3.5">Notes</th>
                            <th className="px-6 py-3.5 text-right">History</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sessionMembersList.map((m) => {
                            const statusInfo = STATUS_STYLE[m.status] || STATUS_STYLE.UNMARKED;
                            return (
                              <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
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
                                <td className="px-6 py-3.5">
                                  <span className={`badge ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
                                    {m.role}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 font-mono text-slate-600">
                                  {m.rollNo || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-3.5">
                                  <span className={`badge ${statusInfo.badge}`}>
                                    {statusInfo.label}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 text-slate-500">
                                  {m.markedAt ? (
                                    new Date(m.markedAt).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-slate-500 italic">
                                  {m.notes || <span className="text-slate-300 not-italic">—</span>}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                  <button
                                    onClick={() => handleOpenHistory(m)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                    title="View full history"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
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
            <div className="space-y-6">
              {/* Reports Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Overall Team Attendance
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{overallTeamAttendancePct}%</div>
                  <p className="text-[11px] text-slate-400 mt-1">Average across all members</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total Tracked Sessions
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{sessions.length}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Completed team meetings</p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Active Members
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{members.length}</div>
                  <p className="text-[11px] text-slate-400 mt-1">On team roster</p>
                </div>
              </div>

              {/* Cumulative Attendance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Member Attendance Summary
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cumulative statistics calculated from all recorded sessions
                    </p>
                  </div>
                </div>

                {membersWithStats.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <BarChart2 className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-sm font-semibold text-slate-600">No attendance data to report</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-6 py-3.5">Member</th>
                          <th className="px-6 py-3.5">Role</th>
                          <th className="px-6 py-3.5 text-center">Total Sessions</th>
                          <th className="px-6 py-3.5 text-center">Present</th>
                          <th className="px-6 py-3.5 text-center">Absent</th>
                          <th className="px-6 py-3.5 text-center">Informed</th>
                          <th className="px-6 py-3.5">Attendance Rate</th>
                          <th className="px-6 py-3.5 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {membersWithStats.map((m) => (
                          <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                                  style={{ background: avatarColor(m.name) }}
                                >
                                  {m.name[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{m.name}</p>
                                  {m.rollNo && (
                                    <p className="text-[10px] text-slate-400 font-mono">{m.rollNo}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={`badge ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
                                {m.role}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-center font-semibold text-slate-700">
                              {m.totalSessions}
                            </td>
                            <td className="px-6 py-3.5 text-center font-semibold text-emerald-600">
                              {m.present}
                            </td>
                            <td className="px-6 py-3.5 text-center font-semibold text-rose-600">
                              {m.absent}
                            </td>
                            <td className="px-6 py-3.5 text-center font-semibold text-amber-600">
                              {m.informed}
                            </td>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 w-10">
                                  {m.presentPct}%
                                </span>
                                <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${
                                      m.presentPct >= 75
                                        ? 'bg-emerald-500'
                                        : m.presentPct >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${m.presentPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <button
                                onClick={() => handleOpenHistory(m)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              >
                                History
                              </button>
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
      )}

      {/* ══════════════════════════════════════════════
          EDIT MEMBER DETAILS MODAL
         ══════════════════════════════════════════════ */}
      {editModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
      )}
    </div>
  );
}
