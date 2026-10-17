/**
 * In-app change notifications, fired after a write transaction COMMITs.
 *
 * Why this exists: repository writes use withExclusiveTransactionAsync, which
 * runs on a separate SQLite connection. expo-sqlite's native change listener
 * (sqlite3_update_hook) fires per statement, *before* COMMIT, so a live query
 * re-run from that event reads the pre-write data and the UI never sees the
 * change. Writers call notifyTablesChanged() after the transaction resolves;
 * useLiveQuery subscribes here.
 */
type Listener = (tables: ReadonlySet<string>) => void;

const listeners = new Set<Listener>();

export function notifyTablesChanged(...tables: string[]): void {
  const set = new Set(tables);
  listeners.forEach((l) => l(set));
}

export function subscribeTablesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every table the app writes. Used after bulk operations (sync pull, wipe). */
export const ALL_TABLES = [
  'habits',
  'completions',
  'freeze_events',
  'vacations',
  'milestones',
  'profile',
  'sync_outbox',
  'sync_state',
] as const;

type TxDb<T> = { withExclusiveTransactionAsync(task: (txn: T) => Promise<void>): Promise<void> };

/** Runs an exclusive write transaction, then notifies `tables` once it has committed. */
export async function writeTransaction<T>(db: TxDb<T>, tables: readonly string[], task: (txn: T) => Promise<void>): Promise<void> {
  await db.withExclusiveTransactionAsync(task);
  notifyTablesChanged(...tables);
}
