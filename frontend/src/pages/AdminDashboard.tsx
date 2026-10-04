import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import {
  Users, Calendar, BarChart2,
  LogOut, Grid3X3, ArrowUpDown, ArrowDown, ArrowUp, RefreshCw,
  Search, Filter, X, Minus, Plus, Edit3, Eye, Menu, ShieldCheck,
  Activity, ArrowRight, Sparkles, UserX, ChevronRight, ChevronLeft
} from 'lucide-react';
import AttendanceView from './AttendanceView';
import ReportsView from './ReportsView';
import { isUpcoming } from './sessionTime';
import RepeatAbsentees, { repeatAbsenteeCards } from './RepeatAbsentees';
import type { MemberHistoryDetail } from './TeamDashboard';
import TopographyBackground from '../components/TopographyBackground';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

type NavKey = 'Overview' | 'Members' | 'Attendance' | 'Reports' | 'Leads' | 'Coordinators' | 'Core';

const NAV: { icon: React.ElementType; label: NavKey }[] = [
  { icon: Grid3X3, label: 'Overview' },
  { icon: Users, label: 'Members' },
  { icon: Calendar, label: 'Attendance' },
  { icon: BarChart2, label: 'Reports' },
];

export type Member = {
  id: string;
  name: string;
  team: string;
  role: string;
  rollNo?: string;
  department?: string;
  year?: string;
  phone?: string;
};

const ROLE_STYLE: Record<string, string> = {
  LEAD: 'bg-[#082F49] text-[#7DD3FC] border border-sky-500/40',
  'CO-LEAD': 'bg-[#0C4A6E] text-[#BAE6FD] border border-cyan-500/40',
  COORDINATOR: 'bg-[#064E3B] text-[#6EE7B7] border border-emerald-500/40',
  CORE: 'bg-[#0D1E36] text-[#CBD5E1] border border-white/10',
};

const avatarColor = (name: string) => {
  const colors = ['#0EA5E9', '#0284C7', '#06B6D4', '#059669', '#38BDF8', '#2563EB'];
  return colors[name.charCodeAt(0) % colors.length];
};

// Members are listed LEAD → CO-LEAD → COORDINATOR → CORE, then by name
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
const ROLE_SHORT: Record<string, string> = { 'LEAD': 'L', 'CO-LEAD': 'CL', 'COORDINATOR': 'C', 'CORE': 'Co' };

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
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

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfigs, setSortConfigs] = useState<{ key: keyof Member; direction: 'asc' | 'desc' }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');

  // Track hidden columns
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<Partial<Member>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMemberHistory, setSelectedMemberHistory] = useState<MemberHistoryDetail | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
  };

  const fetchOverviewData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const sessRes = await fetch('/api/sessions', { headers });
      if (sessRes.ok) {
        const sData = await sessRes.json();
        setSessions(sData.sessions || []);
      }
    } catch (e) {
      console.error('Failed to load overview analytics:', e);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    setSortConfigs([]);
    setSearchQuery('');
    setFilterTeam('ALL');
    setFilterRole('ALL');
    try {
      const res = await fetch('/api/members', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
      fetchOverviewData();
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHistory = async (member: Member) => {
    setViewingMember(member);
    setHistoryLoading(true);
    setSelectedMemberHistory(null);
    try {
      const res = await fetch(`/api/members/${member.id}/attendance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        setSelectedMemberHistory(data);
      }
    } catch (err) {
      console.error('Failed to load member history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenEdit = (member: Member) => {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      team: member.team,
      role: member.role,
      rollNo: member.rollNo || '',
      department: member.department || '',
      year: member.year || '',
      phone: member.phone || '',
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const res = await fetch(`/api/members/${editingMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update member');
      }

      setMembers(prev =>
        prev.map(m => (m.id === editingMember.id ? { ...m, ...data.member } : m))
      );
      setEditSuccess('Member details successfully updated!');
      setTimeout(() => {
        setEditModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setEditError(err.message || 'Error updating member');
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const totalMembers = members.length;
  const teamCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.team] = (acc[m.team] || 0) + 1;
    return acc;
  }, {});
  const teams = Object.entries(teamCounts).sort(([a], [b]) => teamRank(a) - teamRank(b) || a.localeCompare(b));

  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});
  const leadsTotal = (roleCounts['LEAD'] || 0) + (roleCounts['CO-LEAD'] || 0);
  const coordTotal = roleCounts['COORDINATOR'] || 0;
  const coreTotal = roleCounts['CORE'] || 0;

  const requestSort = (key: keyof Member) => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(c => c.key === key);
      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        if (existing.direction === 'asc') {
          const next = [...prev];
          next[existingIndex] = { key, direction: 'desc' };
          return next;
        } else {
          return prev.filter(c => c.key !== key);
        }
      } else {
        return [...prev, { key, direction: 'asc' }];
      }
    });
  };

  // Role + search filters (everything except the team), used for the team cards' counts
  const matchesNonTeamFilters = (m: Member) => {
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
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.rollNo && m.rollNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.phone && m.phone.includes(searchQuery));
    return matchesRole && matchesSearch;
  };
  const nonTeamFiltered = members.filter(matchesNonTeamFilters);
  const filteredMembers = nonTeamFiltered.filter(m => filterTeam === 'ALL' || m.team === filterTeam);

  // Team cards: All + each vertical in TEAM_ORDER (plus any unexpected team at the end)
  const teamCards = Array.from(new Set([...TEAM_ORDER, ...members.map(m => m.team)]))
    .filter(t => TEAM_ORDER.includes(t) || members.some(m => m.team === t))
    .sort((a, b) => teamRank(a) - teamRank(b) || a.localeCompare(b))
    .map(team => {
      const list = nonTeamFiltered.filter(m => m.team === team);
      const byRole = ROLE_ORDER.map(r => [r, list.filter(m => m.role === r).length] as const).filter(([, n]) => n > 0);
      return { team, count: list.length, byRole };
    });

  // Members (sidebar) opens on the first vertical so the list stays short;
  // the Leads / Coordinators / Core directories open on all verticals.
  useEffect(() => {
    if (activeNav === 'Members') setFilterTeam(prev => (prev === 'ALL' ? TEAM_ORDER[0] : prev));
    else if (['Leads', 'Coordinators', 'Core'].includes(activeNav)) setFilterTeam('ALL');
  }, [activeNav]);

  // Default order: role (LEAD → CO-LEAD → COORDINATOR → CORE), then name.
  // Column sorts apply first; sorting by Role uses the same role order, not A-Z.
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    for (const config of sortConfigs) {
      const dir = config.direction === 'asc' ? 1 : -1;
      if (config.key === 'role') {
        const diff = roleRank(a.role) - roleRank(b.role);
        if (diff !== 0) return diff * dir;
        continue;
      }
      const aVal = (a[config.key] || '').toString().toLowerCase();
      const bVal = (b[config.key] || '').toString().toLowerCase();
      if (aVal < bVal) return -dir;
      if (aVal > bVal) return dir;
    }
    return byRoleThenName(a, b);
  });

  const SortIcon = ({ columnKey }: { columnKey: keyof Member }) => {
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

  return (
    <div className="relative flex h-dvh bg-[#050B14] overflow-hidden text-white select-none">
      {/* ── React Bits Living Topography Background ── */}
      <TopographyBackground />

      {/* ── Mobile/Overlay Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm transition-opacity"
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
            <p className="text-[#94A3B8] text-[11px] mt-0.5">Admin Central</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors cursor-pointer shrink-0"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5">
          {NAV.map(({ icon: Icon, label }) => {
            const isActive = activeNav === label;
            return (
              <button
                key={label}
                onClick={() => {
                  navigateTo(label);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={`w-full nav-item-rect ${isActive ? 'nav-item-rect-active' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">{label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="border-t border-white/[0.08] pt-4 mt-auto">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-[#0C1A30] border border-white/[0.06]">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
              style={{ background: avatarColor(user.username) }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.username}</p>
              <p className="text-[10px] text-sky-300 font-medium">Administrator</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchMembers}
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

      {/* ── Main Content Area ── */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-5 sm:py-7">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className="btn-rect-secondary p-2.5 flex items-center justify-center shrink-0 cursor-pointer"
                title={sidebarOpen ? 'Close navigation' : 'Open navigation'}
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              {['Leads', 'Coordinators', 'Core'].includes(activeNav) && (
                <button
                  onClick={() => navigateTo('Overview')}
                  className="btn-rect-secondary px-3 py-2 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                  title="Back to Overview"
                >
                  <ChevronLeft className="w-4 h-4 text-sky-400" />
                  <span className="hidden sm:inline">Overview</span>
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  {activeNav === 'Leads' ? 'Domain Leads' : activeNav === 'Coordinators' ? 'Coordinators' : activeNav === 'Core' ? 'Core Members' : activeNav}
                  <span className="badge-reactbits-new hidden sm:inline-block">Live</span>
                </h1>
                <p className="text-xs text-[#9490A6] mt-0.5">
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rect-card text-xs text-[#94A3B8]">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Admin Level</span>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              VIEW 1: OVERVIEW
             ══════════════════════════════════════════════ */}
          {activeNav === 'Overview' && (
            loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-8 pb-12">
                {/* ── Hero Executive Card (Enlarged with Live Indicators & Quick Links) ── */}
                <div className="rect-card rect-card-hover-pop p-6 sm:p-9 border-sky-500/30 bg-gradient-to-r from-[#0C1E38]/95 via-[#102747]/90 to-[#0A172B]/95 shadow-[0_0_40px_rgba(14,165,233,0.25)]">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-3">
                        <span className="badge-reactbits-new flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          Executive Control
                        </span>
                        <span className="text-xs text-sky-300 font-mono flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                          Students Union Central System
                        </span>
                        <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                          • Realtime Synced
                        </span>
                      </div>
                      <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-3.5 font-mono">
                        {totalMembers}
                        <span className="text-base sm:text-xl font-normal text-sky-300">
                          Registered Members
                        </span>
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 font-mono mt-2 max-w-xl">
                        Comprehensive administrative oversight across all 6 technical & creative domains, active meeting attendances, and leadership rosters.
                      </p>
                    </div>

                    {/* Quick Launch Buttons on Hero */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                      <button
                        onClick={() => navigateTo('Attendance')}
                        className="btn-sky-glow px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Launch Attendance</span>
                      </button>
                      <button
                        onClick={() => navigateTo('Reports')}
                        className="btn-rect-secondary px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4 text-sky-300" />
                        <span>View Analytics</span>
                      </button>
                      <button
                        onClick={() => navigateTo('Members')}
                        className="btn-rect-secondary px-4 py-2.5 text-xs font-mono flex items-center gap-2 cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-cyan-300" />
                        <span>All Members</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Ribbon inside Hero */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-white/10">
                    <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-mono text-slate-400">Total Domains</p>
                      <p className="text-lg font-bold text-white font-mono mt-0.5">{teams.length} Teams</p>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-mono text-slate-400">Held Sessions</p>
                      <p className="text-lg font-bold text-sky-300 font-mono mt-0.5">
                        {sessions.filter(s => !isUpcoming(s)).length} Meetings
                        {sessions.some(s => isUpcoming(s)) && (
                          <span className="text-xs text-indigo-300 font-medium ml-1.5">+{sessions.filter(s => isUpcoming(s)).length} upcoming</span>
                        )}
                      </p>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-mono text-slate-400">Leadership Roster</p>
                      <p className="text-lg font-bold text-cyan-300 font-mono mt-0.5">{leadsTotal} Leads / Co-Leads</p>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] uppercase font-mono text-slate-400">Core & Coords</p>
                      <p className="text-lg font-bold text-blue-300 font-mono mt-0.5">{coreTotal + coordTotal} Members</p>
                    </div>
                  </div>
                </div>

                {/* ── Domain Breakdown Section (BIGGER Cards + Hover Pop + Click to Filter) ── */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                        <Grid3X3 className="w-5 h-5 text-sky-400" />
                        Domain Breakdown & Distribution
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Click on any team card to instantly view its filtered members in the roster
                      </p>
                    </div>
                    <span className="badge-reactbits-new hidden sm:inline-block">6 Dedicated Units</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {teams.map(([team, count]) => {
                      const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
                      const teamLeads = members.filter(
                        m => m.team === team && (m.role === 'LEAD' || m.role === 'CO-LEAD')
                      ).length;

                      return (
                        <div
                          key={team}
                          onClick={() => {
                            setFilterTeam(team);
                            navigateTo('Members');
                          }}
                          className="rect-card rect-card-hover-pop p-5 flex flex-col justify-between cursor-pointer group min-h-[175px] border-white/10 hover:border-sky-400/60 transition-all"
                          title={`Click to view ${team} team roster`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="badge-reactbits-new font-bold truncate max-w-[100px]">
                                {team}
                              </span>
                              <span className="text-xs font-mono text-sky-300 font-bold px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30">
                                {pct}%
                              </span>
                            </div>
                            <div className="mt-2">
                              <p className="text-3xl font-extrabold text-white group-hover:text-sky-300 transition-colors font-mono">
                                {count}
                              </p>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">Active Members</p>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span className="text-sky-300 font-semibold">{teamLeads} {teamLeads === 1 ? 'Lead' : 'Leads'}</span>
                            <div className="flex items-center gap-1 group-hover:text-sky-300 group-hover:translate-x-1 transition-all">
                              <span>View</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2.5">
                            <div
                              className="h-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Organizational Governance Structure (4 Big Rectangular Cards) ── */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-cyan-400" />
                      Organizational Roles Breakdown
                    </h3>
                    <span className="text-xs font-mono text-slate-400">Hierarchical Distribution</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { role: 'LEAD', label: 'Domain Leads', count: roleCounts['LEAD'] || 0, color: 'text-sky-300', bg: 'bg-sky-950/50', border: 'border-sky-500/30', nav: 'Leads' as NavKey },
                      { role: 'CO-LEAD', label: 'Domain Co-Leads', count: roleCounts['CO-LEAD'] || 0, color: 'text-cyan-300', bg: 'bg-cyan-950/50', border: 'border-cyan-500/30', nav: 'Leads' as NavKey },
                      { role: 'COORDINATOR', label: 'Coordinators', count: roleCounts['COORDINATOR'] || 0, color: 'text-emerald-300', bg: 'bg-emerald-950/50', border: 'border-emerald-500/30', nav: 'Coordinators' as NavKey },
                      { role: 'CORE', label: 'Core Members', count: roleCounts['CORE'] || 0, color: 'text-slate-200', bg: 'bg-[#0B1A30]', border: 'border-white/10', nav: 'Core' as NavKey },
                    ].map(({ role, label, count, color, bg, border, nav }) => {
                      const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
                      return (
                        <div
                          key={role}
                          onClick={() => {
                            navigateTo(nav);
                          }}
                          className={`rect-card rect-card-hover-pop p-5 ${bg} border ${border} cursor-pointer group`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
                              {label}
                            </span>
                            <span className={`text-xs font-mono font-bold ${color}`}>
                              {pct}%
                            </span>
                          </div>
                          <div className="text-3xl font-black text-white font-mono mt-1 group-hover:text-sky-300 transition-colors">
                            {count}
                          </div>
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-3 pt-2 border-t border-white/5">
                            <span>Assigned Students</span>
                            <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                              Filter <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Last 3 Sessions Absentees Pulse (Live Administrative Feed) ── */}
                <div className="rect-card-elevated p-6 border-sky-500/25">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-white/10">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
                        <Activity className="w-5 h-5 text-sky-400" />
                        Last 3 Sessions Attendance Pulse
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Recent meeting engagement and absentee overview across all domains
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav('Attendance')}
                      className="btn-rect-secondary px-3.5 py-1.5 text-xs font-mono flex items-center gap-2 cursor-pointer self-start sm:self-auto"
                    >
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      <span>Manage All Sessions</span>
                    </button>
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
                        Attendance Sessions
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Create meeting sessions, mark attendance by domain, and track real-time attendance registers.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-sky-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Take Attendance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div
                    onClick={() => navigateTo('Reports')}
                    className="rect-card rect-card-hover-pop p-6 cursor-pointer group border-cyan-500/20 hover:border-cyan-500/60 flex flex-col justify-between min-h-[170px]"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-3">
                        <BarChart2 className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                        Deep Analytics & Reports
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Review member attendance frequencies, multi-filter absent lists, and export Excel / CSV spreadsheets.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-cyan-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Explore Reports</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div
                    onClick={() => navigateTo('Members')}
                    className="rect-card rect-card-hover-pop p-6 cursor-pointer group border-blue-500/20 hover:border-blue-500/60 flex flex-col justify-between min-h-[170px]"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-md bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                        Member Registry Management
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Search and filter 229 student records, manage roles and contact details, and view individual histories.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-blue-300 mt-4 font-semibold group-hover:translate-x-1 transition-transform">
                      <span>Manage Roster</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ══════════════════════════════════════════════
              VIEW 2: MEMBERS & DEDICATED ROLE DIRECTORIES
             ══════════════════════════════════════════════ */}
          {['Members', 'Leads', 'Coordinators', 'Core'].includes(activeNav) && (
            <div className="flex flex-col gap-4 md:h-full md:max-h-[calc(100vh-100px)]">
              {/* Rectangular Search Bar & Filters */}
              <div className="rect-card p-4 shrink-0">
                <div className="flex flex-col lg:flex-row gap-3">
                  {/* Search Input */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder={
                        activeNav === 'Leads'
                          ? 'Search leads by name, roll no, department...'
                          : activeNav === 'Coordinators'
                          ? 'Search coordinators by name, roll no...'
                          : activeNav === 'Core'
                          ? 'Search core members by name, roll no...'
                          : 'Search by name, roll no, department, phone...'
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rect-input w-full pl-10 pr-12 py-2 text-xs"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {searchQuery ? (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <kbd className="hidden sm:inline-block text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono">
                          /
                        </kbd>
                      )}
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {activeNav === 'Members' && (
                      <div className="flex items-center gap-1.5 bg-[#0B172B] border border-white/10 rounded-md px-3 py-1.5">
                        <Filter className="w-3 h-3 text-sky-400" />
                        <select
                          value={filterRole}
                          onChange={(e) => setFilterRole(e.target.value)}
                          className="bg-transparent text-xs text-slate-200 font-medium outline-none cursor-pointer pr-1"
                        >
                          <option value="ALL" className="bg-[#0B172B] text-slate-200">All Roles</option>
                          {Array.from(new Set(members.map(m => m.role))).sort((a, b) => roleRank(a) - roleRank(b)).map(r => (
                            <option key={r} value={r} className="bg-[#0B172B] text-slate-200">{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vertical cards: pick a team (or All) instead of scrolling one long list */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 shrink-0">
                {[{ team: 'ALL', count: nonTeamFiltered.length, byRole: [] as (readonly [string, number])[] }, ...teamCards].map(({ team, count, byRole }) => {
                  const active = filterTeam === team;
                  return (
                    <button
                      key={team}
                      onClick={() => setFilterTeam(team)}
                      className={`rect-card text-left px-3.5 py-3 cursor-pointer transition-all border ${
                        active
                          ? 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_18px_rgba(14,165,233,0.18)]'
                          : 'border-white/10 hover:border-sky-500/40'
                      }`}
                      title={team === 'ALL' ? 'All verticals, grouped by team' : `Show ${team} members`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${active ? 'text-sky-300' : 'text-slate-300'}`}>
                          {team === 'ALL' ? 'All Verticals' : team}
                        </span>
                        <span className={`text-lg font-bold font-mono leading-none ${active ? 'text-white' : 'text-slate-200'}`}>{count}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                        {team === 'ALL'
                          ? `${teamCards.filter(t => t.count > 0).length} teams`
                          : byRole.length ? byRole.map(([r, n]) => `${n} ${ROLE_SHORT[r] || r}`).join(' · ') : 'No matches'}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Members Table (Crisp Rectangular Card) */}
              <div className="rect-card overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {['Leads', 'Coordinators', 'Core'].includes(activeNav) && (
                      <button
                        onClick={() => navigateTo('Overview')}
                        className="btn-rect-secondary px-3 py-1.5 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                        title="Back to Overview"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-sky-400" />
                        <span className="hidden sm:inline">Overview</span>
                      </button>
                    )}
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {activeNav === 'Leads'
                          ? 'Domain Leads & Co-Leads Directory'
                          : activeNav === 'Coordinators'
                          ? 'Coordinators Directory'
                          : activeNav === 'Core'
                          ? 'Core Members Directory'
                          : 'Member Directory'}
                      </h2>
                      <p className="text-xs text-[#9490A6] mt-0.5">
                        Showing {sortedMembers.length} {sortedMembers.length === 1 ? 'member' : 'members'}
                        {filterTeam !== 'ALL' ? ` in ${filterTeam}` : ' across all verticals'}
                        {((activeNav === 'Members' && filterRole !== 'ALL') || searchQuery) && ' (filtered)'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#100D1B]/95 sticky top-0 z-10 backdrop-blur-md border-b border-white/[0.08]">
                      <tr>
                        {['Name', 'Team', 'Role', 'Roll No', 'Department', 'Year', 'Phone']
                          .filter(header => !hiddenColumns.includes(header))
                          .map((header) => {
                            const keyMap: Record<string, keyof Member> = {
                              'Name': 'name', 'Team': 'team', 'Role': 'role', 'Roll No': 'rollNo', 'Department': 'department', 'Year': 'year', 'Phone': 'phone'
                            };
                            const colKey = keyMap[header];
                            return (
                              <th
                                key={header}
                                className="px-6 py-3.5 text-xs font-semibold text-[#9490A6] uppercase tracking-wider group hover:bg-white/[0.03] transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div
                                    className="flex items-center cursor-pointer flex-1"
                                    onClick={() => requestSort(colKey)}
                                  >
                                    {header}
                                    <SortIcon columnKey={colKey} />
                                  </div>
                                  <button
                                    onClick={() => setHiddenColumns(prev => [...prev, header])}
                                    className="hidden md:block opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-all cursor-pointer"
                                    title={`Hide ${header}`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </th>
                            );
                          })}
                        <th className="px-4 sm:px-6 py-3.5 w-16 text-right sticky right-0 bg-[#0A1628]/95 border-b border-white/[0.08]">
                          {hiddenColumns.length > 0 && (
                            <div className="relative group inline-block text-left">
                              <button className="p-1 text-slate-400 hover:text-sky-400 rounded transition-all" title="Restore columns">
                                <Plus className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-40 bg-[#0E1E34] border border-white/10 shadow-2xl rounded-md p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Restore</div>
                                {hiddenColumns.map(col => (
                                  <button
                                    key={col}
                                    onClick={() => setHiddenColumns(prev => prev.filter(c => c !== col))}
                                    className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-sky-400 rounded flex items-center justify-between group/btn transition-colors cursor-pointer"
                                  >
                                    {col}
                                    <Plus className="w-3 h-3 opacity-0 group-hover/btn:opacity-100" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {(filterTeam === 'ALL'
                        ? teamCards.filter(t => t.count > 0).map(t => ({ team: t.team as string | null, rows: sortedMembers.filter(m => m.team === t.team) }))
                        : [{ team: null as string | null, rows: sortedMembers }]
                      ).map(group => (
                        <React.Fragment key={group.team || 'rows'}>
                          {group.team && group.rows.length > 0 && (
                            // Bold vertical header; pinned under the column headers while scrolling that team
                            <tr>
                              <td
                                colSpan={8 - hiddenColumns.length}
                                className="sticky top-[45px] md:top-[51px] z-[5] px-4 sm:px-6 py-3 bg-[#0C1E38] border-y border-sky-500/40 border-l-4 border-l-sky-400 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-base sm:text-lg font-black text-white uppercase tracking-widest">{group.team}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {group.rows.length} {group.rows.length === 1 ? 'member' : 'members'}
                                  </span>
                                  <span className="ml-auto hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
                                    {ROLE_ORDER.map(r => [r, group.rows.filter(m => m.role === r).length] as const)
                                      .filter(([, n]) => n > 0)
                                      .map(([r, n]) => (
                                        <span key={r} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                          <span className="text-white font-bold">{n}</span> {ROLE_SHORT[r] || r}
                                        </span>
                                      ))}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                      {group.rows.map((m) => {
                        return (
                          <tr
                            key={m.id}
                            className="transition-colors hover:bg-white/[0.03]"
                          >
                            {!hiddenColumns.includes('Name') && (
                              <td className="px-6 py-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md"
                                    style={{ background: avatarColor(m.name) }}
                                  >
                                    {m.name.charAt(0)}
                                  </div>
                                  <span className="font-semibold text-white">{m.name}</span>
                                </div>
                              </td>
                            )}
                            {!hiddenColumns.includes('Team') && (
                              <td className="px-6 py-3.5 whitespace-nowrap">
                                <span className="badge-reactbits-new">
                                  {m.team}
                                </span>
                              </td>
                            )}
                            {!hiddenColumns.includes('Role') && (
                              <td className="px-6 py-3.5 whitespace-nowrap">
                                <span className={`badge-rect ${ROLE_STYLE[m.role] || 'bg-white/5 text-slate-300'}`}>
                                  {m.role}
                                </span>
                              </td>
                            )}
                            {!hiddenColumns.includes('Roll No') && (
                              <td className="px-6 py-3.5 whitespace-nowrap text-slate-300 font-mono text-xs">
                                {m.rollNo || '—'}
                              </td>
                            )}
                            {!hiddenColumns.includes('Department') && (
                              <td className="px-6 py-3.5 whitespace-nowrap text-slate-300">
                                {m.department || '—'}
                              </td>
                            )}
                            {!hiddenColumns.includes('Year') && (
                              <td className="px-6 py-3.5 whitespace-nowrap text-slate-300">
                                {m.year || '—'}
                              </td>
                            )}
                            {!hiddenColumns.includes('Phone') && (
                              <td className="px-6 py-3.5 whitespace-nowrap text-slate-300 font-mono text-xs">
                                {m.phone || '—'}
                              </td>
                            )}
                            <td className="px-3 sm:px-4 py-3.5 whitespace-nowrap text-right sticky right-0 bg-[#0A1628]/90 backdrop-blur-md">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenHistory(m)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-sky-400 hover:bg-white/5 transition-colors cursor-pointer"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(m)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors cursor-pointer"
                                  title="Edit member"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                        </React.Fragment>
                      ))}
                      {sortedMembers.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7 - hiddenColumns.length + (hiddenColumns.length > 0 ? 1 : 0)} className="px-6 py-12 text-center text-slate-400">
                            No members found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              VIEW 3: ATTENDANCE
             ══════════════════════════════════════════════ */}
          {activeNav === 'Attendance' && (
            <AttendanceView members={members} />
          )}

          {/* ══════════════════════════════════════════════
              VIEW 4: REPORTS
             ══════════════════════════════════════════════ */}
          {activeNav === 'Reports' && (
            <ReportsView members={members} />
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════
          VIEW MEMBER / ATTENDANCE HISTORY MODAL
         ══════════════════════════════════════════════ */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Attendance History</h3>
                <p className="text-xs text-[#9490A6] mt-0.5">Detailed session attendance record for member</p>
              </div>
              <button
                onClick={() => { setViewingMember(null); setSelectedMemberHistory(null); }}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
              {/* Member Profile Card */}
              <div className="flex items-center gap-3 p-4 rounded-md bg-white/[0.03] border border-white/[0.08]">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md"
                  style={{ background: avatarColor(viewingMember.name) }}
                >
                  {viewingMember.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{viewingMember.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge-rect text-[10px] ${ROLE_STYLE[viewingMember.role] || 'bg-white/5 text-slate-300'}`}>
                      {viewingMember.role}
                    </span>
                    {viewingMember.rollNo && (
                      <span className="text-[11px] font-mono text-slate-400">{viewingMember.rollNo}</span>
                    )}
                  </div>
                </div>
                {selectedMemberHistory && (
                  <div className="text-right">
                    <span className="text-lg font-bold text-sky-400">{selectedMemberHistory.stats.presentPct}%</span>
                    <p className="text-[10px] text-slate-400">Overall Rate</p>
                  </div>
                )}
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Department</p>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{viewingMember.department || '—'}</p>
                </div>
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Year</p>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{viewingMember.year || '—'}</p>
                </div>
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Phone</p>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">{viewingMember.phone || '—'}</p>
                </div>
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Team</p>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{viewingMember.team}</p>
                </div>
              </div>

              {/* Attendance Stats or Loader */}
              {historyLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Loading attendance details...</p>
                </div>
              ) : selectedMemberHistory ? (
                <>
                  {/* Summary Counters */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-md bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-200">{selectedMemberHistory.stats.total}</div>
                      <span className="text-[10px] text-slate-400">Total</span>
                    </div>
                    <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-300">{selectedMemberHistory.stats.present}</div>
                      <span className="text-[10px] text-emerald-400">Present</span>
                    </div>
                    <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                      <div className="text-xs font-bold text-rose-300">{selectedMemberHistory.stats.absent}</div>
                      <span className="text-[10px] text-rose-400">Absent</span>
                    </div>
                    <div className="p-2.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                      <div className="text-xs font-bold text-sky-300">{selectedMemberHistory.stats.informed}</div>
                      <span className="text-[10px] text-sky-400">Informed</span>
                    </div>
                  </div>

                  {/* Meeting Logs */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Meeting Logs</h4>
                    {selectedMemberHistory.history.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No meeting attendance recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedMemberHistory.history.map((h, i) => {
                          const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
                            PRESENT: { badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', label: 'Present' },
                            ABSENT: { badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30', label: 'Absent' },
                            INFORMED: { badge: 'bg-sky-500/15 text-sky-300 border border-sky-500/30', label: 'Informed' },
                            UNMARKED: { badge: 'bg-white/5 text-slate-400 border border-white/10', label: 'Unmarked' },
                          };
                          const statusStyle = STATUS_STYLE[h.status] || STATUS_STYLE.UNMARKED;
                          return (
                            <div key={i} className="p-3 rounded-md border border-white/[0.06] hover:bg-white/[0.03] flex items-center justify-between text-xs transition-colors">
                              <div>
                                <p className="font-semibold text-slate-200">{h.title}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{h.date} • Slot: {h.sessionSlot || 'FN'}</p>
                              </div>
                              <span className={`badge-rect ${statusStyle.badge}`}>{statusStyle.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Could not load attendance data.</p>
              )}

              {/* Edit shortcut */}
              <button
                onClick={() => { handleOpenEdit(viewingMember); setViewingMember(null); setSelectedMemberHistory(null); }}
                className="btn-sky-glow w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Member Details
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-[#050B14]/80 border-t border-white/[0.08] text-right">
              <button
                onClick={() => { setViewingMember(null); setSelectedMemberHistory(null); }}
                className="btn-rect-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-md w-full max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Member Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update info for {editingMember.name}
                </p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMemberEdit} className="p-6 space-y-4">
              {/* Member Info */}
              <div className="p-3 bg-white/[0.03] rounded-md border border-white/[0.08] flex flex-col gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-300">Full Name:</span>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="rect-input w-full px-2.5 py-1.5 text-xs mt-1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-slate-300">Team:</span>
                    <select
                      value={editForm.team}
                      onChange={(e) => setEditForm(prev => ({ ...prev, team: e.target.value }))}
                      className="rect-input w-full px-2 py-1.5 text-xs bg-[#0B172B] text-slate-200 mt-1 cursor-pointer"
                    >
                      {['MEDIA', 'AMBIANCE', 'PR', 'TECH', 'ERM', 'DESIGN', 'ALL'].map(t => <option key={t} value={t} className="bg-[#0B172B] text-slate-200">{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-300">Role:</span>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      className="rect-input w-full px-2 py-1.5 text-xs bg-[#0B172B] text-slate-200 mt-1 cursor-pointer"
                    >
                      {['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map(r => <option key={r} value={r} className="bg-[#0B172B] text-slate-200">{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status / Notice Messages */}
              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs text-rose-300 flex items-start gap-2">
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300">
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
                  className="rect-input w-full px-3.5 py-2 text-xs"
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
                  className="rect-input w-full px-3.5 py-2 text-xs"
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
                  className="rect-input w-full px-3.5 py-2 text-xs"
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
                  className="rect-input w-full px-3.5 py-2 text-xs"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-rect-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn-sky-glow px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
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