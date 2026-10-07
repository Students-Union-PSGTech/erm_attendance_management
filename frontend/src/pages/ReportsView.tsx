import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Download, Users, TrendingUp, CalendarDays, Activity, Search,
  Eye, Award, AlertTriangle, X, BarChart3, PieChart, Layers, ArrowUpDown
} from 'lucide-react';
import { animate } from 'animejs';

import type { Member } from './AdminDashboard';
import { isUpcoming, opensLabel } from './sessionTime';

interface ReportsViewProps {
  members: Member[];
  /** Set for team logins: only this team's data is shown and cross-team sections are hidden. */
  team?: string;
}

type AttendanceStat = {
  memberId: string;
  name: string;
  team: string;
  role: string;
  rollNo?: string;
  department?: string;
  year?: string;
  phone?: string;
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
  team: string;
  present: number;
  absent: number;
  informed: number;
  marked: number;
  targetCount: number;
  presentPct: number;
  upcoming: boolean;
  startTime?: string;
  sessionSlot?: string;
  notes?: string;
};

type MemberHistoryDetail = {
  member: Member & { createdAt?: string };
  stats: {
    total: number;
    present: number;
    absent: number;
    informed: number;
    presentPct: number;
  };
  history: Array<{
    sessionId: string;
    title: string;
    date: string;
    sessionSlot?: string;
    status: 'PRESENT' | 'ABSENT' | 'INFORMED';
    marked?: boolean;
    markedAt?: string;
  }>;
};

const ROLE_ORDER = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];
const roleRank = (role?: string) => {
  const i = ROLE_ORDER.indexOf((role || '').toUpperCase());
  return i === -1 ? ROLE_ORDER.length : i;
};

const TEAM_ORDER = ['ERM', 'TECH', 'PR', 'DESIGN', 'AMBIANCE', 'MEDIA'];
const teamRank = (team?: string) => {
  const i = TEAM_ORDER.indexOf((team || '').toUpperCase());
  return i === -1 ? TEAM_ORDER.length : i;
};

const byTeamRoleName = (a: { team?: string; role?: string; name?: string }, b: { team?: string; role?: string; name?: string }) =>
  teamRank(a.team) - teamRank(b.team) || (a.team || '').localeCompare(b.team || '') || roleRank(a.role) - roleRank(b.role) || (a.name || '').localeCompare(b.name || '');

// Does a session (e.g. "ALL" or "TECH,DESIGN") apply to this team?
const sessionHasTeam = (sessionTeam: string | undefined, team: string) => {
  const t = (sessionTeam || 'ALL').split(',').map((x) => x.trim().toUpperCase());
  return t.includes('ALL') || t.includes(team);
};

const ROLE_STYLE: Record<string, string> = {
  LEAD: 'bg-[#082F49] text-[#7DD3FC] border border-sky-500/40',
  'CO-LEAD': 'bg-[#0C4A6E] text-[#BAE6FD] border border-cyan-500/40',
  COORDINATOR: 'bg-[#064E3B] text-[#6EE7B7] border border-emerald-500/40',
  CORE: 'bg-[#1E1B4B] text-[#C7D2FE] border border-indigo-500/40',
};

const avatarColor = (name: string) => {
  const colors = [
    'linear-gradient(135deg, #0284c7, #0369a1)',
    'linear-gradient(135deg, #0d9488, #0f766e)',
    'linear-gradient(135deg, #6366f1, #4f46e5)',
    'linear-gradient(135deg, #d97706, #b45309)',
    'linear-gradient(135deg, #e11d48, #be123c)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
};

/* ─────────────────────────────────────────────────────────
   SPOTLIGHT CARD
   ───────────────────────────────────────────────────────── */
function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(14, 165, 233, 0.16)',
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rect-card border border-white/10 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div className="relative z-20 h-full">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ANIMATED NUMBER COUNTER
   ───────────────────────────────────────────────────────── */
function AnimatedCounter({
  value,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: 0 };
    const anim = animate(obj, {
      val: value,
      duration: 1000,
      ease: 'outExpo',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent =
            (decimals > 0 ? obj.val.toFixed(decimals) : Math.round(obj.val).toString()) + suffix;
        }
      },
    });
    return () => {
      anim.pause();
    };
  }, [value, suffix, decimals]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ─────────────────────────────────────────────────────────
   MAIN REPORTS & ANALYTICS VIEW
   ───────────────────────────────────────────────────────── */
export default function ReportsView({ members, team }: ReportsViewProps) {
  const rosterTeams = Array.from(new Set(members.map((m) => (m.team || '').toUpperCase()).filter(Boolean)));
  const teamScope = team?.toUpperCase() ?? (rosterTeams.length === 1 ? rosterTeams[0] : undefined);
  const isTeamView = !!teamScope;

  const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'analytics' | 'members' | 'sessions' | 'exports'>('analytics');
  const [selectedVertical, setSelectedVertical] = useState<string>(teamScope ?? 'ALL');
  // Domain highlighted in the Domain card; the Role card follows it
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showDefaultersOnly, setShowDefaultersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'pct_desc' | 'pct_asc' | 'name' | 'role'>('pct_desc');

  // Drilldown Member History Modal (View Mode Read-Only)
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memberHistory, setMemberHistory] = useState<MemberHistoryDetail | null>(null);

  // Hovered trend point state
  const [hoveredSession, setHoveredSession] = useState<{
    stat: SessionStat;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setSelectedVertical(teamScope ?? 'ALL');
  }, [teamScope]);

  // For team logins show only the team (or ALL), never other teams' names
  const sessionTeamLabel = (t: string) =>
    isTeamView
      ? t.split(',').map((x) => x.trim().toUpperCase()).includes('ALL')
        ? 'ALL'
        : teamScope
      : t;

  // Fetch Stats Data
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
        const [attRes, sessionsRes] = await Promise.all([
          fetch('/api/stats/attendance', { headers }),
          fetch('/api/sessions', { headers }),
        ]);
        if (cancelled) return;

        if (attRes.ok) {
          const attData = await attRes.json();
          if (cancelled) return;
          // Informed is tracked on its own: absent = total - present - informed.
          // Turnout % is still present / total, so informed does not count as present.
          const rows: AttendanceStat[] = (attData.members || [])
            .filter((m: AttendanceStat) => !teamScope || (m.team || '').toUpperCase() === teamScope)
            .map((m: AttendanceStat) => {
              const informed = m.informed || 0;
              const absent = Math.max(0, m.total - m.present - informed);
              return {
                ...m,
                absent,
                informed,
                absentPct: m.total ? Math.round((absent / m.total) * 1000) / 10 : 0,
                informedPct: m.total ? Math.round((informed / m.total) * 1000) / 10 : 0,
              };
            });
          setAttendanceStats(rows.sort(byTeamRoleName));
        }

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          if (cancelled) return;
          const computedStats = (sessionsData.sessions || [])
            .filter((s: any) => !teamScope || sessionHasTeam(s.team, teamScope))
            .map((s: any) => {
              const teams = (s.team || 'ALL').split(',').map((t: string) => t.trim().toUpperCase());
              const targetMembers = teams.includes('ALL')
                ? members
                : members.filter((m: any) => teams.includes(m.team?.toUpperCase() || ''));

              const records = s.records || {};
              let present = 0;
              let informed = 0;
              let marked = 0;
              targetMembers.forEach((m: any) => {
                const status = records[m.id]?.status;
                if (status) marked++;
                if (status === 'PRESENT') present++;
                else if (status === 'INFORMED') informed++;
              });

              const targetCount = targetMembers.length;
              // Absent = marked absent + still unmarked (everyone who is neither present nor informed)
              const absent = Math.max(0, targetCount - present - informed);
              const presentPct = targetCount ? Math.round((present / targetCount) * 1000) / 10 : 0;

              return {
                id: s.id,
                date: s.date,
                title: s.title,
                team: s.team || 'ALL',
                present,
                absent,
                informed,
                marked,
                targetCount,
                presentPct,
                startTime: s.startTime,
                sessionSlot: s.sessionSlot,
                notes: s.notes,
                upcoming: isUpcoming(s),
              };
            });

          computedStats.sort((a: SessionStat, b: SessionStat) => a.date.localeCompare(b.date));
          setSessionStats(computedStats);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [members, teamScope]);

  // Open member attendance history in View Mode (Read-Only)
  const handleOpenMemberView = async (member: Member) => {
    setViewMember(member);
    setHistoryLoading(true);
    setMemberHistory(null);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/members/${member.id}/attendance`, { headers });
      if (res.ok) {
        const data = await res.json();
        const { total, present } = data.stats;
        const informed = (data.history || []).filter((h: any) => h.status === 'INFORMED').length;
        setMemberHistory({
          ...data,
          stats: {
            ...data.stats,
            informed,
            absent: Math.max(0, total - present - informed),
          },
        });
      }
    } catch (err) {
      console.error('Failed to load member history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     AGGREGATE CALCULATIONS
     ───────────────────────────────────────────────────────── */
  const activeMembers = useMemo(() => attendanceStats.filter((s) => s.total > 0), [attendanceStats]);

  const overallStats = useMemo(() => {
    const totalMembers = activeMembers.length;
    const totalPresents = activeMembers.reduce((sum, m) => sum + m.present, 0);
    const totalSessions = activeMembers.reduce((sum, m) => sum + m.total, 0);
    const overallPct = totalSessions > 0 ? Math.round((totalPresents / totalSessions) * 1000) / 10 : 0;

    const defaultersCount = activeMembers.filter((m) => m.presentPct < 75).length;
    const outstandingCount = activeMembers.filter((m) => m.presentPct >= 90).length;
    const consistentCount = activeMembers.filter((m) => m.presentPct >= 75 && m.presentPct < 90).length;

    const pastSessions = sessionStats.filter((s) => !s.upcoming);
    const upcomingSessions = sessionStats.filter((s) => s.upcoming);

    return {
      totalMembers,
      totalPresents,
      overallPct,
      defaultersCount,
      outstandingCount,
      consistentCount,
      pastSessionsCount: pastSessions.length,
      upcomingSessionsCount: upcomingSessions.length,
      pastSessions,
    };
  }, [activeMembers, sessionStats]);

  // Domain & role breakdown: meetings held per vertical, expected = meetings x members
  const domainBreakdown = useMemo(() => {
    const held = sessionStats.filter((s) => !s.upcoming);
    const round1 = (n: number) => Math.round(n * 10) / 10;

    const build = (label: string, list: AttendanceStat[], meetings: number) => {
      const present = list.reduce((s, m) => s + m.present, 0);
      const informed = list.reduce((s, m) => s + m.informed, 0);
      const expected = meetings * list.length;
      return {
        label,
        meetings,
        memberCount: list.length,
        expected,
        present,
        informed,
        absent: Math.max(0, expected - present - informed),
        pct: expected > 0 ? round1((present / expected) * 100) : 0,
      };
    };

    const extraTeams = Array.from(
      new Set(attendanceStats.map((m) => m.team.toUpperCase()).filter((t) => !TEAM_ORDER.includes(t))),
    );
    const teams = isTeamView ? [teamScope!] : [...TEAM_ORDER, ...extraTeams];

    return teams.map((t) => {
      const list = attendanceStats.filter((m) => m.team.toUpperCase() === t);
      const meetings = held.filter((s) => sessionHasTeam(s.team, t)).length;

      const roles = ROLE_ORDER.map((r) =>
        build(r, list.filter((m) => m.role.toUpperCase() === r), meetings),
      );
      const otherRoles = list.filter((m) => !ROLE_ORDER.includes(m.role.toUpperCase()));
      if (otherRoles.length) roles.push(build('OTHER', otherRoles, meetings));

      return { ...build(t, list, meetings), roles: roles.filter((r) => r.memberCount > 0) };
    });
  }, [attendanceStats, sessionStats, isTeamView, teamScope]);

  // "All domains" summary row + role totals across domains
  const allDomains = useMemo(() => {
    const sum = (k: 'expected' | 'present' | 'informed' | 'memberCount') =>
      domainBreakdown.reduce((s, d) => s + d[k], 0);
    const expected = sum('expected');
    const present = sum('present');
    const informed = sum('informed');
    const roleMap = new Map<string, { label: string; meetings: number; memberCount: number; expected: number; present: number; informed: number; absent: number; pct: number }>();
    domainBreakdown.forEach((d) =>
      d.roles.forEach((r) => {
        const cur = roleMap.get(r.label) ?? { label: r.label, meetings: 0, memberCount: 0, expected: 0, present: 0, informed: 0, absent: 0, pct: 0 };
        cur.memberCount += r.memberCount;
        cur.expected += r.expected;
        cur.present += r.present;
        cur.informed += r.informed;
        roleMap.set(r.label, cur);
      }),
    );
    const roles = [...ROLE_ORDER, 'OTHER']
      .map((l) => roleMap.get(l))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({
        ...r,
        absent: Math.max(0, r.expected - r.present - r.informed),
        pct: r.expected > 0 ? Math.round((r.present / r.expected) * 1000) / 10 : 0,
      }));
    return {
      label: 'ALL',
      meetings: sessionStats.filter((x) => !x.upcoming).length, // distinct held meetings
      memberCount: sum('memberCount'),
      expected,
      present,
      informed,
      absent: Math.max(0, expected - present - informed),
      pct: expected > 0 ? Math.round((present / expected) * 1000) / 10 : 0,
      roles,
    };
  }, [domainBreakdown, sessionStats]);

  const activeDomain = isTeamView ? teamScope! : selectedDomain;
  const activeDetail =
    activeDomain === 'ALL' ? allDomains : domainBreakdown.find((d) => d.label === activeDomain) ?? allDomains;
  const activeRoles = activeDetail.roles;


  // Filtered member matrix
  const filteredMembers = useMemo(() => {
    const q = memberSearchQuery.toLowerCase();
    return attendanceStats
      .filter((m) => {
        if (selectedVertical !== 'ALL' && m.team.toUpperCase() !== selectedVertical) return false;
        if (showDefaultersOnly && (m.total === 0 || m.presentPct >= 75)) return false;
        if (q) {
          const matchName = m.name.toLowerCase().includes(q);
          const matchRole = m.role.toLowerCase().includes(q);
          const matchTeam = m.team.toLowerCase().includes(q);
          const matchRoll = (m.rollNo || '').toLowerCase().includes(q);
          const matchDept = (m.department || '').toLowerCase().includes(q);
          if (!matchName && !matchRole && !matchTeam && !matchRoll && !matchDept) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pct_desc') return b.presentPct - a.presentPct || byTeamRoleName(a, b);
        if (sortBy === 'pct_asc') return a.presentPct - b.presentPct || byTeamRoleName(a, b);
        if (sortBy === 'role') return roleRank(a.role) - roleRank(b.role) || (a.name || '').localeCompare(b.name || '');
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [attendanceStats, selectedVertical, showDefaultersOnly, memberSearchQuery, sortBy]);

  /* ─────────────────────────────────────────────────────────
     EXPORT HANDLERS
     ───────────────────────────────────────────────────────── */
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadMembersCSV = () => {
    if (!members.length) return;
    const headers = ['Name', 'Team', 'Role', 'Roll No', 'Department', 'Year', 'Phone'];
    const data = [...members].sort(byTeamRoleName).map((m) => [
      `"${m.name || ''}"`,
      `"${m.team || ''}"`,
      `"${m.role || ''}"`,
      `"${m.rollNo || '-'}"`,
      `"${m.department || '-'}"`,
      `"${m.year || '-'}"`,
      `"${m.phone || '-'}"`,
    ]);
    downloadCSV([headers.join(','), ...data.map((r) => r.join(','))].join('\n'), `members_roster_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadAttendanceCSV = () => {
    if (!attendanceStats.length) return;
    const headers = ['Name', 'Team', 'Role', 'Total Meetings', 'Present', 'Informed', 'Absent', 'Turnout %'];
    const data = attendanceStats.map((s) => [
      `"${s.name || ''}"`,
      `"${s.team || ''}"`,
      `"${s.role || ''}"`,
      s.total,
      s.present,
      s.informed,
      s.absent,
      `"${s.presentPct}%"`,
    ]);
    downloadCSV([headers.join(','), ...data.map((r) => r.join(','))].join('\n'), `attendance_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const downloadSessionsCSV = () => {
    const held = sessionStats.filter((s) => !s.upcoming);
    if (!held.length) return;
    const headers = ['Date', 'Title', 'Team / Domain', 'Slot', 'Target Count', 'Present', 'Informed', 'Absent', 'Attendance %'];
    const data = held.map((s) => [
      `"${s.date}"`,
      `"${s.title}"`,
      `"${sessionTeamLabel(s.team)}"`,
      `"${s.sessionSlot || 'FN'}"`,
      s.targetCount,
      s.present,
      s.informed,
      s.absent,
      `"${s.presentPct}%"`,
    ]);
    downloadCSV([headers.join(','), ...data.map((r) => r.join(','))].join('\n'), `session_pulse_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(14,165,233,0.4)]" />
        <span className="font-mono text-xs text-sky-300 uppercase tracking-widest animate-pulse">
          Synthesizing Intelligence & Metrics...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-500 text-slate-100">
      {/* ══════════════════════════════════════════════
          TOP HEADER & VIEW PERMISSION BANNER
         ══════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg bg-[#0A1526]/90 border border-sky-500/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 font-mono text-xs font-bold uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5" /> View Mode (Read-Only Analytics)
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
              {activeMembers.length} Active Records
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-sky-400" />
            {isTeamView ? `${teamScope} Team ` : ''}Attendance Intelligence & Analytics
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time turnout benchmarks, {isTeamView ? 'role distribution' : 'domain distribution'} & member participation
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center p-1 bg-[#050B14] rounded-md border border-white/10 self-start md:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'analytics', label: 'Executive Dashboard', icon: TrendingUp },
            { id: 'members', label: 'Member Matrix', icon: Users },
            { id: 'sessions', label: 'Session Pulse', icon: CalendarDays },
            { id: 'exports', label: 'Export Studio', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded text-xs font-bold font-mono uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-sky-500 text-white shadow-[0_0_16px_rgba(14,165,233,0.5)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAB 1: EXECUTIVE ANALYTICS DASHBOARD
         ══════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top 4 KPI Spotlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Overall Attendance Rate */}
            <SpotlightCard className="p-5 rect-card-hover-pop" spotlightColor="rgba(56, 189, 248, 0.25)">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Overall Turnout
                </span>
                <div className="p-2 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black font-mono text-white tracking-tight">
                  <AnimatedCounter value={overallStats.overallPct} suffix="%" decimals={1} />
                </div>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    overallStats.overallPct >= 75 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {overallStats.overallPct >= 75 ? '● Healthy' : '▲ Action Needed'}
                </span>
              </div>
              <div className="mt-3 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-1000"
                  style={{ width: `${Math.min(100, overallStats.overallPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2 flex items-center justify-between">
                <span>Weighted across all meetings</span>
                <span className="text-sky-300 font-bold">{overallStats.totalPresents} check-ins</span>
              </p>
            </SpotlightCard>

            {/* KPI 2: Total Sessions */}
            <SpotlightCard className="p-5 rect-card-hover-pop" spotlightColor="rgba(147, 51, 234, 0.25)">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Meeting Sessions
                </span>
                <div className="p-2 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black font-mono text-white tracking-tight">
                  <AnimatedCounter value={sessionStats.length} />
                </div>
                <span className="text-[11px] font-mono text-slate-400">Recorded</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  {overallStats.pastSessionsCount} Completed
                </span>
                {overallStats.upcomingSessionsCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    {overallStats.upcomingSessionsCount} Upcoming
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2">
                {isTeamView ? 'Team meetings & general calls' : 'Tracking all verticals & general calls'}
              </p>
            </SpotlightCard>

            {/* KPI 3: Monitored Members */}
            <SpotlightCard className="p-5 rect-card-hover-pop" spotlightColor="rgba(16, 185, 129, 0.25)">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Monitored Members
                </span>
                <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black font-mono text-white tracking-tight">
                  <AnimatedCounter value={members.length} />
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Active Roster</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                {isTeamView ? (
                  <span className="text-sky-300 font-bold">{teamScope} Team</span>
                ) : (
                  <>
                    <span>Distributed across</span>
                    <span className="text-sky-300 font-bold">{TEAM_ORDER.length} Domains</span>
                  </>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2">
                {isTeamView ? 'Your team roster only' : 'ERM, TECH, PR, DESIGN, AMBIANCE, MEDIA'}
              </p>
            </SpotlightCard>

            {/* KPI 4: Defaulters Warning */}
            <SpotlightCard className="p-5 rect-card-hover-pop" spotlightColor="rgba(244, 63, 94, 0.25)">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
                  Critical Defaulters
                </span>
                <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black font-mono text-rose-400 tracking-tight">
                  <AnimatedCounter value={overallStats.defaultersCount} />
                </div>
                <span className="text-[11px] font-mono text-rose-400/80">Below 75%</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Roster Impact:</span>
                <span className="font-bold text-rose-400">
                  {overallStats.totalMembers > 0
                    ? Math.round((overallStats.defaultersCount / overallStats.totalMembers) * 100)
                    : 0}
                  % of team
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('members');
                  setShowDefaultersOnly(true);
                }}
                className="mt-2 w-full text-center text-[10px] font-mono font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
              >
                Inspect Defaulter Roster →
              </button>
            </SpotlightCard>
          </div>

          {/* ══════════════════════════════════════════════
              ROW 2: VISUAL CHARTS
             ══════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Curved Line & Area Chart */}
            <div className="lg:col-span-2 rect-card-elevated p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-400" />
                    Session Attendance Trends
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Chronological turnout rate across completed sessions
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950/80 text-sky-300 border border-sky-500/30">
                  SVG Spline Curve
                </span>
              </div>

              {overallStats.pastSessions.length < 2 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-2">
                  <Activity className="w-8 h-8 text-slate-600" />
                  <span>At least 2 completed sessions are required to render trendline.</span>
                </div>
              ) : (
                <div className="relative w-full h-64 select-none">
                  {/* Floating tooltip on point hover */}
                  {hoveredSession && (
                    <div
                      className="absolute z-30 pointer-events-none p-3 rounded-md bg-[#050B14]/95 border border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)] text-xs font-mono"
                      style={{
                        left: `${Math.min(hoveredSession.x + 10, 480)}px`,
                        top: `${Math.max(hoveredSession.y - 80, 0)}px`,
                      }}
                    >
                      <p className="font-bold text-white truncate max-w-[200px]">
                        {hoveredSession.stat.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{hoveredSession.stat.date}</span>
                        <span>•</span>
                        <span className="text-sky-300 font-bold">{sessionTeamLabel(hoveredSession.stat.team)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-4 pt-1.5 border-t border-white/10">
                        <span className="text-slate-400">Turnout:</span>
                        <span className="font-bold text-emerald-400">{hoveredSession.stat.presentPct}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                        <span>Present: {hoveredSession.stat.present}</span>
                        <span>Informed: {hoveredSession.stat.informed}</span>
                        <span>Absent: {hoveredSession.stat.absent}</span>
                      </div>
                    </div>
                  )}

                  {/* Responsive SVG Line Chart */}
                  {(() => {
                    const W = 620;
                    const H = 210;
                    const padX = 40;
                    const padY = 25;
                    const innerW = W - padX * 2;
                    const innerH = H - padY * 2;
                    const past = overallStats.pastSessions;

                    const points = past.map((s, i) => {
                      const x = padX + (i / (past.length - 1)) * innerW;
                      const y = padY + innerH - (s.presentPct / 100) * innerH;
                      return { x, y, s };
                    });

                    let linePath = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 0; i < points.length - 1; i++) {
                      const curr = points[i];
                      const next = points[i + 1];
                      const cpX = (curr.x + next.x) / 2;
                      linePath += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
                    }

                    const areaPath = `${linePath} L ${points[points.length - 1].x} ${
                      padY + innerH
                    } L ${points[0].x} ${padY + innerH} Z`;

                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
                          </linearGradient>
                          <filter id="glowLine" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Grid horizontal lines */}
                        {[0, 25, 50, 75, 100].map((pct) => {
                          const y = padY + innerH - (pct / 100) * innerH;
                          return (
                            <g key={pct}>
                              <line
                                x1={padX}
                                y1={y}
                                x2={padX + innerW}
                                y2={y}
                                stroke="rgba(255, 255, 255, 0.08)"
                                strokeDasharray={pct === 75 ? '3 3' : undefined}
                                strokeWidth={pct === 75 ? '1.5' : '1'}
                              />
                              <text
                                x={padX - 8}
                                y={y + 3.5}
                                textAnchor="end"
                                fontSize="9"
                                fill={pct === 75 ? '#38BDF8' : '#64748B'}
                                fontFamily="monospace"
                              >
                                {pct}%
                              </text>
                            </g>
                          );
                        })}

                        {/* Benchmark Line (75% threshold) */}
                        <text
                          x={padX + innerW}
                          y={padY + innerH - 0.75 * innerH - 4}
                          textAnchor="end"
                          fontSize="9"
                          fill="#38BDF8"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          75% Benchmark
                        </text>

                        <path d={areaPath} fill="url(#areaGradient)" />

                        <path
                          d={linePath}
                          fill="none"
                          stroke="#38BDF8"
                          strokeWidth="2.5"
                          filter="url(#glowLine)"
                        />

                        {points.map((p) => (
                          <g
                            key={p.s.id}
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              setHoveredSession({ stat: p.s, x: p.x, y: p.y });
                            }}
                            onMouseLeave={() => setHoveredSession(null)}
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="8"
                              fill="#0EA5E9"
                              fillOpacity="0.2"
                              className="animate-pulse"
                            />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={hoveredSession?.stat.id === p.s.id ? '5' : '3.5'}
                              fill={p.s.presentPct >= 75 ? '#34D399' : '#F43F5E'}
                              stroke="#050B14"
                              strokeWidth="2"
                              className="transition-all duration-200"
                            />
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Chart 2: Attendance Distribution Donut Chart */}
            <div className="rect-card-elevated p-6 flex flex-col justify-between">
              <div className="pb-3 border-b border-white/10 mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                  Roster Performance Tiers
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Member distribution by attendance threshold
                </p>
              </div>

              <div className="flex flex-col items-center justify-center my-auto">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  {(() => {
                    const radius = 64;
                    const circumference = 2 * Math.PI * radius;
                    const total = Math.max(1, overallStats.totalMembers);

                    const lenOutstanding = (overallStats.outstandingCount / total) * circumference;
                    const lenConsistent = (overallStats.consistentCount / total) * circumference;
                    const lenDefaulters = (overallStats.defaultersCount / total) * circumference;

                    const offsetOutstanding = 0;
                    const offsetConsistent = -lenOutstanding;
                    const offsetDefaulters = -(lenOutstanding + lenConsistent);

                    return (
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r={radius} fill="transparent" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="14" />
                        <circle
                          cx="80" cy="80" r={radius} fill="transparent" stroke="#10B981" strokeWidth="14"
                          strokeDasharray={`${lenOutstanding} ${circumference}`}
                          strokeDashoffset={offsetOutstanding}
                          className="transition-all duration-1000"
                        />
                        <circle
                          cx="80" cy="80" r={radius} fill="transparent" stroke="#38BDF8" strokeWidth="14"
                          strokeDasharray={`${lenConsistent} ${circumference}`}
                          strokeDashoffset={offsetConsistent}
                          className="transition-all duration-1000"
                        />
                        <circle
                          cx="80" cy="80" r={radius} fill="transparent" stroke="#F43F5E" strokeWidth="14"
                          strokeDasharray={`${lenDefaulters} ${circumference}`}
                          strokeDashoffset={offsetDefaulters}
                          className="transition-all duration-1000"
                        />
                      </svg>
                    );
                  })()}

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black font-mono text-white tracking-tight">
                      <AnimatedCounter value={overallStats.overallPct} suffix="%" decimals={1} />
                    </span>
                    <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400">
                      Overall Turnout
                    </span>
                  </div>
                </div>

                <div className="w-full mt-4 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-950/20 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
                      <span className="text-slate-300">Outstanding (≥90%)</span>
                    </div>
                    <span className="font-bold text-emerald-400">{overallStats.outstandingCount} members</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-sky-950/20 border border-sky-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8]" />
                      <span className="text-slate-300">Consistent (75-89%)</span>
                    </div>
                    <span className="font-bold text-sky-300">{overallStats.consistentCount} members</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-rose-950/20 border border-rose-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_#F43F5E]" />
                      <span className="text-slate-300">Defaulters (&lt;75%)</span>
                    </div>
                    <span className="font-bold text-rose-400">{overallStats.defaultersCount} members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              ROW 3: DOMAIN CARD + ROLE CARD (role card follows the selected domain)
             ══════════════════════════════════════════════ */}
          <div className={`grid grid-cols-1 ${isTeamView ? '' : 'lg:grid-cols-2'} gap-6`}>
            {/* Domain card (admin only) */}
            {!isTeamView && (
              <div className="rect-card-elevated p-6">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Domain Turnout Benchmarks
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Select a domain to see its role-wise stats
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Expected = meetings × members</span>
                </div>

                <div className="space-y-2.5">
                  {[allDomains, ...domainBreakdown].map((d) => {
                    const isAll = d.label === 'ALL';
                    const selected = activeDomain === d.label;
                    const hasData = d.expected > 0;
                    const healthy = hasData && d.pct >= 75;
                    return (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => setSelectedDomain(d.label)}
                        aria-pressed={selected}
                        className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer ${
                          selected
                            ? 'bg-sky-500/10 border-sky-400/70 shadow-[0_0_18px_rgba(14,165,233,0.18)]'
                            : 'bg-[#050B14]/80 border-white/5 hover:border-sky-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 rounded font-bold border text-[10px] ${
                              selected
                                ? 'bg-sky-500 text-white border-sky-300'
                                : 'bg-sky-950/80 text-sky-300 border-sky-500/30'
                            }`}>
                              {isAll ? 'ALL DOMAINS' : d.label}
                            </span>
                            <span className="text-slate-400 truncate">
                              {d.memberCount} members · {d.meetings} {isAll ? 'meetings total' : 'meetings'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {hasData && (
                              <span className="text-slate-400 hidden sm:inline">
                                <strong className="text-emerald-400">{d.present}</strong> / {d.expected}
                                {d.informed > 0 && <span className="text-amber-400"> · {d.informed} inf</span>}
                              </span>
                            )}
                            <span className={`font-black text-sm ${!hasData ? 'text-slate-500' : healthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {hasData ? `${d.pct}%` : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full transition-all duration-700 ${
                              healthy ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, d.pct)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Role card: follows the selected domain */}
            <div className="rect-card-elevated p-6 self-start">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    Role Attendance Analysis
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {activeDomain === 'ALL'
                      ? 'Roles across all domains'
                      : `Roles in ${activeDomain}`}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-sky-500 text-white border border-sky-300 text-[11px] font-mono font-bold uppercase tracking-wider shrink-0">
                  {activeDomain === 'ALL' ? 'All Domains' : activeDomain}
                </span>
              </div>

              {activeDetail && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center font-mono mb-4">
                  <div className="p-2 rounded bg-white/[0.03] border border-white/5">
                    <div className="text-sm font-bold text-white">
                      {activeDetail.meetings}
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase">{activeDomain === 'ALL' ? 'Total Meetings' : 'Meetings'}</span>
                  </div>
                  <div className="p-2 rounded bg-white/[0.03] border border-white/5">
                    <div className="text-sm font-bold text-sky-300">{activeDetail.expected}</div>
                    <span className="text-[9px] text-slate-500 uppercase">Expected</span>
                  </div>
                  <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/20">
                    <div className="text-sm font-bold text-emerald-400">{activeDetail.present}</div>
                    <span className="text-[9px] text-slate-500 uppercase">Present</span>
                  </div>
                  <div className="p-2 rounded bg-amber-950/30 border border-amber-500/20">
                    <div className="text-sm font-bold text-amber-400">{activeDetail.informed}</div>
                    <span className="text-[9px] text-slate-500 uppercase">Informed</span>
                  </div>
                  <div className="p-2 rounded bg-rose-950/30 border border-rose-500/20">
                    <div className="text-sm font-bold text-rose-400">{activeDetail.absent}</div>
                    <span className="text-[9px] text-slate-500 uppercase">Absent</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {activeRoles.length === 0 ? (
                  <p className="py-8 text-center text-xs font-mono text-slate-500">No members in this domain.</p>
                ) : (
                  activeRoles.map((r) => {
                    const rHas = r.expected > 0;
                    const rHealthy = rHas && r.pct >= 75;
                    return (
                      <div key={r.label} className="p-3 rounded-md bg-[#050B14]/80 border border-white/5">
                        <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ROLE_STYLE[r.label] || 'bg-slate-800 text-slate-300'}`}>
                              {r.label}
                            </span>
                            <span className="text-slate-400">
                              {r.memberCount} personnel{activeDomain !== 'ALL' && ` × ${r.meetings}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {rHas && (
                              <span className="text-slate-400 hidden sm:inline">
                                <strong className="text-emerald-400">{r.present}</strong> / {r.expected} expected
                                {r.informed > 0 && <span className="text-amber-400"> · {r.informed} inf</span>}
                              </span>
                            )}
                            <span className={`font-black text-sm ${!rHas ? 'text-slate-500' : rHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {rHas ? `${r.pct}%` : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full transition-all duration-700 ${
                              rHealthy ? 'bg-gradient-to-r from-sky-500 to-indigo-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2: MEMBER MATRIX & DRILLDOWN
         ══════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="rect-card-elevated p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                Member Intelligence Matrix
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Detailed attendance stats per individual with View-Only history drilldown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, role, dept..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="rect-input w-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
              </div>

              <button
                onClick={() => setShowDefaultersOnly(!showDefaultersOnly)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  showDefaultersOnly
                    ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)] border border-rose-400'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {showDefaultersOnly ? '● Defaulters (<75%) Active' : 'Show <75% Only'}
              </button>

              <div className="flex items-center gap-1.5 bg-[#050B14] px-2.5 py-1 rounded border border-white/10 text-xs font-mono">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-slate-300 font-mono text-xs focus:outline-none cursor-pointer"
                >
                  <option value="pct_desc" className="bg-[#050B14]">Turnout (High → Low)</option>
                  <option value="pct_asc" className="bg-[#050B14]">Turnout (Low → High)</option>
                  <option value="name" className="bg-[#050B14]">Name (A → Z)</option>
                  <option value="role" className="bg-[#050B14]">Role Hierarchy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vertical Tabs Filter (admin only) */}
          {!isTeamView && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
              {['ALL', ...TEAM_ORDER].map((vertical) => {
                const active = selectedVertical === vertical;
                return (
                  <button
                    key={vertical}
                    onClick={() => setSelectedVertical(vertical)}
                    className={`px-3 py-1 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {vertical}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-2.5 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {filteredMembers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono text-xs">
                No members found matching the specified filters.
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isHealthy = m.presentPct >= 75;
                const memberData = members.find((x) => x.id === m.memberId) || {
                  id: m.memberId,
                  name: m.name,
                  team: m.team,
                  role: m.role,
                  rollNo: m.rollNo,
                  department: m.department,
                  year: m.year,
                  phone: m.phone,
                };

                return (
                  <div
                    key={m.memberId}
                    className="rect-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center text-white text-xs font-black shrink-0"
                        style={{ background: avatarColor(m.name) }}
                      >
                        {m.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm truncate">{m.name}</p>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${ROLE_STYLE[m.role.toUpperCase()] || 'bg-slate-800 text-slate-300'}`}>
                            {m.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                          {!isTeamView && <span className="text-sky-300 font-semibold">{m.team}</span>}
                          {m.rollNo && <span>{isTeamView ? '' : '• '}{m.rollNo}</span>}
                          {m.department && <span>{isTeamView && !m.rollNo ? '' : '• '}{m.department}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-right font-mono text-xs">
                        <div className="text-slate-300">
                          <span className="text-emerald-400 font-bold">{m.present}</span> Present · <span className="text-amber-400 font-bold">{m.informed}</span> Informed · <span className="text-rose-400 font-bold">{m.absent}</span> Absent
                        </div>
                        <span className="text-[10px] text-slate-500">out of {m.total} sessions</span>
                      </div>

                      <div className="flex flex-col items-end gap-1 w-20">
                        <span className={`font-mono font-black text-sm ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.presentPct}%
                        </span>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, m.presentPct)}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenMemberView(memberData)}
                        title="View Attendance History (Read-Only)"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold font-mono uppercase tracking-wider cursor-pointer transition-colors shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3: SESSION PULSE
         ══════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="rect-card-elevated p-6 space-y-4">
          <div className="pb-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-400" />
                Session Pulse Log
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Attendance results logged per meeting session
              </p>
            </div>
            <span className="px-3 py-1 rounded bg-sky-950 text-sky-300 border border-sky-500/30 text-xs font-mono font-bold">
              {sessionStats.length} Total Sessions
            </span>
          </div>

          <div className="space-y-3 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
            {sessionStats.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono text-xs">
                No session logs recorded yet.
              </div>
            ) : (
              sessionStats.map((session) => (
                <div
                  key={session.id}
                  className="rect-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-sky-500/40 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)] transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-md bg-[#0C1E38] border border-sky-500/30 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-sky-400 uppercase leading-none mb-0.5">
                        {new Date(`${session.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-lg font-black text-white leading-none font-mono">
                        {new Date(`${session.date}T00:00:00`).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-[#0C1E38] text-sky-300 border border-sky-500/30 rounded-sm text-[9px] font-bold font-mono uppercase">
                          {sessionTeamLabel(session.team)}
                        </span>
                        <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                          {session.sessionSlot || 'FN'}
                        </span>
                        {session.upcoming && (
                          <span className="px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-500/30">
                            Upcoming
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-white text-sm truncate">{session.title}</h4>
                      {session.notes && (
                        <p className="text-xs text-slate-400 font-mono line-clamp-1 mt-0.5">
                          {session.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 font-mono text-xs">
                    {session.upcoming ? (
                      <span className="text-xs text-indigo-300 font-mono">
                        {opensLabel(session as any)}
                      </span>
                    ) : (
                      <>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">{session.present}</span> Present · <span className="text-amber-400 font-bold">{session.informed}</span> Informed · <span className="text-rose-400 font-bold">{session.absent}</span> Absent
                          <p className="text-[10px] text-slate-500">{session.targetCount} target members</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 w-20">
                          <span className={`font-black text-sm ${session.presentPct >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {session.presentPct}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                            <div
                              className={`h-full ${session.presentPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, session.presentPct)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4: DATA EXPORT STUDIO
         ══════════════════════════════════════════════ */}
      {activeTab === 'exports' && (
        <div className="rect-card-elevated p-6 space-y-6">
          <div className="pb-4 border-b border-white/10">
            <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-400" />
              Data Export & Reporting Studio
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Export comprehensive dataset extracts for compliance, faculty reporting, or archiving
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-5 flex flex-col justify-between" spotlightColor="rgba(56, 189, 248, 0.2)">
              <div>
                <div className="p-2.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 w-fit mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wide mb-1">
                  Member Directory Extract
                </h3>
                <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                  Clean CSV extract containing name, vertical, role, roll number, department, year, and phone contacts.
                </p>
              </div>
              <button
                onClick={downloadMembersCSV}
                className="btn-sky-glow w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Members CSV</span>
              </button>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between" spotlightColor="rgba(16, 185, 129, 0.2)">
              <div>
                <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 w-fit mb-3">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wide mb-1">
                  Attendance Metrics Matrix
                </h3>
                <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                  Comprehensive performance log with total sessions, present, informed and absent counts, and turnout %.
                </p>
              </div>
              <button
                onClick={downloadAttendanceCSV}
                className="btn-rect-secondary w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Export Attendance CSV</span>
              </button>
            </SpotlightCard>

            <SpotlightCard className="p-5 flex flex-col justify-between" spotlightColor="rgba(168, 85, 247, 0.2)">
              <div>
                <div className="p-2.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 w-fit mb-3">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wide mb-1">
                  Session Pulse History
                </h3>
                <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                  Chronological log of every held meeting, {isTeamView ? 'team' : 'target vertical'}, slot (FN/AN), and turnout counts.
                </p>
              </div>
              <button
                onClick={downloadSessionsCSV}
                className="btn-rect-secondary w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer border-purple-500/40 text-purple-300 hover:bg-purple-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Export Sessions CSV</span>
              </button>
            </SpotlightCard>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MEMBER ATTENDANCE HISTORY DRILLDOWN MODAL
         ══════════════════════════════════════════════ */}
      {viewMember && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="rect-card-elevated max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                    Attendance History
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-mono font-bold">
                    <Eye className="w-3 h-3" /> View Mode (Read-Only)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Detailed session attendance record for member
                </p>
              </div>
              <button
                onClick={() => {
                  setViewMember(null);
                  setMemberHistory(null);
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-2 shadow-[0_0_12px_rgba(14,165,233,0.4)]" />
                  <p className="text-xs font-mono text-sky-300">Loading attendance details...</p>
                </div>
              ) : memberHistory ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-md rect-card bg-[#0B172B]/70">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: avatarColor(memberHistory.member.name) }}
                    >
                      {memberHistory.member.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {memberHistory.member.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold font-mono uppercase tracking-wider ${ROLE_STYLE[memberHistory.member.role] || ''}`}>
                          {memberHistory.member.role}
                        </span>
                        {memberHistory.member.rollNo && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {memberHistory.member.rollNo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono text-sky-400">
                        {memberHistory.stats.presentPct}%
                      </span>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Turnout</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2.5 rounded-sm rect-card bg-white/[0.02]">
                      <div className="text-xs font-bold text-slate-200">{memberHistory.stats.total}</div>
                      <span className="text-[9px] text-slate-500 uppercase">Total</span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                      <div className="text-xs font-bold">{memberHistory.stats.present}</div>
                      <span className="text-[9px] uppercase">Present</span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-amber-950/40 border border-amber-500/30 text-amber-400">
                      <div className="text-xs font-bold">{memberHistory.stats.informed}</div>
                      <span className="text-[9px] uppercase">Informed</span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-rose-950/40 border border-rose-500/30 text-rose-400">
                      <div className="text-xs font-bold">{memberHistory.stats.absent}</div>
                      <span className="text-[9px] uppercase">Absent</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                      Meeting Logs
                    </h4>
                    {memberHistory.history.length === 0 ? (
                      <p className="text-xs text-slate-500 font-mono py-6 text-center">
                        No meeting attendance recorded for this member yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {memberHistory.history.map((h, i) => {
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
                              <span
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase ${
                                  h.status === 'PRESENT'
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                    : h.status === 'INFORMED'
                                    ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-900 text-slate-400 border border-slate-700/40'
                                }`}
                              >
                                {h.status === 'PRESENT' ? 'Present' : h.status === 'INFORMED' ? 'Informed' : 'Absent'}
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

            <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] text-right">
              <button
                onClick={() => {
                  setViewMember(null);
                  setMemberHistory(null);
                }}
                className="btn-rect-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}