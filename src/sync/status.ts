import { useSyncExternalStore } from 'react';

/**
 * Observable sync status for the UI. Every state here reflects something
 * that actually happened; nothing is reported as synced unless a push and
 * pull against Firestore completed.
 */
export type SyncStatus =
  | { state: 'disabled'; reason: 'not-configured' | 'signed-out' }
  | { state: 'idle'; lastSyncedAt: number | null }
  | { state: 'syncing'; lastSyncedAt: number | null }
  | { state: 'offline'; lastSyncedAt: number | null }
  | { state: 'error'; lastSyncedAt: number | null; message: string };

let status: SyncStatus = { state: 'disabled', reason: 'signed-out' };
const listeners = new Set<() => void>();

export function setSyncStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}
