import type { SQLiteDatabase } from 'expo-sqlite';

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
