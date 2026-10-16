import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { COMPLETIONS_SQL, rowToCompletion, type CompletionRow } from '@/db/repositories/completions';
import { HABITS_SQL, rowToHabit, type HabitRow } from '@/db/repositories/habits';
import { PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import { useLiveQuery } from '@/db/live';
import { addDays, today as todayDate, weekDates, type LocalDate } from '@/domain/dates';
import { nextMilestone, type Milestone } from '@/domain/milestones';
import { bestStreak, consistency, currentStreak, dayStatus, historyFrom, type DayStatus } from '@/domain/streak';
import type { Completion, Habit, Vacation } from '@/domain/types';

export type WeekDay = { date: LocalDate; status: DayStatus; isToday: boolean };

export type HabitView = Habit & {
  streak: number;
  best: number;
  total: number;
  /** 30-day consistency %, null before there is data. */
  consistency30: number | null;
  todayStatus: DayStatus;
  todayCompletion: Completion | null;
  week: WeekDay[];
  weekDone: number;
  weekScheduled: number;
  next: Milestone | null;
};

type VacationRow = { id: string; start_date: string; end_date: string; habit_ids: string | null; ended_early_on: string | null };

/** Today's local date; updates at midnight and when the app returns to the foreground. */
function useToday(): LocalDate {
  const [date, setDate] = useState(todayDate);
  useEffect(() => {
    const refresh = () => setDate((d) => (d === todayDate() ? d : todayDate()));
    const timer = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return date;
}

/** Everything the Streaks / Habits tabs render, derived live from SQLite. */
export function useHabitBoard() {
  const habitRows = useLiveQuery<HabitRow>(HABITS_SQL.live, [], ['habits']);
  const completionRows = useLiveQuery<CompletionRow>(COMPLETIONS_SQL.all, [], ['completions', 'habits']);
  const freezeRows = useLiveQuery<{ habit_id: string; local_date: string }>(COMPLETIONS_SQL.freezes, [], ['freeze_events']);
  const vacationRows = useLiveQuery<VacationRow>(COMPLETIONS_SQL.vacations, [], ['vacations']);
  const profileRows = useLiveQuery<ProfileRow>(PROFILE_SQL, [], ['profile']);

  const date = useToday();

  return useMemo(() => {
    if (!habitRows || !completionRows || !freezeRows || !vacationRows || !profileRows) return { loading: true as const };

    const vacations: Vacation[] = vacationRows.map((v) => ({
      id: v.id,
      startDate: v.start_date,
      endDate: v.end_date,
      habitIds: v.habit_ids ? (JSON.parse(v.habit_ids) as string[]) : null,
      endedEarlyOn: v.ended_early_on,
    }));

    const byHabit = new Map<string, Completion[]>();
    for (const r of completionRows) {
      const list = byHabit.get(r.habit_id) ?? [];
      list.push(rowToCompletion(r));
      byHabit.set(r.habit_id, list);
    }
    const freezesByHabit = new Map<string, string[]>();
    for (const f of freezeRows) freezesByHabit.set(f.habit_id, [...(freezesByHabit.get(f.habit_id) ?? []), f.local_date]);

    const week = weekDates(date);
    const habits: HabitView[] = habitRows.map((row) => {
      const habit = rowToHabit(row);
      const completions = byHabit.get(habit.id) ?? [];
      const h = historyFrom(habit, completions.map((c) => c.localDate), freezesByHabit.get(habit.id) ?? [], vacations);
      const streak = currentStreak(h, date);
      const weekDays = week.map((d) => ({ date: d, status: dayStatus(h, d, date), isToday: d === date }));
      return {
        ...habit,
        streak,
        best: bestStreak(h, date),
        total: completions.length,
        consistency30: consistency(h, addDays(date, -29), date),
        todayStatus: dayStatus(h, date, date),
        todayCompletion: completions.find((c) => c.localDate === date) ?? null,
        week: weekDays,
        weekDone: weekDays.filter((d) => d.status === 'completed' || d.status === 'frozen').length,
        weekScheduled: weekDays.filter((d) => d.status !== 'rest').length,
        next: nextMilestone(streak),
      };
    });

    const active = habits.filter((h) => h.status === 'active');
    return {
      loading: false as const,
      date,
      habits,
      active,
      paused: habits.filter((h) => h.status === 'paused'),
      primary: (active.find((h) => h.isPrimary) ?? active.at(0) ?? null) as HabitView | null,
      profile: profileRows[0],
      vacations,
    };
  }, [habitRows, completionRows, freezeRows, vacationRows, profileRows, date]);
}
