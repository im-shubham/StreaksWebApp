# Firebase Integration Plan

Status: **plan only.** No Firebase code or config is in the app yet. The app runs fully on-device on top of SQLite until Stage 4 (accounts) and Stage 5 (sync).

## 1. Principles

1. **Local-first.** SQLite on the device is the source of truth for every screen. Firestore is a replica used for backup and multi-device sync. The Stitch designs require this: "Offline Mode & Local Cache", "Pending Synchronization Queue" and "Sync Failure & Recovery" all show the app working fully with no network.
2. **Guests never touch Firebase.** "Guest Mode Experience" says data lives in "Local Device Storage" and is "Unsynced". Creating an account uploads the guest's local data.
3. **Keep the Firebase surface small.** Habit reminders and "streak at risk" alerts are local notifications (`expo-notifications`), not FCM. The device already knows whether today's check-in happened, so it needs no server.

## 2. SDK choice: React Native Firebase

| Need from the designs | Firebase JS SDK | React Native Firebase (RNFB) |
|---|---|---|
| Native Apple / Google sign-in ("Continue with Apple/Google") | Possible, but needs manual credential plumbing | Native, first-class |
| Firestore | Yes | Yes (native SDK) |
| Crashlytics, Analytics | **No** | Yes |
| App Check (DeviceCheck / App Attest, Play Integrity) | Limited | Yes |
| FCM push (later) | No | Yes |
| Works in Expo Go | Yes | No (needs a dev build) |

**Recommendation: React Native Firebase.** The Expo Go limitation costs nothing here, because the app already needs a development build for other parts of the designs: in-app purchases, native ads, lock-screen widgets and Live Activities, and alternate app icons.

Packages, installed with `npx expo install` when Stage 4 starts:
`@react-native-firebase/app`, `auth`, `firestore`, `crashlytics`, `analytics`, `app-check`, plus `expo-dev-client`, `expo-build-properties`, `expo-apple-authentication` and `@react-native-google-signin/google-signin`.

> Check the exact config-plugin options (`googleServicesFile`, `expo-build-properties` → `ios.useFrameworks: "static"`) against the RNFB Expo guide and the SDK 57 docs at implementation time. Do not copy them from memory.

## 3. Environments

- Two Firebase projects: `streaks-dev` and `streaks-prod`.
- Convert `app.json` to `app.config.ts`, and select `GoogleService-Info.plist` / `google-services.json` by `APP_VARIANT`.
- Provide the service files to EAS as **file environment variables**, not committed files.
- Bundle ID / package: `app.streaks.mobile` is a **placeholder**. Confirm the real identifier before creating the Firebase apps, because it can't be changed afterwards.

## 4. Authentication (Stage 4)

| Stitch screen | Firebase API |
|---|---|
| Sign In / Create Account / Authentication | Email + password, Sign in with Apple, Google |
| Forgot Password / Password Reset Email Sent | `sendPasswordResetEmail` |
| Auth Error & Recovery | Map `auth/*` error codes to the design's states (wrong password, too many attempts, network) |
| Session Expired & Account Confirmation | `reauthenticateWithCredential` before sensitive actions |
| Delete Account (Profile, Session screens) | Callable function `deleteAccount` (see §8); required by App Store rules |
| Guest Mode → "Save Progress & Sign Up" | Create the account, then upload local data (§6.4) |

The local `profile.account_uid` column records which Firebase user owns the device database. Signing out keeps local data only if the user chooses "keep on device". Otherwise the database is wiped.

## 5. Firestore data model

All user data lives under the user's own document. Field names are the camelCase form of the SQLite columns in `src/db/migrations.ts`.

```
users/{uid}                          profile: displayName, tier (read-only to clients), freezeBalance, preferences…
users/{uid}/habits/{habitId}         habit definition, status, isPrimary, sortOrder
users/{uid}/completions/{habitId}_{localDate}
users/{uid}/freezeEvents/{habitId}_{localDate}
users/{uid}/vacations/{vacationId}
users/{uid}/milestones/{habitId}_{threshold}
users/{uid}/entitlements/current     written only by the server (purchases webhook)
```

Every synced document carries:

- `updatedAt`: client epoch ms. This is the last-write-wins clock.
- `serverUpdatedAt`: `serverTimestamp()`. This is the pull cursor (§6.2).
- `deletedAt`: a tombstone. Documents are never hard-deleted by clients.

**Deterministic IDs** for check-ins, freezes and milestones (`habitId_localDate`, `habitId_threshold`) are already used in the local schema. If two offline devices check in the same habit on the same day, they write the same document, so no deduplication is needed.

## 6. Sync engine (Stage 5)

### 6.1 Push: transactional outbox

Every repository write already inserts into `sync_outbox` **in the same SQLite transaction** (`src/db/outbox.ts`). The outbox holds one entry per record, coalesced so the last write wins.

The drain loop:
1. Read up to 450 entries in `seq` order.
2. Write them as one Firestore `WriteBatch`, using `set(..., { merge: true })` with `serverUpdatedAt: serverTimestamp()`.
3. On success, delete each entry **only if its `created_at` is unchanged**. A newer local edit made during the push stays queued.
4. On failure, increment `attempts`, store `last_error`, and back off exponentially (2s → 5 min cap).

Triggers: app foreground, network regained (`expo-network`), after each local write (debounced 2s), and "Sync All Now" on the Pending Sync Queue screen.

### 6.2 Pull

- While the app is foregrounded and signed in, run an `onSnapshot` per collection with `where('serverUpdatedAt', '>', cursor)`. Store the cursor in `sync_state`.
- Apply a remote document locally only if `remote.updatedAt > local.updatedAt` **and** no outbox entry is pending for that record. Pending local writes win until they are pushed.
- Disable Firestore's own offline persistence, because SQLite is already the cache and keeping both would double the storage.

### 6.3 Conflicts

Conflicts resolve last-write-wins per document on `updatedAt`. Security rules enforce this on the server by rejecting writes where `request.resource.data.updatedAt < resource.data.updatedAt`. Habit-day records are naturally idempotent because of their deterministic IDs. Streaks are **never stored as truth**: they are always recomputed from check-ins, freezes and vacations by `src/domain/streak.ts`, so they can't drift.

### 6.4 Guest → account upgrade

After sign-up, enqueue an upsert for every local row in a single transaction, set `profile.account_uid`, then drain. On sign-in to an **existing** account from a device that has guest data, ask the user to merge or discard. The deterministic IDs make merging safe.

## 7. Security rules (outline)

```
match /users/{uid}/{document=**} {
  allow read: if request.auth.uid == uid;
  allow write: if request.auth.uid == uid
    && request.resource.data.updatedAt is int
    && (resource == null || request.resource.data.updatedAt >= resource.data.updatedAt)
    && request.resource.size() < 64;   // field-count guard; add per-collection schemas
}
match /users/{uid}/entitlements/{doc} { allow write: if false; }   // server only
// users/{uid}.tier is also server-only: deny client writes that change it.
```

Write emulator tests for these rules (`@firebase/rules-unit-testing`) before production.

## 8. Cloud Functions (2nd gen)

- `deleteAccount` (callable): deletes `users/{uid}/**` recursively, then the Auth user.
- `purchasesWebhook`: receives store events and writes `users/{uid}/entitlements/current` and `users/{uid}.tier`.
- Optional: a scheduled cleanup that purges tombstones older than 90 days.

## 9. Purchases (Stage 6)

The paywall, restore, and purchase-state screens need StoreKit 2 and Play Billing. Recommended: **RevenueCat** (`react-native-purchases`), with its webhook writing entitlements to Firestore. The client never sets its own tier. Show prices from the store at runtime; the designs disagree ($29.99 vs $39.99/yr) and must not be hard-coded.

## 10. Crashlytics, Analytics, App Check

- Crashlytics on from Stage 4. Analytics behind a consent toggle in "Data & Privacy".
- App Check: App Attest on iOS, Play Integrity on Android. Enforce on Firestore and Functions once it is stable in production.

## 11. Copy that must change before launch

Several designs claim **"256-bit E2EE", "Zero-Knowledge Encryption" and "decentralized ledger"**. Firestore data is encrypted in transit and at rest, but it is *not* end-to-end encrypted, and Google holds the keys. Either:
- (a) rewrite that copy to "Encrypted in transit and at rest", or
- (b) build client-side encryption of habit payloads, which makes server-side features such as analytics exports much harder.

Recommendation: (a). This needs a product decision before the sync screens ship.

## 12. Inputs needed from the project owner

1. Final bundle ID / Android package name.
2. Firebase projects (dev and prod) created under your Google account, with the iOS and Android apps registered.
3. An Apple Developer team, for Sign in with Apple, App Attest and StoreKit.
4. A decision on the free-plan habit cap (designs show both 1 and 3; currently 3 in `src/domain/plans.ts`).
5. A decision on the encryption copy (§11).
