import type { SQLiteDatabase } from 'expo-sqlite';

export type SyncEntity = 'habits' | 'completions' | 'freeze_events' | 'vacations' | 'milestones' | 'profile';

/**
 * Enqueue a sync operation. Must be called inside the same transaction as
 * the local write it describes. Coalesces per entity: a newer pending write
 * for the same record replaces the older one, so the queue holds at most one
 * operation per record (last write wins).
 */
export async function enqueue(
  db: SQLiteDatabase,
  entity: SyncEntity,
  entityId: string,
  op: 'upsert' | 'delete',
  payload: object,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_outbox (entity, entity_id, op, payload, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (entity, entity_id) DO UPDATE SET
       op = excluded.op, payload = excluded.payload, created_at = excluded.created_at,
       attempts = 0, last_error = NULL`,
    entity,
    entityId,
    op,
    JSON.stringify(payload),
    Date.now(),
  );
}

export type OutboxItem = {
  seq: number;
  entity: SyncEntity;
  entity_id: string;
  op: 'upsert' | 'delete';
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
};

export function pendingCount(db: SQLiteDatabase): Promise<{ n: number } | null> {
  return db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox');
}

export function peek(db: SQLiteDatabase, limit = 50): Promise<OutboxItem[]> {
  return db.getAllAsync<OutboxItem>('SELECT * FROM sync_outbox ORDER BY seq LIMIT ?', limit);
}
