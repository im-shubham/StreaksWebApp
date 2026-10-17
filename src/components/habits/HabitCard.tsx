import { Pressable, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { HoldToComplete } from '@/components/streaks/HoldToComplete';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { checkIn } from '@/db/repositories/completions';
import { setHabitStatus, setPrimaryHabit } from '@/db/repositories/habits';
import { describeCadence } from '@/domain/cadence';
import { formatClock, formatTime, WEEKDAY_INITIALS } from '@/domain/dates';
import { HABIT_CATEGORIES } from '@/domain/types';
import { openHabitMenu, withLimit } from '@/features/habits/habitActions';
import type { HabitView } from '@/features/habits/useHabitBoard';
import { alpha, colors, radius, spacing } from '@/theme';

/** Habit deck card from "STREAKS - Habits Manager". */
export function HabitCard({ habit }: { habit: HabitView }) {
  const db = useSQLiteContext();
  const paused = habit.status === 'paused';
  const done = habit.todayStatus === 'completed';
  const meta = [
    HABIT_CATEGORIES[habit.category]?.label ?? habit.category,
    describeCadence(habit.cadence),
    habit.executionTime ? formatTime(habit.executionTime) : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const openMenu = () => openHabitMenu(db, habit);

  return (
    <Card padding={spacing['space-lg'] - 4} style={[habit.isPrimary && styles.primary, paused && { opacity: 0.85 }]}>
      <View style={styles.head}>
        <View style={[styles.emblem, habit.isPrimary && { backgroundColor: alpha(colors['primary-fixed'], 0.15) }]}>
          <Icon name={habit.emblem} size={24} color={habit.isPrimary ? 'primary-fixed' : 'on-surface-variant'} />
        </View>
        <View style={styles.titleCol}>
          <Text variant="headline-md" weight="600" numberOfLines={2} color={paused ? 'on-surface-variant' : 'on-surface'}>
            {habit.name}
          </Text>
          <Text variant="caption-caps" color="on-surface-variant" numberOfLines={2}>
            {meta}
          </Text>
        </View>
        {habit.isPrimary ? (
          <Pill label="On Dashboard" dot="primary-fixed" tone="surface-container-high" color="primary-fixed" variant="micro-counter" />
        ) : paused ? (
          <Pill label="Paused" icon="pause_circle" variant="micro-counter" />
        ) : (
          <IconButton icon="push_pin" accessibilityLabel="Pin to dashboard" size={36} tone="transparent" onPress={() => void setPrimaryHabit(db, habit.id)} />
        )}
      </View>

      <View style={styles.statusRow}>
        <Icon name="local_fire_department" size={18} color={habit.streak > 0 ? 'primary-fixed' : 'outline'} />
        <Text variant="label-md" weight="600" tabular>
          {habit.streak} Day Streak{paused ? ' Preserved' : ''}
        </Text>
        {!paused ? (
          <>
            <View style={styles.dot} />
            <Text variant="label-md" color="on-surface-variant" style={{ flexGrow: 1, flexShrink: 1 }}>
              {done && habit.todayCompletion
                ? `Completed ${formatClock(habit.todayCompletion.completedAt)}`
                : habit.todayStatus === 'rest'
                  ? 'Rest day'
                  : habit.executionTime
                    ? `Due ${formatTime(habit.executionTime)}`
                    : 'Pending'}
            </Text>
            {done ? (
              <Icon name="check_circle" size={20} color="primary-fixed" />
            ) : habit.todayStatus === 'pending' ? (
              <Text variant="micro-counter" color="primary-fixed" style={styles.pending}>
                Pending
              </Text>
            ) : null}
          </>
        ) : (
          <Pressable onPress={() => void withLimit(() => setHabitStatus(db, habit.id, 'active'))} style={{ marginLeft: 'auto' }} hitSlop={8}>
            <Text variant="label-md" weight="600" color="primary-fixed">
              Resume
            </Text>
          </Pressable>
        )}
      </View>

      {!paused ? (
        <>
          <View style={styles.cadenceHead}>
            <Text variant="caption-caps" color="on-surface-variant">
              Weekly Cadence
            </Text>
            <Text variant="caption-caps" color="primary-fixed" tabular>
              {habit.weekDone} / {habit.weekScheduled} Days Done
            </Text>
          </View>
          <View style={styles.week}>
            {habit.week.map((d, i) => {
              const filled = d.status === 'completed' || d.status === 'frozen';
              return (
                <View
                  key={d.date}
                  style={[
                    styles.day,
                    filled && { backgroundColor: colors['primary-fixed'] },
                    d.isToday && !filled && { borderWidth: 1.5, borderColor: colors['primary-fixed'] },
                  ]}
                >
                  <Text variant="micro-counter" color={filled ? 'on-primary-fixed' : 'on-surface-variant'}>
                    {WEEKDAY_INITIALS[i]}
                  </Text>
                  <Icon
                    name={filled ? 'check' : d.status === 'missed' ? 'close' : 'radio_button_unchecked'}
                    size={12}
                    color={filled ? 'on-primary-fixed' : d.status === 'missed' ? 'error' : 'outline'}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.footer}>
        <Text variant="label-md" weight="500" color="on-surface-variant" numberOfLines={1} style={{ flex: 1 }}>
          {habit.targetLabel ? `Target: ${habit.targetLabel}` : habit.notes ?? ''}
        </Text>
        {!paused && habit.todayStatus === 'pending' ? (
          <HoldToComplete
            icon={habit.emblem}
            completed={false}
            size={32}
            label="Hold to Complete"
            onComplete={() => checkIn(db, habit.id)}
            accessibilityLabel={`Hold to complete ${habit.name}`}
          />
        ) : null}
        <IconButton icon="more_horiz" accessibilityLabel={`${habit.name} options`} size={36} tone="transparent" onPress={openMenu} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  primary: { borderLeftWidth: 4, borderLeftColor: colors['primary-fixed'] },
  // Wraps so the dashboard pill drops below the title on narrow phones instead of truncating it.
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-sm'] + 4 },
  titleCol: { flex: 1, minWidth: 150 },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    marginTop: spacing['space-md'],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-sm'],
    paddingHorizontal: spacing['space-md'] - 4,
    paddingVertical: spacing['space-sm'] + 2,
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container'],
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.outline },
  pending: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.DEFAULT,
    backgroundColor: alpha(colors['primary-fixed'], 0.12),
  },
  cadenceHead: { marginTop: spacing['space-md'], flexDirection: 'row', justifyContent: 'space-between' },
  week: { marginTop: spacing['space-sm'], flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { marginTop: spacing['space-md'], flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'] },
});
