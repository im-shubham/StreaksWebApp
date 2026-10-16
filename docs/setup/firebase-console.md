# Firebase Console setup (about 10 minutes)

> **Project `streak-app-72026`:** the web-app config (steps 5–6) is already in the committed [`.env`](../../.env). As of 2026-10-16, Authentication isn't initialized (`CONFIGURATION_NOT_FOUND`) and the Firestore database doesn't exist yet, so do **steps 2, 3 and 4**.

The app's Firebase code is complete and tested against the Firebase Emulator Suite. It needs your Firebase project before real accounts and sync can work. Until then, STREAKS runs in guest mode and the sign-in screens say cloud accounts aren't configured.

## 1. Create the project

1. Open <https://console.firebase.google.com> and click **Create a project** (or **Add project**).
2. Name it, for example `streaks`. Google Analytics is optional; you can turn it off.
3. Click **Create project**.

## 2. Turn on email/password sign-in

1. In the left menu, open **Build → Authentication** and click **Get started**.
2. Open the **Sign-in method** tab, choose **Email/Password**, turn on the first toggle (**Email/Password**) and click **Save**.
   - Leave "Email link (passwordless sign-in)" off.

If you skip this step, the app shows: *"Email/Password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method."*

## 3. Create the Firestore database

1. Open **Build → Firestore Database** and click **Create database**.
2. Choose a location near your users, such as `nam5 (United States)` or `eur3 (Europe)`. **This can't be changed later.**
3. Choose **Start in production mode** and click **Create**.

## 4. Publish the security rules

1. In Firestore Database, open the **Rules** tab.
2. Replace everything with the contents of [`firestore.rules`](../../firestore.rules) from this repository.
3. Click **Publish**.

These rules let each signed-in user read and write only `users/{their uid}/…`, and stop the app from setting its own plan tier. If you skip this step, the Profile tab shows: *"Firestore rejected the write. Publish firestore.rules in Firebase Console."*

## 5. Register a Web app and copy its config

The app uses the Firebase **JS SDK**, which is the one that runs in Expo Go, so it needs a **Web** app's config, not an iOS app's.

1. Click the gear icon → **Project settings** → **General** tab → **Your apps** → click the **Web** icon (`</>`).
2. Give it a nickname (for example `streaks-mobile`). Leave Firebase Hosting **unchecked**, then click **Register app**.
3. Copy the values from the `firebaseConfig` object that's shown.

## 6. Give the config to the app

Create a file named `.env.local` in the project root (it's git-ignored) and paste in your values:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=streaks-xxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=streaks-xxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=streaks-xxxx.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

Then restart the dev server (`npx expo start`).

These are public identifiers, not secrets; your data is protected by the security rules. You can also paste them into the chat, and they can be committed to the repo.

## 7. Check it works

1. In the app, go to Profile → **Create Free Account** and register.
2. In Firebase Console → Authentication → **Users**, your email should appear.
3. Create a habit and check in. Profile → Cloud Sync should say **Cloud Sync Active · Synced at …**.
4. In Firestore Database → **Data**, you should see `users/<uid>/habits/…` and `users/<uid>/completions/…`.
5. Sign out, then sign back in. Your habit and streak come back from the cloud.

## Test locally without a project (optional)

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-streaks
npm run test:emulator     # in another terminal
```
