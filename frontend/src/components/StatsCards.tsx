import React from 'react';
import { TeamMember, TeamType, AuthUser } from '../types';
import { TEAMS, TEAM_COLORS } from '../data/initialData';
import { Users, Award, Star, Compass, UserCheck, ShieldAlert, Key, Filter, X } from 'lucide-react';

interface StatsCardsProps {
  user: AuthUser;
  members: TeamMember[];
  allMembers: TeamMember[];
  selectedTeam: TeamType | 'ALL';
  onSelectTeam: (team: TeamType | 'ALL') => void;
  onOpenCredentials?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  user,
  members,
  allMembers,
  selectedTeam,
  onSelectTeam,
  onOpenCredentials,
}) => {
  const isAdmin = user.role === 'admin';

  const totalCount = members.length;
  const leadCount = members.filter((m) => m.role === 'LEAD').length;
  const coLeadCount = members.filter((m) => m.role === 'CO-LEAD').length;
  const coordinatorCount = members.filter((m) => m.role === 'COORDINATOR').length;
  const coreCount = members.filter((m) => m.role === 'CORE').length;

  return (
    <div className="space-y-4">
      {/* Isolation notice for Team User */}
      {!isAdmin && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Team Privacy Active:</strong> Logged in under <strong>{user.team} Team</strong>. You can only view and manage <strong>{user.team}</strong> members.
            </span>
          </div>
          <span className="self-start sm:self-auto shrink-0 text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow-2xs">
            {totalCount} Members
          </span>
        </div>
      )}

      {/* Admin Team Filter Bar */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 sm:mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Team Filter
              </span>
              {selectedTeam !== 'ALL' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {selectedTeam}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs">
                Total: <strong className="text-slate-800 dark:text-slate-200 font-bold">{allMembers.length}</strong>
              </span>
              {onOpenCredentials && (
                <button
                  id="admin-change-credentials-btn"
                  onClick={onOpenCredentials}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer min-h-[34px]"
                  title="Change usernames and passwords for all teams"
                >
                  <Key className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Credentials</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap no-scrollbar -mx-1 px-1 touch-pan-x">
            <button
              id="team-filter-all"
              onClick={() => onSelectTeam('ALL')}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 min-h-[38px] sm:min-h-[34px] ${
                selectedTeam === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs ring-2 ring-slate-900/20 dark:ring-white/20'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span>All Teams</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${selectedTeam === 'ALL' ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {allMembers.length}
              </span>
            </button>

            {TEAMS.map((team) => {
              const teamCount = allMembers.filter((m) => m.team === team).length;
              const isSelected = selectedTeam === team;
              const color = TEAM_COLORS[team];

              return (
                <button
                  key={team}
                  id={`team-filter-${team.toLowerCase()}`}
                  onClick={() => onSelectTeam(team)}
                  className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer shrink-0 min-h-[38px] sm:min-h-[34px] ${
                    isSelected
                      ? `${color.bg} text-white border-transparent shadow-xs ring-2 ring-indigo-500/30`
                      : `bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 ${color.border}`
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : color.bg}`} />
                  <span>{team}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {teamCount}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTeam !== 'ALL' && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="text-[11px] text-slate-400">Filtering table &amp; stats by:</span>
                <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {selectedTeam} Team ({members.length} members)
                </span>
              </div>
              <button
                onClick={() => onSelectTeam('ALL')}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset to All Teams ({allMembers.length})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {/* Total */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-medium">Visible Members</span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{totalCount}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
            {isAdmin ? (selectedTeam === 'ALL' ? 'Across all 6 teams' : `${selectedTeam} team`) : `${user.team} team`}
          </p>
        </div>

        {/* Lead */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-medium">Leads</span>
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{leadCount}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Primary leads</p>
        </div>

        {/* Co-Lead */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-medium">Co-Leads</span>
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{coLeadCount}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Associate leads</p>
        </div>

        {/* Coordinators */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-medium">Coordinators</span>
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{coordinatorCount}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Field operations</p>
        </div>

        {/* Core */}
        <div className="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] sm:text-xs font-medium">Core Members</span>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{coreCount}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Execution staff</p>
        </div>
      </div>
    </div>
  );
};
