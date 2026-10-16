// `firebase/auth` re-exports `@firebase/auth`, which Metro resolves with the
// "react-native" export condition (that build has getReactNativePersistence).
// The public `firebase/auth` typings omit it, so declare it here.
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
