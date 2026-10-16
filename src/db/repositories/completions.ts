import type { SQLiteDatabase } from 'expo-sqlite';

import { today as todayDate, type LocalDate } from '@/domain/dates';
import type { Completion, CompletionSource } from '@/domain/types';
import { enqueue } from '../outbox';

export type CompletionRow = {
  id: string;
  habit_id: string;
  local_date: string;
  completed_at: number;
  source: CompletionSource;
  value: number | null;
  note: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export function rowToCompletion(r: CompletionRow): Completion {
  return {
    id: r.id,
    habitId: r.habit_id,
    localDate: r.local_date,
    completedAt: r.completed_at,
    source: r.source,
    value: r.value,
    note: r.note,
  };
}

export const COMPLETIONS_SQL = {
  /** Live check-ins for non-deleted habits (history feeds the streak engine). */
  all: `SELECT c.* FROM completions c JOIN habits h ON h.id = c.habit_id
        WHERE c.deleted_at IS NULL AND h.deleted_at IS NULL ORDER BY c.local_date`,
  freezes: `SELECT habit_id, local_date FROM freeze_events WHERE deleted_at IS NULL`,
  vacations: `SELECT * FROM vacations WHERE deleted_at IS NULL`,
};

/**
 * Check-ins have a deterministic id per habit-day. Two offline devices
 * checking in the same day then write the *same* cloud document instead of
 * creating duplicates, and undo/redo revives the same row.
 */
export const completionId = (habitId: string, date: LocalDate) => `${habitId}_${date}`;

/** Records a check-in. Idempotent: a second hold on the same day is a no-op. */
export async function checkIn(
  db: SQLiteDatabase,
  habitId: string,
  opts: { source?: CompletionSource; date?: LocalDate; value?: number | null; note?: string | null } = {},
): Promise<string> {
  const date = opts.date ?? todayDate();
  const id = completionId(habitId, date);
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ deleted_at: number | null }>('SELECT deleted_at FROM completions WHERE id = ?', id);
    if (existing && existing.deleted_at === null) return;
    await txn.runAsync(
      `INSERT INTO completions (id, habit_id, local_date, completed_at, source, value, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         completed_at = excluded.completed_at, source = excluded.source, value = excluded.value,
         note = excluded.note, updated_at = excluded.updated_at, deleted_at = NULL`,
      id,
      habitId,
      date,
      now,
      opts.source ?? 'hold',
      opts.value ?? null,
      opts.note ?? null,
      now,
      now,
    );
    const row = await txn.getFirstAsync<CompletionRow>('SELECT * FROM completions WHERE id = ?', id);
    if (row) await enqueue(txn, 'completions', id, 'upsert', row);
  });
  return id;
}

/** "Undo Check-in": tombstones the completion so the deletion syncs. */
export async function undoCheckIn(db: SQLiteDatabase, habitId: string, date: LocalDate = todayDate()): Promise<void> {
  const id = completionId(habitId, date);
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const res = await txn.runAsync(
      'UPDATE completions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
    if (res.changes === 0) return;
    await enqueue(txn, 'completions', id, 'delete', { id, deleted_at: now, updated_at: now });
  });
}
