/**
 * Insights recompute from persisted rows after a check-in is added or undone,
 * and the write announces the tables useInsights' live queries watch.
 * Real SQLite (node:sqlite) with the app's migrations and repositories.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { subscribeTablesChanged } from '@/db/changes';
import { checkIn, COMPLETIONS_SQL, undoCheckIn, type CompletionRow } from '@/db/repositories/completions';
import { createHabit, HABITS_SQL, rowToHabit, type HabitRow } from '@/db/repositories/habits';
import { addDays, today } from '@/domain/dates';
import { recentActivity, streakHighlights, summarizePeriod, type InsightsHabit } from '@/domain/insights';
import { historyFrom } from '@/domain/streak';
import { openDb } from '@/test/localDb';

jest.mock('expo-crypto', () => ({ randomUUID: () => (jest.requireActual('crypto') as typeof import('crypto')).randomUUID() }));

type Db = ReturnType<typeof openDb>;

/** Same read path as useInsights: live habits + live completions. */
async function load(db: Db) {
  const habits = await db.getAllAsync<HabitRow>(HABITS_SQL.live);
  const completions = await db.getAllAsync<CompletionRow>(COMPLETIONS_SQL.all);
  const list: InsightsHabit[] = habits.map((r) => {
    const h = rowToHabit(r);
    const dates = completions.filter((c) => c.habit_id === h.id).map((c) => c.local_date);
    return { id: h.id, name: h.name, status: h.status, history: historyFrom(h, dates) };
  });
  const d = today();
  return {
    all: summarizePeriod(list, 'all', d),
    streaks: streakHighlights(list, d),
    recent: recentActivity(
      completions.map((c) => ({ id: c.id, habitId: c.habit_id, localDate: c.local_date, completedAt: c.completed_at })),
      list,
    ),
  };
}

describe('insights refresh', () => {
  it('reflects a check-in and its undo, without duplicates', async () => {
    const db = openDb();
    const id = await createHabit(db, { name: 'Morning Gym', category: 'fitness', emblem: 'fitness_center', cadenceType: 'daily' });
    // Habit started yesterday and yesterday was done.
    await db.runAsync('UPDATE habits SET start_date = ? WHERE id = ?', addDays(today(), -1), id);
    await checkIn(db, id, { date: addDays(today(), -1) });

    const before = await load(db);
    expect(before.all).toMatchObject({ done: 1, due: 1, rate: 100 });
    expect(before.streaks.current.days).toBe(1);

    const changed: string[][] = [];
    const unsubscribe = subscribeTablesChanged((t) => changed.push([...t]));

    await checkIn(db, id);
    await checkIn(db, id); // second hold on the same day is a no-op
    const after = await load(db);
    expect(after.all).toMatchObject({ done: 2, due: 2 });
    expect(after.streaks.current).toEqual({ days: 2, habitName: 'Morning Gym' });
    expect(after.recent.map((r) => r.localDate)).toEqual([today(), addDays(today(), -1)]);

    await undoCheckIn(db, id);
    const undone = await load(db);
    expect(undone.all).toMatchObject({ done: 1, due: 1 });
    expect(undone.streaks.current.days).toBe(1);
    expect(undone.recent).toHaveLength(1);

    unsubscribe();
    expect(changed.some((t) => t.includes('completions'))).toBe(true);
  });

  it('is empty for a new install', async () => {
    const db = openDb();
    const { all, streaks, recent } = await load(db);
    expect(all.rate).toBeNull();
    expect(streaks.best.days).toBe(0);
    expect(recent).toEqual([]);
  });
});
