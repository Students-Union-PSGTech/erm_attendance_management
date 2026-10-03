import React, { useEffect, useState } from 'react';
import type { User } from '../types';
import {
  Users, Calendar, BarChart2, Settings,
  TrendingUp, UserCheck, UserX, Activity,
  LogOut, Grid3X3, ArrowUpDown, ArrowDown, ArrowUp, RefreshCw,
  Search, Filter, X, Minus, Plus, Check
} from 'lucide-react';
import AttendanceView from './AttendanceView';
import ReportsView from './ReportsView';

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
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfigs, setSortConfigs] = useState<{ key: keyof Member; direction: 'asc' | 'desc' }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');

  // Track hidden columns instead of archived rows
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  
  // Inline editing state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Member>>({});

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

  const handleSaveEdit = async () => {
    if (!editingMemberId) return;
    try {
      const payload = { ...editForm };
      // Backend expects omitted or undefined for empty strings, but we handle empty to undefined
      if (payload.rollNo === '') delete payload.rollNo;
      if (payload.department === '') delete payload.department;
      if (payload.year === '') delete payload.year;
      if (payload.phone === '') delete payload.phone;

      const res = await fetch(`/api/members/${editingMemberId}`, {
        method: 'PUT', // standard REST update
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === editingMemberId ? { ...m, ...payload } : m));
        setEditingMemberId(null);
      } else {
        const errData = await res.json();
        console.error('Failed to update member:', errData);
      }
    } catch (err) {
      console.error('Network error updating member', err);
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

      {/* ── Sidebar ── */}
      <aside className="w-60 flex flex-col bg-white border-r border-slate-100 py-6 px-3 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <img
            src="https://ugc.production.linktr.ee/16e3a388-5f1c-4ebc-a943-a064b81991c3_243269363-3078323169067077-7607043015283444723-n.jpeg?io=true&size=avatar-v3_0"
            alt="Logo"
            className="w-9 h-9 rounded-xl object-cover"
          />
          <div>
            <p className="text-slate-900 font-semibold text-sm leading-tight">Students Union</p>
            <p className="text-slate-400 text-[10px]">Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setActiveNav(label)}
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
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900">{activeNav}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
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
                        const isEditing = editingMemberId === m.id;
                        return (
                          <tr 
                            key={m.id} 
                            className={`transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50 cursor-pointer'}`}
                            onClick={(e) => {
                              if (!isEditing && (e.target as HTMLElement).closest('td')) {
                                setEditingMemberId(m.id);
                                setEditForm(m);
                              }
                            }}
                          >
                            {!hiddenColumns.includes('Name') && (
                              <td className="px-6 py-3 whitespace-nowrap">
                                {isEditing ? (
                                  <input autoFocus value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Name" />
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: avatarColor(m.name) }}>
                                      {m.name.charAt(0)}
                                    </div>
                                    <span className="font-medium text-slate-900">{m.name}</span>
                                  </div>
                                )}
                              </td>
                            )}
                            {!hiddenColumns.includes('Team') && (
                              <td className="px-6 py-3 whitespace-nowrap font-medium text-slate-700">
                                {isEditing ? (
                                  <select value={editForm.team || ''} onChange={e => setEditForm({ ...editForm, team: e.target.value })} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                                    {['MEDIA', 'AMBIANCE', 'PR', 'TECH', 'ERM', 'DESIGN'].map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                ) : m.team}
                              </td>
                            )}
                            {!hiddenColumns.includes('Role') && (
                              <td className="px-6 py-3 whitespace-nowrap">
                                {isEditing ? (
                                  <select value={editForm.role || ''} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                                    {['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'].map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                ) : (
                                  <span className={`badge ${ROLE_STYLE[m.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{m.role}</span>
                                )}
                              </td>
                            )}
                            {!hiddenColumns.includes('Roll No') && (
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                                {isEditing ? (
                                  <input value={editForm.rollNo || ''} onChange={e => setEditForm({ ...editForm, rollNo: e.target.value })} className="w-24 px-2 py-1 bg-white border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Roll No" />
                                ) : (m.rollNo || '-')}
                              </td>
                            )}
                            {!hiddenColumns.includes('Department') && (
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                                {isEditing ? (
                                  <input value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })} className="w-32 px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Dept" />
                                ) : (m.department || '-')}
                              </td>
                            )}
                            {!hiddenColumns.includes('Year') && (
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                                {isEditing ? (
                                  <select value={editForm.year || ''} onChange={e => setEditForm({ ...editForm, year: e.target.value })} className="w-full px-2 py-1 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-100">
                                    <option value="">None</option>
                                    {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'].map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                ) : (m.year || '-')}
                              </td>
                            )}
                            {!hiddenColumns.includes('Phone') && (
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                                {isEditing ? (
                                  <input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-28 px-2 py-1 bg-white border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Phone" />
                                ) : (m.phone || '-')}
                              </td>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {isEditing && (
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingMemberId(null); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Cancel">
                                    <X className="w-4 h-4"/>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded" title="Save">
                                    <Check className="w-4 h-4"/>
                                  </button>
                                </div>
                              )}
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
    </div>
  );
}
