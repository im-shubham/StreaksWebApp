import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { IconName } from '@/components/ui/Icon';
import { today } from '@/domain/dates';
import type { CadenceType, Habit, HabitCategory, HabitStatus } from '@/domain/types';
import { enqueue } from '../outbox';

export type HabitRow = {
  id: string;
  name: string;
  category: string;
  emblem: string;
  cadence_type: CadenceType;
  weekdays_mask: number;
  interval_days: number;
  start_date: string;
  weekly_target: number | null;
  target_label: string | null;
  execution_time: string | null;
  reminder_enabled: number;
  reminder_time: string | null;
  notes: string | null;
  status: HabitStatus;
  is_primary: number;
  sort_order: number;
  template_id: string | null;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
  deleted_at: number | null;
};

export function rowToHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    name: r.name,
    category: r.category as HabitCategory,
    emblem: r.emblem as IconName,
    cadence: { type: r.cadence_type, weekdaysMask: r.weekdays_mask, intervalDays: r.interval_days, startDate: r.start_date },
    weeklyTarget: r.weekly_target,
    targetLabel: r.target_label,
    executionTime: r.execution_time,
    reminderEnabled: r.reminder_enabled === 1,
    reminderTime: r.reminder_time,
    notes: r.notes,
    status: r.status,
    isPrimary: r.is_primary === 1,
    sortOrder: r.sort_order,
    templateId: r.template_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
  };
}

export const HABITS_SQL = {
  live: `SELECT * FROM habits WHERE deleted_at IS NULL AND status != 'archived' ORDER BY is_primary DESC, sort_order, created_at`,
  byId: `SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL`,
};

export type NewHabit = {
  name: string;
  category: HabitCategory;
  emblem: IconName;
  cadenceType: CadenceType;
  weekdaysMask?: number;
  intervalDays?: number;
  weeklyTarget?: number | null;
  targetLabel?: string | null;
  executionTime?: string | null;
  reminderEnabled?: boolean;
  reminderTime?: string | null;
  notes?: string | null;
  templateId?: string | null;
};

async function upsertOutbox(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', id);
  if (row) await enqueue(db, 'habits', id, 'upsert', row);
}

export async function createHabit(db: SQLiteDatabase, input: NewHabit): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const counts = await txn.getFirstAsync<{ n: number; maxOrder: number | null }>(
      `SELECT COUNT(*) AS n, MAX(sort_order) AS maxOrder FROM habits WHERE deleted_at IS NULL AND status = 'active'`,
    );
    const isFirst = (counts?.n ?? 0) === 0;
    await txn.runAsync(
      `INSERT INTO habits (id, name, category, emblem, cadence_type, weekdays_mask, interval_days, start_date,
         weekly_target, target_label, execution_time, reminder_enabled, reminder_time, notes, status,
         is_primary, sort_order, template_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.category,
      input.emblem,
      input.cadenceType,
      input.weekdaysMask ?? 0b1111111,
      input.intervalDays ?? 1,
      today(),
      input.weeklyTarget ?? null,
      input.targetLabel ?? null,
      input.executionTime ?? null,
      input.reminderEnabled ? 1 : 0,
      input.reminderTime ?? null,
      input.notes ?? null,
      isFirst ? 1 : 0,
      (counts?.maxOrder ?? -1) + 1,
      input.templateId ?? null,
      now,
      now,
    );
    await upsertOutbox(txn, id);
  });
  return id;
}

export async function setHabitStatus(db: SQLiteDatabase, id: string, status: HabitStatus): Promise<void> {
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE habits SET status = ?, archived_at = ?, is_primary = CASE WHEN ? = 'active' THEN is_primary ELSE 0 END,
         updated_at = ? WHERE id = ?`,
      status,
      status === 'archived' ? now : null,
      status,
      now,
      id,
    );
    await upsertOutbox(txn, id);
  });
}

/** Pins a habit to the dashboard hero ("On Dashboard"). Exactly one primary. */
export async function setPrimaryHabit(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const prev = await txn.getAllAsync<{ id: string }>(
      'SELECT id FROM habits WHERE is_primary = 1 AND id != ? AND deleted_at IS NULL',
      id,
    );
    await txn.runAsync('UPDATE habits SET is_primary = 0, updated_at = ? WHERE is_primary = 1 AND id != ?', now, id);
    await txn.runAsync('UPDATE habits SET is_primary = 1, updated_at = ? WHERE id = ?', now, id);
    for (const p of prev) await upsertOutbox(txn, p.id);
    await upsertOutbox(txn, id);
  });
}

/** Soft delete; the tombstone syncs, then can be purged. */
export async function deleteHabit(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE habits SET deleted_at = ?, is_primary = 0, updated_at = ? WHERE id = ?', now, now, id);
    await enqueue(txn, 'habits', id, 'delete', { id, deleted_at: now, updated_at: now });
  });
}
