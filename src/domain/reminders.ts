import { isScheduled } from './cadence';
import { addDays, formatTime, parseLocalDate, toHHMM, today as localToday, WEEKDAY_SHORT, weekdayIndex, type LocalDate } from './dates';
import { currentStreak, isShielded, type HabitHistory } from './streak';
import type { Habit } from './types';

/**
 * Habit reminders are local notifications planned from the habit list, never
 * stored. Each occurrence is a one-off notification for a specific day, so a
 * reminder is skipped on rest days, vacation / freeze days and on a day the
 * habit is already done. The plan is rebuilt whenever habits or check-ins
 * change, which is how completing a habit cancels today's reminder.
 *
 * iOS keeps at most 64 pending local notifications per app, so the plan looks
 * `HORIZON_DAYS` ahead and is capped at `MAX_PENDING`, nearest first; it is
 * refilled every time the app opens.
 */
export const HORIZON_DAYS = 14;
export const MAX_PENDING = 60;

export type ReminderHabit = {
  habit: Pick<Habit, 'id' | 'name' | 'status' | 'reminderEnabled' | 'reminderTime' | 'targetLabel'>;
  history: HabitHistory;
};

export type PlannedReminder = {
  /** Stable per habit-day, e.g. `${habitId}_2026-10-20`. */
  id: string;
  habitId: string;
  date: LocalDate;
  /** Epoch ms of the local wall-clock fire time. */
  fireAt: number;
  title: string;
  body: string;
};

/** Local Date for `date` at 'HH:mm' on this device. */
export function fireTime(date: LocalDate, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = parseLocalDate(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isValidTime(hhmm: string | null): hhmm is string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(':').map(Number);
  return h < 24 && m < 60;
}

/** True when the habit needs doing on `date` (scheduled, not done, not covered by a freeze or vacation). */
export function isDue(history: HabitHistory, date: LocalDate): boolean {
  return (
    isScheduled(history.cadence, date) &&
    !history.completedDates.has(date) &&
    !history.frozenDates.has(date) &&
    !isShielded(history.vacations, history.habitId, date)
  );
}

function body(r: ReminderHabit, date: LocalDate, todayDate: LocalDate): string {
  const streak = date === todayDate ? currentStreak(r.history, todayDate) : 0;
  const target = r.habit.targetLabel ? `${r.habit.targetLabel}. ` : '';
  if (streak > 0) return `${target}Keep your ${streak}-day streak going. Hold to check in.`;
  return `${target}Time to check in. Small actions, big momentum.`;
}

export function planReminders(habits: readonly ReminderHabit[], now: Date = new Date(), horizon = HORIZON_DAYS): PlannedReminder[] {
  const todayDate = localToday(now);
  const out: PlannedReminder[] = [];
  for (const r of habits) {
    const { habit } = r;
    if (habit.status !== 'active' || !habit.reminderEnabled || !isValidTime(habit.reminderTime)) continue;
    for (let i = 0; i < horizon; i++) {
      const date = addDays(todayDate, i);
      if (!isDue(r.history, date)) continue;
      const at = fireTime(date, habit.reminderTime).getTime();
      if (at <= now.getTime()) continue;
      out.push({ id: `${habit.id}_${date}`, habitId: habit.id, date, fireAt: at, title: habit.name, body: body(r, date, todayDate) });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt || a.id.localeCompare(b.id)).slice(0, MAX_PENDING);
}

/** Cheap equality key so an unchanged plan is not rescheduled. */
export function planSignature(plan: readonly PlannedReminder[]): string {
  return plan.map((p) => `${p.id}@${p.fireAt}:${p.title}|${p.body}`).join('\n');
}

/** "today at 8:00 AM", "tomorrow at 8:00 AM", "Thu at 8:00 AM". */
export function describeWhen(r: Pick<PlannedReminder, 'date' | 'fireAt'>, now: Date = new Date()): string {
  const t = localToday(now);
  const day = r.date === t ? 'today' : r.date === addDays(t, 1) ? 'tomorrow' : WEEKDAY_SHORT[weekdayIndex(r.date)];
  return `${day} at ${formatTime(toHHMM(new Date(r.fireAt)))}`;
}
