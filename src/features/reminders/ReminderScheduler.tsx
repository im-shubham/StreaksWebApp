import * as Haptics from 'expo-haptics';
import * as Notifications from '@/services/expoNotifications';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { checkIn } from '@/db/repositories/completions';
import { today, type LocalDate } from '@/domain/dates';
import { planReminders } from '@/domain/reminders';
import { useToday } from '@/features/habits/useHabitBoard';
import { useHabitHistories } from '@/features/habits/useHabitHistories';
import { maybeSendWelcome } from './welcome';
import {
  ACTION_COMPLETE,
  applyReminderPlan,
  configureNotifications,
  getReminderPermission,
  onReminderPermissionChange,
} from '@/services/notifications';

const handled = new Set<string>();

/**
 * "Mark Done" on a reminder checks the habit in, but only for today's
 * reminder of a habit that is still active; anything else just opens the app.
 * Resolves true when a check-in was recorded.
 */
export async function completeFromReminder(
  db: SQLiteDatabase,
  actionIdentifier: string,
  data: Record<string, unknown> | null | undefined,
  todayDate: LocalDate,
): Promise<boolean> {
  const habitId = typeof data?.habitId === 'string' ? data.habitId : null;
  if (actionIdentifier !== ACTION_COMPLETE || !habitId || data?.date !== todayDate) return false;
  const habit = await db.getFirstAsync<{ status: string }>('SELECT status FROM habits WHERE id = ? AND deleted_at IS NULL', habitId);
  if (habit?.status !== 'active') return false;
  await checkIn(db, habitId, { date: todayDate, source: 'notification' });
  return true;
}

/**
 * Keeps the OS's queue of habit reminders in step with SQLite (habits,
 * check-ins, freezes, vacations), the date and the notification permission,
 * and handles taps on reminders. Renders nothing.
 */
export function ReminderScheduler() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  return <Scheduler />;
}

function Scheduler() {
  const db = useSQLiteContext();
  const { habits } = useHabitHistories();
  const date = useToday();
  // Re-plan on foreground (refills the 14-day window, picks up a permission granted in Settings) and after an in-app permission prompt.
  const [foregrounds, setForegrounds] = useState(0);

  useEffect(() => {
    void configureNotifications().catch((e) => console.warn('[reminders] setup failed', e));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setForegrounds((n) => n + 1);
    });
    const unsubscribe = onReminderPermissionChange(() => setForegrounds((n) => n + 1));
    return () => {
      sub.remove();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!habits) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if ((await getReminderPermission()) !== 'granted' || cancelled) return;
          const plan = planReminders(habits);
          await applyReminderPlan(plan);
          await maybeSendWelcome(plan[0]);
        } catch (e) {
          console.warn('[reminders] scheduling failed', e);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [habits, date, foregrounds]);

  useEffect(() => {
    const handle = async (response: Notifications.NotificationResponse, coldStart: boolean) => {
      const { identifier, content } = response.notification.request;
      const key = `${identifier}:${response.actionIdentifier}`;
      if (handled.has(key)) return;
      handled.add(key);
      if (await completeFromReminder(db, response.actionIdentifier, content.data, today())) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Notifications.clearLastNotificationResponse();
      // On a cold start the app already opens on the Streaks tab.
      if (!coldStart) router.navigate('/');
    };

    const last = Notifications.getLastNotificationResponse();
    if (last) void handle(last, true).catch((e) => console.warn('[reminders] response failed', e));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      void handle(r, false).catch((e) => console.warn('[reminders] response failed', e));
    });
    return () => sub.remove();
  }, [db]);

  return null;
}
