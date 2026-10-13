
import { z } from 'zod';
import { ID_PATTERN, ROLES, TEAMS, YEARS, DEPARTMENTS } from '../config/constants';
import { normalizeRole, normalizeRollNo, normalizeTeam, normalizeYear, normalizeDepartment, optional } from '../utils/normalize';

// Free text stored as entered (trimmed); "" -> undefined
const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const memberCreateSchema = z.object({
  // Optional client-generated id so the frontend can do optimistic updates (FR-4.6)
  id: z.string().regex(/^custom-\d+-[A-Za-z0-9]+$/, 'id must look like custom-{timestamp}-{random}').optional(),
  name: z.string({ required_error: 'name is required' }).trim().min(1, 'name is required').max(120),
  // Normalized fields (utils/normalize.ts)
  role: z.preprocess(optional(normalizeRole), z.enum(ROLES)),
  team: z.preprocess(optional(normalizeTeam), z.enum(TEAMS)),
  rollNo: z.preprocess(optional(normalizeRollNo), z.string().max(40).optional()),
  year: z.preprocess(optional(normalizeYear), z.enum(YEARS).optional()),
  department: z.preprocess(optional(normalizeDepartment), z.enum(DEPARTMENTS).optional()),
  // Stored as entered
  phone: optionalText,
  photo: optionalText,
});

export const memberUpdateSchema = memberCreateSchema.omit({ id: true }).partial();

export const idParamSchema = z.string().regex(ID_PATTERN, 'invalid id');

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;