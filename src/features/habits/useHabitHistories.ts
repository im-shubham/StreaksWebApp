import { useMemo } from 'react';

import { useLiveQueryState } from '@/db/live';
import { COMPLETIONS_SQL, type CompletionRow } from '@/db/repositories/completions';
import { HABITS_SQL, rowToHabit, type HabitRow } from '@/db/repositories/habits';
import { historyFrom, type HabitHistory } from '@/domain/streak';
import type { Habit, Vacation } from '@/domain/types';

type VacationRow = { id: string; start_date: string; end_date: string; habit_ids: string | null; ended_early_on: string | null };

export type HabitWithHistory = { habit: Habit; history: HabitHistory };

/**
 * Live (non-archived) habits with their check-in / freeze / vacation history,
 * re-read whenever any of those tables change. Shared by Insights and the
 * reminder scheduler.
 */
export function useHabitHistories() {
  const habitsQ = useLiveQueryState<HabitRow>(HABITS_SQL.live, [], ['habits']);
  const completionsQ = useLiveQueryState<CompletionRow>(COMPLETIONS_SQL.all, [], ['completions', 'habits']);
  const freezesQ = useLiveQueryState<{ habit_id: string; local_date: string }>(COMPLETIONS_SQL.freezes, [], ['freeze_events']);
  const vacationsQ = useLiveQueryState<VacationRow>(COMPLETIONS_SQL.vacations, [], ['vacations']);

  const habitRows = habitsQ.rows;
  const completionRows = completionsQ.rows;
  const freezeRows = freezesQ.rows;
  const vacationRows = vacationsQ.rows;

  const habits = useMemo(() => {
    if (!habitRows || !completionRows || !freezeRows || !vacationRows) return undefined;
    const vacations: Vacation[] = vacationRows.map((v) => ({
      id: v.id,
      startDate: v.start_date,
      endDate: v.end_date,
      habitIds: v.habit_ids ? (JSON.parse(v.habit_ids) as string[]) : null,
      endedEarlyOn: v.ended_early_on,
    }));
    const dates = new Map<string, string[]>();
    for (const c of completionRows) dates.set(c.habit_id, [...(dates.get(c.habit_id) ?? []), c.local_date]);
    const frozen = new Map<string, string[]>();
    for (const f of freezeRows) frozen.set(f.habit_id, [...(frozen.get(f.habit_id) ?? []), f.local_date]);
    return habitRows.map((row): HabitWithHistory => {
      const habit = rowToHabit(row);
      return { habit, history: historyFrom(habit, dates.get(habit.id) ?? [], frozen.get(habit.id) ?? [], vacations) };
    });
  }, [habitRows, completionRows, freezeRows, vacationRows]);

  const queries = [habitsQ, completionsQ, freezesQ, vacationsQ];
  const error = queries.find((q) => q.error)?.error ?? null;
  const retry = () => {
    for (const q of queries) void q.retry();
  };
  return { habits, completionRows, error, retry };
}
