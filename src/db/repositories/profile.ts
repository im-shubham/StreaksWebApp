import type { SQLiteDatabase } from 'expo-sqlite';

import { isProActive, type Entitlement } from '@/domain/billing';
import type { AccountTier } from '@/domain/types';
import { enqueue } from '../outbox';
import { writeTransaction } from '../changes';

export type ProfileRow = {
  id: 'me';
  account_uid: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  tier: AccountTier;
  freeze_balance: number;
  freeze_refilled_on: string | null;
  auto_freeze: number;
  accent: string;
  surface_mode: string;
  app_icon: string;
  haptics: number;
  onboarded_at: number | null;
  updated_at: number;
  /** Cached server entitlement (see src/features/billing/EntitlementSync.tsx). */
  pro_plan: 'monthly' | 'yearly' | 'lifetime' | null;
  pro_state: string | null;
  pro_expires_at: number | null;
  pro_auto_renewing: number;
  pro_environment: string | null;
  pro_platform: 'android' | 'ios' | null;
  pro_checked_at: number | null;
};

export const PROFILE_SQL = `SELECT * FROM profile WHERE id = 'me'`;

type Editable = Partial<Omit<ProfileRow, 'id' | 'updated_at'>>;

const COLUMNS: (keyof Editable)[] = [
  'account_uid',
  'display_name',
  'email',
  'avatar_url',
  'tier',
  'freeze_balance',
  'freeze_refilled_on',
  'auto_freeze',
  'accent',
  'surface_mode',
  'app_icon',
  'haptics',
  'onboarded_at',
];

export async function updateProfile(db: SQLiteDatabase, patch: Editable): Promise<void> {
  const keys = COLUMNS.filter((k) => k in patch);
  if (keys.length === 0) return;
  await writeTransaction(db, ['profile', 'sync_outbox'], async (txn) => {
    await txn.runAsync(
      `UPDATE profile SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = 'me'`,
      ...keys.map((k) => patch[k] ?? null),
      Date.now(),
    );
    const row = await txn.getFirstAsync<ProfileRow>(PROFILE_SQL);
    // Guests have nowhere to sync to; their outbox is flushed on account link.
    if (row) await enqueue(txn, 'profile', 'me', 'upsert', row);
  });
}

/**
 * Caches the server entitlement for offline use and sets the plan tier from
 * it. Local-only columns: no outbox entry, nothing synced.
 */
export async function cacheEntitlement(db: SQLiteDatabase, e: Entitlement | null, now: number = Date.now()): Promise<void> {
  await writeTransaction(db, ['profile'], async (txn) => {
    await txn.runAsync(
      `UPDATE profile SET tier = CASE WHEN ? THEN 'pro' WHEN account_uid IS NOT NULL THEN 'free' ELSE 'guest' END,
         pro_plan = ?, pro_state = ?, pro_expires_at = ?, pro_auto_renewing = ?, pro_environment = ?, pro_platform = ?, pro_checked_at = ?
       WHERE id = 'me'`,
      isProActive(e, now) ? 1 : 0,
      e?.plan ?? null,
      e?.state ?? null,
      e?.expiresAt ?? null,
      e?.autoRenewing ? 1 : 0,
      e?.environment ?? null,
      e?.platform ?? null,
      now,
    );
  });
}
