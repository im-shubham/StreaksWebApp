/**
 * @jest-environment node
 *
 * End-to-end against the Firebase Emulator Suite: real Firebase JS SDK
 * (Auth + Firestore), the app's FirestoreRemote, sync engine, repositories,
 * and the real firestore.rules. Skipped unless FIREBASE_EMULATORS=1.
 *
 *   npx firebase emulators:start --only auth,firestore --project demo-streaks
 *   FIREBASE_EMULATORS=1 npx jest firebase.emulator
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  terminate,
  type Firestore,
} from 'firebase/firestore';

import { checkIn } from '@/db/repositories/completions';
import { createHabit } from '@/db/repositories/habits';
import { authErrorMessage } from '@/features/auth/authErrors';
import { openDb } from '@/test/localDb';
import { adoptAccount, pull, push } from '../engine';
import { firestoreRemote } from '../firestoreRemote';

jest.mock('expo-crypto', () => ({ randomUUID: () => (jest.requireActual('crypto') as typeof import('crypto')).randomUUID() }));

const run = process.env.FIREBASE_EMULATORS === '1' ? describe : describe.skip;

run('Firebase emulators', () => {
  let app: FirebaseApp;
  let auth: Auth;
  let fs: Firestore;
  const email = `user${Date.now()}@streaks.test`;
  const password = 'Streaks123';

  beforeAll(() => {
    app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-streaks', appId: 'demo-app' }, `t${Date.now()}`);
    auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fs = initializeFirestore(app, {});
    connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  });

  afterAll(async () => {
    await terminate(fs);
    await deleteApp(app);
  });

  it('registers, signs in, and maps a wrong password to a clear message', async () => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    expect(cred.user.email).toBe(email);
    await signOut(auth);
    const err = await signInWithEmailAndPassword(auth, email, 'WrongPass1').catch((e: unknown) => e);
    expect(authErrorMessage(err)).toBe('Incorrect email or password.');
    const dup = await createUserWithEmailAndPassword(auth, email, password).catch((e: unknown) => e);
    expect(authErrorMessage(dup)).toMatch(/already exists/);
    await signInWithEmailAndPassword(auth, email, password);
    expect(auth.currentUser?.email).toBe(email);
  });

  it('pushes guest data to Firestore and restores it on another device', async () => {
    const uid = auth.currentUser!.uid;
    const remote = firestoreRemote(fs);

    const phone = openDb();
    const habitId = await createHabit(phone, { name: 'Morning Gym', category: 'fitness', emblem: 'fitness_center', cadenceType: 'daily' });
    await checkIn(phone, habitId);
    await adoptAccount(phone, { uid, email });
    const pushed = await push(phone, remote, uid);
    expect(pushed.pushed).toBe(3);

    const snap = await getDoc(doc(fs, 'users', uid, 'habits', habitId));
    expect(snap.data()?.name).toBe('Morning Gym');
    expect(snap.data()?.serverUpdatedAt).toBeTruthy();

    const tablet = openDb();
    await adoptAccount(tablet, { uid, email });
    const pulled = await pull(tablet, remote, uid);
    expect(pulled.applied).toBeGreaterThanOrEqual(2);
    const c = await tablet.getAllAsync<{ habit_id: string }>('SELECT habit_id FROM completions WHERE deleted_at IS NULL');
    expect(c.map((r) => r.habit_id)).toEqual([habitId]);
    // Incremental pull: nothing new the second time.
    expect((await pull(tablet, remote, uid)).applied).toBe(0);
  });

  it('enforces firestore.rules: no cross-user access, no client-set tier', async () => {
    const ownerUid = auth.currentUser!.uid;
    await signOut(auth);
    await createUserWithEmailAndPassword(auth, `other${Date.now()}@streaks.test`, password);
    const denied = await getDoc(doc(fs, 'users', ownerUid, 'profile', 'me')).catch((e: { code?: string }) => e.code);
    expect(denied).toBe('permission-denied');

    const me = auth.currentUser!.uid;
    const tier = await setDoc(doc(fs, 'users', me, 'profile', 'me'), { tier: 'pro', updatedAt: 1, serverUpdatedAt: serverTimestamp() }).catch(
      (e: { code?: string }) => e.code,
    );
    expect(tier).toBe('permission-denied');
  });

  it('Pro entitlement: readable by its owner, never writable by a client; purchases are server-only', async () => {
    const me = auth.currentUser!.uid;
    // Seed as the backend would (emulator admin bypass), then act as the client.
    await fetch(`http://127.0.0.1:8080/v1/projects/demo-streaks/databases/(default)/documents/users/${me}/entitlements?documentId=pro`, {
      method: 'POST',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { active: { booleanValue: false }, state: { stringValue: 'expired' } } }),
    });
    expect((await getDoc(doc(fs, 'users', me, 'entitlements', 'pro'))).data()?.state).toBe('expired');

    const grant = { active: true, plan: 'lifetime', updatedAt: 1, serverUpdatedAt: serverTimestamp() };
    const write = await setDoc(doc(fs, 'users', me, 'entitlements', 'pro'), grant).catch((e: { code?: string }) => e.code);
    expect(write).toBe('permission-denied');
    const other = await setDoc(doc(fs, 'users', me, 'entitlements', 'mine'), grant).catch((e: { code?: string }) => e.code);
    expect(other).toBe('permission-denied');
    const purchases = await getDoc(doc(fs, 'purchases', 'android_x')).catch((e: { code?: string }) => e.code);
    expect(purchases).toBe('permission-denied');
    const forge = await setDoc(doc(fs, 'purchases', 'android_x'), { uid: me }).catch((e: { code?: string }) => e.code);
    expect(forge).toBe('permission-denied');
  });
});
