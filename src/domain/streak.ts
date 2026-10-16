import { isScheduled } from './cadence';
import { addDays, dateRange, diffDays, type LocalDate } from './dates';
import type { Cadence, Vacation } from './types';

/**
 * Status of one calendar day for one habit.
 *
 * - completed: checked in
 * - frozen:    a streak freeze covered it (counts toward the streak, as in
 *              the Streak Freeze & Repair design: 24d -> 25d "Safeguarded")
 * - shielded:  inside a vacation buffer (keeps the chain, does not add to it:
 *              "Momentum frozen at 18 days with zero penalty")
 * - rest:      not scheduled by the cadence
 * - missed:    scheduled, past, and none of the above
 * - pending:   today, scheduled, not yet done
 * - future
 */
export type DayStatus = 'completed' | 'frozen' | 'shielded' | 'rest' | 'missed' | 'pending' | 'future';

export type HabitHistory = {
  cadence: Cadence;
  completedDates: ReadonlySet<LocalDate>;
  frozenDates: ReadonlySet<LocalDate>;
  vacations: readonly Vacation[];
  habitId: string;
};

export function isShielded(vacations: readonly Vacation[], habitId: string, date: LocalDate): boolean {
  return vacations.some((v) => {
    const end = v.endedEarlyOn && diffDays(v.endedEarlyOn, v.endDate) > 0 ? addDays(v.endedEarlyOn, -1) : v.endDate;
    return (
      diffDays(v.startDate, date) >= 0 &&
      diffDays(date, end) >= 0 &&
      (v.habitIds === null || v.habitIds.includes(habitId))
    );
  });
}

export function dayStatus(h: HabitHistory, date: LocalDate, todayDate: LocalDate): DayStatus {
  // A completion always wins, even on rest days (an "optional session").
  if (h.completedDates.has(date)) return 'completed';
  const delta = diffDays(todayDate, date);
  if (delta > 0) return 'future';
  if (!isScheduled(h.cadence, date)) return 'rest';
  if (h.frozenDates.has(date)) return 'frozen';
  if (isShielded(h.vacations, h.habitId, date)) return 'shielded';
  if (delta === 0) return 'pending';
  return 'missed';
}

const COUNTS: Record<DayStatus, 'count' | 'keep' | 'break'> = {
  completed: 'count',
  frozen: 'count',
  shielded: 'keep',
  rest: 'keep',
  pending: 'keep', // today isn't over yet
  future: 'keep',
  missed: 'break',
};

/** Current streak: walks back from today until a missed scheduled day. */
export function currentStreak(h: HabitHistory, todayDate: LocalDate): number {
  let streak = 0;
  for (let d = todayDate; diffDays(h.cadence.startDate, d) >= 0; d = addDays(d, -1)) {
    const effect = COUNTS[dayStatus(h, d, todayDate)];
    if (effect === 'break') break;
    if (effect === 'count') streak++;
  }
  return streak;
}

/** Longest streak over the habit's whole history up to today. */
export function bestStreak(h: HabitHistory, todayDate: LocalDate): number {
  let best = 0;
  let run = 0;
  for (const d of dateRange(h.cadence.startDate, todayDate)) {
    const effect = COUNTS[dayStatus(h, d, todayDate)];
    if (effect === 'break') run = 0;
    else if (effect === 'count') best = Math.max(best, ++run);
  }
  return best;
}

/**
 * Consistency %: share of scheduled, already-decided days in the window that
 * were completed or frozen. Shielded days are excluded from the denominator.
 * Returns null when there is nothing to measure yet ("--%" in the designs).
 */
export function consistency(h: HabitHistory, from: LocalDate, todayDate: LocalDate): number | null {
  const start = diffDays(h.cadence.startDate, from) >= 0 ? from : h.cadence.startDate;
  let done = 0;
  let total = 0;
  for (const d of dateRange(start, todayDate)) {
    const s = dayStatus(h, d, todayDate);
    if (s === 'completed' || s === 'frozen') {
      done++;
      total++;
    } else if (s === 'missed') total++;
  }
  return total === 0 ? null : Math.round((done / total) * 100);
}

export function historyFrom(
  habit: { id: string; cadence: Cadence },
  completedDates: Iterable<LocalDate>,
  frozenDates: Iterable<LocalDate> = [],
  vacations: readonly Vacation[] = [],
): HabitHistory {
  return {
    habitId: habit.id,
    cadence: habit.cadence,
    completedDates: new Set(completedDates),
    frozenDates: new Set(frozenDates),
    vacations,
  };
}
