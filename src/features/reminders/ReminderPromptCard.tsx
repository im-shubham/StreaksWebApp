import Storage from 'expo-sqlite/kv-store';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { setHabitReminder } from '@/db/repositories/habits';
import { formatTime } from '@/domain/dates';
import { isValidTime } from '@/domain/reminders';
import type { Habit } from '@/domain/types';
import { openNotificationSettings } from '@/services/notifications';
import { alpha, colors, radius, spacing } from '@/theme';
import { ensureReminderPermission, useReminderPermission } from './permission';
import { PROMPT_DISMISSED_KEY } from './welcome';

const DEFAULT_TIME = '08:00';

type PromptHabit = Pick<Habit, 'id' | 'name' | 'status' | 'reminderEnabled' | 'reminderTime' | 'executionTime'>;

const reminderTimeFor = (h: PromptHabit) =>
  isValidTime(h.reminderTime) ? h.reminderTime : isValidTime(h.executionTime) ? h.executionTime : DEFAULT_TIME;

function readDismissed(): boolean {
  try {
    return Storage.getItemSync(PROMPT_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * In-app ask before the OS prompt ("soft prompt"): explains what reminders
 * do, turns them on for active habits that have none, then asks iOS/Android.
 * Hidden once reminders are working, or after "Not Now".
 */
export function ReminderPromptCard({ habits, primary }: { habits: readonly PromptHabit[]; primary: PromptHabit }) {
  const db = useSQLiteContext();
  const { permission, refresh } = useReminderPermission();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  const active = habits.filter((h) => h.status === 'active');
  const anyReminder = active.some((h) => h.reminderEnabled);
  if (dismissed || permission === null || permission === 'unsupported' || active.length === 0) return null;
  if (permission === 'granted' && anyReminder) return null;

  const denied = permission === 'denied';
  const time = formatTime(reminderTimeFor(primary));

  const turnOn = async () => {
    setBusy(true);
    try {
      for (const h of active) if (!h.reminderEnabled) await setHabitReminder(db, h.id, true, reminderTimeFor(h));
      await ensureReminderPermission();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    setDismissed(true);
    void Storage.setItem(PROMPT_DISMISSED_KEY, String(Date.now())).catch(() => undefined);
  };

  return (
    <Card padding={spacing['space-lg'] - 4} style={{ gap: spacing['space-md'] }}>
      <View style={styles.head}>
        <View style={styles.iconTile}>
          <Icon name={denied ? 'notifications_off' : 'notifications_active'} size={24} color={denied ? 'warning' : 'primary-fixed'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline-md">{denied ? 'Notifications are off' : 'Never miss a check-in'}</Text>
          <Text variant="body-md" color="on-surface-variant" style={{ marginTop: 2 }}>
            {denied
              ? 'Allow notifications for this app in Settings to get your habit reminders.'
              : `Get a reminder for ${primary.name} at ${time}, only on days it’s due.`}
          </Text>
        </View>
      </View>
      {denied ? (
        <Button label="Open Settings" icon="settings" variant="secondary" size="md" onPress={() => void openNotificationSettings()} />
      ) : (
        <Button label="Turn On Reminders" icon="notifications_active" size="md" loading={busy} onPress={() => void turnOn()} />
      )}
      <Pressable accessibilityRole="button" onPress={notNow} hitSlop={8} style={styles.notNow}>
        <Text variant="label-md" weight="600" color="on-surface-variant">
          Not Now
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing['space-md'] - 4, alignItems: 'flex-start' },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors['primary-fixed'], 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNow: { alignSelf: 'center', minHeight: 32, justifyContent: 'center' },
});
