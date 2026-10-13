import { YEARS } from '../config/constants';

const collapse = (v: string) => v.replace(/\s+/g, ' ').trim();


export function normalizeRollNo(v: string): string {
  const s = v.replace(/\s+/g, '').toUpperCase();
  const excel = s.match(/^(\d)\.(\d)0*E\+(\d+)$/);
  if (excel) {
    const exponent = Number(excel[3]) - 1;
    if (exponent >= 0) return `${excel[1]}${excel[2]}E${String(exponent).padStart(3, '0')}`;
  }
  return s;
}


export function normalizeRole(v: string): string {
  const s = collapse(v).toUpperCase().replace(/[\s_]+/g, '-');
  const aliases: Record<string, string> = {
    COLEAD: 'CO-LEAD',
    'CO-ORDINATOR': 'COORDINATOR',
    COORDINATORS: 'COORDINATOR',
    LEADS: 'LEAD',
    MEMBER: 'CORE',
    MEMBERS: 'CORE',
  };
  return aliases[s] ?? s;
}

/** " tech " -> "TECH" */
export function normalizeTeam(v: string): string {
  return collapse(v).toUpperCase();
}

/** "2", "II", "second", "2nd yr" -> "2nd Year". Unrecognised input is returned as-is. */
export function normalizeYear(v: string): string | undefined {
  const s = collapse(v).toUpperCase();
  if (!s) return undefined;
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const words: Record<string, number> = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5 };
  const first = s.split(' ')[0];
  const digit = s.match(/[1-5]/)?.[0];
  const n = digit ? Number(digit) : (roman[first] ?? words[first]);
  return n ? YEARS[n - 1] : v;
}


export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;


export function normalizeTime(v: string): string {
  const s = v.trim().toLowerCase().replace(/\s+/g, ' ');
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m || (!m[2] && !m[3])) return v.trim(); // a bare "9" is ambiguous
  let hour = Number(m[1]);
  const minute = m[2] ?? '00';
  if (m[3]) {
    if (hour < 1 || hour > 12) return v.trim();
    if (m[3] === 'am' && hour === 12) hour = 0;
    if (m[3] === 'pm' && hour !== 12) hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${minute}`;
}


export function slotFromTime(time: string): 'FN' | 'AN' | 'EV' {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'FN';
  if (hour < 16) return 'AN';
  return 'EV';
}


export function optional<R>(fn: (v: string) => R) {
  return (v: unknown) => {
    if (typeof v !== 'string') return v;
    const out = fn(v);
    return out === '' ? undefined : out;
  };
}
import { DEPARTMENTS } from '../config/constants';

export function normalizeDepartment(v: string): string | undefined {
  const s = collapse(v).toLowerCase();
  if (!s) return undefined;
  
  // Try exact match case-insensitive
  const exact = DEPARTMENTS.find(d => d.toLowerCase() === s);
  if (exact) return exact;
  
  // Try common abbreviations (optional but helpful, let's keep it simple for now)
  // If we don't match, return original so Zod enum validation will fail it
  return v.trim();
}
