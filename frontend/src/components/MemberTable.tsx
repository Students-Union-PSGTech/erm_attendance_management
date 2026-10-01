import React, { useState, useMemo } from 'react';
import { TeamMember, RoleType, TeamType, AuthUser, AttendanceSession } from '../types';
import { TEAMS, TEAM_COLORS, INITIAL_ATTENDANCE_SESSIONS } from '../data/initialData';
import { DEPARTMENT_CATEGORIES, ALL_DEPARTMENTS, findDepartment, YEARS_OF_STUDY } from '../data/departments';
import {
  Search,
  Plus,
  Download,
  Upload,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserX,
  Phone,
  GraduationCap,
  Hash,
  Calendar,
  Users,
  ChevronDown,
  Printer,
  Eye,
} from 'lucide-react';
import { parseCsvToMembers } from '../utils/csv';
import { MemberDetailDrawer } from './MemberDetailDrawer';

interface MemberTableProps {
  members: TeamMember[];
  allMembers?: TeamMember[];
  user: AuthUser;
  onAddMember: () => void;
  onEditMember: (member: TeamMember) => void;
  onDeleteMember: (member: TeamMember) => void;
  onExportCsv: (membersToExport: TeamMember[], customFilename?: string) => void;
  onImportCsv?: (importedMembers: TeamMember[]) => Promise<void>;
  selectedTeam: TeamType | 'ALL';
  onSelectTeam?: (team: TeamType | 'ALL') => void;
  attendanceSessions?: AttendanceSession[];
}

const ROLE_RANK: Record<RoleType, number> = {
  LEAD: 1,
  'CO-LEAD': 2,
  COORDINATOR: 3,
  CORE: 4,
};

const ROLE_STYLES: Record<RoleType, { bg: string; text: string; border: string }> = {
  LEAD: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
  },
  'CO-LEAD': {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
  },
  COORDINATOR: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
  },
  CORE: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
  },
};

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  allMembers,
  user,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onExportCsv,
  onImportCsv,
  selectedTeam,
  onSelectTeam,
  attendanceSessions,
}) => {
  const isAdmin = user.role === 'admin';
  const allMembersList = allMembers || members;

  // Selected member for detail side-drawer / popover
  const [selectedMemberForDrawer, setSelectedMemberForDrawer] = useState<TeamMember | null>(null);

  // Fallback to saved or initial sessions if prop is not passed
  const effectiveSessions = useMemo(() => {
    if (attendanceSessions !== undefined) return attendanceSessions;
    try {
      const saved = localStorage.getItem('team_data_attendance_v1') || localStorage.getItem('psg_tech_club_attendance_sessions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_ATTENDANCE_SESSIONS;
  }, [attendanceSessions]);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleType | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'name' | 'role' | 'team' | 'rollNo' | 'department' | 'year'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Alias hook to support queries for #member-search-input and #search-member-input
  React.useEffect(() => {
    const originalGetElementById = document.getElementById.bind(document);
    const originalQuerySelector = document.querySelector.bind(document);

    document.getElementById = (id: string) => {
      if (id === 'member-search-input') {
        return originalGetElementById('search-member-input') || originalGetElementById(id);
      }
      return originalGetElementById(id);
    };

    document.querySelector = (selector: string) => {
      if (selector === '#member-search-input') {
        return originalQuerySelector('#search-member-input') || originalQuerySelector(selector);
      }
      return originalQuerySelector(selector);
    };

    return () => {
      document.getElementById = originalGetElementById;
      document.querySelector = originalQuerySelector;
    };
  }, []);

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let list = members;

    // Search query - Real-time filtering by Name, ID (id & rollNo), or Role
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const searchTerms = q.split(/\s+/).filter(Boolean);

      list = list.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const memberId = (m.id || '').toLowerCase();
        const rollNo = (m.rollNo || '').toLowerCase();
        const role = (m.role || '').toLowerCase();
        const roleNormalized = role.replace('-', ' ');
        const team = (m.team || '').toLowerCase();
        const dept = (m.department || '').toLowerCase();
        const year = (m.year || '').toLowerCase();
        const phone = (m.phone || '').toLowerCase();

        // Direct match against name, ID (memberId or rollNo), role, and other fields
        const directMatch =
          name.includes(q) ||
          memberId.includes(q) ||
          rollNo.includes(q) ||
          role.includes(q) ||
          roleNormalized.includes(q) ||
          team.includes(q) ||
          dept.includes(q) ||
          year.includes(q) ||
          phone.includes(q);

        if (directMatch) return true;

        // If multi-word query (e.g. "Rahul Lead" or "Aarav Tech")
        if (searchTerms.length > 1) {
          return searchTerms.every(
            (term) =>
              name.includes(term) ||
              memberId.includes(term) ||
              rollNo.includes(term) ||
              role.includes(term) ||
              roleNormalized.includes(term) ||
              team.includes(term) ||
              dept.includes(term)
          );
        }

        return false;
      });
    }

    // Role filter
    if (roleFilter !== 'ALL') {
      list = list.filter((m) => m.role === roleFilter);
    }

    // Year filter
    if (yearFilter !== 'ALL') {
      list = list.filter((m) => m.year === yearFilter);
    }

    // Department filter
    if (departmentFilter !== 'ALL') {
      list = list.filter((m) => m.department === departmentFilter);
    }

    // Sort
    return [...list].sort((a, b) => {
      let comp = 0;
      if (sortField === 'name') {
        comp = a.name.localeCompare(b.name);
      } else if (sortField === 'role') {
        comp = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      } else if (sortField === 'team') {
        comp = a.team.localeCompare(b.team);
      } else if (sortField === 'rollNo') {
        comp = (a.rollNo || '').localeCompare(b.rollNo || '');
      } else if (sortField === 'department') {
        comp = (a.department || '').localeCompare(b.department || '');
      } else if (sortField === 'year') {
        comp = (a.year || '').localeCompare(b.year || '');
      }
      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [members, searchQuery, roleFilter, yearFilter, departmentFilter, sortField, sortOrder]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const paginatedMembers = useMemo(() => {
    if (pageSize >= 9999) return filteredMembers;
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  const handleSort = (field: 'name' | 'role' | 'team' | 'rollNo' | 'department' | 'year') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Control Bar */}
      <div className="no-print p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
        {/* Row 1: Search box & Primary Actions */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <label htmlFor="search-member-input" className="sr-only">
              Search members by name, ID, or role
            </label>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="search-member-input"
              data-testid="member-search-input"
              name="searchQuery"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, ID, or role..."
              aria-label="Search members by name, ID, or role"
              className="w-full pl-10 pr-16 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[40px]"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {filteredMembers.length}
                </span>
                <button
                  type="button"
                  id="clear-search-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold cursor-pointer px-1 py-0.5"
                  title="Clear search"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons: Add Member, Export, Import, Print */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {/* Add Member Button */}
            <button
              id="add-member-btn"
              onClick={onAddMember}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs shadow-indigo-600/20 transition-all cursor-pointer min-h-[42px]"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add Member</span>
            </button>

            {/* Export CSV Button */}
            <button
              id="export-current-csv-btn"
              onClick={() => onExportCsv(filteredMembers)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[42px]"
              title="Export all currently displayed results to CSV"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Export ({filteredMembers.length})</span>
            </button>

            {/* Import CSV Button */}
            {onImportCsv && (
              <label
                id="import-csv-label"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer min-h-[42px]"
                title="Import or upload members from CSV to database"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Import CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      const text = evt.target?.result as string;
                      if (!text) return;
                      const res = parseCsvToMembers(text, user.team);
                      if (res.success && res.members.length > 0) {
                        setCsvError(null);
                        const newMembers: TeamMember[] = res.members.map((m, idx) => ({
                          id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
                          ...m,
                          updatedAt: new Date().toISOString(),
                        }));
                        await onImportCsv(newMembers);
                      } else {
                        setCsvError(res.errors.join(' ') || 'Failed to parse CSV');
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            {/* Print / PDF Button */}
            <button
              id="print-members-btn"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[42px]"
              title="Print member list or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {csvError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
            <span>{csvError}</span>
            <button
              type="button"
              onClick={() => setCsvError(null)}
              className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer px-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Row 2: Dropdown Filters in Responsive Grid on mobile, flex on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Team Filter (Admin Only) */}
          {isAdmin && onSelectTeam && (
            <div
              className={`relative flex items-center border rounded-xl px-2.5 py-1.5 transition-all shadow-2xs min-h-[38px] ${
                selectedTeam !== 'ALL'
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700/80 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/10'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Users
                className={`w-3.5 h-3.5 shrink-0 mr-1.5 ${
                  selectedTeam !== 'ALL' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <select
                id="admin-table-team-filter-select"
                value={selectedTeam}
                onChange={(e) => {
                  onSelectTeam(e.target.value as TeamType | 'ALL');
                  setCurrentPage(1);
                }}
                className="appearance-none bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-5 w-full truncate"
                title="Filter members by Team"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                  All Teams ({allMembersList.length})
                </option>
                {TEAMS.map((team) => {
                  const count = allMembersList.filter((m) => m.team === team).length;
                  return (
                    <option key={team} value={team} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                      {team} Team ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                className={`w-3.5 h-3.5 pointer-events-none absolute right-2 ${
                  selectedTeam !== 'ALL' ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            </div>
          )}

          {/* Role Filter */}
          <div
            className={`relative flex items-center border rounded-xl px-2.5 py-1.5 transition-all shadow-2xs min-h-[38px] ${
              roleFilter !== 'ALL'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/10'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <Filter
              className={`w-3.5 h-3.5 shrink-0 mr-1.5 ${
                roleFilter !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
              }`}
            />
            <select
              id="role-filter-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as RoleType | 'ALL');
                setCurrentPage(1);
              }}
              className="appearance-none bg-transparent text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer pr-5 w-full truncate"
              title="Filter by Role"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                All Roles
              </option>
              <option value="LEAD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Leads
              </option>
              <option value="CO-LEAD" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Co-Leads
              </option>
              <option value="COORDINATOR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Coordinators
              </option>
              <option value="CORE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                Core
              </option>
            </select>
            <ChevronDown
              className={`w-3.5 h-3.5 pointer-events-none absolute right-2 ${
                roleFilter !== 'ALL' ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          </div>

          {/* Year of Study Filter */}
          <div
            className={`relative flex items-center border rounded-xl px-2.5 py-1.5 transition-all shadow-2xs min-h-[38px] ${
              yearFilter !== 'ALL'
                ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/10'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <Calendar
              className={`w-3.5 h-3.5 shrink-0 mr-1.5 ${
                yearFilter !== 'ALL' ? 'text-sky-600 dark:text-sky-400' : 'text-sky-500'
              }`}
            />
            <select
              id="year-filter-select"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none bg-transparent text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer pr-5 w-full truncate"
              title="Filter by Year of Study"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                All Years
              </option>
              {YEARS_OF_STUDY.map((y) => (
                <option key={y.value} value={y.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {y.value}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`w-3.5 h-3.5 pointer-events-none absolute right-2 ${
                yearFilter !== 'ALL' ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          </div>

          {/* Department Filter */}
          <div
            className={`col-span-2 sm:col-span-1 relative flex items-center border rounded-xl px-2.5 py-1.5 transition-all shadow-2xs sm:max-w-[260px] min-h-[38px] ${
              departmentFilter !== 'ALL'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/10'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <GraduationCap
              className={`w-3.5 h-3.5 shrink-0 mr-1.5 ${
                departmentFilter !== 'ALL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'
              }`}
            />
            <select
              id="department-filter-select"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none bg-transparent text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer truncate w-full pr-5"
              title="Filter by Department or Programme"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold">
                All Courses ({ALL_DEPARTMENTS.length})
              </option>
              {DEPARTMENT_CATEGORIES.map((cat) => (
                <optgroup
                  key={cat.id}
                  label={`${cat.categoryName} (${cat.courses.length})`}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                >
                  {cat.courses.map((course) => (
                    <option
                      key={course.name}
                      value={course.name}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-normal"
                    >
                      {course.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown
              className={`w-3.5 h-3.5 pointer-events-none absolute right-2 ${
                departmentFilter !== 'ALL' ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Active Filter Badges */}
        {(searchQuery.trim() || departmentFilter !== 'ALL' || roleFilter !== 'ALL' || yearFilter !== 'ALL' || (isAdmin && selectedTeam !== 'ALL')) && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5 animate-in fade-in duration-100">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Active Filters:</span>
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
                <Search className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                Query: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="hover:text-indigo-950 dark:hover:text-white ml-0.5 font-bold cursor-pointer"
                  title="Clear search query"
                >
                  ×
                </button>
              </span>
            )}
            {isAdmin && selectedTeam !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[11px] font-semibold">
                <Users className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                Team: {selectedTeam}
                <button
                  onClick={() => {
                    if (onSelectTeam) onSelectTeam('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-950 dark:hover:text-white ml-0.5 font-bold cursor-pointer"
                  title="Show all teams"
                >
                  ×
                </button>
              </span>
            )}
            {roleFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
                Role: {roleFilter}
                <button
                  onClick={() => {
                    setRoleFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-indigo-950 dark:hover:text-white ml-0.5 cursor-pointer"
                  title="Remove role filter"
                >
                  ×
                </button>
              </span>
            )}
            {yearFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[11px] font-semibold">
                Year: {yearFilter}
                <button
                  onClick={() => {
                    setYearFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-sky-950 dark:hover:text-white ml-0.5 cursor-pointer"
                  title="Remove year filter"
                >
                  ×
                </button>
              </span>
            )}
            {departmentFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold max-w-[280px]">
                <span className="truncate">Dept: {departmentFilter}</span>
                <button
                  onClick={() => {
                    setDepartmentFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="hover:text-indigo-950 dark:hover:text-white shrink-0 ml-0.5 cursor-pointer"
                  title="Remove department filter"
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={() => {
                if (isAdmin && onSelectTeam) onSelectTeam('ALL');
                setRoleFilter('ALL');
                setYearFilter('ALL');
                setDepartmentFilter('ALL');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-1 cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Table Interaction Hint */}
      <div className="screen-only px-4 py-2 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Eye className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Click any member row to view their detailed profile, last attendance date, and history log.</span>
        </span>
        <span className="hidden sm:inline-block text-[10px] text-slate-400 dark:text-slate-500">
          Showing {paginatedMembers.length} of {filteredMembers.length}
        </span>
      </div>

      {/* Mobile Member Cards View (screens < 640px) */}
      <div className="screen-only block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
        {paginatedMembers.length > 0 ? (
          paginatedMembers.map((member, idx) => {
            const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.CORE;
            const teamColor = TEAM_COLORS[member.team];
            const serialNumber = (currentPage - 1) * pageSize + idx + 1;
            const deptInfo = member.department ? findDepartment(member.department) : null;

            return (
              <div
                key={member.id}
                id={`member-card-${member.id}`}
                onClick={() => setSelectedMemberForDrawer(member)}
                className="p-3.5 space-y-2.5 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer"
                title="Click to view full details and attendance history"
              >
                {/* Header: Serial, Avatar, Name & Role/Team badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 w-5">
                      #{serialNumber}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-200 dark:border-indigo-800">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {member.name}
                      </h4>
                      {member.rollNo ? (
                        <span className="inline-flex items-center gap-1 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          <Hash className="w-2.5 h-2.5 text-slate-400" />
                          {member.rollNo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Roll No</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                    >
                      {member.role}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold border ${
                        teamColor ? `${teamColor.lightBg} ${teamColor.text} ${teamColor.border}` : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${teamColor?.bg || 'bg-slate-400'}`} />
                      {member.team}
                    </span>
                  </div>
                </div>

                {/* Details card: Year, Department, Phone */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-sky-500" />
                      Year:
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {member.year || 'Not specified'}
                    </span>
                  </div>

                  {member.department && (
                    <div className="flex items-start justify-between gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                        <GraduationCap className="w-3 h-3 text-indigo-500" />
                        Dept:
                      </span>
                      <div className="text-right min-w-0">
                        {deptInfo && (
                          <span className="inline-block mr-1 px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            {deptInfo.code || deptInfo.degree}
                          </span>
                        )}
                        <span className="font-medium text-slate-800 dark:text-slate-200 leading-tight">
                          {member.department}
                        </span>
                      </div>
                    </div>
                  )}

                  {member.phone && (
                    <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                        <Phone className="w-3 h-3 text-emerald-500" />
                        Phone:
                      </span>
                      <a
                        href={`tel:${member.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono font-semibold hover:underline"
                      >
                        {member.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Card Actions: View, Edit & Delete buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    id={`view-member-mobile-${member.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMemberForDrawer(member);
                    }}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors min-h-[42px] cursor-pointer shadow-2xs"
                    title="View full details and attendance history"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>View</span>
                  </button>
                  <button
                    id={`edit-member-mobile-${member.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditMember(member);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[42px] cursor-pointer shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Edit</span>
                  </button>
                  <button
                    id={`delete-member-mobile-${member.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMember(member);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors min-h-[42px] cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 px-4 text-center text-slate-500 dark:text-slate-400">
            <UserX className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              No team members found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? `No results matching "${searchQuery}".`
                : 'No records exist in this view.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('ALL');
                  setCurrentPage(1);
                }}
                className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop Table View (screens >= 640px) */}
      <div className="screen-only hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 w-12 text-slate-400 font-semibold">#</th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Member Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('rollNo')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Roll No</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('year')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Year</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('department')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Department</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">Phone No</th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Role</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  onClick={() => handleSort('team')}
                  className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Team</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {paginatedMembers.length > 0 ? (
              paginatedMembers.map((member, idx) => {
                const roleStyle = ROLE_STYLES[member.role] || ROLE_STYLES.CORE;
                const teamColor = TEAM_COLORS[member.team];
                const serialNumber = (currentPage - 1) * pageSize + idx + 1;

                const attStats = (() => {
                  let eligible = 0;
                  let attended = 0;
                  for (const s of effectiveSessions) {
                    if (s.team === 'ALL' || s.team === member.team) {
                      eligible++;
                      const rec = s.records ? s.records[member.id] : undefined;
                      if (rec && rec.status === 'PRESENT') {
                        attended++;
                      }
                    }
                  }
                  const pct = eligible > 0 ? Math.round((attended / eligible) * 100) : 0;
                  return { eligible, attended, pct };
                })();

                return (
                  <tr
                    key={member.id}
                    id={`member-row-${member.id}`}
                    onClick={() => setSelectedMemberForDrawer(member)}
                    className="transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer group"
                    title="Click row to view full details and attendance history"
                  >
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {serialNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center text-[10px] shrink-0 border border-slate-200 dark:border-slate-700 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition-colors">
                          {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {member.name}
                            </span>
                            {attStats.eligible > 0 && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                                  attStats.pct < 75
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                }`}
                                title={`Attendance: ${attStats.pct}% (${attStats.attended}/${attStats.eligible} sessions)`}
                              >
                                {attStats.pct}%
                                {attStats.pct < 75 && ' ⚠️ <75%'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {member.rollNo ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                          <Hash className="w-3 h-3 text-slate-400" />
                          {member.rollNo}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {member.year ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60 whitespace-nowrap">
                          <Calendar className="w-3 h-3 text-sky-500 shrink-0" />
                          {member.year}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {member.department ? (
                        <div className="inline-flex items-center gap-1.5 max-w-[260px]">
                          {(() => {
                            const deptInfo = findDepartment(member.department);
                            if (deptInfo) {
                              return (
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded shrink-0 ${
                                    deptInfo.degree === 'M.Sc'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                      : deptInfo.degree === 'B.Sc'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                      : deptInfo.category.includes('Sandwich')
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                  }`}
                                  title={deptInfo.category}
                                >
                                  {deptInfo.code || deptInfo.degree}
                                </span>
                              );
                            }
                            return <GraduationCap className="w-3 h-3 text-indigo-400 shrink-0" />;
                          })()}
                          <span className="text-xs truncate font-medium" title={member.department}>
                            {member.department}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {member.phone ? (
                        <a
                          href={`tel:${member.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-[11px]"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          {member.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          teamColor ? `${teamColor.lightBg} ${teamColor.text} ${teamColor.border}` : ''
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${teamColor?.bg || 'bg-slate-400'}`} />
                        {member.team}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          id={`view-member-${member.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMemberForDrawer(member);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                          title="View member details & attendance history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`edit-member-${member.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMember(member);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit member"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-member-${member.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMember(member);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <UserX className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      No team members found
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? `No results matching "${searchQuery}". Try adjusting your search term.`
                        : 'No records exist in this view.'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setRoleFilter('ALL');
                          setCurrentPage(1);
                        }}
                        className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary Bar */}
      <div className="screen-only p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredMembers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
            <strong className="text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * pageSize, filteredMembers.length)}
            </strong>{' '}
            of <strong className="text-slate-800 dark:text-slate-200">{filteredMembers.length}</strong>
          </span>
          <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
            <span className="text-[11px]">Per page:</span>
            <div className="relative inline-flex items-center">
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2 pr-5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value={15} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">15</option>
                <option value={25} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">25</option>
                <option value={50} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">50</option>
                <option value={100} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">100</option>
                <option value={9999} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500 pointer-events-none absolute right-1" />
            </div>
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex-1 sm:flex-initial flex items-center justify-center p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px] cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4 mr-1 sm:mr-0" />
            <span className="inline sm:hidden text-xs font-medium">Prev</span>
          </button>
          <span className="font-medium text-slate-800 dark:text-slate-200 px-2 text-center">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="flex-1 sm:flex-initial flex items-center justify-center p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px] cursor-pointer"
            title="Next page"
          >
            <span className="inline sm:hidden text-xs font-medium">Next</span>
            <ChevronRight className="w-4 h-4 ml-1 sm:ml-0" />
          </button>
        </div>
      </div>

      {/* Dedicated Clean Print Roster View */}
      <div className="print-only p-2">
        {/* Institutional Header */}
        <div className="print-report-header">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="institution-name">PSG COLLEGE OF TECHNOLOGY</h1>
              <h2 className="system-title">Team Data Management System • Official Member Directory</h2>
            </div>
            <div className="text-right text-[8pt] text-slate-600">
              <div><strong>PSG Tech Campus</strong></div>
              <div>Peelamedu, Coimbatore - 641004</div>
            </div>
          </div>
          <div className="meta-bar">
            <div>
              <strong>Team Scope:</strong> {selectedTeam === 'ALL' ? 'All 6 Teams (Combined)' : `${selectedTeam} Team`}
              {roleFilter !== 'ALL' && ` | Role: ${roleFilter}`}
              {yearFilter !== 'ALL' && ` | Year: ${yearFilter}`}
              {departmentFilter !== 'ALL' && ` | Dept: ${departmentFilter}`}
            </div>
            <div>
              <strong>Total Listed:</strong> {filteredMembers.length} Members | <strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Member Directory Table */}
        <table className="print-only">
          <thead>
            <tr>
              <th style={{ width: '4%' }} className="text-center">#</th>
              <th style={{ width: '13%' }}>Roll No</th>
              <th style={{ width: '22%' }}>Member Name</th>
              <th style={{ width: '10%' }}>Team</th>
              <th style={{ width: '11%' }}>Role</th>
              <th style={{ width: '22%' }}>Department / Programme</th>
              <th style={{ width: '6%' }} className="text-center">Year</th>
              <th style={{ width: '12%' }}>Phone No</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((m, idx) => (
                <tr key={`print-member-${m.id}`}>
                  <td className="text-center font-mono">{idx + 1}</td>
                  <td className="font-mono font-semibold">{m.rollNo || '—'}</td>
                  <td className="font-semibold">{m.name}</td>
                  <td>{m.team}</td>
                  <td>{m.role}</td>
                  <td>{m.department || '—'}</td>
                  <td className="text-center">{m.year ? m.year.replace(' Year', '') : '—'}</td>
                  <td className="font-mono">{m.phone || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-500">
                  No members found matching the selected filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Official Signatures Footer */}
        <div className="print-signature-footer">
          <div className="print-signature-box">
            Generated By: {user.name}
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

      {/* Member Detail Side-Drawer / Popover */}
      <MemberDetailDrawer
        isOpen={!!selectedMemberForDrawer}
        onClose={() => setSelectedMemberForDrawer(null)}
        member={selectedMemberForDrawer}
        sessions={effectiveSessions}
        user={user}
        onEditMember={onEditMember}
        onDeleteMember={onDeleteMember}
      />
    </div>
  );
};
