// Domain enums from the SRS (FR-2.2, FR-2.3, FR-2.12, FR-3.2, FR-3.5)
export const ROLES = ['LEAD', 'CO-LEAD', 'COORDINATOR', 'CORE'] as const;
export type Role = (typeof ROLES)[number];

export const TEAMS = ['MEDIA', 'AMBIANCE', 'PR', 'TECH', 'ERM', 'DESIGN'] as const;
export type Team = (typeof TEAMS)[number];

export const SESSION_TEAMS = [...TEAMS, 'ALL'] as const;
export type SessionTeam = (typeof SESSION_TEAMS)[number];

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'] as const;
export type Year = (typeof YEARS)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'INFORMED'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const SESSION_SLOTS = ['FN', 'AN', 'EV'] as const;
export type SessionSlot = (typeof SESSION_SLOTS)[number];

export const USER_ROLES = ['admin', 'team'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// FR-4.8: keep bulk writes well under MongoDB/driver comfort limits
export const BATCH_CHUNK_SIZE = 400;

// FR-4.9: legacy member ids to purge on startup
export const LEGACY_MEMBER_PREFIX = 'mem-';

// Ids are used as keys in session.records, so keep them to safe characters
export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const DEPARTMENTS = [
  "B.E. Automobile Engineering",
  "B.E. Biomedical Engineering",
  "B.E. Civil Engineering",
  "B.E. Computer Science and Engineering",
  "B.E. Computer Science and Engineering (AI and ML)",
  "B.E. Electrical and Electronics Engineering",
  "B.E. Electronics and Communication Engineering",
  "B.E. Instrumentation and Control Engineering",
  "B.E. Mechanical Engineering",
  "B.E. Metallurgical Engineering",
  "B.E. Production Engineering",
  "B.E. Robotics and Automation",
  "B.Tech Biotechnology",
  "B.Tech Fashion Technology",
  "B.Tech Information Technology",
  "B.Tech Textile Technology",
  "B.E. Electrical and Electronics Engineering (Sandwich)",
  "B.E. Mechanical Engineering (Sandwich)",
  "B.E. Production Engineering (Sandwich)",
  "B.Sc Applied Science",
  "B.Sc Computer Systems & Design",
  "M.Sc Software Systems",
  "M.Sc Theoretical Computer Science",
  "M.Sc Data Science",
  "M.Sc Cyber Security",
  "M.Sc Computational Finance",
  "M.Sc Fashion Design & Merchandising"
] as const;
export type Department = (typeof DEPARTMENTS)[number];
