import Storage from 'expo-sqlite/kv-store';

import { describeWhen, type PlannedReminder } from '@/domain/reminders';
import { sendWelcomeNotification } from '@/services/notifications';

/** Device-local flags (not synced): each phone gets its own welcome. */
export const WELCOME_SENT_KEY = 'momentum.welcomeNotificationSent';
export const PROMPT_DISMISSED_KEY = 'momentum.reminderPromptDismissed';

/**
 * Sends "Welcome to MOMENTUM" once per install, the first time notifications
 * are allowed and at least one reminder is scheduled. Resolves true if sent.
 */
export async function maybeSendWelcome(first: PlannedReminder | undefined, now: Date = new Date()): Promise<boolean> {
  if (!first || (await Storage.getItem(WELCOME_SENT_KEY))) return false;
  await Storage.setItem(WELCOME_SENT_KEY, String(now.getTime()));
  await sendWelcomeNotification({ title: first.title, when: describeWhen(first, now) });
  return true;
}
