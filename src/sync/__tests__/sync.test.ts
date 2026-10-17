/**
 * Sync engine + repositories against real SQLite (Node's built-in engine,
 * same schema/migrations as the app) and an in-memory stand-in for
 * Firestore that mimics set-merge and server timestamps.
 * This proves the local-first logic; it does not talk to Firebase.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { subscribeTablesChanged } from '@/db/changes';
import { checkIn, undoCheckIn } from '@/db/repositories/completions';
import { createHabit, setHabitStatus } from '@/db/repositories/habits';
import { today } from '@/domain/dates';
import { HabitLimitError } from '@/domain/plans';
import { currentStreak, historyFrom } from '@/domain/streak';
import { adoptAccount, pull, push } from '../engine';
import { FakeRemote, openDb, type Row } from '@/test/localDb';
import type { LocalDb } from '../types';

jest.mock('expo-crypto', () => ({ randomUUID: () => (jest.requireActual('crypto') as typeof import('crypto')).randomUUID() }));

const habitInput = { name: 'Morning Gym', category: 'fitness' as const, emblem: 'fitness_center' as const, cadenceType: 'daily' as const };

async function streakOf(db: LocalDb, habitId: string) {
  const habit = await db.getFirstAsync<Row>('SELECT * FROM habits WHERE id = ?', habitId);
  const days = await db.getAllAsync<{ local_date: string }>(
    'SELECT local_date FROM completions WHERE habit_id = ? AND deleted_at IS NULL',
    habitId,
  );
  const cadence = { type: 'daily' as const, weekdaysMask: 127, intervalDays: 1, startDate: String(habit!.start_date) };
  return currentStreak(historyFrom({ id: habitId, cadence }, days.map((d) => d.local_date)), today());
}

describe('guest mode + plan limit', () => {
  it('persists a habit and check-in locally and enforces the 1-habit Free/guest cap', async () => {
    const db = openDb();
    const id = await createHabit(db, habitInput);
    await checkIn(db, id);
    expect(await streakOf(db, id)).toBe(1);
    await expect(createHabit(db, { ...habitInput, name: 'Reading' })).rejects.toBeInstanceOf(HabitLimitError);

    // Pausing frees the slot; resuming while another is active is blocked.
    await setHabitStatus(db, id, 'paused');
    const second = await createHabit(db, { ...habitInput, name: 'Reading' });
    await expect(setHabitStatus(db, id, 'active')).rejects.toBeInstanceOf(HabitLimitError);
    expect(second).toBeTruthy();
  });

  it('check-in is idempotent per day and undo is reversible', async () => {
    const db = openDb();
    const id = await createHabit(db, habitInput);
    const a = await checkIn(db, id);
    const b = await checkIn(db, id);
    expect(a).toBe(b);
    await undoCheckIn(db, id);
    expect(await streakOf(db, id)).toBe(0);
    await checkIn(db, id);
    expect(await streakOf(db, id)).toBe(1);
    const rows = await db.getAllAsync<Row>('SELECT * FROM completions');
    expect(rows).toHaveLength(1);
  });
});

describe('change notifications', () => {
  it('fire after COMMIT, so a re-query sees the new check-in (dashboard refresh)', async () => {
    const db = openDb();
    const id = await createHabit(db, habitInput);
    const seen: { tables: string[]; visible: number }[] = [];
    const reads: Promise<void>[] = [];
    const unsubscribe = subscribeTablesChanged((tables) => {
      reads.push(
        db
          .getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM completions WHERE deleted_at IS NULL')
          .then((r) => void seen.push({ tables: [...tables], visible: r?.n ?? 0 })),
      );
    });
    await checkIn(db, id);
    await Promise.all(reads);
    unsubscribe();
    expect(seen).toEqual([{ tables: ['completions', 'sync_outbox'], visible: 1 }]);
  });
});

describe('sync', () => {
  let remote: FakeRemote;
  beforeEach(() => {
    remote = new FakeRemote();
  });

  it('uploads guest data on account creation, then restores it on a second device', async () => {
    const phone = openDb();
    const id = await createHabit(phone, habitInput);
    await checkIn(phone, id);

    expect(await adoptAccount(phone, { uid: 'u1', email: 'a@b.co' })).toBe('adopted-guest');
    const r = await push(phone, remote, 'u1');
    expect(r.pushed).toBeGreaterThanOrEqual(3); // profile, habit, completion
    expect((await phone.getAllAsync('SELECT * FROM sync_outbox')).length).toBe(0);

    // Local-only fields never leave the device.
    const remoteProfile = remote.get('u1', 'profile', 'me')!;
    expect(remoteProfile).not.toHaveProperty('tier');
    expect(remoteProfile).not.toHaveProperty('accountUid');
    expect(remote.get('u1', 'habits', id)?.name).toBe('Morning Gym');

    const tablet = openDb();
    await adoptAccount(tablet, { uid: 'u1', email: 'a@b.co' });
    await pull(tablet, remote, 'u1');
    expect(await streakOf(tablet, id)).toBe(1);
    const tier = await tablet.getFirstAsync<{ tier: string }>(`SELECT tier FROM profile WHERE id = 'me'`);
    expect(tier?.tier).toBe('free');
  });

  it('propagates an undo (tombstone) to other devices', async () => {
    const a = openDb();
    const b = openDb();
    await adoptAccount(a, { uid: 'u1', email: null });
    await adoptAccount(b, { uid: 'u1', email: null });
    const id = await createHabit(a, habitInput);
    await checkIn(a, id);
    await push(a, remote, 'u1');
    await push(b, remote, 'u1');
    await pull(b, remote, 'u1');
    expect(await streakOf(b, id)).toBe(1);

    await new Promise((r) => setTimeout(r, 5)); // later updated_at
    await undoCheckIn(a, id);
    await push(a, remote, 'u1');
    await pull(b, remote, 'u1');
    expect(await streakOf(b, id)).toBe(0);
  });

  it('never lets a pull overwrite a pending local edit', async () => {
    const a = openDb();
    const b = openDb();
    await adoptAccount(a, { uid: 'u1', email: null });
    await adoptAccount(b, { uid: 'u1', email: null });
    const id = await createHabit(a, habitInput);
    await push(a, remote, 'u1');
    await pull(b, remote, 'u1');

    await b.runAsync(`UPDATE habits SET name = 'Local edit', updated_at = ? WHERE id = ?`, 1, id); // stale clock on purpose
    await b.runAsync(`INSERT INTO sync_outbox (entity, entity_id, op, payload, created_at) VALUES ('habits', ?, 'upsert', '{}', 1)`, id);
    await new Promise((r) => setTimeout(r, 5));
    await a.runAsync(`UPDATE habits SET name = 'Remote edit', updated_at = ? WHERE id = ?`, Date.now(), id);
    await a.runAsync(
      `INSERT INTO sync_outbox (entity, entity_id, op, payload, created_at) SELECT 'habits', id, 'upsert', json_object('id', id, 'name', name, 'updated_at', updated_at), 1 FROM habits WHERE id = ?`,
      id,
    );
    await push(a, remote, 'u1');
    await pull(b, remote, 'u1');
    const row = await b.getFirstAsync<{ name: string }>('SELECT name FROM habits WHERE id = ?', id);
    expect(row?.name).toBe('Local edit');
  });

  it('keeps the queue and records the error when a push fails', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u1', email: null });
    await createHabit(db, habitInput);
    remote.failNext = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    await expect(push(db, remote, 'u1')).rejects.toThrow('insufficient permissions');
    const q = await db.getAllAsync<{ attempts: number; last_error: string }>('SELECT attempts, last_error FROM sync_outbox');
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((x) => x.attempts === 1 && x.last_error.includes('permissions'))).toBe(true);
    expect(remote.docs.size).toBe(0);
  });

  it('keeps an edit made while a push is in flight', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u1', email: null });
    const id = await createHabit(db, habitInput);
    remote.onPush = async () => {
      remote.onPush = null;
      await checkIn(db, id); // new outbox entry during the push
      await db.runAsync(`UPDATE sync_outbox SET payload = json_set(payload, '$.name', 'Edited'), created_at = created_at + 1 WHERE entity = 'habits'`);
    };
    await push(db, remote, 'u1');
    const left = await db.getAllAsync<{ entity: string }>('SELECT entity FROM sync_outbox ORDER BY entity');
    expect(left.map((l) => l.entity)).toEqual(['completions', 'habits']);
  });

  it('wipes local data when a different account signs in on this device', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u1', email: null });
    await createHabit(db, habitInput);
    expect(await adoptAccount(db, { uid: 'u2', email: null })).toBe('switched');
    expect(await db.getAllAsync('SELECT * FROM habits')).toHaveLength(0);
    const p = await db.getFirstAsync<{ account_uid: string }>(`SELECT account_uid FROM profile WHERE id = 'me'`);
    expect(p?.account_uid).toBe('u2');
  });
});
