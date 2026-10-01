import React, { useMemo } from 'react';
import { AttendanceSession, TeamMember, TeamType } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Award,
  Users,
  Info,
  ExternalLink,
} from 'lucide-react';

interface AttendanceTrendChartProps {
  sessions: AttendanceSession[];
  allMembers: TeamMember[];
  selectedTeam: TeamType | 'ALL';
  onSelectSession?: (session: AttendanceSession) => void;
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  sessions,
  allMembers,
  selectedTeam,
  onSelectSession,
}) => {
  // Process the last 7 sessions in ascending chronological order for timeline plotting
  const trendData = useMemo(() => {
    // Sort ascending by date
    const sorted = [...sessions].sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      const timeA = a.createdAt || a.updatedAt || '';
      const timeB = b.createdAt || b.updatedAt || '';
      return timeA.localeCompare(timeB);
    });

    // Take the most recent 7 sessions
    const last7 = sorted.slice(-7);

    return last7.map((session, index) => {
      const recordsMap = session.records || {};
      const entries = Object.values(recordsMap);
      const totalMarked = entries.length;

      const sessionEligible = allMembers.filter(
        (m) => session.team === 'ALL' || m.team === session.team
      );
      const rosterCount = sessionEligible.length;

      const presentCount = entries.filter((r) => r.status === 'PRESENT').length;
      const absentCount = entries.filter((r) => r.status === 'ABSENT').length;
      const informedCount = entries.filter((r) => r.status === 'INFORMED').length;

      const baseTotal = totalMarked > 0 ? totalMarked : rosterCount > 0 ? rosterCount : 0;
      const attendanceRate = baseTotal > 0 ? Math.round((presentCount / baseTotal) * 100) : 0;

      // Format clean short date, e.g. "Sep 18"
      let shortDate = session.date;
      try {
        const parts = (session.date || '').split('-');
        if (parts.length === 3) {
          const d = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10)
          );
          shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch {
        shortDate = session.date;
      }

      return {
        session,
        index: index + 1,
        displayLabel: shortDate,
        date: session.date,
        title: session.title,
        team: session.team,
        attendanceRate,
        presentCount,
        absentCount,
        informedCount,
        totalEligible: baseTotal,
      };
    });
  }, [sessions, allMembers]);

  // Compute trend metrics (Growth / Decline / Steady)
  const trendStats = useMemo(() => {
    if (trendData.length === 0) return null;

    const rates = trendData.map((d) => d.attendanceRate);
    const avgRate = Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);

    const initialRate = trendData[0].attendanceRate;
    const latestRate = trendData[trendData.length - 1].attendanceRate;
    const delta = latestRate - initialRate;

    let trendStatus: 'growth' | 'decline' | 'steady' = 'steady';
    if (delta > 0) trendStatus = 'growth';
    else if (delta < 0) trendStatus = 'decline';

    const maxSession = trendData.find((d) => d.attendanceRate === maxRate);

    return {
      count: trendData.length,
      initialRate,
      latestRate,
      delta,
      trendStatus,
      avgRate,
      maxRate,
      minRate,
      maxSession,
    };
  }, [trendData]);

  // Custom rich Tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-xs max-w-xs text-xs space-y-1.5 pointer-events-none z-50">
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-1.5">
            <span className="font-mono text-slate-300 font-bold text-[11px] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              {data.displayLabel} ({data.date})
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 font-semibold">
              {data.team === 'ALL' ? 'All Teams' : `${data.team} Team`}
            </span>
          </div>

          <p className="font-semibold text-white text-xs truncate" title={data.title}>
            {data.title}
          </p>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-slate-400 text-[11px]">Turnout Rate:</span>
            <span
              className={`font-black text-base font-mono ${
                data.attendanceRate >= 80
                  ? 'text-emerald-400'
                  : data.attendanceRate >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {data.attendanceRate}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-700/60 text-[10px] text-center">
            <div className="bg-slate-800/90 dark:bg-slate-900/90 rounded p-1 border border-slate-700/50">
              <span className="text-emerald-400 block font-bold">{data.presentCount}</span>
              <span className="text-slate-400 text-[9px]">Present</span>
            </div>
            <div className="bg-slate-800/90 dark:bg-slate-900/90 rounded p-1 border border-slate-700/50">
              <span className="text-amber-400 block font-bold">{data.informedCount}</span>
              <span className="text-slate-400 text-[9px]">Informed</span>
            </div>
            <div className="bg-slate-800/90 dark:bg-slate-900/90 rounded p-1 border border-slate-700/50">
              <span className="text-rose-400 block font-bold">{data.absentCount}</span>
              <span className="text-slate-400 text-[9px]">Absent</span>
            </div>
          </div>
          {onSelectSession && (
            <div className="text-[10px] text-indigo-300/80 pt-1 text-center font-medium">
              Click node to open session sheet
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="attendance-trend-chart-card"
      className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header: Title, Description & Trend Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <span>Attendance Trends (Last 7 Sessions)</span>
                {trendStats && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    {trendStats.count} {trendStats.count === 1 ? 'session' : 'sessions'}
                  </span>
                )}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Participation growth or decline trajectory across meetings
              </p>
            </div>
          </div>
        </div>

        {/* Growth / Decline indicator badge */}
        {trendStats && trendStats.count > 1 ? (
          <div className="flex items-center gap-2">
            {trendStats.trendStatus === 'growth' ? (
              <span
                id="attendance-trend-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>+{trendStats.delta}% Participation Growth</span>
              </span>
            ) : trendStats.trendStatus === 'decline' ? (
              <span
                id="attendance-trend-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs"
              >
                <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{trendStats.delta}% Participation Decline</span>
              </span>
            ) : (
              <span
                id="attendance-trend-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-2xs"
              >
                <Minus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Steady Participation ({trendStats.latestRate}%)</span>
              </span>
            )}
          </div>
        ) : trendStats && trendStats.count === 1 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Baseline established</span>
          </span>
        ) : null}
      </div>

      {/* Mini Stat Summary Strip */}
      {trendStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Average Turnout
            </span>
            <span
              id="attendance-trend-avg-rate"
              className="text-base sm:text-lg font-black text-slate-900 dark:text-white"
            >
              {trendStats.avgRate}%
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Latest Turnout
            </span>
            <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">
              {trendStats.latestRate}%
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Peak Turnout
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              {trendStats.maxRate}%
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Benchmark Goal
            </span>
            <span className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-300">
              80% <span className="text-[10px] font-normal text-slate-400">Target</span>
            </span>
          </div>
        </div>
      )}

      {/* Recharts Line Chart Visualization */}
      {trendData.length > 0 ? (
        <div className="w-full pt-2">
          <div className="h-60 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 12, right: 15, left: -15, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length && onSelectSession) {
                    onSelectSession(e.activePayload[0].payload.session);
                  }
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                  className="stroke-slate-200 dark:stroke-slate-800"
                />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  dy={6}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={80}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Target 80%',
                    position: 'insideTopRight',
                    fill: '#10b981',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="attendanceRate"
                  name="Attendance Turnout"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{
                    r: 4.5,
                    fill: '#4f46e5',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 7,
                    fill: '#6366f1',
                    stroke: '#ffffff',
                    strokeWidth: 2.5,
                    cursor: onSelectSession ? 'pointer' : 'default',
                  }}
                  isAnimationActive={true}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Chart session chips underneath */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mr-1">
                Sessions:
              </span>
              {trendData.map((d, i) => (
                <button
                  key={d.session.id || i}
                  type="button"
                  onClick={() => onSelectSession && onSelectSession(d.session)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer border ${
                    d.attendanceRate >= 80
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100'
                      : d.attendanceRate >= 60
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100'
                  }`}
                  title={`${d.title} on ${d.date}: ${d.attendanceRate}% turnout. Click to edit session.`}
                >
                  <span>{d.displayLabel}:</span>
                  <span className="font-mono font-bold">{d.attendanceRate}%</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-indigo-600 rounded-full" />
                <span>Attendance Turnout</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-emerald-500 border-dashed border-t border-emerald-500" />
                <span>80% Target Benchmark</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
          <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No attendance trend data available
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Record attendance sessions to visualize the turnout trend and see participation growth or decline over time.
          </p>
        </div>
      )}
    </div>
  );
};
