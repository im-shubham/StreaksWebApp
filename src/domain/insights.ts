import { addDays, dateRange, diffDays, startOfWeek, type LocalDate } from './dates';
import { bestStreak, currentStreak, dayStatus, type HabitHistory } from './streak';
import type { HabitStatus } from './types';

/**
 * Insights are derived on the fly from habits + completions (+ freezes and
 * vacations, through HabitHistory). Nothing here is persisted.
 *
 * Rate rule (the same one `consistency()` uses per habit): a day counts for
 * a habit when it was scheduled and is already decided. Completed or frozen
 * days are "done"; missed days are "due but not done". Rest days, vacation
 * days, days before the habit existed, today-not-yet-done and future days
 * are left out, so a habit created mid-period is only measured from its
 * start date.
 *
 * Paused habits: there is no stored pause date, so a paused habit's unchecked
 * days are treated as not scheduled rather than invented misses. Its
 * check-ins still count.
 */
export type InsightsPeriod = 'week' | 'month' | 'all';

export type InsightsHabit = { id: string; name: string; status: HabitStatus; history: HabitHistory };

export type DayKind = 'complete' | 'partial' | 'missed' | 'pending' | 'rest' | 'future';

export type DayAggregate = {
  date: LocalDate;
  kind: DayKind;
  /** Habits done (completed or frozen) that day. */
  done: number;
  /** Habits due and decided (done + missed). */
  due: number;
  /** Habits scheduled today and not yet done. */
  pending: number;
  /** Names of habits checked in that day. */
  completedNames: string[];
};

export function dayAggregate(habits: readonly InsightsHabit[], date: LocalDate, todayDate: LocalDate): DayAggregate {
  let done = 0;
  let due = 0;
  let pending = 0;
  const completedNames: string[] = [];
  for (const h of habits) {
    const s = dayStatus(h.history, date, todayDate);
    if (s === 'completed' || s === 'frozen') {
      done++;
      due++;
      if (s === 'completed') completedNames.push(h.name);
    } else if (s === 'missed' && h.status !== 'paused') due++;
    else if (s === 'pending' && h.status !== 'paused') pending++;
  }
  let kind: DayKind;
  if (diffDays(todayDate, date) > 0) kind = 'future';
  else if (due === 0 && pending === 0) kind = 'rest';
  else if (done > 0 && done === due && pending === 0) kind = 'complete';
  else if (done > 0) kind = 'partial';
  else kind = pending > 0 ? 'pending' : 'missed';
  return { date, kind, done, due, pending, completedNames };
}

/** First day of the period, in local calendar dates. `all` starts at the earliest habit start or check-in. */
export function periodStart(period: InsightsPeriod, todayDate: LocalDate, habits: readonly InsightsHabit[]): LocalDate {
  if (period === 'week') return startOfWeek(todayDate);
  if (period === 'month') return `${todayDate.slice(0, 7)}-01`;
  let earliest = todayDate;
  for (const h of habits) {
    if (diffDays(h.history.cadence.startDate, earliest) > 0) earliest = h.history.cadence.startDate;
    for (const d of h.history.completedDates) if (diffDays(d, earliest) > 0) earliest = d;
  }
  return earliest;
}

export type StreakHighlight = { days: number; habitName: string | null };

export type PeriodSummary = {
  from: LocalDate;
  to: LocalDate;
  done: number;
  due: number;
  missed: number;
  /** Whole percent, or null when nothing in the period was due yet. */
  rate: number | null;
};

export function summarizePeriod(
  habits: readonly InsightsHabit[],
  period: InsightsPeriod,
  todayDate: LocalDate,
): PeriodSummary {
  const from = periodStart(period, todayDate, habits);
  let done = 0;
  let due = 0;
  for (const d of dateRange(from, todayDate)) {
    const a = dayAggregate(habits, d, todayDate);
    done += a.done;
    due += a.due;
  }
  return { from, to: todayDate, done, due, missed: due - done, rate: due === 0 ? null : Math.round((done / due) * 100) };
}

/** Longest current run among active habits, and the best run ever among all listed habits. */
export function streakHighlights(habits: readonly InsightsHabit[], todayDate: LocalDate) {
  const current: StreakHighlight = { days: 0, habitName: null };
  const best: StreakHighlight = { days: 0, habitName: null };
  for (const h of habits) {
    if (h.status === 'active') {
      const c = currentStreak(h.history, todayDate);
      if (c > current.days) Object.assign(current, { days: c, habitName: h.name });
    }
    const b = bestStreak(h.history, todayDate);
    if (b > best.days) Object.assign(best, { days: b, habitName: h.name });
  }
  return { current, best };
}

export const HEATMAP_WEEKS = 14;

/** Monday-start weeks ending with the current week; each inner array is Mon..Sun. */
export function heatmap(habits: readonly InsightsHabit[], todayDate: LocalDate, weeks = HEATMAP_WEEKS): DayAggregate[][] {
  const first = addDays(startOfWeek(todayDate), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => dayAggregate(habits, addDays(first, w * 7 + i), todayDate)),
  );
}

export type ActivityItem = { id: string; habitId: string; habitName: string; localDate: LocalDate; completedAt: number };

/** Most recent check-ins of the listed habits, newest first (one per habit-day by construction). */
export function recentActivity(
  completions: readonly { id: string; habitId: string; localDate: LocalDate; completedAt: number }[],
  habits: readonly InsightsHabit[],
  limit = 5,
): ActivityItem[] {
  const names = new Map(habits.map((h) => [h.id, h.name]));
  const seen = new Set<string>();
  return completions
    .filter((c) => names.has(c.habitId))
    .sort((a, b) => (a.localDate === b.localDate ? b.completedAt - a.completedAt : a.localDate < b.localDate ? 1 : -1))
    .filter((c) => {
      const key = `${c.habitId}_${c.localDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((c) => ({ id: c.id, habitId: c.habitId, habitName: names.get(c.habitId)!, localDate: c.localDate, completedAt: c.completedAt }));
}
