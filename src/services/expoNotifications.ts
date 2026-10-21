/**
 * The local-notification subset of expo-notifications, imported from its
 * individual modules instead of the package index.
 *
 * The index also loads push-only native modules (e.g.
 * `ExpoTopicSubscriptionModule`) that Expo Go on Android does not ship;
 * `requireNativeModule` throws for those at import time, which took down the
 * whole app in Expo Go. Everything below only touches the local
 * notification modules that Expo Go, development and release builds all have.
 */
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponse,
} from 'expo-notifications/build/NotificationsEmitter';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export { IosAuthorizationStatus, type NotificationPermissionsStatus } from 'expo-notifications/build/NotificationPermissions.types';
export { SchedulableTriggerInputTypes, type NotificationResponse } from 'expo-notifications/build/Notifications.types';
