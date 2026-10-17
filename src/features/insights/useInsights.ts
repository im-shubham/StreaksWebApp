import { useMemo } from 'react';

import { useLiveQueryState } from '@/db/live';
import { COMPLETIONS_SQL, type CompletionRow } from '@/db/repositories/completions';
import { HABITS_SQL, rowToHabit, type HabitRow } from '@/db/repositories/habits';
import type { LocalDate } from '@/domain/dates';
import {
  heatmap,
  recentActivity,
  streakHighlights,
  summarizePeriod,
  type ActivityItem,
  type DayAggregate,
  type InsightsHabit,
  type InsightsPeriod,
  type PeriodSummary,
  type StreakHighlight,
} from '@/domain/insights';
import { historyFrom } from '@/domain/streak';
import type { Vacation } from '@/domain/types';
import { useToday } from '@/features/habits/useHabitBoard';

type VacationRow = { id: string; start_date: string; end_date: string; habit_ids: string | null; ended_early_on: string | null };

export type InsightsState =
  | { state: 'loading' }
  | { state: 'error'; message: string; retry: () => void }
  | { state: 'empty'; reason: 'no-habits' | 'no-check-ins' }
  | ({ state: 'ready' } & InsightsData);

export type InsightsData = {
  date: LocalDate;
  summary: PeriodSummary;
  current: StreakHighlight;
  best: StreakHighlight;
  heatmap: DayAggregate[][];
  recent: ActivityItem[];
};

/**
 * Insights for the selected period, re-derived whenever habits, check-ins,
 * freezes or vacations change (same live queries as the Streaks tab) and when
 * the local date rolls over. Nothing derived is stored.
 */
export function useInsights(period: InsightsPeriod): InsightsState {
  const habitsQ = useLiveQueryState<HabitRow>(HABITS_SQL.live, [], ['habits']);
  const completionsQ = useLiveQueryState<CompletionRow>(COMPLETIONS_SQL.all, [], ['completions', 'habits']);
  const freezesQ = useLiveQueryState<{ habit_id: string; local_date: string }>(COMPLETIONS_SQL.freezes, [], ['freeze_events']);
  const vacationsQ = useLiveQueryState<VacationRow>(COMPLETIONS_SQL.vacations, [], ['vacations']);
  const date = useToday();

  const habitRows = habitsQ.rows;
  const completionRows = completionsQ.rows;
  const freezeRows = freezesQ.rows;
  const vacationRows = vacationsQ.rows;

  // Histories only change with the data; period switches reuse them.
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
    return habitRows.map((row): InsightsHabit => {
      const habit = rowToHabit(row);
      return {
        id: habit.id,
        name: habit.name,
        status: habit.status,
        history: historyFrom(habit, dates.get(habit.id) ?? [], frozen.get(habit.id) ?? [], vacations),
      };
    });
  }, [habitRows, completionRows, freezeRows, vacationRows]);

  const shared = useMemo(() => {
    if (!habits || !completionRows) return undefined;
    return {
      ...streakHighlights(habits, date),
      heatmap: heatmap(habits, date),
      recent: recentActivity(
        completionRows.map((c) => ({ id: c.id, habitId: c.habit_id, localDate: c.local_date, completedAt: c.completed_at })),
        habits,
      ),
      totalCheckIns: habits.reduce((n, h) => n + h.history.completedDates.size, 0),
    };
  }, [habits, completionRows, date]);

  const summary = useMemo(() => (habits ? summarizePeriod(habits, period, date) : undefined), [habits, period, date]);

  const failed = [habitsQ, completionsQ, freezesQ, vacationsQ].find((q) => q.error);
  if (failed?.error) {
    return {
      state: 'error',
      message: failed.error.message,
      retry: () => {
        for (const q of [habitsQ, completionsQ, freezesQ, vacationsQ]) void q.retry();
      },
    };
  }
  if (!habits || !shared || !summary) return { state: 'loading' };
  if (habits.length === 0) return { state: 'empty', reason: 'no-habits' };
  if (shared.totalCheckIns === 0) return { state: 'empty', reason: 'no-check-ins' };
  return { state: 'ready', date, summary, current: shared.current, best: shared.best, heatmap: shared.heatmap, recent: shared.recent };
}
