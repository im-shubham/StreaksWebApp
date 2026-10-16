import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { TabScreen } from '@/components/shell/TabScreen';
import { FlameMark } from '@/components/streaks/FlameMark';
import { HoldToComplete } from '@/components/streaks/HoldToComplete';
import { WeekRhythm } from '@/components/streaks/WeekRhythm';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { checkIn, undoCheckIn } from '@/db/repositories/completions';
import { setPrimaryHabit } from '@/db/repositories/habits';
import { formatClock, formatTime } from '@/domain/dates';
import { HABIT_CATEGORIES } from '@/domain/types';
import { openHabitMenu } from '@/features/habits/habitActions';
import { useHabitBoard, type HabitView } from '@/features/habits/useHabitBoard';
import { alpha, colors, glow, radius, spacing } from '@/theme';
import { EmptyDashboard } from './EmptyDashboard';

/** Stitch: "STREAKS - Main Dashboard" / "STREAKS - Empty Dashboard". */
export function DashboardScreen() {
  const board = useHabitBoard();
  if (board.loading) return <TabScreen title="Streaks">{null}</TabScreen>;

  const initial = board.profile?.display_name?.[0]?.toUpperCase();
  if (!board.primary) {
    return (
      <TabScreen title="Streaks" avatarInitial={initial}>
        <EmptyDashboard date={board.date} />
      </TabScreen>
    );
  }
  return (
    <TabScreen title="Streaks" avatarInitial={initial}>
      <HabitSwitcher habit={board.primary} others={board.active.filter((h) => h.id !== board.primary?.id)} />
      <StreakHero habit={board.primary} />
      <CheckInCard habit={board.primary} />
      <WeeklyRhythmCard habit={board.primary} />
      <View style={styles.split}>
        <InfoTile
          icon="schedule"
          label="Scheduled"
          value={board.primary.executionTime ? formatTime(board.primary.executionTime) : 'Anytime'}
          sub={board.primary.targetLabel ?? 'Daily target'}
        />
        <InfoTile
          icon="ac_unit"
          iconColor="tertiary-fixed-dim"
          label="Safeguard"
          value={`${board.profile?.freeze_balance ?? 0} Freeze`}
          sub={board.profile?.auto_freeze ? 'Auto-protect ready' : 'Manual only'}
        />
      </View>
    </TabScreen>
  );
}

function HabitSwitcher({ habit, others }: { habit: HabitView; others: HabitView[] }) {
  const db = useSQLiteContext();
  const switchHabit = () => {
    if (others.length === 0) {
      router.navigate('/habits');
      return;
    }
    Alert.alert('Show on Dashboard', undefined, [
      ...others.map((h) => ({ text: h.name, onPress: () => void setPrimaryHabit(db, h.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };
  return (
    <View style={styles.switcher}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Current habit ${habit.name}. Switch habit`} onPress={switchHabit} style={styles.switcherPill}>
        <Text variant="caption-caps" color="primary-fixed">
          {HABIT_CATEGORIES[habit.category]?.label ?? habit.category}
        </Text>
        <View style={styles.dot} />
        <Text variant="label-md" weight="600" numberOfLines={2} style={{ flexShrink: 1 }}>
          {habit.name}
        </Text>
        <Icon name="unfold_more" size={18} color="outline" />
      </Pressable>
      <IconButton icon="more_horiz" accessibilityLabel="Habit Settings" onPress={() => openHabitMenu(db, habit)} />
    </View>
  );
}

function StreakHero({ habit }: { habit: HabitView }) {
  const toNext = habit.next ? habit.next.days - habit.streak : null;
  const isBest = habit.streak > 0 && habit.streak >= habit.best;
  return (
    <Card style={styles.hero}>
      {/* Ambient radial atmosphere glow */}
      <View pointerEvents="none" style={styles.heroGlow} />
      <View style={styles.flameWrap}>
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />
        <View style={glow}>
          <FlameMark size={80} />
        </View>
      </View>
      <Text variant="display-hero-mobile" color="primary" tabular style={{ fontSize: 56, lineHeight: 60 }}>
        {habit.streak}
      </Text>
      <Text variant="micro-counter" color="primary-fixed" style={{ letterSpacing: 2, marginTop: -2 }}>
        Day Streak
      </Text>
      <View style={styles.ribbon}>
        <Text variant="label-sm">🔥</Text>
        <Text variant="label-sm" weight="600">
          {isBest ? 'Personal Best Matched' : `Best: ${habit.best} days`}
        </Text>
        {habit.next && toNext ? (
          <>
            <View style={styles.dotSmall} />
            <Text variant="caption-caps" weight="500" color="on-surface-variant" style={{ textTransform: 'none' }}>
              {toNext} {toNext === 1 ? 'day' : 'days'} to {habit.next.name}
            </Text>
          </>
        ) : null}
      </View>
    </Card>
  );
}

function CheckInCard({ habit }: { habit: HabitView }) {
  const db = useSQLiteContext();
  const done = habit.todayStatus === 'completed';
  const rest = habit.todayStatus === 'rest';
  const shielded = habit.todayStatus === 'shielded';
  const time = habit.todayCompletion ? formatClock(habit.todayCompletion.completedAt) : undefined;

  return (
    <Card style={[styles.center, done && styles.cardGlow]}>
      <View style={styles.cardHead}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="caption-caps" color="outline">
            Daily Protocol
          </Text>
          <Text variant="headline-md">Today&apos;s Check-In</Text>
        </View>
        {done ? (
          <Pill label="Completed Today" dot="on-primary-fixed" tone="primary-fixed" color="on-primary-fixed" />
        ) : (
          <Pill label={rest ? 'Rest Day' : shielded ? 'Habit Shielded' : 'Awaiting Execution'} dot="outline" />
        )}
      </View>
      <HoldToComplete
        icon={habit.emblem}
        completed={done}
        completedLabel={time}
        duration={1500}
        onComplete={() => void checkIn(db, habit.id)}
        accessibilityLabel={`Hold to complete ${habit.name}`}
      />
      <View style={styles.feedback}>
        {done ? (
          <>
            <Text variant="label-md" weight="700" color="primary-fixed">
              {habit.streak}-Day Streak Preserved! 💪
            </Text>
            <Text variant="caption-caps" color="on-surface-variant" style={{ textTransform: 'none', marginTop: 2 }}>
              Checked in at {time}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void undoCheckIn(db, habit.id)} hitSlop={10} style={{ marginTop: 10 }}>
              <Text variant="label-md" weight="600" color="on-surface-variant" style={{ textDecorationLine: 'underline' }}>
                Undo check-in
              </Text>
            </Pressable>
          </>
        ) : (
          <Text variant="body-lg" color="on-surface-variant" align="center">
            {rest
              ? 'Rest day. Log an optional session if you want to.'
              : "Press and hold firmly to lock in today's momentum."}
          </Text>
        )}
      </View>
    </Card>
  );
}

function WeeklyRhythmCard({ habit }: { habit: HabitView }) {
  return (
    <Card padding={spacing['space-md'] + 4}>
      <View style={[styles.cardHead, { marginBottom: spacing['space-md'] }]}>
        <Text variant="caption-caps" color="outline">
          Weekly Rhythm
        </Text>
        <Text variant="label-sm" weight="600" color="primary-fixed">
          {habit.consistency30 === null ? 'Day 1' : `${habit.consistency30}% On Track`}
        </Text>
      </View>
      <WeekRhythm days={habit.week} />
    </Card>
  );
}

function InfoTile({
  icon,
  iconColor = 'on-surface-variant',
  label,
  value,
  sub,
}: {
  icon: 'schedule' | 'ac_unit';
  iconColor?: 'on-surface-variant' | 'tertiary-fixed-dim';
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card style={{ flex: 1 }} padding={spacing['space-md'] + 4}>
      <View style={styles.tileHead}>
        <Icon name={icon} size={20} color={iconColor} />
        <Text variant="caption-caps" color="on-surface-variant">
          {label}
        </Text>
      </View>
      <Text variant="headline-md" weight="700" tabular>
        {value}
      </Text>
      <Text variant="body-md" color="on-surface-variant" numberOfLines={1}>
        {sub}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: spacing['space-sm'] },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-xs'] },
  switcherPill: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-xs'] + 2,
    paddingHorizontal: spacing['space-md'],
    paddingVertical: spacing['space-xs'],
    borderRadius: radius.full,
    backgroundColor: colors['surface-container'],
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outline },
  dotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.outline },
  hero: { alignItems: 'center' },
  heroGlow: {
    position: 'absolute',
    top: -48,
    alignSelf: 'center',
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: alpha(colors['primary-fixed'], 0.06),
  },
  flameWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['space-xs'] },
  ring: { position: 'absolute', borderRadius: radius.full, borderWidth: 1 },
  ringOuter: { top: -8, left: -8, right: -8, bottom: -8, borderColor: alpha(colors['primary-fixed'], 0.15) },
  ringInner: { top: 0, left: 0, right: 0, bottom: 0, borderColor: alpha(colors['primary-fixed'], 0.2) },
  ribbon: {
    marginTop: spacing['space-md'],
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing['space-xs'],
    paddingHorizontal: spacing['space-md'],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  center: { alignItems: 'center' },
  cardGlow: { ...glow, shadowRadius: 24, shadowOpacity: 0.35, overflow: 'visible' },
  cardHead: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: spacing['space-lg'] },
  feedback: { marginTop: spacing['space-lg'], alignItems: 'center', minHeight: 48 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
});
