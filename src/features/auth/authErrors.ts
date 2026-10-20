export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a reset email without revealing whether an account exists: Firebase
 * already answers "ok" for unknown emails when email-enumeration protection
 * is on (the default), and this treats "user-not-found" the same way when it
 * is off.
 */
export async function requestPasswordReset(send: (email: string) => Promise<void>, email: string): Promise<void> {
  try {
    await send(email.trim());
  } catch (e) {
    if ((e as { code?: string })?.code !== 'auth/user-not-found') throw e;
  }
}

/** Firebase error code -> message a user (or the project owner) can act on. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-email':
      return 'Enter your account email.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No connection to Firebase. Check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already has an account with a different sign-in method. Sign in with email and password.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not set up. Open Firebase Console → Authentication → Get started.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'The Firebase API key is invalid. Check EXPO_PUBLIC_FIREBASE_API_KEY in .env.';
    default:
      return e instanceof Error ? e.message : 'Something went wrong.';
  }
}
