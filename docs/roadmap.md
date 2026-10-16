# Build roadmap

The Stitch designs (`design/stitch`) are implemented in stages. The live per-screen status is in `src/design/stitchScreens.ts`.

| Stage | Scope | Stitch screens | Status |
|---|---|---|---|
| 0 | Foundation: Expo SDK 57, Expo Router, design tokens, SQLite schema, streak engine, Firebase plan | — | **Done** |
| 1 | Core tracking | Main Dashboard, Empty Dashboard, Habits Manager, Empty Habits Manager, Create Habit | **Done** |
| MVP | Usable app: guest mode, Welcome, Sign In, Create Account, Profile (account + sync + sign out), Firebase Auth (email/password, persisted session), Firestore sync, Free plan = 1 active habit | Welcome & Onboarding, Sign In, Create Account, Profile & Settings (subset) | **Done**: needs your Firebase project to go live ([setup](setup/firebase-console.md)) |
| 2 | Habit depth | Edit Habit, Habit Details & Calendar, Completion History empty state, Hold-to-Complete Success, Already Completed Today, Archive & Delete, Starter Templates, Streak Freeze & Repair, Vacation Buffer, Dashboard (Vacation Mode), Milestone Celebration, Push & Check-in Alerts (local notifications) | Next |
| 3 | Insights & settings | Insights & Analytics, Empty Insights, Profile & Settings, App Icon & Themes | Planned |
| 4 | Onboarding & accounts (Firebase Auth) | Welcome, Onboarding 1–3, Authentication, Sign In, Create Account, Forgot Password, Reset Email Sent, Auth Error, Session Expired, Guest Mode | Planned |
| 5 | Sync & offline (Firestore) | Account Data Loading, Offline Mode, Pending Sync Queue, Sync Failure & Recovery | Planned |
| 6 | Monetization & platform | Pro Paywall, Paywall Modal, Feature Comparison, Free Limit Sheet, Purchase States, Restore Purchases, Native Ads, Widgets & Live Activities | Planned |

Deferred by decision: Pro purchases, ads, AI features, advanced streak features (freeze, vacation), and the remaining non-essential screens.

Stage 1 caveats:

- The "All Daily" header filter isn't wired up yet. The habit switcher and the "…" menu (pin, undo, pause, archive, delete) work.
- Reminder times are saved on the habit; scheduling the notifications is Stage 2.
- The dashboard's "Log Workout Proof" row is omitted; photo-proof logging has no data model yet.
