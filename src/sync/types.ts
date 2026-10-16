/** Minimal SQLite surface the sync engine needs (expo-sqlite's SQLiteDatabase satisfies it). */
export interface LocalDb {
  getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  withExclusiveTransactionAsync(task: (txn: LocalDb) => Promise<void>): Promise<void>;
}

export type RemoteCollection = 'profile' | 'habits' | 'completions' | 'freezeEvents' | 'vacations' | 'milestones';

export type RemoteDoc = { id: string; data: Record<string, unknown>; serverUpdatedAt: number };

/** Remote side of sync. FirestoreRemote implements it; tests use an in-memory fake. */
export interface RemoteStore {
  /** Writes all ops atomically, stamping each with a server timestamp. */
  push(uid: string, ops: { collection: RemoteCollection; id: string; data: Record<string, unknown> }[]): Promise<void>;
  /** Documents whose server timestamp is strictly after `sinceMs`, oldest first. */
  pull(uid: string, collection: RemoteCollection, sinceMs: number): Promise<RemoteDoc[]>;
}
