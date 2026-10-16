import Constants, { ExecutionEnvironment } from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

/**
 * Google Sign-In → Firebase Auth.
 *
 * Uses @react-native-google-signin/google-signin (native). It can't run in
 * Expo Go, so the module is required lazily and only outside Expo Go;
 * importing it eagerly would crash Expo Go at startup.
 *
 * Config (docs/setup/google-sign-in.md):
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  Firebase → Auth → Google → Web SDK configuration
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  CLIENT_ID from the iOS app's GoogleService-Info.plist
 */
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export type GoogleAvailability = { available: true } | { available: false; reason: string };

export function googleAvailability(): GoogleAvailability {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return {
      available: false,
      reason: 'Google sign-in needs the installed STREAKS app (development build). In Expo Go, use email and password.',
    };
  }
  if (!webClientId || (Platform.OS === 'ios' && !iosClientId)) {
    return { available: false, reason: 'Google sign-in isn’t configured in this build yet. Use email and password for now.' };
  }
  return { available: true };
}

let lib: GoogleSignInModule | null = null;
function load(): GoogleSignInModule {
  if (!lib) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
    lib.GoogleSignin.configure({ webClientId, iosClientId });
  }
  return lib;
}

/** Returns 'cancelled' when the user closes the Google sheet. */
export async function signInWithGoogle(auth: Auth): Promise<'success' | 'cancelled'> {
  const availability = googleAvailability();
  if (!availability.available) throw new Error(availability.reason);
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = load();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return 'cancelled';
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google didn’t return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return 'success';
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return 'cancelled';
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play Services is missing or out of date on this device.');
    }
    throw e;
  }
}

/** Clears the native Google session so the account picker shows next time. */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleAvailability().available) return;
  try {
    await load().GoogleSignin.signOut();
  } catch {
    // Not signed in with Google; nothing to clear.
  }
}
