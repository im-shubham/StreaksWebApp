/** "Mark Done" from a reminder and reminder edits, against real SQLite (node:sqlite). */
import { describe, expect, it, jest } from '@jest/globals';

import { createHabit, HABITS_SQL, setHabitReminder, setHabitStatus, type HabitRow } from '@/db/repositories/habits';
import { addDays, today } from '@/domain/dates';
import { openDb } from '@/test/localDb';
import { completeFromReminder } from '../ReminderScheduler';

jest.mock('expo-crypto', () => ({ randomUUID: () => (jest.requireActual('crypto') as typeof import('crypto')).randomUUID() }));
jest.mock('expo-notifications', () => ({}));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const input = { name: 'Morning Gym', category: 'fitness' as const, emblem: 'fitness_center' as const, cadenceType: 'daily' as const };
const completions = (db: ReturnType<typeof openDb>) =>
  db.getAllAsync<{ local_date: string; source: string }>('SELECT local_date, source FROM completions WHERE deleted_at IS NULL');

describe('Mark Done from a reminder', () => {
  it('checks in today’s habit once, recorded as a notification check-in', async () => {
    const db = openDb();
    const id = await createHabit(db, input);
    const t = today();
    expect(await completeFromReminder(db, 'complete', { habitId: id, date: t }, t)).toBe(true);
    expect(await completeFromReminder(db, 'complete', { habitId: id, date: t }, t)).toBe(true);
    expect(await completions(db)).toEqual([{ local_date: t, source: 'notification' }]);
    const outbox = await db.getAllAsync<{ entity: string }>("SELECT entity FROM sync_outbox WHERE entity = 'completions'");
    expect(outbox.length).toBeGreaterThan(0);
  });

  it('only opens the app for a plain tap, an old reminder or a habit that is no longer active', async () => {
    const db = openDb();
    const id = await createHabit(db, input);
    const t = today();
    expect(await completeFromReminder(db, 'expo.modules.notifications.actions.DEFAULT', { habitId: id, date: t }, t)).toBe(false);
    expect(await completeFromReminder(db, 'complete', { habitId: id, date: addDays(t, -1) }, t)).toBe(false);
    expect(await completeFromReminder(db, 'complete', { test: true }, t)).toBe(false);
    await setHabitStatus(db, id, 'paused');
    expect(await completeFromReminder(db, 'complete', { habitId: id, date: t }, t)).toBe(false);
    expect(await completions(db)).toEqual([]);
  });
});

describe('setHabitReminder', () => {
  it('updates the reminder, keeps the time when turned off, and queues the change for sync', async () => {
    const db = openDb();
    const id = await createHabit(db, { ...input, reminderEnabled: false, reminderTime: null });
    await db.runAsync('DELETE FROM sync_outbox');

    await setHabitReminder(db, id, true, '07:15');
    let row = (await db.getAllAsync<HabitRow>(HABITS_SQL.live))[0];
    expect([row.reminder_enabled, row.reminder_time]).toEqual([1, '07:15']);

    await setHabitReminder(db, id, false, null);
    row = (await db.getAllAsync<HabitRow>(HABITS_SQL.live))[0];
    expect([row.reminder_enabled, row.reminder_time]).toEqual([0, '07:15']);

    const outbox = await db.getAllAsync<{ entity: string; entity_id: string }>('SELECT entity, entity_id FROM sync_outbox');
    expect(outbox.every((o) => o.entity === 'habits' && o.entity_id === id)).toBe(true);
    expect(outbox.length).toBeGreaterThan(0);
  });
});
