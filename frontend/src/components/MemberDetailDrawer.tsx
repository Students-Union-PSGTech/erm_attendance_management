import React, { useEffect, useMemo, useState } from 'react';
import { TeamMember, AttendanceSession, AuthUser, RoleType, AttendanceStatus } from '../types';
import { TEAM_COLORS } from '../data/initialData';
import { findDepartment } from '../data/departments';
import {
  X,
  User,
  Calendar,
  Phone,
  GraduationCap,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Copy,
  Check,
  Building,
  ShieldCheck,
  TrendingUp,
  History,
  Info,
  CalendarCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface MemberDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  sessions: AttendanceSession[];
  user: AuthUser;
  onEditMember?: (member: TeamMember) => void;
  onDeleteMember?: (member: TeamMember) => void;
}

const ROLE_STYLES: Record<RoleType, { bg: string; text: string; border: string; badge: string }> = {
  LEAD: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  },
  'CO-LEAD': {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300 dark:border-purple-700',
  },
  COORDINATOR: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700',
  },
  CORE: {
    bg: 'bg-slate-50 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  },
};

const STATUS_CONFIG: Record<
  AttendanceStatus | 'UNRECORDED',
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string }
> = {
  PRESENT: {
    label: 'Present',
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
  },
  INFORMED: {
    label: 'Informed',
    icon: Info,
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/60',
  },
  ABSENT: {
    label: 'Absent',
    icon: XCircle,
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
  },
  UNRECORDED: {
    label: 'Not Marked',
    icon: AlertCircle,
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const MemberDetailDrawer: React.FC<MemberDetailDrawerProps> = ({
  isOpen,
  onClose,
  member,
  sessions,
  user,
  onEditMember,
  onDeleteMember,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | AttendanceStatus>('ALL');

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 1800);
  };

  // Compute attendance analytics and history for this member
  const attendanceData = useMemo(() => {
    if (!member) {
      return {
        eligibleSessions: [],
        history: [],
        totalEligible: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        unrecordedCount: 0,
        attendedCount: 0,
        attendanceRate: 0,
        lastAttendedDate: null as string | null,
        lastAttendedSessionTitle: null as string | null,
        lastAttendedStatus: null as AttendanceStatus | null,
        lastSessionDate: null as string | null,
        lastSessionTitle: null as string | null,
        lastSessionStatus: null as (AttendanceStatus | 'UNRECORDED') | null,
      };
    }

    // Filter sessions where this member was eligible (team match or ALL teams)
    // or if the member has a record explicitly recorded
    const relevantSessions = sessions.filter((s) => {
      const isTeamEligible = s.team === 'ALL' || s.team === member.team;
      const hasRecord = !!s.records && member.id in s.records;
      return isTeamEligible || hasRecord;
    });

    // Sort descending by date (most recent first)
    const sortedSessions = [...relevantSessions].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

    let present = 0;
    let absent = 0;
    let informed = 0;
    let unrecorded = 0;

    const historyItems = sortedSessions.map((session) => {
      const rec = session.records ? session.records[member.id] : undefined;
      let status: AttendanceStatus | 'UNRECORDED' = 'UNRECORDED';
      if (rec) {
        if (rec.status === 'PRESENT' || (rec.status as string) === 'LATE') status = 'PRESENT';
        else if (rec.status === 'INFORMED' || (rec.status as string) === 'EXCUSED') status = 'INFORMED';
        else if (rec.status === 'ABSENT') status = 'ABSENT';
      }

      if (status === 'PRESENT') present++;
      else if (status === 'INFORMED') informed++;
      else if (status === 'ABSENT') absent++;
      else unrecorded++;

      return {
        session,
        status,
        notes: rec?.notes,
        markedAt: rec?.markedAt,
      };
    });

    const total = sortedSessions.length;
    const attended = present;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    // Find the latest session where the member actually attended (PRESENT)
    const lastAttendedEntry = historyItems.find((item) => item.status === 'PRESENT');

    // Also get the absolute most recent recorded session
    const latestEntry = historyItems.length > 0 ? historyItems[0] : null;

    return {
      eligibleSessions: sortedSessions,
      history: historyItems,
      totalEligible: total,
      presentCount: present,
      informedCount: informed,
      absentCount: absent,
      unrecordedCount: unrecorded,
      attendedCount: attended,
      attendanceRate: rate,
      lastAttendedDate: lastAttendedEntry ? lastAttendedEntry.session.date : null,
      lastAttendedSessionTitle: lastAttendedEntry ? lastAttendedEntry.session.title : null,
      lastAttendedStatus: lastAttendedEntry ? (lastAttendedEntry.status as AttendanceStatus) : null,
      lastSessionDate: latestEntry ? latestEntry.session.date : null,
      lastSessionTitle: latestEntry ? latestEntry.session.title : null,
      lastSessionStatus: latestEntry ? latestEntry.status : null,
    };
  }, [member, sessions]);

  // Filter history items by status tab
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return attendanceData.history;
    return attendanceData.history.filter((item) => item.status === historyFilter);
  }, [attendanceData.history, historyFilter]);

  if (!isOpen || !member) return null;

  const teamColor = TEAM_COLORS[member.team];
  const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.CORE;
  const deptInfo = member.department ? findDepartment(member.department) : null;
  const isAdmin = user.role === 'admin';

  return (
    <div
      id="member-detail-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer slide-over container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 ease-out focus:outline-none">
          
          {/* Top Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-900/90 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs shrink-0 ${
                  teamColor?.bg || 'bg-indigo-600'
                }`}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleStyle.badge}`}
                  >
                    {member.role}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${teamColor.bg}`} />
                    {member.team} TEAM
                  </span>
                </div>
                <h2
                  id="member-drawer-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight mt-1 truncate"
                  title={member.name}
                >
                  {member.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {member.rollNo ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(member.rollNo || '', 'rollNo')}
                      className="inline-flex items-center gap-1 font-mono font-medium hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                      title="Click to copy roll number"
                    >
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span>{member.rollNo}</span>
                      {copiedField === 'rollNo' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60" />
                      )}
                    </button>
                  ) : (
                    <span className="italic text-slate-400">No roll number</span>
                  )}
                  {member.year && (
                    <>
                      <span>•</span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{member.year}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              id="drawer-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Close drawer"
              title="Close panel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
            
            {/* LAST ATTENDANCE DATE HIGHLIGHT CARD */}
            <div
              id="last-attendance-highlight-card"
              className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 p-4 shadow-xs relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <CalendarCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Last Attendance Status
                </span>
                {attendanceData.lastAttendedDate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Attended
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    No Attended Sessions
                  </span>
                )}
              </div>

              {attendanceData.lastAttendedDate ? (
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {formatDisplayDate(attendanceData.lastAttendedDate)}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                      ({attendanceData.lastAttendedDate})
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate flex items-center gap-1">
                    <span>Session:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {attendanceData.lastAttendedSessionTitle || 'General Meeting'}
                    </strong>
                  </p>
                  {attendanceData.lastSessionDate &&
                    attendanceData.lastSessionDate !== attendanceData.lastAttendedDate && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>
                          Most recent session was on {formatDisplayDate(attendanceData.lastSessionDate)} (
                          {attendanceData.lastSessionStatus})
                        </span>
                      </p>
                    )}
                </div>
              ) : attendanceData.lastSessionDate ? (
                <div className="space-y-1">
                  <div className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>Never attended a recorded session</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Most recent session was on {formatDisplayDate(attendanceData.lastSessionDate)} ({attendanceData.lastSessionStatus}).
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-1">
                  No attendance sessions have been logged for this team or member yet.
                </div>
              )}
            </div>

            {/* CUMULATIVE ATTENDANCE STATS */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                  Attendance Summary
                </h3>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    attendanceData.attendanceRate >= 80
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : attendanceData.attendanceRate >= 60
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  {attendanceData.attendanceRate}% Attendance Rate
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    attendanceData.attendanceRate >= 80
                      ? 'bg-emerald-500'
                      : attendanceData.attendanceRate >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${attendanceData.attendanceRate}%` }}
                />
              </div>

              {/* 3 Stat Boxes: Present, Informed, Absent */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block">Present</span>
                  <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-200">
                    {attendanceData.presentCount}
                  </span>
                </div>
                <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 block">Informed</span>
                  <span className="text-base sm:text-lg font-black text-sky-800 dark:text-sky-200">
                    {attendanceData.informedCount}
                  </span>
                </div>
                <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block">Absent</span>
                  <span className="text-base sm:text-lg font-black text-rose-800 dark:text-rose-200">
                    {attendanceData.absentCount}
                  </span>
                </div>
              </div>

              {/* Low Attendance Warning (< 75%) */}
              {attendanceData.totalEligible > 0 && attendanceData.attendanceRate < 75 && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-900 dark:text-rose-100">
                      Low Attendance Warning ({attendanceData.attendanceRate}% &lt; 75%)
                    </span>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                      {member.name}'s attendance is below the PSG Tech minimum requirement of 75%. Attended only {attendanceData.presentCount} of {attendanceData.totalEligible} meetings.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* MEMBER PROFILE & ACADEMIC DETAILS */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                Member Information
              </h3>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3.5 space-y-2.5 text-xs">
                {/* Department */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 pt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    Department:
                  </span>
                  <div className="text-right min-w-0">
                    {deptInfo && (
                      <span
                        className={`inline-block mr-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded ${
                          deptInfo.degree === 'M.Sc'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                            : deptInfo.degree === 'B.Sc'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : deptInfo.category.includes('Sandwich')
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        }`}
                      >
                        {deptInfo.code || deptInfo.degree}
                      </span>
                    )}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {member.department || 'Not specified'}
                    </span>
                  </div>
                </div>

                {/* Year of Study */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    Year of Study:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {member.year || 'Not specified'}
                  </span>
                </div>

                {/* Institution */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    College:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                    PSG College of Technology
                  </span>
                </div>

                {/* Phone */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    Phone:
                  </span>
                  {member.phone ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${member.phone}`}
                        className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        title="Call member"
                      >
                        {member.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(member.phone || '', 'phone')}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                        title="Copy phone number"
                      >
                        {copiedField === 'phone' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="italic text-slate-400">Not provided</span>
                  )}
                </div>

                {/* Member ID */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    System ID:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{member.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(member.id, 'id')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                      title="Copy ID"
                    >
                      {copiedField === 'id' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ATTENDANCE HISTORY LOG */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-500" />
                  Attendance History ({attendanceData.history.length})
                </h3>

                {/* Filter chips */}
                {attendanceData.history.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px]">
                    {(['ALL', 'PRESENT', 'INFORMED', 'ABSENT'] as const).map((filterVal) => (
                      <button
                        key={filterVal}
                        type="button"
                        onClick={() => setHistoryFilter(filterVal)}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          historyFilter === filterVal
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {filterVal === 'ALL' ? 'All' : filterVal}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredHistory.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                  {filteredHistory.map((item, idx) => {
                    const statusConf = STATUS_CONFIG[item.status];
                    const StatusIcon = statusConf.icon;

                    return (
                      <div
                        key={item.session.id || idx}
                        className="p-3 sm:p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {formatDisplayDate(item.session.date)}
                            </span>
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {item.session.team === 'ALL' ? 'All Teams' : `${item.session.team}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                            {item.session.title}
                          </p>
                          {item.notes && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300/90 italic flex items-center gap-1">
                              <span>Remark:</span> "{item.notes}"
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConf.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40">
                  <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No session records found
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {historyFilter !== 'ALL'
                      ? `No records marked as ${historyFilter}`
                      : 'Attendance sessions for this team will appear here once conducted.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer with Quick Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 shrink-0 flex items-center justify-between gap-2.5">
            <button
              type="button"
              id="drawer-dismiss-btn"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {onDeleteMember && (
                <button
                  type="button"
                  id="drawer-delete-member-btn"
                  onClick={() => {
                    onDeleteMember(member);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-semibold transition-colors cursor-pointer"
                  title="Delete member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

              {onEditMember && (
                <button
                  type="button"
                  id="drawer-edit-member-btn"
                  onClick={() => {
                    onEditMember(member);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  title="Edit member details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
