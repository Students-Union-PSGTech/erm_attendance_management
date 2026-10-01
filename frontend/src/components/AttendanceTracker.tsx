import React, { useState, useMemo } from 'react';
import {
  AuthUser,
  TeamMember,
  TeamType,
  AttendanceSession,
  AttendanceStatus,
  AttendanceEntry,
  SessionSlot,
} from '../types';
import { TEAMS, TEAM_COLORS } from '../data/initialData';
import { MonthlyAttendanceHeatmap } from './MonthlyAttendanceHeatmap';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Search,
  Download,
  Plus,
  Trash2,
  Save,
  Users,
  BarChart3,
  CheckCheck,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Info,
  Printer,
  Flame,
  TrendingUp,
  ArrowRight,
  UserX,
  Phone,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

interface AttendanceTrackerProps {
  user: AuthUser;
  members: TeamMember[]; // Available / visible members
  allMembers: TeamMember[]; // Full roster
  sessions: AttendanceSession[];
  onSaveSession: (session: AttendanceSession) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  selectedTeam: TeamType | 'ALL';
  onSelectTeam?: (team: TeamType | 'ALL') => void;
  showToast: (msg: string) => void;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    icon: React.ElementType;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    activeBg: string;
  }
> = {
  PRESENT: {
    label: 'Present',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    activeBg: 'bg-emerald-600 text-white',
  },
  ABSENT: {
    label: 'Absent',
    icon: XCircle,
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800',
    activeBg: 'bg-rose-600 text-white',
  },
  INFORMED: {
    label: 'Informed',
    icon: Info,
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-200 dark:border-sky-800',
    activeBg: 'bg-sky-600 text-white',
  },
};

export function normalizeStatus(st?: string): AttendanceStatus | undefined {
  if (!st) return undefined;
  if (st === 'PRESENT') return 'PRESENT';
  if (st === 'ABSENT') return 'ABSENT';
  if (st === 'INFORMED') return 'INFORMED';
  if (st === 'LATE') return 'PRESENT';
  if (st === 'EXCUSED') return 'INFORMED';
  return 'ABSENT';
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSessionDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  user,
  members,
  allMembers,
  sessions,
  onSaveSession,
  onDeleteSession,
  selectedTeam,
  onSelectTeam,
  showToast,
}) => {
  const isAdmin = user.role === 'admin';
  const defaultTeamScope: TeamType | 'ALL' = isAdmin ? selectedTeam : (user.team || 'ALL');

  // Active view inside attendance tracker: 'session' | 'absentees' | 'analytics' | 'history'
  const [activeSubTab, setActiveSubTab] = useState<'session' | 'absentees' | 'analytics' | 'history'>('session');

  // Selected or active attendance session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Form states for the current session being taken or edited
  const [sessionDate, setSessionDate] = useState<string>(getTodayString());
  const [sessionSlot, setSessionSlot] = useState<SessionSlot>('FN');
  const [sessionTitle, setSessionTitle] = useState<string>('General Team Meeting');
  const [sessionTeam, setSessionTeam] = useState<TeamType | 'ALL'>(defaultTeamScope);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [records, setRecords] = useState<Record<string, AttendanceEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');
  const [editingNoteMemberId, setEditingNoteMemberId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Additional states for absentees and low attendance views
  const [lowAttendanceOnly, setLowAttendanceOnly] = useState(false);
  const [absenteeSearch, setAbsenteeSearch] = useState('');
  const [absenteeTeamFilter, setAbsenteeTeamFilter] = useState<TeamType | 'ALL'>('ALL');
  const [copiedAbsentees, setCopiedAbsentees] = useState(false);
  const [analyticsFilter, setAnalyticsFilter] = useState<'ALL' | 'SHORTAGE' | 'ELIGIBLE'>('ALL');
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  // When activeSessionId changes, populate form
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  // Handle switching to a session
  const loadSession = (session: AttendanceSession) => {
    setActiveSessionId(session.id);
    setSessionDate(session.date);
    setSessionSlot(session.sessionSlot || 'FN');
    setSessionTitle(session.title);
    setSessionTeam(session.team);
    setSessionNotes(session.notes || '');
    setRecords(session.records || {});
    setActiveSubTab('session');
  };

  // Handle Date change and automatically check for matching Date + FN/AN session
  const handleDateChange = (newDate: string) => {
    setSessionDate(newDate);
    const matching = sessions.find(
      (s) => s.date === newDate && (s.sessionSlot || 'FN') === sessionSlot && s.team === sessionTeam
    );
    if (matching) {
      setActiveSessionId(matching.id);
      setSessionTitle(matching.title);
      setSessionNotes(matching.notes || '');
      setRecords(matching.records || {});
      showToast(`Loaded existing ${sessionSlot} session for ${newDate}.`);
    } else if (activeSessionId) {
      setActiveSessionId(null);
      setRecords({});
    }
  };

  // Handle FN / AN slot change after selecting date
  const handleSlotChange = (newSlot: SessionSlot) => {
    setSessionSlot(newSlot);
    const matching = sessions.find(
      (s) => s.date === sessionDate && (s.sessionSlot || 'FN') === newSlot && s.team === sessionTeam
    );
    if (matching) {
      setActiveSessionId(matching.id);
      setSessionTitle(matching.title);
      setSessionNotes(matching.notes || '');
      setRecords(matching.records || {});
      showToast(`Loaded existing ${newSlot} session for ${sessionDate}.`);
    } else if (activeSessionId) {
      setActiveSessionId(null);
      setRecords({});
      showToast(`Switched to new ${newSlot} (${newSlot === 'FN' ? 'Forenoon' : 'Afternoon'}) sheet for ${sessionDate}.`);
    }
  };

  // Start a fresh new session
  const handleStartNewSession = () => {
    setActiveSessionId(null);
    setSessionDate(getTodayString());
    setSessionSlot('FN');
    setSessionTitle('Weekly Team Meeting');
    setSessionTeam(isAdmin ? (selectedTeam === 'ALL' ? 'ALL' : selectedTeam) : (user.team || 'ALL'));
    setSessionNotes('');
    setRecords({});
    setSearchQuery('');
    setStatusFilter('ALL');
    setActiveSubTab('session');
    showToast('Started new attendance sheet.');
  };

  // Eligible members for current session
  const eligibleMembers = useMemo(() => {
    const targetTeam = sessionTeam;
    let pool = allMembers;

    if (!isAdmin && user.team) {
      pool = allMembers.filter((m) => m.team === user.team);
    } else if (targetTeam !== 'ALL') {
      pool = allMembers.filter((m) => m.team === targetTeam);
    }

    return pool;
  }, [allMembers, sessionTeam, isAdmin, user.team]);

  // Filtered members by search and status filter
  const displayedMembers = useMemo(() => {
    return eligibleMembers.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.rollNo && m.rollNo.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        m.role.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      const status = normalizeStatus(records[m.id]?.status);
      return status === statusFilter;
    });
  }, [eligibleMembers, searchQuery, statusFilter, records]);

  // Attendance metrics for current session
  const metrics = useMemo(() => {
    const total = eligibleMembers.length;
    let present = 0;
    let absent = 0;
    let informed = 0;
    let unrecorded = 0;

    for (const m of eligibleMembers) {
      const rec = records[m.id];
      const st = normalizeStatus(rec?.status);
      if (!st) {
        unrecorded++;
      } else if (st === 'PRESENT') {
        present++;
      } else if (st === 'ABSENT') {
        absent++;
      } else if (st === 'INFORMED') {
        informed++;
      }
    }

    const recordedTotal = present + absent + informed;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, informed, unrecorded, recordedTotal, rate };
  }, [eligibleMembers, records]);

  // Mark a single member's status
  const handleSetStatus = (memberId: string, status: AttendanceStatus) => {
    setRecords((prev) => {
      const existing = prev[memberId];
      if (existing?.status === status) {
        // Toggle off if already active
        const copy = { ...prev };
        delete copy[memberId];
        return copy;
      }
      return {
        ...prev,
        [memberId]: {
          status,
          ...(existing?.notes ? { notes: existing.notes } : {}),
          markedAt: new Date().toISOString(),
        },
      };
    });
  };

  // Bulk actions
  const handleMarkAll = (status: AttendanceStatus) => {
    setRecords((prev) => {
      const next = { ...prev };
      for (const m of eligibleMembers) {
        const existingNotes = prev[m.id]?.notes;
        next[m.id] = {
          status,
          ...(existingNotes ? { notes: existingNotes } : {}),
          markedAt: new Date().toISOString(),
        };
      }
      return next;
    });
    showToast(`Marked all ${eligibleMembers.length} members as ${STATUS_CONFIG[status].label}.`);
  };

  // Mark unentered/unmarked members as Absent
  const handleMarkUnrecordedAsAbsent = () => {
    let count = 0;
    setRecords((prev) => {
      const next = { ...prev };
      for (const m of eligibleMembers) {
        const st = normalizeStatus(next[m.id]?.status);
        if (!st) {
          const existingNotes = next[m.id]?.notes;
          next[m.id] = {
            status: 'ABSENT',
            ...(existingNotes ? { notes: existingNotes } : {}),
            markedAt: new Date().toISOString(),
          };
          count++;
        }
      }
      return next;
    });
    showToast(`Marked ${count} unentered members as Absent.`);
  };

  const handleClearAll = () => {
    setRecords({});
    showToast('Cleared attendance markings for this session.');
  };

  // Save member note
  const handleSaveMemberNote = (memberId: string) => {
    setRecords((prev) => {
      const existing = prev[memberId] || { status: 'ABSENT' as AttendanceStatus };
      const trimmed = noteInput.trim();
      const updatedEntry: AttendanceEntry = {
        status: existing.status,
        ...(existing.markedAt ? { markedAt: existing.markedAt } : {}),
        ...(trimmed ? { notes: trimmed } : {}),
      };
      return {
        ...prev,
        [memberId]: updatedEntry,
      };
    });
    setEditingNoteMemberId(null);
    setNoteInput('');
    showToast('Saved member note.');
  };

  // Save session to Cloud Firestore (Auto-defaults unentered to ABSENT as required)
  const handleSaveToCloud = async () => {
    if (!sessionTitle.trim()) {
      showToast('Please enter a session title.');
      return;
    }

    setIsSaving(true);
    try {
      const sessionId =
        activeSessionId ||
        `att-${sessionDate}-${sessionSlot.toLowerCase()}-${sessionTeam.toLowerCase()}-${Date.now().toString(36)}`;

      // Auto-default any member not entered (no status or unmarked) to ABSENT
      const processedRecords: Record<string, AttendanceEntry> = {};
      for (const [mId, rec] of Object.entries(records)) {
        if (!rec) continue;
        processedRecords[mId] = {
          status: rec.status,
          ...(rec.notes ? { notes: rec.notes } : {}),
          ...(rec.markedAt ? { markedAt: rec.markedAt } : {}),
        };
      }
      let autoAbsentCount = 0;
      for (const m of eligibleMembers) {
        const existing = processedRecords[m.id];
        const st = normalizeStatus(existing?.status);
        if (!st) {
          processedRecords[m.id] = {
            status: 'ABSENT',
            ...(existing?.notes ? { notes: existing.notes } : {}),
            markedAt: new Date().toISOString(),
          };
          autoAbsentCount++;
        }
      }

      setRecords(processedRecords);

      const sessionObj: AttendanceSession = {
        id: sessionId,
        date: sessionDate,
        sessionSlot,
        title: sessionTitle.trim(),
        team: sessionTeam,
        records: processedRecords,
        notes: sessionNotes.trim() || undefined,
        createdBy: user.username,
        createdAt: currentSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveSession(sessionObj);
      setActiveSessionId(sessionId);
      if (autoAbsentCount > 0) {
        showToast(`Saved session! ${autoAbsentCount} unentered members marked as Absent.`);
      } else {
        showToast('Attendance session successfully saved to Cloud Firestore!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save attendance session.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export session to CSV
  const handleExportSessionCsv = () => {
    const rows = [
      ['Attendance Report', sessionTitle],
      ['Date', sessionDate],
      ['Session Slot', `${sessionSlot} (${sessionSlot === 'FN' ? 'Forenoon' : 'Afternoon'})`],
      ['Team Scope', sessionTeam],
      ['Total Members', String(eligibleMembers.length)],
      ['Present', String(metrics.present)],
      ['Informed', String(metrics.informed)],
      ['Absent', String(metrics.absent)],
      ['Attendance Rate', `${metrics.rate}%`],
      ['Generated At', new Date().toLocaleString()],
      [],
      ['Roll No', 'Name', 'Team', 'Role', 'Department', 'Year', 'Attendance Status', 'Notes'],
    ];

    for (const m of eligibleMembers) {
      const rec = records[m.id];
      const status = normalizeStatus(rec?.status) || 'ABSENT';
      const notes = rec?.notes || '';
      rows.push([
        m.rollNo || 'N/A',
        m.name,
        m.team,
        m.role,
        m.department || 'N/A',
        m.year || 'N/A',
        status,
        notes,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `attendance_${sessionDate}_${sessionSlot.toLowerCase()}_${sessionTeam.toLowerCase()}_${sessionTitle.toLowerCase().replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported session attendance report to CSV.');
  };

  // Export complete member attendance summary across all historical sessions
  const handleExportAggregateCsv = () => {
    if (sessions.length === 0) {
      showToast('No saved attendance sessions available to aggregate.');
      return;
    }

    const headers = ['Roll No', 'Name', 'Team', 'Role', 'Department', 'Year'];
    // Add date column for each session
    sessions.forEach((s) => {
      headers.push(`${s.date} [${s.sessionSlot || 'FN'}] (${s.title})`);
    });
    headers.push('Total Present', 'Total Informed', 'Total Absent', 'Total Sessions Held', 'Attendance %', 'Below 75% Status');

    const rows = [headers];

    for (const m of members) {
      const row = [
        m.rollNo || 'N/A',
        m.name,
        m.team,
        m.role,
        m.department || 'N/A',
        m.year || 'N/A',
      ];

      let presentCount = 0;
      let informedCount = 0;
      let absentCount = 0;
      let eligibleSessionCount = 0;

      for (const s of sessions) {
        const isEligible = s.team === 'ALL' || s.team === m.team;
        if (isEligible) {
          eligibleSessionCount++;
          const rec = s.records[m.id];
          const st = normalizeStatus(rec?.status) || 'ABSENT';
          row.push(st);
          if (st === 'PRESENT') {
            presentCount++;
          } else if (st === 'INFORMED') {
            informedCount++;
          } else {
            absentCount++;
          }
        } else {
          row.push('N/A (Other Team)');
        }
      }

      const pctNum = eligibleSessionCount > 0 ? Math.round((presentCount / eligibleSessionCount) * 100) : 0;
      const pct = `${pctNum}%`;
      const below75 = pctNum < 75 ? 'SHORTAGE (<75%)' : 'Eligible (>=75%)';

      row.push(String(presentCount), String(informedCount), String(absentCount), String(eligibleSessionCount), pct, below75);
      rows.push(row);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `overall_attendance_matrix_${getTodayString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported overall attendance matrix to CSV.');
  };

  // Historical sessions relevant to user
  const visibleSessions = useMemo(() => {
    if (isAdmin) {
      if (selectedTeam === 'ALL') return sessions;
      return sessions.filter((s) => s.team === 'ALL' || s.team === selectedTeam);
    }
    return sessions.filter((s) => s.team === 'ALL' || s.team === user.team);
  }, [sessions, isAdmin, selectedTeam, user.team]);

  // Chronologically sorted sessions (latest date & time first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      const timeA = a.createdAt || a.updatedAt || '';
      const timeB = b.createdAt || b.updatedAt || '';
      return timeB.localeCompare(timeA);
    });
  }, [sessions]);

  // Determine the most recent session
  const mostRecentSession = useMemo(() => {
    const pool = (!isAdmin || selectedTeam !== 'ALL') ? visibleSessions : sessions;
    if (pool.length > 0) {
      return [...pool].sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        const timeA = a.createdAt || a.updatedAt || '';
        const timeB = b.createdAt || b.updatedAt || '';
        return timeB.localeCompare(timeA);
      })[0];
    }
    return sortedSessions[0] || null;
  }, [visibleSessions, sessions, isAdmin, selectedTeam, sortedSessions]);

  // Statistics for the most recent session
  const recentSessionMetrics = useMemo(() => {
    if (!mostRecentSession) return null;

    const recordsMap = mostRecentSession.records || {};
    const entries = Object.values(recordsMap);
    const totalMarked = entries.length;

    // Eligible members in the session's team scope
    const sessionEligible = allMembers.filter(
      (m) => mostRecentSession.team === 'ALL' || m.team === mostRecentSession.team
    );
    const rosterCount = sessionEligible.length;

    const presentOnly = entries.filter((r) => normalizeStatus(r.status) === 'PRESENT').length;
    const informedOnly = entries.filter((r) => normalizeStatus(r.status) === 'INFORMED').length;
    const absentCount = entries.filter((r) => normalizeStatus(r.status) === 'ABSENT').length;
    const totalPresent = presentOnly;

    // Base denominator: prioritize marked count if available, otherwise roster count
    const baseTotal = totalMarked > 0 ? totalMarked : (rosterCount > 0 ? rosterCount : 0);
    const presentPercentage = baseTotal > 0 ? Math.round((totalPresent / baseTotal) * 100) : 0;

    return {
      session: mostRecentSession,
      totalMarked,
      rosterCount,
      baseTotal,
      presentOnly,
      informedOnly,
      absentCount,
      totalPresent,
      presentPercentage,
    };
  }, [mostRecentSession, allMembers]);

  // Members who did not attend the most recent session (status === 'ABSENT' or unentered/unmarked)
  const lastMeetingAbsentees = useMemo(() => {
    if (!mostRecentSession) return [];

    const sessionEligible = allMembers.filter(
      (m) => mostRecentSession.team === 'ALL' || m.team === mostRecentSession.team
    );

    const list: Array<{
      member: TeamMember;
      status: 'ABSENT' | 'INFORMED' | 'NOT_ENTERED';
      notes?: string;
      consecutiveMissed: number;
      overallPercentage: number;
      totalEligible: number;
      attendedCount: number;
    }> = [];

    for (const m of sessionEligible) {
      const rec = mostRecentSession.records ? mostRecentSession.records[m.id] : undefined;
      const st = normalizeStatus(rec?.status);

      // If they didn't attend: not present!
      if (st !== 'PRESENT') {
        // Calculate consecutive missed meetings
        let consecutive = 0;
        for (const s of sortedSessions) {
          const isEligible = s.team === 'ALL' || s.team === m.team;
          if (isEligible) {
            const sRec = s.records ? s.records[m.id] : undefined;
            const sSt = normalizeStatus(sRec?.status);
            if (sSt === 'PRESENT') {
              break;
            } else {
              consecutive++;
            }
          }
        }

        // Calculate overall percentage across all sessions
        let mEligible = 0;
        let mAttended = 0;
        for (const s of sessions) {
          if (s.team === 'ALL' || s.team === m.team) {
            mEligible++;
            const sRec = s.records ? s.records[m.id] : undefined;
            if (normalizeStatus(sRec?.status) === 'PRESENT') {
              mAttended++;
            }
          }
        }

        const overallPercentage = mEligible > 0 ? Math.round((mAttended / mEligible) * 100) : 0;

        list.push({
          member: m,
          status: st === 'INFORMED' ? 'INFORMED' : (rec ? 'ABSENT' : 'NOT_ENTERED'),
          notes: rec?.notes,
          consecutiveMissed: Math.max(consecutive, 1),
          overallPercentage,
          totalEligible: mEligible,
          attendedCount: mAttended,
        });
      }
    }

    return list.sort((a, b) => {
      if (b.consecutiveMissed !== a.consecutiveMissed) {
        return b.consecutiveMissed - a.consecutiveMissed;
      }
      return a.member.name.localeCompare(b.member.name);
    });
  }, [mostRecentSession, allMembers, sortedSessions, sessions]);

  // Filtered absentees for the dedicated Absentees tab
  const filteredAbsentees = useMemo(() => {
    return lastMeetingAbsentees.filter((a) => {
      if (absenteeTeamFilter !== 'ALL' && a.member.team !== absenteeTeamFilter) {
        return false;
      }
      if (lowAttendanceOnly && a.overallPercentage >= 75) {
        return false;
      }
      if (absenteeSearch.trim()) {
        const q = absenteeSearch.toLowerCase().trim();
        const matchName = a.member.name.toLowerCase().includes(q);
        const matchRoll = a.member.rollNo?.toLowerCase().includes(q);
        const matchDept = a.member.department?.toLowerCase().includes(q);
        const matchTeam = a.member.team.toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchDept && !matchTeam) return false;
      }
      return true;
    });
  }, [lastMeetingAbsentees, absenteeTeamFilter, lowAttendanceOnly, absenteeSearch]);

  // Member overall analytics for the Analytics tab
  const memberAnalytics = useMemo(() => {
    return members.map((m) => {
      let eligibleSessions = 0;
      let attended = 0;
      let informed = 0;
      let absent = 0;

      for (const s of sessions) {
        const isEligible = s.team === 'ALL' || s.team === m.team;
        if (isEligible) {
          eligibleSessions++;
          const rec = s.records ? s.records[m.id] : undefined;
          const st = normalizeStatus(rec?.status);
          if (st === 'PRESENT') {
            attended++;
          } else if (st === 'INFORMED') {
            informed++;
          } else {
            absent++;
          }
        }
      }

      const pct = eligibleSessions > 0 ? Math.round((attended / eligibleSessions) * 100) : 0;
      const isShortage = eligibleSessions > 0 && pct < 75;

      return {
        member: m,
        eligibleSessions,
        attended,
        informed,
        absent,
        pct,
        isShortage,
      };
    });
  }, [members, sessions]);

  // Filtered analytics based on search and shortage filter
  const filteredMemberAnalytics = useMemo(() => {
    return memberAnalytics.filter((item) => {
      if (analyticsFilter === 'SHORTAGE' && !item.isShortage) return false;
      if (analyticsFilter === 'ELIGIBLE' && item.isShortage) return false;

      if (analyticsSearch.trim()) {
        const q = analyticsSearch.toLowerCase().trim();
        const matchName = item.member.name.toLowerCase().includes(q);
        const matchRoll = item.member.rollNo?.toLowerCase().includes(q);
        const matchDept = item.member.department?.toLowerCase().includes(q);
        const matchTeam = item.member.team.toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchDept && !matchTeam) return false;
      }
      return true;
    });
  }, [memberAnalytics, analyticsFilter, analyticsSearch]);

  const lowAttendanceCount = useMemo(() => {
    return memberAnalytics.filter((m) => m.isShortage).length;
  }, [memberAnalytics]);

  // Copy absentees list to clipboard
  const handleCopyAbsenteesList = () => {
    if (lastMeetingAbsentees.length === 0) return;
    const lines = [
      `Absentees for ${mostRecentSession?.title || 'Meeting'} (${mostRecentSession?.date || ''} • ${mostRecentSession?.sessionSlot || 'FN'}):`,
      ...lastMeetingAbsentees.map(
        (a, i) =>
          `${i + 1}. ${a.member.name} (${a.member.rollNo || 'No Roll'}) - ${a.member.team} [${a.status}] (Missed: ${a.consecutiveMissed} mtg${a.consecutiveMissed > 1 ? 's' : ''}, Overall: ${a.overallPercentage}%)`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAbsentees(true);
    showToast(`Copied ${lastMeetingAbsentees.length} absentee names to clipboard!`);
    setTimeout(() => setCopiedAbsentees(false), 2000);
  };

  // Export last meeting absentees to CSV
  const handleExportAbsenteesCsv = () => {
    if (!mostRecentSession || lastMeetingAbsentees.length === 0) {
      showToast('No absentees to export.');
      return;
    }

    const rows = [
      ['Meeting Absentees Report', mostRecentSession.title],
      ['Meeting Date', `${mostRecentSession.date} (${mostRecentSession.sessionSlot || 'FN'})`],
      ['Team Scope', mostRecentSession.team],
      ['Total Absentees', String(lastMeetingAbsentees.length)],
      ['Generated On', new Date().toLocaleString()],
      [],
      [
        'Roll No',
        'Name',
        'Team',
        'Role',
        'Department',
        'Year',
        'Phone',
        'Last Meeting Status',
        'Consecutive Missed',
        'Overall Attendance %',
        'Attendance Status',
        'Notes',
      ],
    ];

    for (const a of lastMeetingAbsentees) {
      const below75 = a.overallPercentage < 75 ? 'SHORTAGE (<75%)' : 'Eligible (>=75%)';
      rows.push([
        a.member.rollNo || 'N/A',
        a.member.name,
        a.member.team,
        a.member.role,
        a.member.department || 'N/A',
        a.member.year || 'N/A',
        a.member.phone || 'N/A',
        a.status,
        String(a.consecutiveMissed),
        `${a.overallPercentage}%`,
        below75,
        a.notes || '',
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `absentees_${mostRecentSession.date}_${mostRecentSession.title.toLowerCase().replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported absentees list to CSV.');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & View Switcher */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Attendance Tracker
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Record, track, and analyze member check-ins for team meetings and events with live Cloud Sync.
                </p>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start md:self-auto border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto no-scrollbar touch-pan-x w-full sm:w-auto">
            <button
              id="att-subtab-session"
              onClick={() => setActiveSubTab('session')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[38px] ${
                activeSubTab === 'session'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Mark Attendance</span>
            </button>
            <button
              id="att-subtab-absentees"
              onClick={() => setActiveSubTab('absentees')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[38px] ${
                activeSubTab === 'absentees'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>Last Meeting Absentees ({lastMeetingAbsentees.length})</span>
            </button>
            <button
              id="att-subtab-analytics"
              onClick={() => setActiveSubTab('analytics')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[38px] ${
                activeSubTab === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>Member Rates &amp; &lt;75%</span>
            </button>
            <button
              id="att-subtab-history"
              onClick={() => setActiveSubTab('history')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 min-h-[38px] ${
                activeSubTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Past Sessions ({visibleSessions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Summary Panel */}
      <div
        id="attendance-summary-panel"
        className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        {/* Metric 1: Total Sessions Recorded */}
        <div
          id="summary-card-total-sessions"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Sessions Recorded
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {sessions.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {sessions.length === 0 ? (
                'No attendance sessions recorded yet.'
              ) : selectedTeam !== 'ALL' && isAdmin ? (
                <>
                  <strong className="text-slate-700 dark:text-slate-300 font-semibold">{visibleSessions.length}</strong> sessions for {selectedTeam} team • <strong className="text-slate-700 dark:text-slate-300 font-semibold">{sessions.length}</strong> total in cloud
                </>
              ) : !isAdmin ? (
                <>
                  <strong className="text-slate-700 dark:text-slate-300 font-semibold">{visibleSessions.length}</strong> sessions relevant to {user.team} team
                </>
              ) : (
                'Archived across all 6 departments with Cloud Sync'
              )}
            </p>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            {sessions.length > 0 ? (
              <button
                id="btn-summary-view-history"
                onClick={() => setActiveSubTab('history')}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View Past Sessions ({visibleSessions.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="btn-summary-start-first"
                onClick={handleStartNewSession}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>+ Start First Session</span>
              </button>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {allMembers.length} Members
            </span>
          </div>
        </div>

        {/* Metric 2: Percentage of Members Present in the Most Recent Session */}
        <div
          id="summary-card-recent-percentage"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Recent Session Present Rate
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {recentSessionMetrics ? `${recentSessionMetrics.presentPercentage}%` : '—'}
              </span>
              {recentSessionMetrics ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    recentSessionMetrics.presentPercentage >= 80
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : recentSessionMetrics.presentPercentage >= 60
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {recentSessionMetrics.presentPercentage >= 80
                    ? 'High Turnout'
                    : recentSessionMetrics.presentPercentage >= 60
                    ? 'Moderate'
                    : 'Low Turnout'}
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  No Data
                </span>
              )}
            </div>

            {/* Progress bar */}
            {recentSessionMetrics ? (
              <div className="mt-2.5 space-y-1">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      recentSessionMetrics.presentPercentage >= 80
                        ? 'bg-emerald-500'
                        : recentSessionMetrics.presentPercentage >= 60
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, recentSessionMetrics.presentPercentage)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">
                      {recentSessionMetrics.totalPresent}
                    </strong>{' '}
                    of {recentSessionMetrics.baseTotal} present
                  </span>
                  {recentSessionMetrics.informedOnly > 0 && (
                    <span className="text-sky-600 dark:text-sky-400 font-medium">
                      ({recentSessionMetrics.informedOnly} informed)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Record attendance for a session to calculate turnout metrics.
              </p>
            )}
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {recentSessionMetrics ? (
                <>Session: <span className="font-semibold text-slate-700 dark:text-slate-300">{recentSessionMetrics.session.title}</span></>
              ) : (
                'Awaiting first session'
              )}
            </span>
            {recentSessionMetrics && (
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                {formatSessionDate(recentSessionMetrics.session.date)} • {recentSessionMetrics.session.sessionSlot || 'FN'}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Latest Session Snapshot & Absentees Alert */}
        <div
          id="summary-card-recent-details"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between col-span-1 sm:col-span-2 lg:col-span-1"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Latest Meeting Snapshot
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>

            {recentSessionMetrics ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[210px]">
                    {recentSessionMetrics.session.title}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {recentSessionMetrics.session.team === 'ALL'
                      ? 'All Teams'
                      : `${recentSessionMetrics.session.team} Team`}
                  </span>
                </div>

                {/* Status chips breakdown: Present, Informed, Absent */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 rounded-lg p-1.5 text-center">
                    <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Present</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{recentSessionMetrics.presentOnly}</span>
                  </div>
                  <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/60 rounded-lg p-1.5 text-center">
                    <span className="block text-[10px] font-semibold text-sky-600 dark:text-sky-400">Informed</span>
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-300">{recentSessionMetrics.informedOnly}</span>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 rounded-lg p-1.5 text-center">
                    <span className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400">Absent</span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">{recentSessionMetrics.absentCount}</span>
                  </div>
                </div>

                {/* Quick button to view Absentees from last meeting */}
                {lastMeetingAbsentees.length > 0 && (
                  <button
                    onClick={() => setActiveSubTab('absentees')}
                    className="w-full mt-2 py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>{lastMeetingAbsentees.length} Absent in Last Meeting</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                No meeting sessions have been recorded yet. You can create a new session or load roll calls.
              </div>
            )}
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            {recentSessionMetrics ? (
              <button
                id="btn-summary-open-session"
                onClick={() => loadSession(recentSessionMetrics.session)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Edit Sheet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleStartNewSession}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Take Attendance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => setActiveSubTab('absentees')}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer transition-colors"
            >
              Absentees ({lastMeetingAbsentees.length}) →
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: MARK ATTENDANCE SESSION */}
      {activeSubTab === 'session' && (
        <div className="space-y-4">
          {/* Session Header Configuration Card */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {activeSessionId ? 'Editing Saved Session' : 'Active Attendance Sheet'}
                </span>
                {activeSessionId && (
                  <button
                    onClick={handleStartNewSession}
                    className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    + Start New
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  id="att-btn-save-cloud"
                  onClick={handleSaveToCloud}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[40px]"
                  title="Persist session to Cloud Firestore"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  id="att-btn-export-csv"
                  onClick={handleExportSessionCsv}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[40px]"
                  title="Download CSV report of current session"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Export</span>
                </button>
                <button
                  id="att-btn-print-sheet"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[40px]"
                  title="Print Attendance Sheet or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Print/PDF</span>
                </button>
              </div>
            </div>

            {/* Session Config Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Select Date
                </label>
                <div className="relative">
                  <input
                    id="att-input-date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* FN / AN Session Slot Selector (Right after Date) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Session Slot (FN / AN)
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <button
                    type="button"
                    id="att-slot-fn"
                    disabled={!sessionDate}
                    onClick={() => handleSlotChange('FN')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                      sessionSlot === 'FN'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                    }`}
                    title="Forenoon Session (FN)"
                  >
                    <span>FN</span>
                    <span className="text-[10px] font-medium opacity-85 hidden xl:inline">(Forenoon)</span>
                  </button>
                  <button
                    type="button"
                    id="att-slot-an"
                    disabled={!sessionDate}
                    onClick={() => handleSlotChange('AN')}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                      sessionSlot === 'AN'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                    }`}
                    title="Afternoon Session (AN)"
                  >
                    <span>AN</span>
                    <span className="text-[10px] font-medium opacity-85 hidden xl:inline">(Afternoon)</span>
                  </button>
                </div>
              </div>

              {/* Title / Meeting Name */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Meeting / Event Title
                </label>
                <input
                  id="att-input-title"
                  type="text"
                  placeholder="e.g., Weekly Sync, Orientation, Review..."
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Target Team Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Team Scope
                </label>
                {isAdmin ? (
                  <select
                    id="att-select-team-scope"
                    value={sessionTeam}
                    onChange={(e) => setSessionTeam(e.target.value as TeamType | 'ALL')}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="ALL">All 6 Teams ({allMembers.length} members)</option>
                    {TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t} Team ({allMembers.filter((m) => m.team === t).length} members)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{user.team} Team ({eligibleMembers.length} members)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Meeting Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agenda / Session Remarks (Optional)
              </label>
              <input
                id="att-input-notes"
                type="text"
                placeholder="Key topics discussed, venue, or general notices..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Metrics & Bulk Controls Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Stat Counters: Present, Informed, Absent, Unrecorded */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 flex-1">
                {/* Total */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Total Members
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                    {metrics.total}
                  </span>
                </div>

                {/* Present */}
                <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      Present
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-900 dark:text-emerald-100">
                      {metrics.rate}%
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                    {metrics.present}
                  </span>
                </div>

                {/* Informed */}
                <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60">
                  <span className="block text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                    Informed
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-sky-700 dark:text-sky-400">
                    {metrics.informed}
                  </span>
                </div>

                {/* Absent */}
                <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                  <span className="block text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                    Absent
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-rose-700 dark:text-rose-400">
                    {metrics.absent}
                  </span>
                </div>

                {/* Unrecorded / Unentered */}
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Unentered
                    </span>
                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200" title="Will default to Absent when saved">
                      Auto-Absent
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-extrabold text-amber-700 dark:text-amber-400">
                    {metrics.unrecorded}
                  </span>
                </div>
              </div>

              {/* Bulk Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Quick Actions:
                </span>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                  <button
                    id="att-bulk-present"
                    onClick={() => handleMarkAll('PRESENT')}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">All Present</span>
                  </button>
                  <button
                    id="att-bulk-absent"
                    onClick={() => handleMarkAll('ABSENT')}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">All Absent</span>
                  </button>
                  {metrics.unrecorded > 0 && (
                    <button
                      id="att-bulk-unentered-absent"
                      onClick={handleMarkUnrecordedAsAbsent}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                      title="Set all unentered members to Absent"
                    >
                      <UserX className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Mark {metrics.unrecorded} as Absent</span>
                    </button>
                  )}
                  <button
                    id="att-bulk-clear"
                    onClick={handleClearAll}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Clear</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Member Search & Status Filters */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member name, roll number, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Filter Pills: All, Present, Informed, Absent */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({eligibleMembers.length})
              </button>
              {(['PRESENT', 'INFORMED', 'ABSENT'] as AttendanceStatus[]).map((st) => {
                const count = eligibleMembers.filter((m) => normalizeStatus(records[m.id]?.status) === st).length;
                const conf = STATUS_CONFIG[st];
                return (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === st
                        ? conf.activeBg
                        : `${conf.badgeBg} ${conf.badgeText} border ${conf.badgeBorder}`
                    }`}
                  >
                    {conf.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Members Roster Attendance List */}
          <div className="screen-only bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Mobile Cards View (< 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
              {displayedMembers.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400 dark:text-slate-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                    No members match the current filter
                  </p>
                  <p className="text-xs mt-1">Try clearing search filters or changing the team scope</p>
                </div>
              ) : (
                displayedMembers.map((member, index) => {
                  const entry = records[member.id];
                  const currentStatus = normalizeStatus(entry?.status);
                  const teamColor = TEAM_COLORS[member.team];

                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 space-y-3 transition-colors ${
                        currentStatus === 'PRESENT'
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                          : currentStatus === 'INFORMED'
                          ? 'bg-sky-50/30 dark:bg-sky-950/15'
                          : currentStatus === 'ABSENT'
                          ? 'bg-rose-50/30 dark:bg-rose-950/15'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      {/* Member Info Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[11px] font-mono text-slate-400 shrink-0 w-5">
                            #{index + 1}
                          </span>
                          <div
                            className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center shrink-0 text-xs shadow-2xs ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-500 text-white'
                                : currentStatus === 'INFORMED'
                                ? 'bg-sky-500 text-white'
                                : currentStatus === 'ABSENT'
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate leading-tight">
                              {member.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {member.rollNo ? (
                                <span className="font-mono font-semibold">{member.rollNo}</span>
                              ) : (
                                <span className="italic">No Roll</span>
                              )}
                              {member.department && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px]">{member.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Team & Role Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                          >
                            {member.team}
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {member.role}
                          </span>
                        </div>
                      </div>

                      {/* 3-Button Attendance Selector Grid: Present, Informed, Absent */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['PRESENT', 'INFORMED', 'ABSENT'] as AttendanceStatus[]).map((st) => {
                          const conf = STATUS_CONFIG[st];
                          const isSelected = currentStatus === st;
                          const IconComponent = conf.icon;

                          return (
                            <button
                              key={st}
                              id={`att-mobile-${member.id}-${st.toLowerCase()}`}
                              onClick={() => handleSetStatus(member.id, st)}
                              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center font-bold text-xs transition-all cursor-pointer min-h-[44px] border ${
                                isSelected
                                  ? `${conf.activeBg} border-transparent shadow-xs scale-102 ring-2 ring-indigo-500/20`
                                  : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <IconComponent className="w-4 h-4 mb-0.5 shrink-0" />
                              <span className="text-[10px] uppercase tracking-wider">{conf.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Remarks & Notes */}
                      <div className="pt-0.5">
                        {editingNoteMemberId === member.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Add reason / note..."
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              className="flex-1 px-3 py-2 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none min-h-[38px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveMemberNote(member.id);
                                if (e.key === 'Escape') setEditingNoteMemberId(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveMemberNote(member.id)}
                              className="px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 min-h-[38px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-4 h-4" />
                              <span>Save</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                setEditingNoteMemberId(member.id);
                                setNoteInput(entry?.notes || '');
                              }}
                              className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border text-left transition-colors cursor-pointer min-h-[36px] ${
                                entry?.notes
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                  : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-xs">📝</span>
                              <span className="truncate">
                                {entry?.notes ? entry.notes : 'Add remark or informed excuse reason...'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 sm:px-4 w-12 text-center">#</th>
                    <th className="py-3 px-3 sm:px-4">Member Info</th>
                    <th className="py-3 px-3 sm:px-4 hidden md:table-cell">Roll No</th>
                    <th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Role & Team</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Attendance Status</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {displayedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">No members match the current filter</p>
                        <p className="text-xs mt-1">Try clearing search filters or changing the team scope</p>
                      </td>
                    </tr>
                  ) : (
                    displayedMembers.map((member, index) => {
                      const entry = records[member.id];
                      const currentStatus = normalizeStatus(entry?.status);
                      const teamColor = TEAM_COLORS[member.team];

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Index */}
                          <td className="py-3 px-3 sm:px-4 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                            {index + 1}
                          </td>

                          {/* Member Info */}
                          <td className="py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center shrink-0 text-xs ${
                                  currentStatus === 'PRESENT'
                                    ? 'bg-emerald-500 text-white'
                                    : currentStatus === 'INFORMED'
                                    ? 'bg-sky-500 text-white'
                                    : currentStatus === 'ABSENT'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                                  {member.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                  {member.department || 'PSG College of Technology'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Roll No */}
                          <td className="py-3 px-3 sm:px-4 hidden md:table-cell font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {member.rollNo || '—'}
                          </td>

                          {/* Role & Team */}
                          <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                              >
                                {member.team}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {member.role}
                              </span>
                            </div>
                          </td>

                          {/* Interactive Status Selector Buttons: Present, Informed, Absent */}
                          <td className="py-3 px-3 sm:px-4">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                              {(['PRESENT', 'INFORMED', 'ABSENT'] as AttendanceStatus[]).map((st) => {
                                const conf = STATUS_CONFIG[st];
                                const isSelected = currentStatus === st;
                                const IconComponent = conf.icon;

                                return (
                                  <button
                                    key={st}
                                    id={`att-toggle-${member.id}-${st.toLowerCase()}`}
                                    onClick={() => handleSetStatus(member.id, st)}
                                    className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 border shadow-2xs ${
                                      isSelected
                                        ? `${conf.activeBg} border-transparent shadow-xs scale-105`
                                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    title={`Mark as ${conf.label}`}
                                  >
                                    <IconComponent className="w-3 h-3 shrink-0" />
                                    <span className="hidden sm:inline">{conf.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Member Remarks / Notes */}
                          <td className="py-3 px-3 sm:px-4 text-right">
                            {editingNoteMemberId === member.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Note/reason..."
                                  value={noteInput}
                                  onChange={(e) => setNoteInput(e.target.value)}
                                  className="px-2 py-1 text-[11px] rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-32 sm:w-44 focus:outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveMemberNote(member.id);
                                    if (e.key === 'Escape') setEditingNoteMemberId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveMemberNote(member.id)}
                                  className="p-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                                  title="Save note"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingNoteMemberId(member.id);
                                  setNoteInput(entry?.notes || '');
                                }}
                                className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                  entry?.notes
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                title={entry?.notes || 'Add remark (reason for absence, arrival time)'}
                              >
                                {entry?.notes ? (
                                  <span className="truncate max-w-[120px] inline-block align-middle">
                                    📝 {entry.notes}
                                  </span>
                                ) : (
                                  '+ Note'
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dedicated Printable Official Attendance Session Sheet */}
          <div className="print-only p-2">
            <div className="print-report-header">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="institution-name">PSG COLLEGE OF TECHNOLOGY</h1>
                  <h2 className="system-title">Official Attendance Sheet • {sessionTitle || 'General Meeting / Session'}</h2>
                </div>
                <div className="text-right text-[8pt] text-slate-600">
                  <div><strong>PSG Tech Campus</strong></div>
                  <div>Peelamedu, Coimbatore - 641004</div>
                </div>
              </div>
              <div className="meta-bar">
                <div>
                  <strong>Session Date:</strong> {sessionDate} ({sessionSlot}) | <strong>Team Scope:</strong> {sessionTeam === 'ALL' ? 'All 6 Teams' : `${sessionTeam} Team`}
                </div>
                <div>
                  <strong>Recorded By:</strong> {user.name} ({user.role} - {user.team})
                </div>
              </div>
            </div>

            {/* Attendance Summary Strip */}
            <div className="border border-slate-300 rounded p-2 mb-3 bg-slate-50 flex justify-between text-[8pt]">
              <div><strong>Total Eligible:</strong> {metrics.total} Members</div>
              <div><strong>Present:</strong> {metrics.present} ({metrics.rate}%)</div>
              <div><strong>Informed:</strong> {metrics.informed}</div>
              <div><strong>Absent:</strong> {metrics.absent}</div>
            </div>

            {/* Member Attendance Table */}
            <table className="print-only">
              <thead>
                <tr>
                  <th style={{ width: '4%' }} className="text-center">#</th>
                  <th style={{ width: '13%' }}>Roll No</th>
                  <th style={{ width: '24%' }}>Member Name</th>
                  <th style={{ width: '10%' }}>Team</th>
                  <th style={{ width: '10%' }}>Role</th>
                  <th style={{ width: '19%' }}>Department</th>
                  <th style={{ width: '10%' }} className="text-center">Status</th>
                  <th style={{ width: '10%' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {eligibleMembers.map((m, idx) => {
                  const rec = records[m.id];
                  const st = rec?.status || 'ABSENT';
                  const badgeClass =
                    st === 'PRESENT'
                      ? 'print-badge-present'
                      : st === 'INFORMED'
                      ? 'print-badge-informed'
                      : 'print-badge-absent';

                  return (
                    <tr key={`print-att-${m.id}`}>
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="font-mono font-semibold">{m.rollNo || '—'}</td>
                      <td className="font-semibold">{m.name}</td>
                      <td>{m.team}</td>
                      <td>{m.role}</td>
                      <td>{m.department || '—'}</td>
                      <td className="text-center">
                        <span className={`print-badge ${badgeClass}`}>{st}</span>
                      </td>
                      <td className="text-[7.5pt]">{rec?.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signatures verification */}
            <div className="print-signature-footer">
              <div className="print-signature-box">
                Recorded By: {user.name}
                <div className="text-[7pt] text-slate-500 mt-6">({user.role} - {user.team})</div>
              </div>
              <div className="print-signature-box">
                Team Lead Verification
                <div className="text-[7pt] text-slate-500 mt-6">Signature & Date</div>
              </div>
              <div className="print-signature-box">
                Faculty Advisor / Admin
                <div className="text-[7pt] text-slate-500 mt-6">Seal & Approval</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LAST MEETING ABSENTEES */}
      {activeSubTab === 'absentees' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Last Meeting Absentees</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold">
                      {lastMeetingAbsentees.length} Members
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {mostRecentSession ? (
                      <>
                        Meeting: <strong className="text-slate-700 dark:text-slate-200">{mostRecentSession.title}</strong> on{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {formatSessionDate(mostRecentSession.date)} ({mostRecentSession.sessionSlot || 'FN'})
                        </strong>{' '}
                        • Scope:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {mostRecentSession.team === 'ALL' ? 'All Teams' : `${mostRecentSession.team} Team`}
                        </strong>
                      </>
                    ) : (
                      'No past meetings found to analyze.'
                    )}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="att-copy-absentees"
                  onClick={handleCopyAbsenteesList}
                  disabled={lastMeetingAbsentees.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Copy list of absentee names with reasons to clipboard"
                >
                  {copiedAbsentees ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAbsentees ? 'Copied!' : 'Copy Names'}</span>
                </button>
                <button
                  id="att-export-absentees"
                  onClick={handleExportAbsenteesCsv}
                  disabled={lastMeetingAbsentees.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Download CSV report of absentees with phone and attendance percentage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                {mostRecentSession && (
                  <button
                    onClick={() => loadSession(mostRecentSession)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Edit Sheet</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60 text-center">
                <span className="block text-[10px] font-semibold text-rose-600 dark:text-rose-400">Total Did Not Attend</span>
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">{lastMeetingAbsentees.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Unexcused Absent</span>
                <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                  {lastMeetingAbsentees.filter((a) => a.status === 'ABSENT' || a.status === 'NOT_ENTERED').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 text-center">
                <span className="block text-[10px] font-semibold text-sky-600 dark:text-sky-400">Informed Absence</span>
                <span className="text-base font-extrabold text-sky-700 dark:text-sky-300">
                  {lastMeetingAbsentees.filter((a) => a.status === 'INFORMED').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-center">
                <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-400">Attendance &lt; 75% Warning</span>
                <span className="text-base font-extrabold text-amber-800 dark:text-amber-300">
                  {lastMeetingAbsentees.filter((a) => a.overallPercentage < 75).length}
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search absentee name, roll no, department..."
                  value={absenteeSearch}
                  onChange={(e) => setAbsenteeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Team dropdown */}
                <select
                  value={absenteeTeamFilter}
                  onChange={(e) => setAbsenteeTeamFilter(e.target.value as TeamType | 'ALL')}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium cursor-pointer focus:outline-none"
                >
                  <option value="ALL">All Teams</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t} Team
                    </option>
                  ))}
                </select>

                {/* Toggle below 75% shortage only */}
                <button
                  onClick={() => setLowAttendanceOnly(!lowAttendanceOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    lowAttendanceOnly
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Only &lt; 75% Attendance</span>
                </button>
              </div>
            </div>
          </div>

          {/* Absentees Cards / Table */}
          {!mostRecentSession ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-indigo-400 opacity-60" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200">No Past Sessions Recorded</h4>
              <p className="text-xs text-slate-500 mt-1">Start a session and take attendance to track absentees.</p>
            </div>
          ) : lastMeetingAbsentees.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-8 text-center text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
              <h4 className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                100% Attendance in Last Meeting!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Every member in the session scope attended this meeting.
              </p>
            </div>
          ) : filteredAbsentees.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No absentees match the current search or filters.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-3">Absentee Name</th>
                      <th className="py-3 px-3">Roll No</th>
                      <th className="py-3 px-3">Team &amp; Role</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-center">Last Meeting Status</th>
                      <th className="py-3 px-3 text-center">Consecutive Missed</th>
                      <th className="py-3 px-3 text-center">Overall Attendance %</th>
                      <th className="py-3 px-3">Remarks / Reason</th>
                      <th className="py-3 px-3 text-right">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredAbsentees.map((a, idx) => {
                      const teamColor = TEAM_COLORS[a.member.team];
                      const isLow = a.overallPercentage < 75;

                      return (
                        <tr
                          key={`abs-${a.member.id}`}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block text-sm">
                              {a.member.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {a.member.year || 'PSG Tech'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {a.member.rollNo || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                              >
                                {a.member.team}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {a.member.role}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            {a.member.department || '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {a.status === 'INFORMED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                <Info className="w-3 h-3" />
                                <span>Informed</span>
                              </span>
                            ) : a.status === 'NOT_ENTERED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Not entered - Auto marked as Absent">
                                <XCircle className="w-3 h-3 text-amber-600" />
                                <span>Auto Absent</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <XCircle className="w-3 h-3" />
                                <span>Absent</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                a.consecutiveMissed > 1
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-extrabold'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {a.consecutiveMissed} {a.consecutiveMissed === 1 ? 'meeting' : 'meetings'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {a.overallPercentage}%
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 inline-flex items-center gap-1 ${
                                  isLow
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                }`}
                              >
                                {isLow && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />}
                                {isLow ? '< 75% Shortage' : 'Eligible (>=75%)'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-500 dark:text-slate-400 italic">
                            {a.notes || '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {a.member.phone ? (
                              <a
                                href={`tel:${a.member.phone}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold transition-colors"
                                title={`Call ${a.member.phone}`}
                              >
                                <Phone className="w-3 h-3" />
                                <span>{a.member.phone}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No Phone</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< 640px) */}
              <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredAbsentees.map((a, idx) => {
                  const teamColor = TEAM_COLORS[a.member.team];
                  const isLow = a.overallPercentage < 75;

                  return (
                    <div key={`m-abs-${a.member.id}`} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center shrink-0 text-xs border border-rose-200 dark:border-rose-800">
                            {a.member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                              {a.member.name}
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{a.member.rollNo || 'No Roll'}</span>
                              {a.member.department && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px]">{a.member.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                          >
                            {a.member.team}
                          </span>
                          {a.status === 'INFORMED' ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                              Informed
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                              Absent
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Overall Attendance:</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {a.overallPercentage}% ({a.attendedCount}/{a.totalEligible})
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isLow
                              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-2.5 h-2.5" />}
                          {isLow ? '< 75% Shortage' : 'Eligible (>=75%)'}
                        </span>
                      </div>

                      {a.notes && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/60">
                          <span className="font-semibold">Reason:</span> {a.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PAST SESSIONS LIST */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recorded Attendance Sessions ({visibleSessions.length})
            </h3>
            <button
              onClick={handleStartNewSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Session</span>
            </button>
          </div>

          {visibleSessions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 shadow-xs">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-500" />
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
                No Attendance Sessions Recorded Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Take attendance for today's meeting or event and save it to the cloud. All sessions will be
                archived here with full analytics.
              </p>
              <button
                onClick={handleStartNewSession}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Take Attendance Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleSessions.map((s) => {
                const recordEntries = Object.values(s.records || {});
                const totalMarked = recordEntries.length;
                const presentCount = recordEntries.filter((r) => r.status === 'PRESENT').length;
                const absentCount = recordEntries.filter((r) => r.status === 'ABSENT').length;
                const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
                const isSelected = activeSessionId === s.id;

                return (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                              {s.date}
                            </span>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 font-mono">
                              {s.sessionSlot || 'FN'}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5 line-clamp-1">
                            {s.title}
                          </h4>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            rate >= 80
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : rate >= 60
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {rate}% Present
                        </span>
                      </div>

                      {/* Scope & Details */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          {s.team === 'ALL' ? 'All Teams' : `${s.team} Team`}
                        </span>
                        <span>•</span>
                        <span>{totalMarked} records</span>
                        {s.createdBy && (
                          <>
                            <span>•</span>
                            <span className="truncate">by {s.createdBy}</span>
                          </>
                        )}
                      </div>

                      {s.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                          "{s.notes}"
                        </p>
                      )}

                      {/* Pill Breakdown */}
                      <div className="flex items-center gap-2 text-[11px] pt-1">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          ✓ {presentCount} Present
                        </span>
                        <span>•</span>
                        <span className="text-rose-700 dark:text-rose-400 font-bold">
                          ✗ {absentCount} Absent
                        </span>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => loadSession(s)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Open & Edit
                      </button>

                      {confirmDeleteSessionId === s.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              await onDeleteSession(s.id);
                              if (activeSessionId === s.id) {
                                handleStartNewSession();
                              }
                              setConfirmDeleteSessionId(null);
                              showToast(`Deleted attendance session for ${s.date}`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSessionId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSessionId(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Delete session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MEMBER ATTENDANCE RATES / ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-4">
          {/* Top Shortage Alert Banner */}
          {lowAttendanceCount > 0 && (
            <div className="no-print bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200 flex items-center gap-2">
                    <span>Attendance Shortage Alert</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 text-xs font-extrabold">
                      {lowAttendanceCount} Member{lowAttendanceCount > 1 ? 's' : ''} &lt; 75%
                    </span>
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    Club constitution requires a minimum 75% attendance rate for active member status and event certificates.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalyticsFilter(analyticsFilter === 'SHORTAGE' ? 'ALL' : 'SHORTAGE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-xs ${
                  analyticsFilter === 'SHORTAGE'
                    ? 'bg-rose-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {analyticsFilter === 'SHORTAGE' ? 'Show All Members' : 'Filter Shortage Members Only'}
              </button>
            </div>
          )}

          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Member Attendance Rates Summary
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculates attendance percentages across all {sessions.length} recorded meeting sessions.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <button
                id="att-export-matrix-csv"
                onClick={handleExportAggregateCsv}
                disabled={sessions.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                title="Download full matrix spreadsheet of all sessions"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Export Matrix</span>
              </button>
              <button
                id="att-print-matrix"
                onClick={() => window.print()}
                disabled={sessions.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[40px] sm:min-h-[36px]"
                title="Print Cumulative Attendance Report or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Search & Shortage Filter Ribbon */}
          <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name, roll no, department..."
                value={analyticsSearch}
                onChange={(e) => setAnalyticsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setAnalyticsFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  analyticsFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Members ({memberAnalytics.length})
              </button>
              <button
                onClick={() => setAnalyticsFilter('SHORTAGE')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  analyticsFilter === 'SHORTAGE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Below 75% Shortage ({lowAttendanceCount})</span>
              </button>
              <button
                onClick={() => setAnalyticsFilter('ELIGIBLE')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  analyticsFilter === 'ELIGIBLE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Eligible (&gt;= 75%) ({memberAnalytics.length - lowAttendanceCount})</span>
              </button>
            </div>
          </div>

          <div className="screen-only bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {filteredMemberAnalytics.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No members match the current search or attendance shortage filter.
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< 640px) */}
                <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredMemberAnalytics.map((ma, idx) => {
                    const m = ma.member;
                    const pct = ma.pct;
                    const teamColor = TEAM_COLORS[m.team];
                    const isLow = ma.isShortage;

                    return (
                      <div key={m.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[11px] font-mono text-slate-400 shrink-0 w-5">
                              #{idx + 1}
                            </span>
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs border border-indigo-200 dark:border-indigo-800">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate leading-tight">
                                {m.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {m.rollNo ? (
                                  <span className="font-mono font-semibold">{m.rollNo}</span>
                                ) : (
                                  <span className="italic">No Roll</span>
                                )}
                                {m.department && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[130px]">{m.department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                            >
                              {m.team}
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {m.role}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Stats */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                                {ma.attended} of {ma.eligibleSessions} sessions
                              </span>
                              <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 inline-flex items-center gap-1 ${
                              ma.eligibleSessions === 0
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                : isLow
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {isLow && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />}
                            {ma.eligibleSessions === 0
                              ? 'No Data'
                              : isLow
                              ? '< 75% Shortage'
                              : 'Eligible (>=75%)'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (>= 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-3 sm:px-4 w-12 text-center">#</th>
                        <th className="py-3 px-3 sm:px-4">Member Name</th>
                        <th className="py-3 px-3 sm:px-4">Roll No</th>
                        <th className="py-3 px-3 sm:px-4">Team &amp; Role</th>
                        <th className="py-3 px-3 sm:px-4 text-center">Attended / Total</th>
                        <th className="py-3 px-3 sm:px-4 text-center">Attendance %</th>
                        <th className="py-3 px-3 sm:px-4 text-center">Eligibility / Health Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredMemberAnalytics.map((ma, idx) => {
                        const m = ma.member;
                        const pct = ma.pct;
                        const teamColor = TEAM_COLORS[m.team];
                        const isLow = ma.isShortage;

                        return (
                          <tr
                            key={m.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-3 sm:px-4 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 sm:px-4">
                              <span className="font-bold text-slate-900 dark:text-white block">{m.name}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {m.department || 'PSG Tech'}
                              </span>
                            </td>
                            <td className="py-3 px-3 sm:px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {m.rollNo || '—'}
                            </td>
                            <td className="py-3 px-3 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                                >
                                  {m.team}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {m.role}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                              {ma.attended} / {ma.eligibleSessions}
                            </td>
                            <td className="py-3 px-3 sm:px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="font-bold font-mono text-xs">{pct}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 sm:px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                  ma.eligibleSessions === 0
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    : isLow
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                }`}
                              >
                                {isLow && <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                                {ma.eligibleSessions === 0
                                  ? 'No Sessions'
                                  : isLow
                                  ? '< 75% Shortage'
                                  : 'Eligible (>=75%)'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Dedicated Printable Cumulative Attendance Matrix */}
          <div className="print-only p-2">
            <div className="print-report-header">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="institution-name">PSG COLLEGE OF TECHNOLOGY</h1>
                  <h2 className="system-title">Cumulative Attendance & Participation Report</h2>
                </div>
                <div className="text-right text-[8pt] text-slate-600">
                  <div><strong>PSG Tech Campus</strong></div>
                  <div>Peelamedu, Coimbatore - 641004</div>
                </div>
              </div>
              <div className="meta-bar">
                <div>
                  <strong>Team Scope:</strong> {selectedTeam === 'ALL' ? 'All Teams (Cumulative)' : `${selectedTeam} Team`} | <strong>Total Sessions Tracked:</strong> {sessions.length}
                </div>
                <div>
                  <strong>Generated On:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            <table className="print-only">
              <thead>
                <tr>
                  <th style={{ width: '4%' }} className="text-center">#</th>
                  <th style={{ width: '13%' }}>Roll No</th>
                  <th style={{ width: '22%' }}>Member Name</th>
                  <th style={{ width: '10%' }}>Team</th>
                  <th style={{ width: '11%' }}>Role</th>
                  <th style={{ width: '20%' }}>Department</th>
                  <th style={{ width: '10%' }} className="text-center">Attended / Total</th>
                  <th style={{ width: '10%' }} className="text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => {
                  let eligibleSessions = 0;
                  let attended = 0;
                  for (const s of sessions) {
                    const isEligible = s.team === 'ALL' || s.team === m.team;
                    if (isEligible) {
                      eligibleSessions++;
                      const rec = s.records[m.id];
                      if (rec && rec.status === 'PRESENT') {
                        attended++;
                      }
                    }
                  }
                  const pct = eligibleSessions > 0 ? Math.round((attended / eligibleSessions) * 100) : 0;
                  return (
                    <tr key={`print-matrix-${m.id}`}>
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="font-mono font-semibold">{m.rollNo || '—'}</td>
                      <td className="font-semibold">{m.name}</td>
                      <td>{m.team}</td>
                      <td>{m.role}</td>
                      <td>{m.department || '—'}</td>
                      <td className="text-center font-semibold">
                        {attended} / {eligibleSessions}
                      </td>
                      <td className="text-center font-bold">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="print-signature-footer">
              <div className="print-signature-box">
                Prepared By: {user.name}
                <div className="text-[7pt] text-slate-500 mt-6">({user.role} - {user.team})</div>
              </div>
              <div className="print-signature-box">
                Team Lead Verification
                <div className="text-[7pt] text-slate-500 mt-6">Signature & Date</div>
              </div>
              <div className="print-signature-box">
                Faculty Advisor / Admin
                <div className="text-[7pt] text-slate-500 mt-6">Seal & Approval</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
