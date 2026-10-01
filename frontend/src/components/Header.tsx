import React from 'react';
import { AuthUser, TeamType, ActiveTab } from '../types';
import { TEAMS, TEAM_COLORS } from '../data/initialData';
import { Shield, Users, LogOut, Key, Download, Database, ChevronDown, Calendar, CheckSquare } from 'lucide-react';

interface HeaderProps {
  user: AuthUser;
  onLogout: () => void;
  onOpenCredentials: () => void;
  onExportCsv: () => void;
  onOpenDatabase: () => void;
  cloudMemberCount: number;
  isSyncing: boolean;
  isAutoSyncEnabled: boolean;
  selectedTeam?: TeamType | 'ALL';
  onSelectTeam?: (team: TeamType | 'ALL') => void;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  attendanceSessionCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenCredentials,
  onExportCsv,
  onOpenDatabase,
  cloudMemberCount,
  isSyncing,
  isAutoSyncEnabled,
  selectedTeam,
  onSelectTeam,
  activeTab = 'members',
  onSelectTab,
  attendanceSessionCount = 0,
}) => {
  const isAdmin = user.role === 'admin';
  const currentTeam = isAdmin ? (selectedTeam === 'ALL' ? null : selectedTeam) : user.team;
  const teamColor = currentTeam ? TEAM_COLORS[currentTeam] : null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-16 py-2 sm:py-0 gap-2">
          {/* Brand & Context */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate">
                  Team Data
                </span>
                {isAdmin ? (
                  onSelectTeam ? (
                    <div
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        currentTeam && teamColor
                          ? `${teamColor.lightBg} ${teamColor.text} ${teamColor.border}`
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="relative inline-flex items-center">
                        <select
                          id="header-admin-team-select"
                          value={selectedTeam || 'ALL'}
                          onChange={(e) => onSelectTeam(e.target.value as TeamType | 'ALL')}
                          className="appearance-none bg-transparent font-bold focus:outline-none cursor-pointer py-0.5 pr-3.5 text-[11px]"
                          title="Filter entire admin view by team"
                        >
                          <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                            All Teams
                          </option>
                          {TEAMS.map((t) => (
                            <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                              {t} Team
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-amber-700 dark:text-amber-300 opacity-70 pointer-events-none absolute right-0" />
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      teamColor ? `${teamColor.lightBg} ${teamColor.text} ${teamColor.border}` : ''
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    {user.team}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {isAdmin
                  ? currentTeam
                    ? `Filtered view • Managing ${currentTeam} Team records only`
                    : 'Master access • Viewing, editing and managing all department records'
                  : `Isolated access • Viewing and managing ${user.team} team members only`}
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (Members Directory vs Attendance Tracker) - Desktop/Tablet Only */}
          {onSelectTab && (
            <div className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <button
                id="header-nav-members"
                onClick={() => onSelectTab('members')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members</span>
              </button>
              <button
                id="header-nav-attendance"
                onClick={() => onSelectTab('attendance')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Attendance</span>
                {attendanceSessionCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono">
                    {attendanceSessionCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Cloud Database & Auto-Sync Status Button */}
            <button
              id="header-database-btn"
              onClick={onOpenDatabase}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors shadow-xs cursor-pointer min-h-[38px] ${
                isAutoSyncEnabled
                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80'
              }`}
              title={
                isAutoSyncEnabled
                  ? `Real-time Auto-Sync is ACTIVE (${cloudMemberCount} records in Cloud DB). Click for options.`
                  : `Auto-Sync is PAUSED. Click to view Cloud DB and resume.`
              }
            >
              <span className="relative flex h-2 w-2">
                {isAutoSyncEnabled && (
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                      isSyncing ? 'bg-amber-400' : 'bg-emerald-400'
                    } opacity-75 duration-1000`}
                  />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isAutoSyncEnabled ? 'bg-amber-500' : isSyncing ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="hidden md:inline font-bold">
                {!isAutoSyncEnabled
                  ? 'Auto-Sync: Off'
                  : isSyncing
                  ? 'Syncing...'
                  : 'Auto-Sync: Live'}
              </span>
              <span
                className={`text-[10px] sm:text-[11px] px-1 sm:px-1.5 py-0.2 rounded font-bold ${
                  isAutoSyncEnabled
                    ? 'bg-emerald-200/70 dark:bg-emerald-800/70 text-emerald-900 dark:text-emerald-100'
                    : 'bg-amber-200/70 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100'
                }`}
              >
                {cloudMemberCount}
              </span>
            </button>

            <button
              id="header-export-btn"
              onClick={onExportCsv}
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors min-h-[38px] min-w-[38px]"
              title="Export displayed data to CSV format"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {isAdmin && (
              <button
                id="header-credentials-btn"
                onClick={onOpenCredentials}
                className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 shadow-xs min-h-[38px] min-w-[38px]"
                title="Manage and change team credentials"
              >
                <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Credentials</span>
              </button>
            )}

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5 sm:mx-1" />

            <div className="flex items-center gap-1.5 pl-0.5">
              <div className="text-right hidden md:block">
                <span className="block text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {user.username}
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                  {isAdmin ? 'Superuser' : `${user.team} Rep`}
                </span>
              </div>
              <button
                id="header-logout-btn"
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                title="Sign out of current account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
