/**
 * Calendar-date helpers.
 *
 * Habits are tracked per *local calendar day*, stored as 'YYYY-MM-DD'
 * strings (LocalDate). Timestamps (completedAt etc.) are epoch ms.
 * Weekday index follows the Stitch designs: Monday = 0 ... Sunday = 6.
 */
export type LocalDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** Parses at local noon so DST shifts never move the date. */
export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(s: LocalDate): number {
  return (parseLocalDate(s).getDay() + 6) % 7;
}

export function startOfWeek(s: LocalDate): LocalDate {
  return addDays(s, -weekdayIndex(s));
}

/** The 7 dates of the Monday-start week containing `s`. */
export function weekDates(s: LocalDate): LocalDate[] {
  const start = startOfWeek(s);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = diffDays(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Apr 14" */
export function formatMonthDay(s: LocalDate): string {
  const d = parseLocalDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "06:30" -> "6:30 AM" */
export function formatTime(hhmm: string, opts: { padHour?: boolean } = {}): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${opts.padHour ? pad(hour12) : hour12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Epoch ms -> "07:14 AM" */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`, { padHour: true });
}

/** Date -> local 'HH:mm'. */
export function toHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local 'HH:mm' -> a Date today at that time (for time pickers). */
export function fromHHMM(s: string): Date {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
