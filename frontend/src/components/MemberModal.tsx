import React, { useState, useEffect } from 'react';
import { TeamMember, RoleType, TeamType, AuthUser } from '../types';
import { TEAMS } from '../data/initialData';
import { DepartmentSelect } from './DepartmentSelect';
import { YEARS_OF_STUDY } from '../data/departments';
import { X, UserPlus, UserCheck, AlertCircle, Calendar, ChevronDown } from 'lucide-react';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: Omit<TeamMember, 'id'>, id?: string) => void;
  editingMember: TeamMember | null;
  currentUser: AuthUser;
  defaultTeam?: TeamType;
}

const ROLES: RoleType[] = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'];

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMember,
  currentUser,
  defaultTeam,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const initialTeam: TeamType =
    editingMember?.team ||
    (isAdmin ? (defaultTeam && defaultTeam !== ('ALL' as any) ? defaultTeam : 'MEDIA') : currentUser.team || 'MEDIA');

  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleType>('CORE');
  const [team, setTeam] = useState<TeamType>(initialTeam);
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingMember) {
      setName(editingMember.name);
      setRole(editingMember.role);
      setTeam(editingMember.team);
      setRollNo(editingMember.rollNo || '');
      setDepartment(editingMember.department || '');
      setYear(editingMember.year || '');
      setPhone(editingMember.phone || '');
    } else {
      setName('');
      setRole('CORE');
      setRollNo('');
      setDepartment('');
      setYear('');
      setPhone('');
      setTeam(
        isAdmin
          ? defaultTeam && defaultTeam !== ('ALL' as any)
            ? defaultTeam
            : 'MEDIA'
          : currentUser.team || 'MEDIA'
      );
    }
    setError(null);
  }, [editingMember, isOpen, defaultTeam, isAdmin, currentUser.team]);

  // Roll number helper: auto-suggest year if user hasn't picked one yet
  const handleRollNoChange = (val: string) => {
    setRollNo(val);
    if (!year) {
      const match = val.trim().match(/^(\d{2})/);
      if (match) {
        const prefix = match[1];
        if (prefix === '25') setYear('1st Year');
        else if (prefix === '24') setYear('2nd Year');
        else if (prefix === '23') setYear('3rd Year');
        else if (prefix === '22') setYear('4th Year');
        else if (prefix === '21') setYear('5th Year');
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Member name is required.');
      return;
    }

    const assignedTeam: TeamType = isAdmin ? team : currentUser.team || 'MEDIA';

    onSave(
      {
        name: name.trim(),
        role,
        team: assignedTeam,
        rollNo: rollNo.trim() || undefined,
        department: department.trim() || undefined,
        year: year.trim() || undefined,
        phone: phone.trim() || undefined,
      },
      editingMember?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="member-form-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              {editingMember ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                {editingMember ? 'Edit Member Details' : 'Add New Team Member'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {editingMember ? 'Update member profile information' : 'Enter profile, academic, and contact details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto overscroll-contain flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              id="member-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KARTHICK J S"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[44px]"
            />
          </div>

          {/* Roll No & Year of Study Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Roll Number
              </label>
              <input
                id="member-rollno-input"
                type="text"
                value={rollNo}
                onChange={(e) => handleRollNoChange(e.target.value)}
                placeholder="e.g. 23M906 or 22CS104"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Year of Studying
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="member-year-select"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer min-h-[44px]"
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-400">
                    Select Year of Study...
                  </option>
                  {YEARS_OF_STUDY.map((y) => (
                    <option key={y.value} value={y.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {y.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Department / Course (Full Row) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Department / Course
              </label>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                27 Courses Available
              </span>
            </div>
            <DepartmentSelect
              id="member-department-select"
              value={department}
              onChange={(val) => setDepartment(val)}
              placeholder="Select or search course..."
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone Number
            </label>
            <input
              id="member-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[44px]"
            />
          </div>

          {/* Role & Team Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Assignment *
              </label>
              <div className="relative">
                <select
                  id="member-role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Team Department *
              </label>
              {isAdmin ? (
                <div className="relative">
                  <select
                    id="member-team-select"
                    value={team}
                    onChange={(e) => setTeam(e.target.value as TeamType)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
                  >
                    {TEAMS.map((t) => (
                      <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between min-h-[44px]">
                  <span>{currentUser.team}</span>
                  <span className="text-[11px] font-normal text-slate-400">Locked</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3.5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[44px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="member-save-btn"
              type="submit"
              className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-500/20 transition-all min-h-[44px] cursor-pointer"
            >
              {editingMember ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
