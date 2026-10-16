/**
 * Every Stitch screen (design/stitch/manifest.json) mapped to its build stage
 * and the route that implements it. Keep in sync with docs/roadmap.md.
 */
export type ScreenStatus = 'built' | 'planned';

export type StitchScreen = {
  slug: string;
  title: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  status: ScreenStatus;
  route?: string;
};

export const STAGES: Record<StitchScreen['stage'], string> = {
  1: 'Core tracking',
  2: 'Habit depth',
  3: 'Insights',
  4: 'Onboarding & accounts',
  5: 'Sync & offline',
  6: 'Monetization & platform',
};

export const STITCH_SCREENS: StitchScreen[] = [
  { slug: 'main-dashboard', title: 'Main Dashboard', stage: 1, status: 'built', route: '/' },
  { slug: 'empty-dashboard', title: 'Empty Dashboard', stage: 1, status: 'built', route: '/' },
  { slug: 'habits-manager', title: 'Habits Manager', stage: 1, status: 'built', route: '/habits' },
  { slug: 'empty-habits-manager', title: 'Empty Habits Manager', stage: 1, status: 'built', route: '/habits' },
  { slug: 'create-habit', title: 'Create Habit', stage: 1, status: 'built', route: '/habit/new' },

  { slug: 'edit-habit', title: 'Edit Habit', stage: 2, status: 'planned' },
  { slug: 'habit-details-calendar-history', title: 'Habit Details & Calendar History', stage: 2, status: 'planned' },
  { slug: 'completion-history-calendar-empty-state', title: 'Completion History & Calendar Empty State', stage: 2, status: 'planned' },
  { slug: 'hold-to-complete-success-interaction', title: 'Hold-to-Complete Success Interaction', stage: 2, status: 'planned' },
  { slug: 'habit-already-completed-today', title: 'Habit Already Completed Today', stage: 2, status: 'planned' },
  { slug: 'habit-archive-deletion-confirmation', title: 'Habit Archive & Deletion Confirmation', stage: 2, status: 'planned' },
  { slug: 'starter-habit-templates', title: 'Starter Habit Templates', stage: 2, status: 'planned' },
  { slug: 'streak-freeze-repair', title: 'Streak Freeze & Repair', stage: 2, status: 'planned' },
  { slug: 'vacation-planned-buffer', title: 'Vacation & Planned Buffer', stage: 2, status: 'planned' },
  { slug: 'dashboard-active-vacation-mode', title: 'Dashboard (Active Vacation Mode)', stage: 2, status: 'planned' },
  { slug: 'streak-milestone-celebration', title: 'Streak Milestone Celebration', stage: 2, status: 'planned' },
  { slug: 'push-check-in-alerts', title: 'Push & Check-in Alerts', stage: 2, status: 'planned' },

  { slug: 'insights-analytics', title: 'Insights & Analytics', stage: 3, status: 'planned' },
  { slug: 'empty-insights-analytics', title: 'Empty Insights & Analytics', stage: 3, status: 'planned' },
  { slug: 'profile-settings', title: 'Profile & Settings', stage: 3, status: 'built', route: '/profile' }, // MVP subset: account, sync, sign out
  { slug: 'app-icon-picker-custom-themes', title: 'App Icon Picker & Custom Themes', stage: 3, status: 'planned' },

  { slug: 'welcome-onboarding', title: 'Welcome & Onboarding', stage: 4, status: 'built', route: '/welcome' },
  { slug: 'onboarding-step-1', title: 'Onboarding Step 1', stage: 4, status: 'planned' },
  { slug: 'onboarding-step-2', title: 'Onboarding Step 2', stage: 4, status: 'planned' },
  { slug: 'onboarding-step-3', title: 'Onboarding Step 3', stage: 4, status: 'planned' },
  { slug: 'authentication', title: 'Authentication', stage: 4, status: 'planned' },
  { slug: 'sign-in', title: 'Sign In', stage: 4, status: 'built', route: '/auth/sign-in' },
  { slug: 'create-account', title: 'Create Account', stage: 4, status: 'built', route: '/auth/sign-up' },
  { slug: 'forgot-password', title: 'Forgot Password', stage: 4, status: 'planned' },
  { slug: 'password-reset-email-sent', title: 'Password Reset Email Sent', stage: 4, status: 'planned' },
  { slug: 'auth-error-recovery', title: 'Auth Error & Recovery', stage: 4, status: 'planned' },
  { slug: 'session-expired-account-confirmation', title: 'Session Expired & Account Confirmation', stage: 4, status: 'planned' },
  { slug: 'guest-mode-experience', title: 'Guest Mode Experience', stage: 4, status: 'planned' }, // guest mode works; dedicated screen pending

  { slug: 'account-data-loading-sync-confirmation', title: 'Account Data Loading & Sync Confirmation', stage: 5, status: 'planned' },
  { slug: 'offline-mode-local-cache', title: 'Offline Mode & Local Cache', stage: 5, status: 'planned' },
  { slug: 'pending-synchronization-queue', title: 'Pending Synchronization Queue', stage: 5, status: 'planned' },
  { slug: 'sync-failure-recovery', title: 'Sync Failure & Recovery', stage: 5, status: 'planned' },

  { slug: 'streaks-pro-paywall', title: 'Streaks Pro Paywall', stage: 6, status: 'planned' },
  { slug: 'pro-paywall-modal', title: 'Pro Paywall Modal', stage: 6, status: 'planned' },
  { slug: 'premium-feature-comparison', title: 'Premium Feature Comparison', stage: 6, status: 'planned' },
  { slug: 'free-habit-limit-upgrade-sheet', title: 'Free Habit Limit & Upgrade Sheet', stage: 6, status: 'planned' },
  { slug: 'purchase-states-subscription-management', title: 'Purchase States & Subscription Management', stage: 6, status: 'planned' },
  { slug: 'restore-purchases-subscription-management', title: 'Restore Purchases & Subscription Management', stage: 6, status: 'planned' },
  { slug: 'insights-native-ad-ad-states', title: 'Insights Native Ad & Ad States', stage: 6, status: 'planned' },
  { slug: 'lock-screen-live-activity-widgets', title: 'Lock Screen & Live Activity Widgets', stage: 6, status: 'planned' },
];
