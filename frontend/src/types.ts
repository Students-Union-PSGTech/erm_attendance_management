export type TeamType = 'MEDIA' | 'AMBIANCE' | 'PR' | 'TECH' | 'ERM' | 'DESIGN';

export type RoleType = 'LEAD' | 'CO-LEAD' | 'COORDINATOR' | 'CORE';

export interface TeamMember {
  id: string;
  name: string;
  role: RoleType;
  team: TeamType;
  rollNo?: string;
  department?: string;
  year?: string;
  phone?: string;
  updatedAt?: string;
}

export type AuthRole = 'admin' | 'team';

export interface AuthUser {
  username: string;
  name: string;
  role: AuthRole;
  team?: TeamType;
  label: string;
}

export interface CredentialInfo {
  username: string;
  password: string;
  role: AuthRole;
  team?: TeamType;
  label: string;
  description: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'INFORMED';

export type SessionSlot = 'FN' | 'AN';

export interface AttendanceEntry {
  status: AttendanceStatus;
  notes?: string;
  markedAt?: string;
}

export interface AttendanceSession {
  id: string;
  date: string; // YYYY-MM-DD
  sessionSlot?: SessionSlot; // 'FN' | 'AN'
  title: string;
  team: TeamType | 'ALL';
  records: Record<string, AttendanceEntry>; // key: memberId
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ActiveTab = 'members' | 'attendance';
