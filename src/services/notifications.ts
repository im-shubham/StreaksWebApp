import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { planSignature, type PlannedReminder } from '@/domain/reminders';

/**
 * Local habit reminders (no push server, no tokens). Works in Expo Go and in
 * development / release builds. Web is not a target and is a no-op.
 */
export const REMINDER_CHANNEL = 'habit-reminders';
export const REMINDER_CATEGORY = 'habitReminder';
export const ACTION_COMPLETE = 'complete';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let configured: Promise<void> | null = null;
let lastSignature: string | null = null;
const permissionListeners = new Set<(p: ReminderPermission) => void>();

/** Notified after an in-app permission request resolves (the scheduler re-plans on it). */
export function onReminderPermissionChange(listener: (p: ReminderPermission) => void): () => void {
  permissionListeners.add(listener);
  return () => permissionListeners.delete(listener);
}

/** Foreground presentation, Android channel and the "Mark Done" action. Idempotent. */
export function configureNotifications(): Promise<void> {
  if (!supported) return Promise.resolve();
  configured ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: 'Habit reminders',
        description: 'Reminders at the time you set for each habit',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#BCF540',
      });
    }
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      { identifier: ACTION_COMPLETE, buttonTitle: 'Mark Done', options: { opensAppToForeground: true } },
    ]);
  })().catch((e) => {
    configured = null;
    throw e;
  });
  return configured;
}

function toPermission(s: Notifications.NotificationPermissionsStatus): ReminderPermission {
  const ios = s.ios?.status;
  if (
    s.granted ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  if (s.status === 'undetermined' || ios === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
  return 'denied';
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!supported) return 'unsupported';
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Shows the OS prompt if the user hasn't decided yet; otherwise returns the current answer. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!supported) return 'unsupported';
  await configureNotifications(); // Android 13+ needs a channel before it can prompt.
  const current = await getReminderPermission();
  const result =
    current !== 'undetermined'
      ? current
      : toPermission(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }));
  for (const l of permissionListeners) l(result);
  return result;
}

export const openNotificationSettings = () => Linking.openSettings();

/**
 * Replaces every pending reminder with `plan`. Skips the native round-trip
 * when the plan is unchanged since the last call in this app session.
 */
export async function applyReminderPlan(plan: readonly PlannedReminder[]): Promise<void> {
  if (!supported) return;
  const signature = planSignature(plan);
  if (signature === lastSignature) return;
  await configureNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();
  lastSignature = null;
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: 'default',
        categoryIdentifier: REMINDER_CATEGORY,
        data: { habitId: r.habitId, date: r.date },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: REMINDER_CHANNEL },
    });
  }
  lastSignature = signature;
}

/** Fires a sample reminder a few seconds from now (Stitch "Test" button). */
export async function sendTestReminder(): Promise<void> {
  if (!supported) return;
  await configureNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'MOMENTUM',
      body: 'Test reminder. Your habit reminders will look like this.',
      sound: 'default',
      data: { test: true },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: REMINDER_CHANNEL },
  });
}

/** Number of reminders currently queued with the OS. */
export async function pendingReminderCount(): Promise<number> {
  if (!supported) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
