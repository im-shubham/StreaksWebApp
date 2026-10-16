# Google Sign-In setup

The code is done: "Continue with Google" is on Sign In and Create Account, it signs in to Firebase with the Google credential, and it signs out of Google on sign-out. Two things are still needed.

## The constraint: no Google sign-in in Expo Go

Google Sign-In uses native code (`@react-native-google-signin/google-signin`). Expo Go, including a custom one from `eas go`, can't load it. It works only in a **development build** or a store/TestFlight build of STREAKS. In Expo Go the button explains this and email/password still works.

## 1. Values to copy from Firebase (Google is already enabled)

**Web client ID** (both platforms need it to get the ID token Firebase verifies):
Firebase Console → **Authentication → Sign-in method → Google** → expand **Web SDK configuration** → copy **Web client ID** (it ends in `.apps.googleusercontent.com`).

**iOS client ID**:
1. Firebase Console → ⚙️ **Project settings → General → Your apps → Add app → iOS**.
2. **Apple bundle ID:** `app.streaks.mobile` (the app's current ID). Confirm or change this first, because it's hard to change later.
3. Register, then **download `GoogleService-Info.plist`**. Open it and copy the `CLIENT_ID` value.
   - If `CLIENT_ID` is missing, Google wasn't enabled when the file was generated. Download it again.

**Android** (when you build for Android): Project settings → Add app → **Android**, package `app.streaks.mobile`, and add the **SHA-1** of the signing key. Get it from `npx eas-cli@latest credentials -p android`, or for a local debug build, `cd android && ./gradlew signingReport`.

## 2. Put them in `.env`

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=1234567890-yyyy.apps.googleusercontent.com
```

These are public client IDs, not secrets. Setting the iOS one also enables the native config plugin in `app.config.ts`, which registers the `com.googleusercontent.apps.…` URL scheme.

## 3. Build the app

- **Mac + iPhone (free Apple ID OK):** `npx expo run:ios --device`
- **EAS (paid Apple Developer account):** `npx eas-cli@latest build -p ios --profile development`

Rebuild whenever the client IDs change.
