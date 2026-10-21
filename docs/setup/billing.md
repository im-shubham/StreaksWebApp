# MOMENTUM Pro: billing setup and sandbox testing

Pro is sold through **Google Play Billing** (Android) and **Apple In-App Purchase** (iOS). The app never grants Pro by itself: every purchase is verified by the backend (`functions/`, Firebase Cloud Functions) with Google / Apple before `users/{uid}/entitlements/pro` is written.

Nothing here is live until you do the steps below and deploy. **Do not deploy, enable live billing or make real purchases until you have reviewed this.**

## How it works

```
App (expo-iap)                       Backend (functions/)                         Stores
──────────────                       ────────────────────                         ──────
fetch products ──────────────────────────────────────────────────────────────▶  localized prices
buy (tagged with account id) ────────────────────────────────────────────────▶  payment sheet
purchase token / transaction ─▶ verifyPurchase (signed-in only) ─────────────▶  Play Developer API /
                                  binds purchase → one account                   App Store Server API
                                  acknowledges (Play)
                                  writes entitlements/pro
finish transaction ◀─ ok
entitlement listener ◀── Firestore (read-only for clients)
                                 playBillingNotifications ◀── Pub/Sub ◀──────── Play RTDN
                                 appStoreNotifications   ◀── HTTPS  ◀──────── App Store Server Notifications V2
                                 (renewals, cancels, grace, hold, expiry, refunds)
```

- **Plans:** Monthly, Yearly (auto-renewing subscriptions) and Lifetime (one-time). India prices you set: ₹49 / ₹199 / ₹399. Other countries: set or auto-convert in each console. The app shows whatever price string the store returns for the user's store account.
- **Account binding:** purchases carry an id derived from the Firebase uid (`obfuscatedAccountId` on Play, `appAccountToken` on iOS). One purchase unlocks one MOMENTUM account; restoring it into a different account is refused.
- **Access:** `active`, `canceled` (until the paid period ends) and `grace` grant Pro. `on_hold` / billing retry, `paused`, `pending`, `expired` and `revoked` (refund / chargeback) do not.
- **Server-side enforcement:** when an account isn't Pro, the backend pauses extra active habits (keeps the pinned one, else the oldest). It runs on downgrade and whenever a habit becomes active (`enforceHabitLimit` trigger). Habits are never deleted.
- **Offline:** the app caches the entitlement (with its expiry) locally; a cached Pro lapses by itself after the paid period even without network.
- **Buying needs an account** (Pro follows the account across devices and stores). Guests are asked to create a free account first.

## Product IDs (must match exactly)

| Plan | Google Play | App Store |
|---|---|---|
| Monthly | Subscription **`momentum_pro`**, base plan **`monthly`** (auto-renewing, 1 month) | Auto-renewable **`momentum_pro_monthly`** |
| Yearly | Same subscription, base plan **`yearly`** (auto-renewing, 1 year) | Auto-renewable **`momentum_pro_yearly`** (same group) |
| Lifetime | One-time product **`momentum_pro_lifetime`** | Non-consumable **`momentum_pro_lifetime`** |

Defined in `src/domain/billing.ts` and `functions/src/products.ts` (a test keeps them identical).

## 1. Firebase

1. Upgrade the project (`streak-app-72026`) to the **Blaze** plan (required for Cloud Functions; normal usage of these functions fits in the free monthly quota).
2. Google Cloud Console (same project) → APIs & Services → enable **Google Play Android Developer API**.
3. Note the Cloud Functions runtime service account: `PROJECT_NUMBER-compute@developer.gserviceaccount.com` (2nd gen default).
4. Deploy (only after review): `cd functions && npm install && npm run build`, then from the repo root `npx firebase-tools deploy --only functions,firestore:rules --project streak-app-72026`.

## 2. Google Play Console

1. Create the app with package **`app.streaks.mobile`** and upload one build to **Internal testing** (Play only lets you create products after a build with billing is uploaded): `npx eas-cli@latest build --profile production --platform android`, then upload the `.aab` in Play Console (or `npx eas-cli@latest submit`).
2. **Monetize → Products → Subscriptions → Create subscription** `momentum_pro` ("MOMENTUM Pro"). Add base plans `monthly` (1 month) and `yearly` (1 year), both auto-renewing. Set India **₹49** / **₹199**; set the US and other countries (or let Play convert). In each base plan, keep a **grace period** and **account hold** enabled. Activate both base plans.
3. **Monetize → Products → One-time products → Create** `momentum_pro_lifetime`, India **₹399**, other countries as you like. Activate.
4. **Users and permissions → Invite new user** → the runtime service account email from Firebase step 3 → app permissions: *View financial data* and *Manage orders and subscriptions*.
5. **Real-time developer notifications:** in Google Cloud → Pub/Sub, create topic **`play-billing`**; grant `google-play-developer-notifications@system.gserviceaccount.com` the *Pub/Sub Publisher* role on it. In Play Console → Monetize → Monetization setup, set the topic `projects/streak-app-72026/topics/play-billing` and click **Send test notification** (the function logs `play notification {outcome: test}`).
6. **Settings → License testing:** add your tester Gmail accounts (response *RESPOND_NORMALLY*). Testers' purchases are free and marked as test purchases.

## 3. App Store Connect (needs the Apple Developer Program)

1. Agreements, Tax and Banking: accept the **Paid Apps** agreement.
2. Create the app with bundle id **`app.streaks.mobile`**.
3. **Subscriptions:** create the group "MOMENTUM Pro" with `momentum_pro_monthly` (1 month) and `momentum_pro_yearly` (1 year). Base storefront India: pick the **₹49** and **₹199** price points (or the nearest available); review other storefronts (US etc.). Enable **Billing Grace Period**.
4. **In-App Purchases:** create non-consumable `momentum_pro_lifetime`, India **₹399**.
5. **Users and Access → Integrations → In-App Purchase → generate key**; download the `.p8` once. Configure the backend:
   - `npx firebase-tools functions:secrets:set APPLE_IAP_PRIVATE_KEY` (paste the whole `.p8` contents)
   - `functions/.env.streak-app-72026` with `APPLE_IAP_KEY_ID=…`, `APPLE_IAP_ISSUER_ID=…`, `APPLE_APP_APPLE_ID=…` (numeric Apple ID from App Information)
6. **App Information → App Store Server Notifications:** Version 2, Production and Sandbox URL = the deployed `appStoreNotifications` function URL (shown after deploy). Send a test notification (logs `outcome: test`).
7. **Users and Access → Sandbox → Testers:** add sandbox Apple IDs; on the iPhone, Settings → App Store → Sandbox Account.

## 4. App configuration

- Apple requires links to **Terms of Use (EULA)** and a **Privacy Policy** on the paywall for subscriptions; Google requires a privacy policy. Set `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` in `.env` (the paywall shows the links only when set).
- Purchases need a development or store build (`expo-iap` is native): `npx eas-cli@latest build --profile development --platform android`. Expo Go shows "Purchases need the installed MOMENTUM app".

## 5. Sandbox test plan (no real money)

Store test subscriptions renew quickly: Play monthly → every 5 min, yearly → every 30 min; Apple sandbox monthly → 5 min, yearly → 1 hour. Check the result in the app (Profile → Momentum Pro) and in Firestore `users/{uid}/entitlements/pro`.

| # | Scenario | How (Android license tester / iOS sandbox) | Expected |
|---|---|---|---|
| 1 | Prices | Open the paywall with an Indian and a US test account | ₹49/₹199/₹399 vs your US prices, as returned by the store |
| 2 | Buy monthly | Buy | "Confirming…" → "Welcome to Momentum Pro"; second habit allowed; entitlement `active` |
| 3 | Renewal | Wait one accelerated period | `expiresAt` moves forward |
| 4 | Cancel | Play Store / Settings → Subscriptions → cancel | `canceled`, Pro until expiry, then `expired` and extra habits paused |
| 5 | Failed renewal | Play: change payment to the "declined" test card; iOS: sandbox "Billing Retry" option | `grace` (Pro kept, warning shown) → `on_hold` (Pro removed) |
| 6 | Pending payment (Play) | Pay with the "slow test card, approves after a few minutes" | "Payment pending" → Pro arrives automatically |
| 7 | Upgrade | Monthly → Yearly | yearly entitlement, old token superseded |
| 8 | Lifetime | Buy lifetime | Pro with no expiry |
| 9 | Refund | Play Console → Order management → refund & revoke; iOS: sandbox refund | `revoked`, Pro removed |
| 10 | Restore | New device / reinstall, same account → Restore Purchases | Pro restored |
| 11 | Other account | Restore on a different MOMENTUM account | "already linked to a different MOMENTUM account" |
| 12 | Offline | Buy, then go offline before verification | Not finished; verified on next launch (Play refunds if never acknowledged in 3 days) |

## Automated tests

- `npm test`: app-side catalog parity, account ids, entitlement rules, purchase pipeline (finish only after server verification; pending / errors / other account), entitlement cache and offline expiry, paywall with store prices.
- `cd functions && npm run test:emulator`: backend against the Firestore emulator with fake Google/Apple APIs: purchase, renewal, cancellation, grace, account hold + enforcement, pending, refund, upgrade, restore, account sharing, iOS flows, forged notification.
- `npm run test:emulator` (repo root, emulators running): Firestore rules: entitlement readable by its owner only, never client-writable; `purchases/` closed.

## Not covered by code

- Real sandbox purchases on a device (needs the console setup above and a deployed backend).
- Tax / invoices / refunds policy are handled by Google and Apple.
- The experimental YouPI PG gateway is **not** used for Pro.
