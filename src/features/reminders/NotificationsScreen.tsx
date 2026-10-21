import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { setHabitReminder } from '@/db/repositories/habits';
import { describeCadence } from '@/domain/cadence';
import { formatTime, fromHHMM, toHHMM } from '@/domain/dates';
import { describeWhen, HORIZON_DAYS, isValidTime, planReminders } from '@/domain/reminders';
import { useToday } from '@/features/habits/useHabitBoard';
import { useHabitHistories } from '@/features/habits/useHabitHistories';
import { openNotificationSettings, sendTestReminder, type ReminderPermission } from '@/services/notifications';
import { colors, radius, spacing } from '@/theme';
import { ensureReminderPermission, useReminderPermission } from './permission';

const DEFAULT_TIME = '08:00';

/**
 * Stitch: "Push & Check In Alerts", trimmed to what the app actually does:
 * local reminders per habit, a real preview of the next one, permission
 * status and a test notification.
 */
export function NotificationsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { habits } = useHabitHistories();
  const date = useToday();
  const { permission, refresh } = useReminderPermission();
  const [editing, setEditing] = useState<string | null>(null);

  // `date` keeps the preview fresh across midnight.
  const plan = useMemo(() => (habits && date ? planReminders(habits) : []), [habits, date]);
  const next = plan[0];
  const list = (habits ?? []).filter(({ habit }) => habit.status !== 'archived');
  const enabledCount = list.filter(({ habit }) => habit.status === 'active' && habit.reminderEnabled).length;

  const toggle = async (id: string, on: boolean, time: string | null) => {
    await setHabitReminder(db, id, on, on ? (isValidTime(time) ? time : DEFAULT_TIME) : null);
    if (on) {
      await ensureReminderPermission();
      refresh();
    }
  };

  const test = async () => {
    if (!(await ensureReminderPermission())) return refresh();
    refresh();
    await sendTestReminder();
    Alert.alert('Test sent', 'A test notification arrives in a few seconds. Lock your phone to see it on the Lock Screen.');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={() => router.back()} />
        <Text variant="headline-md" numberOfLines={1} style={{ flex: 1 }}>
          Notifications
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Send test notification" onPress={() => void test()} style={styles.testChip} hitSlop={6}>
          <Icon name="notifications_active" size={18} color="primary-fixed" />
          <Text variant="caption-caps" color="primary-fixed">
            Test
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]} showsVerticalScrollIndicator={false}>
        <Card padding={spacing['space-lg'] - 4} style={{ gap: spacing['space-sm'] }}>
          <View style={styles.rowBetween}>
            <View style={styles.statusPill}>
              <View style={[styles.dot, { backgroundColor: colors[permission === 'granted' && enabledCount ? 'primary-fixed' : 'outline'] }]} />
              <Text variant="caption-caps" color={permission === 'granted' && enabledCount ? 'primary-fixed' : 'on-surface-variant'}>
                {permission === 'granted' ? (enabledCount ? 'Reminders On' : 'No Reminders Set') : 'Notifications Off'}
              </Text>
            </View>
            <Text variant="caption-caps" color="on-surface-variant">
              On This Device
            </Text>
          </View>
          <Text variant="headline-lg">Habit Reminders</Text>
          <Text variant="body-md" color="on-surface-variant">
            A nudge at the time you choose, only on days a habit is scheduled and not done yet. Use “Mark Done” on the notification to check in.
          </Text>
        </Card>

        <PermissionCard permission={permission} onAllow={async () => { await ensureReminderPermission(); refresh(); }} />

        <View style={styles.rowBetween}>
          <Text variant="caption-caps" color="on-surface-variant">
            Next Reminder Preview
          </Text>
          <Text variant="caption-caps" color="primary-fixed">
            {plan.length} in next {HORIZON_DAYS} days
          </Text>
        </View>
        <Card padding={spacing['space-md']} style={{ gap: spacing['space-sm'] }}>
          {next ? (
            <>
              <View style={styles.previewHead}>
                <BrandLogo size={22} />
                <Text variant="label-sm" weight="700" color="on-surface-variant">
                  MOMENTUM
                </Text>
                <Text variant="label-sm" color="outline">
                  {describeWhen(next).replace(/^./, (c) => c.toUpperCase())}
                </Text>
              </View>
              <Text variant="headline-md" numberOfLines={1}>
                {next.title}
              </Text>
              <Text variant="body-md" color="on-surface-variant">
                {next.body}
              </Text>
              <View style={styles.previewAction}>
                <Icon name="check_circle" size={18} color="on-primary-fixed" />
                <Text variant="label-md" weight="600" color="on-primary-fixed">
                  Mark Done
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyPreview}>
              <Icon name="notifications_off" size={22} color="outline" />
              <Text variant="body-md" color="on-surface-variant" style={{ flex: 1 }}>
                {enabledCount ? 'Nothing due in the next two weeks.' : 'Turn on a reminder below to see it here.'}
              </Text>
            </View>
          )}
        </Card>

        <Text variant="caption-caps" color="on-surface-variant" style={{ marginTop: spacing['space-sm'] }}>
          Per-Habit Schedule
        </Text>
        {list.length === 0 ? (
          <Card padding={spacing['space-md']}>
            <Text variant="body-md" color="on-surface-variant">
              No habits yet. Create one to set a reminder.
            </Text>
          </Card>
        ) : (
          list.map(({ habit }) => {
            const paused = habit.status === 'paused';
            const time = isValidTime(habit.reminderTime) ? habit.reminderTime : DEFAULT_TIME;
            const on = habit.reminderEnabled && !paused;
            return (
              <Card key={habit.id} padding={spacing['space-md']} style={{ gap: spacing['space-sm'] }}>
                <View style={styles.habitRow}>
                  <View style={styles.emblem}>
                    <Icon name={habit.emblem} size={22} color={on ? 'primary-fixed' : 'on-surface-variant'} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="label-md" weight="600" numberOfLines={1}>
                      {habit.name}
                    </Text>
                    <Text variant="label-sm" color="on-surface-variant" numberOfLines={1}>
                      {paused ? 'Paused · no reminders' : describeCadence(habit.cadence)}
                    </Text>
                  </View>
                  <Toggle
                    value={habit.reminderEnabled}
                    onChange={(v) => void toggle(habit.id, v, habit.reminderTime)}
                    accessibilityLabel={`Reminder for ${habit.name}`}
                  />
                </View>
                {habit.reminderEnabled ? (
                  <View style={styles.rowBetween}>
                    <Text variant="label-sm" color="on-surface-variant">
                      Reminder time
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Reminder time for ${habit.name}, ${formatTime(time)}`}
                      onPress={() => setEditing((e) => (e === habit.id ? null : habit.id))}
                      style={styles.timeChip}
                    >
                      <Icon name="schedule" size={18} color="primary-fixed" />
                      <Text variant="label-md" weight="600" color="primary-fixed" tabular>
                        {formatTime(time, { padHour: true })}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {editing === habit.id && habit.reminderEnabled ? (
                  <DateTimePicker
                    mode="time"
                    value={fromHHMM(time)}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="dark"
                    onChange={(event, picked) => {
                      if (Platform.OS === 'android') setEditing(null);
                      if (event.type === 'set' && picked) void setHabitReminder(db, habit.id, true, toHHMM(picked));
                    }}
                  />
                ) : null}
              </Card>
            );
          })
        )}

        <Card tone="surface-container-lowest" padding={spacing['space-md']} style={styles.note}>
          <Icon name="info" size={18} color="on-surface-variant" />
          <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
            Reminders are scheduled on this phone. Checking in cancels that day’s reminder.
            {Platform.OS === 'android' ? ' Android may deliver them a few minutes late to save battery.' : ''}
          </Text>
        </Card>

        <Button label="Send Test Notification" icon="notifications_active" onPress={() => void test()} />
      </ScrollView>
    </View>
  );
}

function PermissionCard({ permission, onAllow }: { permission: ReminderPermission | null; onAllow: () => void }) {
  if (permission === null || permission === 'granted') return null;
  const denied = permission === 'denied';
  return (
    <Card tone="surface-container" padding={spacing['space-md']} style={{ gap: spacing['space-md'] }}>
      <View style={styles.habitRow}>
        <Icon name={denied ? 'notifications_off' : 'notifications'} size={22} color="warning" />
        <View style={{ flex: 1 }}>
          <Text variant="label-md" weight="600">
            {permission === 'unsupported' ? 'Not available here' : denied ? 'Notifications are off for MOMENTUM' : 'Allow notifications'}
          </Text>
          <Text variant="label-md" color="on-surface-variant">
            {permission === 'unsupported'
              ? 'Reminders work in the iOS and Android app.'
              : denied
                ? 'Your reminder times are saved. Turn on notifications in Settings to receive them.'
                : 'MOMENTUM needs permission to show your reminders.'}
          </Text>
        </View>
      </View>
      {permission === 'unsupported' ? null : denied ? (
        <Button label="Open Settings" icon="settings" variant="secondary" size="md" onPress={() => void openNotificationSettings()} />
      ) : (
        <Button label="Turn On Notifications" icon="notifications_active" size="md" onPress={onAllow} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: spacing['space-xs'], paddingHorizontal: spacing['space-sm'] },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    marginRight: spacing['space-xs'],
  },
  body: { paddingHorizontal: spacing['margin-mobile'], paddingTop: spacing['space-sm'], gap: spacing['space-md'] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-sm'] },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 4,
    borderRadius: radius.lg,
    backgroundColor: colors['primary-fixed'],
  },
  emptyPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'] },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] - 4 },
  emblem: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  note: { flexDirection: 'row', gap: spacing['space-sm'], alignItems: 'flex-start' },
});
