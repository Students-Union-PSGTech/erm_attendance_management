import { conflict } from './httpError';

/**
 * Meeting start times are wall-clock times in the app's time zone
 * (APP_TIMEZONE, default Asia/Kolkata), stored as date "YYYY-MM-DD" + startTime "HH:mm".
 * A meeting is "upcoming" until that moment; attendance can't be marked and it doesn't
 * count in any stats until then.
 */
const TZ = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';

/** Current time in the app's time zone as "YYYY-MM-DD HH:mm" (sortable as a string). */
export function nowKey(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** "YYYY-MM-DD HH:mm" for a session's start. */
export const startKey = (s: { date: string; startTime?: string | null }) => `${s.date} ${s.startTime || '00:00'}`;

/** Has the meeting started (or finished)? */
export const hasStarted = (s: { date: string; startTime?: string | null }, now = nowKey()) => startKey(s) <= now;

/** Refuse to record attendance for a meeting that hasn't started yet. */
export function assertStarted(s: { date: string; startTime?: string | null }) {
  if (!hasStarted(s)) {
    throw conflict(`This meeting is upcoming. Attendance opens at ${s.startTime || '00:00'} on ${s.date}.`);
  }
}