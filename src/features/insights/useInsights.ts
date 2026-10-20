import { useMemo } from 'react';

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
import { useHabitHistories } from '@/features/habits/useHabitHistories';
import { useToday } from '@/features/habits/useHabitBoard';

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
  const { habits: loaded, completionRows, error, retry } = useHabitHistories();
  const date = useToday();

  const habits = useMemo(
    () => loaded?.map(({ habit, history }): InsightsHabit => ({ id: habit.id, name: habit.name, status: habit.status, history })),
    [loaded],
  );

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

  if (error) return { state: 'error', message: error.message, retry };
  if (!habits || !shared || !summary) return { state: 'loading' };
  if (habits.length === 0) return { state: 'empty', reason: 'no-habits' };
  if (shared.totalCheckIns === 0) return { state: 'empty', reason: 'no-check-ins' };
  return { state: 'ready', date, summary, current: shared.current, best: shared.best, heatmap: shared.heatmap, recent: shared.recent };
}
