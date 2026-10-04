import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import {
  Users, Calendar, BarChart2,
  LogOut, Grid3X3, ArrowUpDown, ArrowDown, ArrowUp, RefreshCw,
  Search, Filter, X, Minus, Plus, Edit3, Eye, Menu
} from 'lucide-react';
import AttendanceView from './AttendanceView';
import ReportsView from './ReportsView';
import type { MemberHistoryDetail } from './TeamDashboard';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

type NavKey = 'Overview' | 'Members' | 'Attendance' | 'Reports';

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
  LEAD: 'bg-amber-50 text-amber-700 border border-amber-200',
  'CO-LEAD': 'bg-purple-50 text-purple-700 border border-purple-200',
  COORDINATOR: 'bg-blue-50 text-blue-700 border border-blue-200',
  CORE: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const avatarColor = (name: string) => {
  const colors = ['#1D4ED8', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];
  return colors[name.charCodeAt(0) % colors.length];
};

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeNav, setActiveNav] = useState<NavKey>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfigs, setSortConfigs] = useState<{ key: keyof Member; direction: 'asc' | 'desc' }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');

  // Track hidden columns instead of archived rows
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
  };

  const fetchMembers = async () => {
    setLoading(true);
    setSortConfigs([]); // Clear sorting on refresh
    setSearchQuery('');
    setFilterTeam('ALL');
    setFilterRole('ALL');
    try {
      const res = await fetch('/api/members', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
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
      const payload = { ...editForm };
      // Backend expects omitted or undefined for empty strings, but we handle empty to undefined
      if (payload.rollNo === '') delete payload.rollNo;
      if (payload.department === '') delete payload.department;
      if (payload.year === '') delete payload.year;
      if (payload.phone === '') delete payload.phone;

      const res = await fetch(`/api/members/${editingMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...payload } : m));
        setEditSuccess('Member updated successfully!');
        setTimeout(() => setEditModalOpen(false), 1500);
      } else {
        const errData = await res.json();
        setEditError(errData.error || 'Failed to update member');
      }
    } catch (err) {
      console.error('Network error updating member', err);
      setEditError('Network error updating member');
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const totalMembers = members.length;
  const teamCounts = members.reduce((acc, m) => {
    acc[m.team] = (acc[m.team] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const teams = Object.entries(teamCounts).sort((a, b) => b[1] - a[1]);

  const requestSort = (key: keyof Member) => {
    setSortConfigs(prev => {
      const existingIndex = prev.findIndex(c => c.key === key);
      let newConfigs = [...prev];

      if (existingIndex === 0) {
        // Toggle direction if it's already the primary sort
        newConfigs[0] = { ...newConfigs[0], direction: newConfigs[0].direction === 'asc' ? 'desc' : 'asc' };
      } else {
        // Make it the primary sort, keeping previous direction if it existed
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

  const sortedMembers = React.useMemo(() => {
    // 1. Filter
    let result = members.filter(m => {
      if (filterTeam !== 'ALL' && m.team !== filterTeam) return false;
      if (filterRole !== 'ALL' && m.role !== filterRole) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.rollNo && m.rollNo.toLowerCase().includes(q)) ||
          (m.department && m.department.toLowerCase().includes(q)) ||
          (m.phone && m.phone.includes(q))
        );
      }
      return true;
    });

    // 2. Sort
    if (sortConfigs.length === 0) return result;

    return result.sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        const aVal = (a[key] || '').toString().toLowerCase();
        const bVal = (b[key] || '').toString().toLowerCase();
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [members, sortConfigs, filterTeam, filterRole, searchQuery]);

  const SortIcon = ({ columnKey }: { columnKey: keyof Member }) => {
    const sortIndex = sortConfigs.findIndex(c => c.key === columnKey);
    if (sortIndex === -1) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }

    const config = sortConfigs[sortIndex];
    return (
      <div className="flex items-center ml-1">
        {config.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />}
        {sortIndex > 0 && <span className="text-[9px] font-bold text-blue-600 ml-0.5">{sortIndex + 1}</span>}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden text-slate-900">

      {/* ── Mobile/Overlay Backdrop ── */}
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
            className="w-9 h-9 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-slate-900 font-semibold text-sm leading-tight truncate">Students Union</p>
            <p className="text-slate-400 text-[10px]">Admin Portal</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => {
                setActiveNav(label);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`nav-item ${activeNav === label ? 'nav-active' : ''}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* User card */}
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
              <p className="text-[10px] text-slate-400">Administrator</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchMembers}
                disabled={loading}
                title="Refresh Data"
                className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ${loading ? 'animate-spin opacity-50 cursor-not-allowed' : ''}`}
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

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-7">
          <div className="flex items-center gap-3.5 mb-6">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-blue-600 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{activeNav}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {activeNav === 'Overview' && (
            loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Hero Stat - Total Members */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-lg shadow-blue-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 font-medium mb-1">Total Organization Size</p>
                    <h2 className="text-5xl font-bold tracking-tight">{totalMembers} <span className="text-2xl font-normal text-blue-200">Members</span></h2>
                  </div>
                  <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                </div>

                {/* Domain Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5 text-slate-400" />
                    Domain Breakdown
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    {teams.map(([team, count], index) => {
                      const palettes = [
                        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: 'bg-emerald-100/50' },
                        { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', icon: 'bg-purple-100/50' },
                        { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: 'bg-amber-100/50' },
                        { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: 'bg-rose-100/50' },
                        { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100', icon: 'bg-cyan-100/50' },
                        { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: 'bg-indigo-100/50' },
                      ];
                      const style = palettes[index % palettes.length];

                      return (
                        <div key={team} className={`rounded-2xl p-5 border ${style.bg} ${style.border} transition-all hover:scale-[1.02] hover:shadow-md cursor-default`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${style.icon}`}>
                              <Users className={`w-4 h-4 ${style.text}`} />
                            </div>
                          </div>
                          <p className={`text-2xl font-bold ${style.text}`}>{count}</p>
                          <p className={`text-[11px] font-semibold uppercase tracking-wider ${style.text} opacity-80 mt-1 truncate`}>{team}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          )}

          {activeNav === 'Members' && (
            <div className="flex flex-col gap-4 h-full max-h-[calc(100vh-100px)] animate-in fade-in duration-500">

              {/* Complex Search Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search Input */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, roll no, department, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={filterTeam}
                        onChange={(e) => setFilterTeam(e.target.value)}
                        className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer py-1 pr-2 appearance-none"
                      >
                        <option value="ALL">All Domains</option>
                        {Array.from(new Set(members.map(m => m.team))).sort().map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer py-1 pr-2 appearance-none"
                      >
                        <option value="ALL">All Roles</option>
                        {Array.from(new Set(members.map(m => m.role))).sort().map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Member Directory</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Showing {sortedMembers.length} {sortedMembers.length === 1 ? 'member' : 'members'}
                      {(filterTeam !== 'ALL' || filterRole !== 'ALL' || searchQuery) && ' (filtered)'}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200">
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
                                className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider group hover:bg-slate-100 transition-colors"
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
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                    title={`Hide ${header}`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </th>
                            );
                          })}
                          <th className="px-6 py-3 w-16 text-right">
                            {hiddenColumns.length > 0 && (
                              <div className="relative group inline-block text-left">
                                <button className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Restore columns">
                                  <Plus className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">Restore</div>
                                  {hiddenColumns.map(col => (
                                    <button
                                      key={col}
                                      onClick={() => setHiddenColumns(prev => prev.filter(c => c !== col))}
                                      className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg flex items-center justify-between group/btn transition-colors"
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
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {sortedMembers.map((m) => {
                        return (
                          <tr 
                            key={m.id} 
                            className="transition-colors hover:bg-slate-50"
                          >
                            {!hiddenColumns.includes('Name') && (
                              <td className="px-6 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: avatarColor(m.name) }}>
                                    {m.name.charAt(0)}
                                  </div>
                                  <span className="font-medium text-slate-900">{m.name}</span>
                                </div>
                              </td>
                            )}
                            {!hiddenColumns.includes('Team') && (
                              <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-700">
                                {m.team}
                              </td>
                            )}
                          {!hiddenColumns.includes('Role') && (
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className={`badge ${ROLE_STYLE[m.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{m.role}</span>
                            </td>
                          )}
                          {!hiddenColumns.includes('Roll No') && (
                            <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                              {m.rollNo || '-'}
                            </td>
                          )}
                          {!hiddenColumns.includes('Department') && (
                            <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                              {m.department || '-'}
                            </td>
                          )}
                          {!hiddenColumns.includes('Year') && (
                            <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                              {m.year || '-'}
                            </td>
                          )}
                          {!hiddenColumns.includes('Phone') && (
                            <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                              {m.phone || '-'}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenHistory(m)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(m)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit member"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          </tr>
                        );
                      })}
                      {sortedMembers.length === 0 && !loading && (
                        <tr>
                          <td colSpan={7 - hiddenColumns.length + (hiddenColumns.length > 0 ? 1 : 0)} className="px-6 py-8 text-center text-slate-500">
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

          {activeNav === 'Attendance' && (
            <AttendanceView members={members} />
          )}

          {activeNav === 'Reports' && (
            <ReportsView members={members} />
          )}
        </main>
      </div>

      {/* View Member / Attendance History Modal */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance History</h3>
                <p className="text-xs text-slate-500 mt-0.5">Detailed session attendance record for member</p>
              </div>
              <button
                onClick={() => { setViewingMember(null); setSelectedMemberHistory(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
              {/* Member Profile Card */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: avatarColor(viewingMember.name) }}
                >
                  {viewingMember.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{viewingMember.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge text-[10px] ${ROLE_STYLE[viewingMember.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {viewingMember.role}
                    </span>
                    {viewingMember.rollNo && (
                      <span className="text-[11px] font-mono text-slate-500">{viewingMember.rollNo}</span>
                    )}
                  </div>
                </div>
                {selectedMemberHistory && (
                  <div className="text-right">
                    <span className="text-lg font-bold text-indigo-600">{selectedMemberHistory.stats.presentPct}%</span>
                    <p className="text-[10px] text-slate-400">Overall Rate</p>
                  </div>
                )}
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Department</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{viewingMember.department || '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Year</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{viewingMember.year || '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Phone</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 font-mono">{viewingMember.phone || '—'}</p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Team</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{viewingMember.team}</p>
                </div>
              </div>

              {/* Attendance Stats or Loader */}
              {historyLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs">Loading attendance details...</p>
                </div>
              ) : selectedMemberHistory ? (
                <>
                  {/* Summary Counters */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-xs font-bold text-slate-700">{selectedMemberHistory.stats.total}</div>
                      <span className="text-[10px] text-slate-400">Total</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                      <div className="text-xs font-bold text-emerald-700">{selectedMemberHistory.stats.present}</div>
                      <span className="text-[10px] text-emerald-600">Present</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                      <div className="text-xs font-bold text-rose-700">{selectedMemberHistory.stats.absent}</div>
                      <span className="text-[10px] text-rose-600">Absent</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="text-xs font-bold text-amber-700">{selectedMemberHistory.stats.informed}</div>
                      <span className="text-[10px] text-amber-600">Informed</span>
                    </div>
                  </div>

                  {/* Meeting Logs */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Meeting Logs</h4>
                    {selectedMemberHistory.history.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No meeting attendance recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedMemberHistory.history.map((h, i) => {
                          const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
                            PRESENT: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Present' },
                            ABSENT: { badge: 'bg-rose-50 text-rose-700 border border-rose-200', label: 'Absent' },
                            INFORMED: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Informed' },
                            UNMARKED: { badge: 'bg-slate-50 text-slate-500 border border-slate-200', label: 'Unmarked' },
                          };
                          const statusStyle = STATUS_STYLE[h.status] || STATUS_STYLE.UNMARKED;
                          return (
                            <div key={i} className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-800">{h.title}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{h.date} • Slot: {h.sessionSlot || 'FN'}</p>
                              </div>
                              <span className={`badge ${statusStyle.badge}`}>{statusStyle.label}</span>
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
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Member
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => { setViewingMember(null); setSelectedMemberHistory(null); }}
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
                  Update info for {editingMember.name}
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
              {/* Member Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 mr-2">Name:</span>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mt-1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-slate-800">Team:</span>
                    <select
                      value={editForm.team}
                      onChange={(e) => setEditForm(prev => ({ ...prev, team: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 mt-1"
                    >
                      {['MEDIA', 'AMBIANCE', 'PR', 'TECH', 'ERM', 'DESIGN', 'ALL'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Role:</span>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 mt-1"
                    >
                      {['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status / Notice Messages */}
              {editError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
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
