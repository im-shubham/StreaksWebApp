import type { SyncEntity } from '@/db/outbox';
import type { LocalDb, RemoteCollection, RemoteStore } from './types';
import { ALL_TABLES, notifyTablesChanged, writeTransaction } from '@/db/changes';

/**
 * Local-first sync between SQLite and a remote store (Firestore).
 *
 * push: drains sync_outbox FIFO as one atomic batch. An entry is removed
 *       only if it is unchanged since it was read, so an edit made while a
 *       push is in flight stays queued.
 * pull: fetches documents changed since the per-collection cursor and
 *       applies them last-write-wins on `updated_at`, skipping any record
 *       with a pending local write (local edits win until pushed).
 */
type EntityDef = { entity: SyncEntity; table: string; collection: RemoteCollection; localOnly: string[] };

/** Pull order matters: habits before rows that reference them. */
export const ENTITIES: EntityDef[] = [
  // Profile: account link, plan tier and onboarding state never leave or enter via sync.
  { entity: 'profile', table: 'profile', collection: 'profile', localOnly: ['account_uid', 'email', 'tier', 'onboarded_at'] },
  { entity: 'habits', table: 'habits', collection: 'habits', localOnly: [] },
  { entity: 'completions', table: 'completions', collection: 'completions', localOnly: [] },
  { entity: 'freeze_events', table: 'freeze_events', collection: 'freezeEvents', localOnly: [] },
  { entity: 'vacations', table: 'vacations', collection: 'vacations', localOnly: [] },
  { entity: 'milestones', table: 'milestones', collection: 'milestones', localOnly: [] },
];

const byEntity = new Map(ENTITIES.map((e) => [e.entity, e]));

export const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const columnsCache = new Map<string, string[]>();
async function columns(db: LocalDb, table: string): Promise<string[]> {
  const cached = columnsCache.get(table);
  if (cached) return cached;
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const names = rows.map((r) => r.name);
  columnsCache.set(table, names);
  return names;
}

export function toRemote(def: EntityDef, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (def.localOnly.includes(k)) continue;
    out[toCamel(k)] = v;
  }
  return out;
}

export type PushResult = { pushed: number };

export async function push(db: LocalDb, remote: RemoteStore, uid: string, limit = 400): Promise<PushResult> {
  const items = await db.getAllAsync<{
    seq: number;
    entity: SyncEntity;
    entity_id: string;
    payload: string;
    created_at: number;
  }>('SELECT seq, entity, entity_id, payload, created_at FROM sync_outbox ORDER BY seq LIMIT ?', limit);
  if (items.length === 0) return { pushed: 0 };

  const ops = items.map((it) => {
    const def = byEntity.get(it.entity);
    if (!def) throw new Error(`Unknown sync entity ${it.entity}`);
    return { collection: def.collection, id: it.entity_id, data: toRemote(def, JSON.parse(it.payload) as Record<string, unknown>) };
  });

  try {
    await remote.push(uid, ops);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.runAsync(
      `UPDATE sync_outbox SET attempts = attempts + 1, last_error = ?, last_attempt_at = ? WHERE seq <= ?`,
      message,
      Date.now(),
      items[items.length - 1].seq,
    );
    notifyTablesChanged('sync_outbox');
    throw e;
  }

  await writeTransaction(db, ['sync_outbox'], async (txn) => {
    for (const it of items) {
      await txn.runAsync(
        'DELETE FROM sync_outbox WHERE seq = ? AND created_at = ? AND payload = ?',
        it.seq,
        it.created_at,
        it.payload,
      );
    }
  });
  return { pushed: items.length };
}

export type PullResult = { applied: number; skipped: number };

export async function pull(db: LocalDb, remote: RemoteStore, uid: string): Promise<PullResult> {
  let applied = 0;
  let skipped = 0;
  for (const def of ENTITIES) {
    const state = await db.getFirstAsync<{ last_pulled_at: number }>(
      'SELECT last_pulled_at FROM sync_state WHERE entity = ?',
      def.entity,
    );
    const docs = await remote.pull(uid, def.collection, state?.last_pulled_at ?? 0);
    if (docs.length === 0) continue;

    const cols = await columns(db, def.table);
    const writable = cols.filter((c) => !def.localOnly.includes(c));
    let cursor = state?.last_pulled_at ?? 0;

    await writeTransaction(db, ALL_TABLES, async (txn) => {
      for (const doc of docs) {
        cursor = Math.max(cursor, Math.floor(doc.serverUpdatedAt));
        const remoteUpdated = Number(doc.data.updatedAt ?? 0);

        const pending = await txn.getFirstAsync<{ n: number }>(
          'SELECT 1 AS n FROM sync_outbox WHERE entity = ? AND entity_id = ?',
          def.entity,
          doc.id,
        );
        const local = await txn.getFirstAsync<{ updated_at: number }>(`SELECT updated_at FROM ${def.table} WHERE id = ?`, doc.id);
        if (pending || (local && local.updated_at >= remoteUpdated)) {
          skipped++;
          continue;
        }

        const values: Record<string, string | number | null> = { id: doc.id };
        for (const c of writable) {
          if (c === 'id') continue;
          const v = doc.data[toCamel(c)];
          if (v === undefined) continue;
          values[c] = typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number | null);
        }
        const keys = Object.keys(values);
        const updates = keys.filter((k) => k !== 'id');
        try {
          if (def.entity === 'profile' && local) {
            // The profile row always exists locally; never overwrite local-only fields.
            await txn.runAsync(
              `UPDATE profile SET ${updates.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
              ...updates.map((k) => values[k]),
              doc.id,
            );
          } else {
            await txn.runAsync(
              `INSERT INTO ${def.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})
               ON CONFLICT (id) DO UPDATE SET ${updates.map((k) => `${k} = excluded.${k}`).join(', ')}`,
              ...keys.map((k) => values[k]),
            );
          }
          applied++;
        } catch (e) {
          // e.g. a row whose habit was never synced; keep going rather than wedge sync.
          skipped++;
          console.warn(`[sync] could not apply ${def.collection}/${doc.id}:`, e);
        }
      }
      await txn.runAsync(
        `INSERT INTO sync_state (entity, last_pulled_at) VALUES (?, ?)
         ON CONFLICT (entity) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
        def.entity,
        cursor,
      );
    });
  }
  return { applied, skipped };
}

/** Enqueues every local row, used when a guest's data moves into a new account. */
export async function enqueueAll(db: LocalDb): Promise<number> {
  let n = 0;
  await writeTransaction(db, ['sync_outbox'], async (txn) => {
    const now = Date.now();
    for (const def of ENTITIES) {
      const rows = await txn.getAllAsync<Record<string, unknown> & { id: string }>(`SELECT * FROM ${def.table}`);
      for (const row of rows) {
        await txn.runAsync(
          `INSERT INTO sync_outbox (entity, entity_id, op, payload, created_at) VALUES (?, ?, 'upsert', ?, ?)
           ON CONFLICT (entity, entity_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
          def.entity,
          row.id,
          JSON.stringify(row),
          now,
        );
        n++;
      }
    }
  });
  return n;
}

const SYNCED_TABLES = ['milestones', 'freeze_events', 'completions', 'vacations', 'habits'];

/** Removes all user data from this device and resets the profile to a fresh guest. */
export async function wipeLocalData(db: LocalDb): Promise<void> {
  await writeTransaction(db, ALL_TABLES, async (txn) => {
    for (const t of SYNCED_TABLES) await txn.runAsync(`DELETE FROM ${t}`);
    await txn.runAsync('DELETE FROM sync_outbox');
    await txn.runAsync('DELETE FROM sync_state');
    await txn.runAsync(`DELETE FROM profile`);
    await txn.runAsync(`INSERT INTO profile (id, updated_at) VALUES ('me', ?)`, Date.now());
  });
}

/**
 * Links this device's data to a signed-in account.
 * - same account: no-op
 * - guest data: kept and queued for upload into the account
 * - different account's data: wiped first (never mix two users' data)
 */
export async function adoptAccount(
  db: LocalDb,
  user: { uid: string; email: string | null; displayName?: string | null },
): Promise<'same' | 'adopted-guest' | 'switched'> {
  const profile = await db.getFirstAsync<{ account_uid: string | null }>(`SELECT account_uid FROM profile WHERE id = 'me'`);
  if (profile?.account_uid === user.uid) {
    await db.runAsync(`UPDATE profile SET email = ? WHERE id = 'me'`, user.email);
    notifyTablesChanged('profile');
    return 'same';
  }
  const switched = !!profile?.account_uid;
  if (switched) await wipeLocalData(db);
  await db.runAsync(
    `UPDATE profile SET account_uid = ?, email = ?, tier = CASE WHEN tier = 'guest' THEN 'free' ELSE tier END,
       display_name = COALESCE(?, display_name), onboarded_at = COALESCE(onboarded_at, ?) WHERE id = 'me'`,
    user.uid,
    user.email,
    user.displayName ?? null,
    Date.now(),
  );
  notifyTablesChanged('profile');
  if (!switched) await enqueueAll(db);
  return switched ? 'switched' : 'adopted-guest';
}
