import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, type AlertButton } from 'react-native';

import { undoCheckIn } from '@/db/repositories/completions';
import { deleteHabit, setHabitStatus, setPrimaryHabit } from '@/db/repositories/habits';
import { HabitLimitError, PLAN_LIMITS } from '@/domain/plans';
import type { AccountTier } from '@/domain/types';
import type { HabitView } from './useHabitBoard';

/** Copy from "STREAKS - Free Habit Limit & Upgrade Sheet"; Pro purchase is deferred. */
export function showHabitLimit(tier: AccountTier = 'free') {
  const max = PLAN_LIMITS[tier].maxActiveHabits;
  Alert.alert(
    `Free capacity reached (${max}/${max})`,
    `The Free plan supports ${max} active habit to help you build unbreakable focus. Pause or archive your current habit to start a new one.\n\nMomentum Pro with unlimited habits is coming soon.`,
    [
      { text: 'Manage Habits', onPress: () => router.navigate('/habits') },
      { text: 'OK', style: 'cancel' },
    ],
  );
}

/** Runs a write and turns plan-limit errors into the limit sheet. */
export async function withLimit(task: () => Promise<unknown>): Promise<boolean> {
  try {
    await task();
    return true;
  } catch (e) {
    if (e instanceof HabitLimitError) {
      showHabitLimit(e.tier);
      return false;
    }
    throw e;
  }
}

/** Habit action sheet shared by the dashboard "…" button and habit cards. */
export function openHabitMenu(db: SQLiteDatabase, habit: HabitView) {
  const paused = habit.status === 'paused';
  const buttons: AlertButton[] = [];
  if (!paused && !habit.isPrimary) buttons.push({ text: 'Pin to Dashboard', onPress: () => void setPrimaryHabit(db, habit.id) });
  if (habit.todayStatus === 'completed') buttons.push({ text: 'Undo Today’s Check-in', onPress: () => void undoCheckIn(db, habit.id) });
  buttons.push(
    paused
      ? { text: 'Resume', onPress: () => void withLimit(() => setHabitStatus(db, habit.id, 'active')) }
      : { text: 'Pause', onPress: () => void setHabitStatus(db, habit.id, 'paused') },
    {
      text: 'Archive',
      onPress: () =>
        Alert.alert('Archive habit?', 'It leaves your daily deck. Its history is kept.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', onPress: () => void setHabitStatus(db, habit.id, 'archived') },
        ]),
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () =>
        Alert.alert('Delete habit?', `“${habit.name}” and its ${habit.total} check-ins will be permanently removed.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void deleteHabit(db, habit.id) },
        ]),
    },
    { text: 'Cancel', style: 'cancel' },
  );
  Alert.alert(habit.name, undefined, buttons);
}
