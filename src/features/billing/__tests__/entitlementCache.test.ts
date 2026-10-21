/** The cached server entitlement drives the on-device plan limit (real SQLite, app migrations). */
import { describe, expect, it, jest } from '@jest/globals';

import { createHabit } from '@/db/repositories/habits';
import { cacheEntitlement, PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import type { Entitlement } from '@/domain/billing';
import { HabitLimitError } from '@/domain/plans';
import { adoptAccount, toRemote, ENTITIES } from '@/sync/engine';
import { openDb } from '@/test/localDb';

jest.mock('expo-crypto', () => ({ randomUUID: () => (jest.requireActual('crypto') as typeof import('crypto')).randomUUID() }));

const DAY = 86_400_000;
const habit = (name: string) => ({ name, category: 'fitness' as const, emblem: 'fitness_center' as const, cadenceType: 'daily' as const });
const pro = (o: Partial<Entitlement> = {}): Entitlement => ({
  active: true,
  plan: 'yearly',
  productId: 'momentum_pro',
  platform: 'android',
  state: 'active',
  expiresAt: Date.now() + 300 * DAY,
  autoRenewing: true,
  environment: 'sandbox',
  updatedAt: Date.now(),
  ...o,
});

describe('entitlement cache', () => {
  it('Pro lifts the 1-habit cap; losing Pro brings it back', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u1', email: 'a@b.c' });
    await createHabit(db, habit('One'));
    await expect(createHabit(db, habit('Two'))).rejects.toBeInstanceOf(HabitLimitError);

    await cacheEntitlement(db, pro());
    const row = (await db.getFirstAsync<ProfileRow>(PROFILE_SQL))!;
    expect([row.tier, row.pro_plan, row.pro_state, row.pro_platform]).toEqual(['pro', 'yearly', 'active', 'android']);
    await createHabit(db, habit('Two'));
    await createHabit(db, habit('Three'));

    await cacheEntitlement(db, pro({ active: false, state: 'on_hold' }));
    expect((await db.getFirstAsync<ProfileRow>(PROFILE_SQL))!.tier).toBe('free');
    await expect(createHabit(db, habit('Four'))).rejects.toBeInstanceOf(HabitLimitError);
  });

  it('an expired cached period stops granting Pro even offline', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u2', email: 'a@b.c' });
    await cacheEntitlement(db, pro({ plan: 'monthly', expiresAt: Date.now() + 1000 }), Date.now());
    await db.runAsync(`UPDATE profile SET pro_expires_at = ? WHERE id = 'me'`, Date.now() - 1);
    await createHabit(db, habit('One'));
    await expect(createHabit(db, habit('Two'))).rejects.toBeInstanceOf(HabitLimitError);
  });

  it('no entitlement document means Free (signed in) or Guest', async () => {
    const db = openDb();
    await cacheEntitlement(db, null);
    expect((await db.getFirstAsync<ProfileRow>(PROFILE_SQL))!.tier).toBe('guest');
    await adoptAccount(db, { uid: 'u3', email: 'a@b.c' });
    await cacheEntitlement(db, null);
    expect((await db.getFirstAsync<ProfileRow>(PROFILE_SQL))!.tier).toBe('free');
  });

  it('the cache never syncs: Pro can’t be pushed to (or pulled from) the synced profile', async () => {
    const db = openDb();
    await adoptAccount(db, { uid: 'u4', email: 'a@b.c' });
    const outbox = () => db.getAllAsync<{ seq: number; payload: string }>(`SELECT seq, payload FROM sync_outbox WHERE entity = 'profile'`);
    const before = await outbox();
    await cacheEntitlement(db, pro());
    expect(await outbox()).toEqual(before); // caching queues nothing for sync
    const remote = toRemote(ENTITIES[0], (await db.getFirstAsync<Record<string, unknown>>(PROFILE_SQL))!);
    expect(Object.keys(remote).filter((k) => /^pro|^tier$/.test(k))).toEqual([]);
  });
});
