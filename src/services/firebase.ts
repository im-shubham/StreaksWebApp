import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import Storage from 'expo-sqlite/kv-store';

/**
 * Firebase JS SDK (runs in Expo Go; React Native Firebase would not).
 *
 * Config comes from EXPO_PUBLIC_FIREBASE_* variables (see .env.example).
 * These are the public web-app config values from the Firebase console;
 * they are not secrets, access is enforced by firestore.rules.
 * When they are missing the app runs local-only (guest) and says so.
 */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

/** Auth with the session persisted in SQLite kv-store, so sign-in survives restarts. */
export function firebaseAuth(): Auth {
  if (auth) return auth;
  const a = ensureApp();
  try {
    auth = initializeAuth(a, { persistence: getReactNativePersistence(Storage) });
  } catch {
    // Fast refresh: already initialized.
    auth = getAuth(a);
  }
  return auth;
}

export function firestore(): Firestore {
  if (db) return db;
  const a = ensureApp();
  try {
    // Long-polling detection keeps the WebChannel transport working on RN.
    db = initializeFirestore(a, { experimentalAutoDetectLongPolling: true });
  } catch {
    db = getFirestore(a);
  }
  return db;
}
