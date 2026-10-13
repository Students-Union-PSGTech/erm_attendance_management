/**
 * A meeting is "upcoming" until its date + start time (browser's local time).
 * Upcoming meetings can't be marked and are left out of every attendance stat.
 * The backend enforces the same rule (APP_TIMEZONE, default Asia/Kolkata).
 */

type Timed = { date: string; startTime?: string | null };

// const pad = (n: number) => String(n).padStart(2, '0');

/** Current local time as "YYYY-MM-DD HH:mm" (sortable as a string). */
export function nowKey(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', // keep in sync with backend APP_TIMEZONE
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

export const startKey = (s: Timed) => `${s.date} ${s.startTime || '00:00'}`;

/** True until the meeting's start time. */
export const isUpcoming = (s: Timed, now = nowKey()) => startKey(s) > now;

/** "Opens 16 Oct, 17:00" */
export function opensLabel(s: Timed): string {
  const d = new Date(`${s.date}T00:00:00`);
  const day = isNaN(d.getTime()) ? s.date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Opens ${day}, ${s.startTime || '00:00'}`;
}