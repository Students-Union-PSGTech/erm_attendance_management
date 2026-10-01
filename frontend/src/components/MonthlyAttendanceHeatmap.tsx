import React, { useState, useMemo } from 'react';
import { AttendanceSession, TeamMember, TeamType } from '../types';
import { TEAM_COLORS } from '../data/initialData';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Clock,
  XCircle,
  Award,
  Users,
  Plus,
  ArrowRight,
  Info,
  CalendarDays,
} from 'lucide-react';

interface MonthlyAttendanceHeatmapProps {
  sessions: AttendanceSession[];
  allMembers: TeamMember[];
  selectedTeam: TeamType | 'ALL';
  onSelectSession: (session: AttendanceSession) => void;
  onNewSessionForDate?: (dateStr: string) => void;
}

interface DaySessionData {
  sessions: AttendanceSession[];
  totalSessions: number;
  avgTurnout: number;
  maxTurnout: number;
  totalPresent: number;
  totalInformed: number;
  totalAbsent: number;
  totalEligible: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MonthlyAttendanceHeatmap: React.FC<MonthlyAttendanceHeatmapProps> = ({
  sessions,
  allMembers,
  selectedTeam,
  onSelectSession,
  onNewSessionForDate,
}) => {
  // Determine initial month based on latest session date or current date
  const defaultYearMonth = useMemo(() => {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const latest = sorted[0].date;
      if (latest) {
        const [y, m] = latest.split('-');
        if (y && m) {
          return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
        }
      }
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [sessions]);

  const [currentYear, setCurrentYear] = useState<number>(defaultYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(defaultYearMonth.month); // 0-indexed

  // Today string "YYYY-MM-DD"
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Selected date on calendar to inspect in side panel
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleJumpToCurrent = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Group sessions by date "YYYY-MM-DD" with calculated statistics
  const sessionDataByDate = useMemo(() => {
    const map: Record<string, DaySessionData> = {};

    for (const session of sessions) {
      if (!session.date) continue;
      const d = session.date;

      if (!map[d]) {
        map[d] = {
          sessions: [],
          totalSessions: 0,
          avgTurnout: 0,
          maxTurnout: 0,
          totalPresent: 0,
          totalInformed: 0,
          totalAbsent: 0,
          totalEligible: 0,
        };
      }

      map[d].sessions.push(session);
    }

    // Compute metrics for each day
    Object.keys(map).forEach((dateKey) => {
      const dayData = map[dateKey];
      dayData.totalSessions = dayData.sessions.length;

      let sumRates = 0;
      let maxRate = 0;

      dayData.sessions.forEach((s) => {
        const records = Object.values(s.records || {});
        const eligible = allMembers.filter((m) => s.team === 'ALL' || m.team === s.team);
        const baseTotal = records.length > 0 ? records.length : eligible.length > 0 ? eligible.length : 0;

        const p = records.filter((r) => r.status === 'PRESENT').length;
        const inf = records.filter((r) => r.status === 'INFORMED').length;
        const a = records.filter((r) => r.status === 'ABSENT').length;
        const rate = baseTotal > 0 ? Math.round((p / baseTotal) * 100) : 0;

        sumRates += rate;
        if (rate > maxRate) maxRate = rate;

        dayData.totalPresent += p;
        dayData.totalInformed += inf;
        dayData.totalAbsent += a;
        dayData.totalEligible += baseTotal;
      });

      dayData.avgTurnout = Math.round(sumRates / dayData.totalSessions);
      dayData.maxTurnout = maxRate;
    });

    return map;
  }, [sessions, allMembers]);

  // Generate calendar grid for currentYear and currentMonth
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      sessionData?: DaySessionData;
    }> = [];

    // Previous month filler cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        sessionData: sessionDataByDate[dateStr],
      });
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        sessionData: sessionDataByDate[dateStr],
      });
    }

    // Next month filler cells to complete 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        sessionData: sessionDataByDate[dateStr],
      });
    }

    return cells;
  }, [currentYear, currentMonth, todayStr, sessionDataByDate]);

  // Month Statistics
  const monthStats = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthSessions = sessions.filter((s) => s.date && s.date.startsWith(prefix));
    const activeDates = new Set(monthSessions.map((s) => s.date));

    let sumTurnout = 0;
    let highTurnoutCount = 0;

    monthSessions.forEach((s) => {
      const records = Object.values(s.records || {});
      const eligible = allMembers.filter((m) => s.team === 'ALL' || m.team === s.team);
      const base = records.length > 0 ? records.length : eligible.length > 0 ? eligible.length : 0;
      const p = records.filter((r) => r.status === 'PRESENT').length;
      const rate = base > 0 ? Math.round((p / base) * 100) : 0;
      sumTurnout += rate;
      if (rate >= 80) highTurnoutCount++;
    });

    const avgTurnout = monthSessions.length > 0 ? Math.round(sumTurnout / monthSessions.length) : 0;

    return {
      sessionCount: monthSessions.length,
      activeDays: activeDates.size,
      avgTurnout,
      highTurnoutCount,
    };
  }, [currentYear, currentMonth, sessions, allMembers]);

  // Selected date details
  const activeSelectedData = useMemo(() => {
    if (!selectedDateStr) return null;
    return {
      dateStr: selectedDateStr,
      data: sessionDataByDate[selectedDateStr] || null,
    };
  }, [selectedDateStr, sessionDataByDate]);

  // Month formatted title
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Heat color helper based on session attendance turnout
  const getHeatmapStyle = (data?: DaySessionData, isCurrentMonth: boolean = true) => {
    if (!data || data.totalSessions === 0) {
      return isCurrentMonth
        ? 'bg-slate-50/70 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
        : 'bg-slate-50/20 dark:bg-slate-900/20 text-slate-300 dark:text-slate-600 border-transparent opacity-50';
    }

    const rate = data.avgTurnout;

    if (rate >= 80) {
      return 'bg-emerald-500 text-white font-bold border-emerald-600 shadow-xs hover:bg-emerald-600 ring-1 ring-emerald-400/40';
    }
    if (rate >= 60) {
      return 'bg-amber-500 text-white font-bold border-amber-600 shadow-xs hover:bg-amber-600 ring-1 ring-amber-400/40';
    }
    return 'bg-rose-500 text-white font-bold border-rose-600 shadow-xs hover:bg-rose-600 ring-1 ring-rose-400/40';
  };

  return (
    <div
      id="attendance-calendar-heatmap-card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Monthly Attendance Heat-Map
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70">
                {monthName}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Visualizes recorded session density and turnout rates across calendar days
            </p>
          </div>
        </div>

        {/* Month Navigation & Today Shortcut */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            id="heatmap-btn-prev-month"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-mono min-w-[140px] text-center">
            {monthName}
          </span>

          <button
            type="button"
            id="heatmap-btn-next-month"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="heatmap-btn-today"
            onClick={handleJumpToCurrent}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Current Month
          </button>
        </div>
      </div>

      {/* Monthly Statistics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Sessions Recorded
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            {monthStats.sessionCount}
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Active Meeting Days
          </span>
          <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-indigo-500" />
            {monthStats.activeDays} days
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Avg Month Turnout
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {monthStats.sessionCount > 0 ? `${monthStats.avgTurnout}%` : '—'}
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Target Met (≥80%)
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            {monthStats.highTurnoutCount}
          </span>
        </div>
      </div>

      {/* Main Grid & Side Detail Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Calendar Heatmap Grid */}
        <div className="lg:col-span-8 space-y-2">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar day tiles */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarGrid.map((cell) => {
              const hasSession = cell.sessionData && cell.sessionData.totalSessions > 0;
              const isSelected = selectedDateStr === cell.dateStr;
              const heatStyle = getHeatmapStyle(cell.sessionData, cell.isCurrentMonth);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  id={`heatmap-cell-${cell.dateStr}`}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2 min-h-[58px] sm:min-h-[68px] rounded-xl border transition-all cursor-pointer text-left ${heatStyle} ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900 z-10'
                      : ''
                  } ${
                    cell.isToday
                      ? 'border-indigo-400 dark:border-indigo-500'
                      : ''
                  }`}
                  title={`${cell.dateStr}${hasSession ? `: ${cell.sessionData?.totalSessions} session(s), ${cell.sessionData?.avgTurnout}% avg turnout` : ''}`}
                >
                  {/* Top row: day number & today indicator */}
                  <div className="w-full flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        cell.isToday
                          ? hasSession
                            ? 'bg-white text-indigo-700 px-1 rounded-sm'
                            : 'bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-bold'
                          : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasSession && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/20 text-white font-bold">
                        {cell.sessionData!.totalSessions}s
                      </span>
                    )}
                  </div>

                  {/* Middle / Bottom content */}
                  {hasSession ? (
                    <div className="w-full text-center mt-1">
                      <span className="text-xs sm:text-sm font-black font-mono tracking-tight leading-none block">
                        {cell.sessionData!.avgTurnout}%
                      </span>
                      <span className="text-[9px] opacity-90 block truncate leading-none mt-0.5">
                        turnout
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-4" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Color Intensity Legend */}
          <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mr-1">
                Attendance Heat:
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-block" />
                <span>No Sessions</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block" />
                <span>&lt;60% (Low)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" />
                <span>60-79% (Moderate)</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
                <span>≥80% (Target Met)</span>
              </div>
            </div>

            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Click any calendar day to inspect recorded meetings
            </span>
          </div>
        </div>

        {/* Selected Date Inspector Side Card */}
        <div className="lg:col-span-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-2">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                {activeSelectedData ? activeSelectedData.dateStr : 'Day Inspector'}
              </h4>
            </div>

            {activeSelectedData && (
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {activeSelectedData.data?.totalSessions || 0} session(s)
              </span>
            )}
          </div>

          {activeSelectedData ? (
            activeSelectedData.data && activeSelectedData.data.sessions.length > 0 ? (
              <div className="space-y-2.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Combined Turnout:</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        activeSelectedData.data.avgTurnout >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : activeSelectedData.data.avgTurnout >= 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {activeSelectedData.data.avgTurnout}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] text-center font-mono">
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 py-0.5 rounded font-bold">
                      {activeSelectedData.data.totalPresent} P
                    </span>
                    <span className="bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 py-0.5 rounded font-bold">
                      {activeSelectedData.data.totalInformed} I
                    </span>
                    <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 py-0.5 rounded font-bold">
                      {activeSelectedData.data.totalAbsent} A
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {activeSelectedData.data.sessions.map((s) => {
                    const records = Object.values(s.records || {});
                    const teamColor = s.team !== 'ALL' ? TEAM_COLORS[s.team] : null;
                    const p = records.filter((r) => r.status === 'PRESENT').length;
                    const inf = records.filter((r) => r.status === 'INFORMED').length;
                    const a = records.filter((r) => r.status === 'ABSENT').length;
                    const eligible = allMembers.filter((m) => s.team === 'ALL' || m.team === s.team);
                    const base = records.length > 0 ? records.length : eligible.length;
                    const rate = base > 0 ? Math.round((p / base) * 100) : 0;

                    return (
                      <div
                        key={s.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <h5 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1" title={s.title}>
                              {s.title}
                            </h5>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full mt-0.5 border ${
                                teamColor
                                  ? `${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                              }`}
                            >
                              {s.team === 'ALL' ? 'All Teams' : `${s.team} Team`}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded-md ${
                              rate >= 80
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : rate >= 60
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {rate}%
                          </span>
                        </div>

                        {s.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                            "{s.notes}"
                          </p>
                        )}

                        <button
                          type="button"
                          id={`heatmap-open-session-${s.id}`}
                          onClick={() => onSelectSession(s)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                        >
                          <span>Open Attendance Sheet</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Info className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No attendance session was recorded on this date.
                </p>
                {onNewSessionForDate && (
                  <button
                    type="button"
                    id={`heatmap-new-session-${activeSelectedData.dateStr}`}
                    onClick={() => onNewSessionForDate(activeSelectedData.dateStr)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Session for this Date</span>
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
              <CalendarIcon className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              Select any day on the calendar to view its session records or schedule a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
