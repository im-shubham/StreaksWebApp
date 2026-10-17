import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { subscribeTablesChanged } from '@/db/changes';
import { updateProfile } from '@/db/repositories/profile';
import { firebaseAuth, firestore, isFirebaseConfigured } from '@/services/firebase';
import { signInWithGoogle, signOutOfGoogle } from '@/services/googleSignIn';
import { adoptAccount, pull, push, wipeLocalData } from '@/sync/engine';
import { firestoreRemote } from '@/sync/firestoreRemote';
import { getSyncStatus, setSyncStatus } from '@/sync/status';
import type { LocalDb } from '@/sync/types';

export { authErrorMessage } from './authErrors';

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User };

type AuthApi = {
  auth: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves 'cancelled' if the user dismisses the Google sheet. */
  signInWithGoogle: () => Promise<'success' | 'cancelled'>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Signs out and removes this account's data from the device. */
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

const LAST_SYNC_KEY = '__last_sync';
const PAGE = 400;

function syncErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'Firestore rejected the write. Publish firestore.rules in Firebase Console.';
  if (code === 'not-found' || code === 'failed-precondition') return 'Cloud Firestore database not found. Create it in Firebase Console.';
  if (code === 'unavailable') return 'Firestore is unreachable right now.';
  return e instanceof Error ? e.message : 'Sync failed.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = sqlite as unknown as LocalDb;
  const [auth, setAuth] = useState<AuthState>(isFirebaseConfigured ? { status: 'loading' } : { status: 'unconfigured' });
  const uidRef = useRef<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const lastSyncedAt = useCallback(async () => {
    const row = await db.getFirstAsync<{ last_pulled_at: number }>(
      'SELECT last_pulled_at FROM sync_state WHERE entity = ?',
      LAST_SYNC_KEY,
    );
    return row?.last_pulled_at || null;
  }, [db]);

  const runSync = useCallback((): Promise<void> => {
    const uid = uidRef.current;
    if (!uid) return Promise.resolve();
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      const last = await lastSyncedAt();
      const net = await Network.getNetworkStateAsync().catch(() => null);
      if (net && (net.isConnected === false || net.isInternetReachable === false)) {
        setSyncStatus({ state: 'offline', lastSyncedAt: last });
        return;
      }
      setSyncStatus({ state: 'syncing', lastSyncedAt: last });
      try {
        const remote = firestoreRemote(firestore());
        let r;
        do {
          r = await push(db, remote, uid, PAGE);
        } while (r.pushed === PAGE && uidRef.current === uid);
        await pull(db, remote, uid);
        const now = Date.now();
        await db.runAsync(
          `INSERT INTO sync_state (entity, last_pulled_at) VALUES (?, ?)
           ON CONFLICT (entity) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
          LAST_SYNC_KEY,
          now,
        );
        setSyncStatus({ state: 'idle', lastSyncedAt: now });
      } catch (e) {
        console.warn('[sync] failed', e);
        setSyncStatus({ state: 'error', lastSyncedAt: last, message: syncErrorMessage(e) });
      }
    })().finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, [db, lastSyncedAt]);

  // Firebase session (persisted in SQLite kv-store, so it survives restarts).
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSyncStatus({ state: 'disabled', reason: 'not-configured' });
      return;
    }
    return onAuthStateChanged(firebaseAuth(), (user) => {
      if (!user) {
        uidRef.current = null;
        setSyncStatus({ state: 'disabled', reason: 'signed-out' });
        setAuth({ status: 'signedOut' });
        return;
      }
      void (async () => {
        await adoptAccount(db, { uid: user.uid, email: user.email, displayName: user.displayName });
        uidRef.current = user.uid;
        setAuth({ status: 'signedIn', user });
        void runSync();
      })();
    });
  }, [db, runSync]);

  // Sync on foreground and shortly after local writes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runSync();
    });
    // Post-commit notification (see src/db/changes.ts), not the native pre-commit event.
    const unsubscribe = subscribeTablesChanged((tables) => {
      if (!tables.has('sync_outbox') || !uidRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox').then((r) => {
          if ((r?.n ?? 0) > 0 && getSyncStatus().state !== 'syncing') void runSync();
        });
      }, 1500);
    });
    return () => {
      appSub.remove();
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [db, runSync]);

  const api = useMemo<AuthApi>(
    () => ({
      auth,
      async signIn(email, password) {
        await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      },
      signInWithGoogle: () => signInWithGoogle(firebaseAuth()),
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
        if (name.trim()) {
          await fbUpdateProfile(cred.user, { displayName: name.trim() });
          await updateProfile(sqlite, { display_name: name.trim() });
        }
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(firebaseAuth(), email.trim());
      },
      async signOut() {
        // Last best-effort push so nothing unsynced is lost silently; the caller
        // already warned the user about pending changes.
        await runSync().catch(() => undefined);
        await fbSignOut(firebaseAuth());
        await signOutOfGoogle();
        uidRef.current = null;
        await wipeLocalData(db);
      },
      syncNow: runSync,
    }),
    [auth, db, sqlite, runSync],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
