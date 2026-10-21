# Build roadmap

The Stitch designs (`design/stitch`) are implemented in stages. The live per-screen status is in `src/design/stitchScreens.ts`.

| Stage | Scope | Stitch screens | Status |
|---|---|---|---|
| 0 | Foundation: Expo SDK 57, Expo Router, design tokens, SQLite schema, streak engine, Firebase plan | — | **Done** |
| 1 | Core tracking | Main Dashboard, Empty Dashboard, Habits Manager, Empty Habits Manager, Create Habit | **Done** |
| MVP | Usable app: guest mode, Welcome, Sign In, Create Account, Profile (account + sync + sign out), Firebase Auth (email/password, persisted session), Firestore sync, Free plan = 1 active habit | Welcome & Onboarding, Sign In, Create Account, Profile & Settings (subset) | **Done**: needs your Firebase project to go live ([setup](setup/firebase-console.md)) |
| 2 | Habit depth | Edit Habit, Habit Details & Calendar, Completion History empty state, Hold-to-Complete Success, Already Completed Today, Archive & Delete, Starter Templates, Streak Freeze & Repair, Vacation Buffer, Dashboard (Vacation Mode), Milestone Celebration, Push & Check-in Alerts (local notifications) | **Reminders done** (local notifications + Notifications screen); the rest is next |
| 3 | Insights & settings | Insights & Analytics, Empty Insights, Profile & Settings, App Icon & Themes | **Insights done** (consistency, streaks, 14-week heatmap, recent activity; Temporal Peak, Top Habits and Export deferred). App icon = MOMENTUM logo. Settings/themes planned |
| 4 | Onboarding & accounts (Firebase Auth) | Welcome, Onboarding 1–3, Authentication, Sign In, Create Account, Forgot Password, Reset Email Sent, Auth Error, Session Expired, Guest Mode | **Forgot Password + Reset Email Sent done**; rest planned |
| 5 | Sync & offline (Firestore) | Account Data Loading, Offline Mode, Pending Sync Queue, Sync Failure & Recovery | Planned |
| 6 | Monetization & platform | Pro Paywall, Paywall Modal, Feature Comparison, Free Limit Sheet, Purchase States, Restore Purchases, Native Ads, Widgets & Live Activities | **Pro billing built** (Play Billing + StoreKit via expo-iap, backend verification in `functions/`, [setup](setup/billing.md)); not deployed or live. Ads, widgets planned |

Deferred by decision: ads, AI features, advanced streak features (freeze, vacation), and the remaining non-essential screens.

Reminder notes:

- Local notifications only (no push server). Each due day gets a one-off notification at the habit's reminder time, so rest days, freeze/vacation days and days already checked in get none. The queue covers the next 14 days (max 60, under the iOS limit of 64) and is rebuilt whenever habits or check-ins change, the date rolls over, or the app opens.
- "Mark Done" on a reminder checks in today's habit (source `notification`).
- Android delivers at an inexact time (no exact-alarm permission requested); the Android status-bar icon still needs a monochrome asset.

Insights notes:

- Rates use scheduled occurrences: done (completed or frozen) ÷ (done + missed). Rest days, vacation days, days before a habit started and today-not-yet-done are excluded. Paused habits keep their check-ins, but their unchecked days are not counted as missed (no pause date is stored).
- Archived habits are excluded, matching the Streaks and Habits tabs.

Stage 1 caveats:

- The "All Daily" header filter isn't wired up yet. The habit switcher and the "…" menu (pin, undo, pause, archive, delete) work.
- The dashboard's "Log Workout Proof" row is omitted; photo-proof logging has no data model yet.
