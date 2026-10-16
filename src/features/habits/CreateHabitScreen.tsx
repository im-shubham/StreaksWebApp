import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { createHabit } from '@/db/repositories/habits';
import { ALL_WEEKDAYS_MASK, maskCount, maskHas, toggleMask } from '@/domain/cadence';
import { formatTime, WEEKDAY_INITIALS } from '@/domain/dates';
import { canAddHabit, PLAN_LIMITS } from '@/domain/plans';
import { EMBLEMS, HABIT_CATEGORIES, type CadenceType } from '@/domain/types';
import { useHabitBoard } from '@/features/habits/useHabitBoard';
import { colors, fontFamily, radius, spacing, typography } from '@/theme';

const CADENCES: { type: CadenceType; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: 'specific_days', label: 'Specific Days' },
  { type: 'interval', label: 'Interval' },
];

const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/** Stitch: "STREAKS - Create Habit". */
export function CreateHabitScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const board = useHabitBoard();

  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [emblemIndex, setEmblemIndex] = useState(0);
  const [cadence, setCadence] = useState<CadenceType>('daily');
  const [mask, setMask] = useState(ALL_WEEKDAYS_MASK);
  const [intervalDays, setIntervalDays] = useState(2);
  const [reminder, setReminder] = useState(true);
  const [time, setTime] = useState('06:30');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const emblem = EMBLEMS[emblemIndex];
  const nameError = touched && name.trim().length === 0;
  const effectiveMask = cadence === 'daily' ? ALL_WEEKDAYS_MASK : mask;
  const daysLabel =
    cadence === 'interval' ? `Every ${intervalDays} days` : `${maskCount(effectiveMask)} of 7 days`;

  const submit = async () => {
    setTouched(true);
    if (!name.trim()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (cadence === 'specific_days' && mask === 0) {
      Alert.alert('Pick at least one day', 'Select the weekdays this habit runs on.');
      return;
    }
    if (!board.loading && board.profile && !canAddHabit(board.profile.tier, board.active.length)) {
      // Upgrade sheet ("Free Habit Limit & Upgrade Sheet") arrives in the monetization stage.
      Alert.alert('Habit limit reached', `Your plan supports ${PLAN_LIMITS[board.profile.tier].maxActiveHabits} active habits.`);
      return;
    }
    setSaving(true);
    try {
      await createHabit(db, {
        name,
        category: emblem.category,
        emblem: emblem.icon,
        cadenceType: cadence,
        weekdaysMask: effectiveMask,
        intervalDays,
        executionTime: time,
        reminderEnabled: reminder,
        reminderTime: reminder ? time : null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={() => router.back()} />
        <Text variant="headline-md" style={{ flex: 1 }}>
          Habit Configuration
        </Text>
        <IconButton icon="more_vert" accessibilityLabel="More options" tone="surface-container-high" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <Text variant="caption-caps" color="primary-fixed">
                Discipline Protocol
              </Text>
            </View>
            <Text variant="headline-xl" style={{ marginTop: 4 }}>
              New Habit
            </Text>
            <Text variant="body-lg" color="on-surface-variant" style={{ marginTop: 6 }}>
              Start with one habit and build momentum from there.
            </Text>
          </View>

          <View style={{ gap: spacing['space-sm'] }}>
            <View style={styles.labelRow}>
              <Text variant="body-lg" weight="500">
                Habit Name
              </Text>
              <Text variant="label-sm" color="on-surface-variant">
                Target Action
              </Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                setTouched(true);
              }}
              placeholder="e.g. Morning Gym Session, Deep Reading"
              placeholderTextColor={colors.outline}
              selectionColor={colors['primary-fixed']}
              returnKeyType="done"
              maxLength={60}
              accessibilityLabel="Habit name"
              style={[
                styles.input,
                focused && { borderColor: colors['primary-fixed'] },
                nameError && { borderColor: colors.error },
              ]}
            />
            {nameError ? (
              <View style={styles.errorRow}>
                <Icon name="error" size={16} color="error" filled />
                <Text variant="label-sm" color="error">
                  Please define your habit focus before locking in.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ gap: spacing['space-sm'] }}>
            <View style={styles.labelRow}>
              <Text variant="body-lg" weight="500">
                Visual Emblem
              </Text>
              <Text variant="caption-caps" color="primary-fixed">
                {HABIT_CATEGORIES[emblem.category].label}
              </Text>
            </View>
            <View style={styles.well}>
              <View style={styles.emblemGrid}>
                {EMBLEMS.map((e, i) => {
                  const active = i === emblemIndex;
                  return (
                    <Pressable
                      key={e.icon}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${e.icon.replace(/_/g, ' ')} emblem`}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setEmblemIndex(i);
                      }}
                      style={[styles.emblem, { backgroundColor: colors[active ? 'primary-fixed' : 'surface-container-high'] }]}
                    >
                      <Icon name={e.icon} size={26} color={active ? 'on-primary-fixed' : 'on-surface-variant'} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ gap: spacing['space-sm'] }}>
            <View style={styles.labelRow}>
              <Text variant="body-lg" weight="500">
                Frequency &amp; Cadence
              </Text>
              <Text variant="caption-caps" color="on-surface-variant">
                {daysLabel}
              </Text>
            </View>
            <View style={styles.segment}>
              {CADENCES.map((c) => {
                const active = c.type === cadence;
                return (
                  <Pressable
                    key={c.type}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCadence(c.type)}
                    style={[styles.segTab, active && { backgroundColor: colors['surface-container-highest'] }]}
                  >
                    <Text variant="label-md" weight={active ? '600' : '500'} color={active ? 'on-surface' : 'on-surface-variant'}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.well}>
              {cadence === 'interval' ? (
                <View style={styles.stepper}>
                  <IconButton icon="remove" accessibilityLabel="Fewer days" tone="surface-container-high" onPress={() => setIntervalDays((n) => Math.max(2, n - 1))} />
                  <Text variant="headline-md" tabular>
                    Every {intervalDays} days
                  </Text>
                  <IconButton icon="add" accessibilityLabel="More days" tone="surface-container-high" onPress={() => setIntervalDays((n) => Math.min(30, n + 1))} />
                </View>
              ) : (
                <View style={styles.days}>
                  {WEEKDAY_INITIALS.map((d, i) => {
                    const on = maskHas(effectiveMask, i);
                    return (
                      <Pressable
                        key={i}
                        disabled={cadence === 'daily'}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled: cadence === 'daily' }}
                        accessibilityLabel={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setMask((m) => toggleMask(m, i));
                        }}
                        style={[styles.dayCircle, { backgroundColor: colors[on ? 'primary-fixed' : 'surface-container-high'] }]}
                      >
                        <Text variant="micro-counter" weight="700" color={on ? 'on-primary-fixed' : 'on-surface-variant'}>
                          {d}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          <Card tone="surface-container-low" style={{ gap: spacing['space-md'] }}>
            <View style={styles.reminderHead}>
              <View style={styles.reminderIcon}>
                <Icon name="notifications_active" size={24} color="primary-fixed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body-lg" weight="500">
                  Daily Push Trigger
                </Text>
                <Text variant="body-md" color="on-surface-variant">
                  Direct alert to device
                </Text>
              </View>
              <Toggle value={reminder} onChange={setReminder} accessibilityLabel="Daily push trigger" />
            </View>
            <View style={styles.windowRow}>
              <Text variant="label-md" weight="600" color="on-surface-variant">
                Scheduled window
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Scheduled time ${formatTime(time)}`}
                onPress={() => setShowPicker((s) => !s)}
                style={styles.timeChip}
              >
                <Icon name="schedule" size={20} color="primary-fixed" />
                <Text variant="headline-md" weight="500" color="primary-fixed" tabular>
                  {formatTime(time, { padHour: true })}
                </Text>
              </Pressable>
            </View>
            {showPicker ? (
              <DateTimePicker
                mode="time"
                value={fromHHMM(time)}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onChange={(event, date) => {
                  if (Platform.OS === 'android') setShowPicker(false);
                  if (event.type === 'set' && date) setTime(toHHMM(date));
                }}
              />
            ) : null}
            {reminder ? (
              <View style={styles.note}>
                <Icon name="verified_user" size={18} color="on-surface-variant" />
                <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
                  Streaks will dispatch a daily reminder at {formatTime(time)}.
                </Text>
              </View>
            ) : null}
          </Card>

          <Card tone="surface-container-lowest" padding={spacing['space-md'] + 4} style={styles.tip}>
            <View style={styles.tipIcon}>
              <Icon name="bolt" size={20} color="primary-fixed" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label-md" weight="700" style={{ letterSpacing: 0.5 }}>
                The 21-Day Threshold
              </Text>
              <Text variant="label-md" color="on-surface-variant" numberOfLines={1}>
                Consistency creates automated neural pathways.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing['space-md'] }]}>
        <Button label="Create Habit" icon="add_task" onPress={() => void submit()} loading={saving} style={{ borderRadius: radius.full, height: 56 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-sm'],
    paddingHorizontal: spacing['space-sm'],
    backgroundColor: colors['surface-container-low'],
  },
  body: { padding: spacing['margin-mobile'], gap: spacing['space-lg'] + 4, paddingBottom: 120 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors['primary-fixed'] },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  input: {
    height: 56,
    paddingHorizontal: spacing['space-md'] + 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors['surface-container-high'],
    color: colors['on-surface'],
    fontFamily: fontFamily['400'],
    fontSize: typography['body-lg'].fontSize,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  well: { padding: spacing['space-md'] - 4, borderRadius: radius.xl, backgroundColor: colors['surface-container-low'] },
  emblemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-sm'] + 2 },
  emblem: { width: '17.5%', aspectRatio: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.xl, backgroundColor: colors['surface-container-low'] },
  segTab: { flex: 1, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] - 4 },
  reminderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing['space-md'] - 2,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container'],
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing['space-sm'] + 4,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-lowest'],
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] - 4 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing['margin-mobile'],
    paddingTop: spacing['space-sm'],
    backgroundColor: colors.surface,
  },
});
