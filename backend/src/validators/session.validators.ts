import { z } from 'zod';
import { ATTENDANCE_STATUSES, ID_PATTERN, SESSION_SLOTS, SESSION_TEAMS } from '../config/constants';
import { normalizeTime, optional, slotFromTime, TIME_PATTERN } from '../utils/normalize';

export const attendanceEntrySchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().trim().max(500).optional(),
  markedAt: z.string().datetime().optional(),
});

const recordsSchema = z.record(z.string().regex(ID_PATTERN, 'invalid member id'), attendanceEntrySchema);

const TIME_MESSAGE = 'time must be HH:mm (24-hour), e.g. 09:30 or 14:15';

const time = z.string().regex(TIME_PATTERN, TIME_MESSAGE);

const baseSession = z.object({
  id: z.string().regex(/^session-\d+-[A-Za-z0-9]+$/, 'id must look like session-{timestamp}-{random}').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  startTime: z.preprocess(optional(normalizeTime), time),
  
  endTime: z.preprocess(optional(normalizeTime), time.nullable().optional()),
  
  sessionSlot: z.enum(SESSION_SLOTS).optional(),
  title: z.string().trim().min(1).max(200),
  team: z.enum(SESSION_TEAMS).default('ALL'),
  records: recordsSchema.default({}),
  notes: z.string().trim().max(1000).optional(),
});

function endAfterStart(v: { startTime?: string; endTime?: string | null }, ctx: z.RefinementCtx) {
  if (v.startTime && v.endTime && v.endTime <= v.startTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'endTime must be after startTime' });
  }
}

export const sessionCreateSchema = baseSession
  .superRefine(endAfterStart)
  .transform((v) => ({ ...v, sessionSlot: v.sessionSlot ?? slotFromTime(v.startTime) }));

// Cross-field check against the stored session happens in the controller
export const sessionUpdateSchema = baseSession.omit({ id: true }).partial().superRefine(endAfterStart);

export const sessionQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  team: z.enum(SESSION_TEAMS).optional(),
});

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;
export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;