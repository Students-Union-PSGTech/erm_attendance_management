import { parse } from 'csv-parse/sync';
import { ROLES, TEAMS, YEARS } from '../config/constants';
import { memberCreateSchema, type MemberCreateInput } from '../validators/member.validators';

type Field = 'name' | 'rollNo' | 'department' | 'year' | 'phone' | 'role' | 'team';


const HEADER_RULES: [Field, RegExp][] = [
  ['rollNo', /roll|regno|register/],
  ['department', /dept|department|course|branch/],
  ['year', /year/],
  ['phone', /phone|mobile|contact/],
  ['team', /team/],
  ['role', /role|position|designation/],
  ['name', /name/],
];

function mapHeaders(headers: string[]): Map<number, Field> {
  const mapping = new Map<number, Field>();
  const used = new Set<Field>();
  headers.forEach((raw, idx) => {
    const h = raw.toLowerCase().replace(/[^a-z]/g, '');
    const rule = HEADER_RULES.find(([field, re]) => !used.has(field) && re.test(h));
    if (rule) {
      mapping.set(idx, rule[0]);
      used.add(rule[0]);
    }
  });
  return mapping;
}

export interface CsvParseResult {
  members: MemberCreateInput[];
  errors: { row: number; message: string }[];
}

export function parseMembersCsv(text: string): CsvParseResult {
  const rows: string[][] = parse(text, { skip_empty_lines: true, trim: true, bom: true });
  if (rows.length === 0) return { members: [], errors: [{ row: 0, message: 'Empty CSV' }] };

  const mapping = mapHeaders(rows[0]);
  if (![...mapping.values()].includes('name')) {
    return { members: [], errors: [{ row: 1, message: 'No "name" column found in header' }] };
  }

  const members: MemberCreateInput[] = [];
  const errors: CsvParseResult['errors'] = [];

  rows.slice(1).forEach((cells, i) => {
    const raw: Record<string, string | undefined> = {};
    mapping.forEach((field, idx) => {
      const val = cells[idx]?.trim();
      if (val) raw[field] = val;
    });
    // All field normalization happens inside memberCreateSchema (utils/normalize.ts)
    if (!raw.role) raw.role = 'CORE';

    const result = memberCreateSchema.safeParse(raw);
    if (result.success) members.push(result.data);
    else
      errors.push({
        row: i + 2, // 1-based, plus header row
        message: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      });
  });

  return { members, errors };
}



const EXPORT_COLUMNS = ['NAME', 'ROLL NO', 'DEPARTMENT', 'YEAR OF STUDY', 'PHONE', 'ROLE', 'TEAM'];

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function membersToCsv(
  members: { name: string; rollNo?: string | null; department?: string | null; year?: string | null; phone?: string | null; role: string; team: string }[],
): string {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const m of members) {
    lines.push(
      [m.name, m.rollNo, m.department, m.year, m.phone, m.role, m.team].map(escapeCell).join(','),
    );
  }
  return lines.join('\r\n');
}

// Re-exported for convenience in error messages
export const VALID = { ROLES, TEAMS, YEARS };