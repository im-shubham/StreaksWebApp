import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HabitCard } from '@/components/habits/HabitCard';
import { TabScreen } from '@/components/shell/TabScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { createHabit } from '@/db/repositories/habits';
import { ARCHETYPE_TEMPLATES } from '@/domain/templates';
import { colors, radius, spacing } from '@/theme';
import { useHabitBoard } from './useHabitBoard';

/** Stitch: "STREAKS - Habits Manager" / "STREAKS - Empty Habits Manager". */
export function HabitsScreen() {
  const board = useHabitBoard();
  const [filter, setFilter] = useState<'active' | 'paused'>('active');
  if (board.loading) return <TabScreen title="Habits">{null}</TabScreen>;

  if (board.habits.length === 0) {
    return (
      <TabScreen title="Habits">
        <EmptyHabits />
      </TabScreen>
    );
  }

  const list = filter === 'active' ? board.active : board.paused;
  const cleared = board.active.filter((h) => h.todayStatus === 'completed').length;
  const due = board.active.filter((h) => h.todayStatus !== 'rest' && h.todayStatus !== 'shielded').length;
  const score = due === 0 ? 0 : Math.round((cleared / due) * 100);

  return (
    <TabScreen title="Habits">
      <View style={styles.titleRow}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="caption-caps" color="primary-fixed">
            Tactical Habit Deck
          </Text>
          <Text variant="headline-xl">My Habits</Text>
          <Text variant="label-md" color="on-surface-variant">
            {board.active.length} Active • {board.paused.length} Paused
          </Text>
        </View>
        <Button label="New Habit" icon="add" size="md" onPress={() => router.push('/habit/new')} style={{ borderRadius: radius['2xl'], height: 52 }} />
      </View>

      <View style={styles.segment}>
        <SegmentTab icon="checklist" label={`Active (${board.active.length})`} active={filter === 'active'} onPress={() => setFilter('active')} />
        <SegmentTab icon="pause_circle" label={`Paused (${board.paused.length})`} active={filter === 'paused'} onPress={() => setFilter('paused')} />
      </View>

      {list.map((h) => (
        <HabitCard key={h.id} habit={h} />
      ))}
      {list.length === 0 ? (
        <Text variant="body-md" color="on-surface-variant" align="center" style={{ paddingVertical: spacing['space-lg'] }}>
          {filter === 'paused' ? 'No paused habits.' : 'No active habits. Resume one or create a new habit.'}
        </Text>
      ) : null}

      <Card padding={spacing['space-lg'] - 4}>
        <View style={styles.scoreHead}>
          <View style={styles.scoreIcon}>
            <Icon name="analytics" size={20} color="primary-fixed" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body-lg" weight="500">
              Daily Completion Score
            </Text>
            <Text variant="caption-caps" color="on-surface-variant">
              {cleared} of {due} target habits cleared
            </Text>
          </View>
          <Text variant="headline-lg" color="primary-fixed" tabular>
            {score}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${score}%` }]} />
        </View>
      </Card>
    </TabScreen>
  );
}

function SegmentTab({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segTab, active && { backgroundColor: colors['surface-container-high'] }]}
    >
      <Icon name={icon} size={18} color={active ? 'primary-fixed' : 'on-surface-variant'} />
      <Text variant="label-md" weight="600" color={active ? 'primary-fixed' : 'on-surface-variant'}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyHabits() {
  const db = useSQLiteContext();
  return (
    <>
      <View style={styles.chips}>
        {['All', 'Active', 'Archived'].map((l, i) => (
          <View key={l} style={[styles.chip, i === 0 && { backgroundColor: colors['primary-fixed'] }]}>
            <Text variant="label-md" weight="600" color={i === 0 ? 'on-primary-fixed' : 'on-surface'}>
              {l}
            </Text>
            <Text variant="micro-counter" color={i === 0 ? 'on-primary-fixed' : 'on-surface-variant'}>
              0
            </Text>
          </View>
        ))}
      </View>

      <Card style={{ alignItems: 'center', paddingVertical: spacing['space-xl'] }}>
        <View style={styles.slot}>
          <View style={styles.slotHead}>
            <View style={styles.slotDot} />
            <Text variant="label-sm" weight="700" color="primary-fixed" uppercase>
              New Slot
            </Text>
            <Icon name="tune" size={18} color="outline" style={{ marginLeft: 'auto' }} />
          </View>
          <View style={[styles.bar, { width: '75%' }]} />
          <View style={[styles.bar, { width: '50%', height: 6 }]} />
          <View style={styles.slotFoot}>
            {['M', 'T', 'W'].map((d) => (
              <View key={d} style={styles.slotDay}>
                <Text variant="micro-counter" color="on-surface-variant">
                  {d}
                </Text>
              </View>
            ))}
            <Icon name="add_circle" size={18} color="primary-fixed" style={{ marginLeft: 'auto' }} />
          </View>
        </View>
        <Text variant="headline-lg" align="center" style={{ fontSize: 28, lineHeight: 34, marginTop: spacing['space-lg'] }}>
          Your habit deck is empty.
        </Text>
        <Text variant="body-lg" color="on-surface-variant" align="center" style={{ marginTop: spacing['space-sm'] }}>
          Create and organize multiple independent routines. Track custom cadences, frequencies, and target metrics for
          each goal.
        </Text>
        <Button label="Create New Habit" icon="add" onPress={() => router.push('/habit/new')} style={{ alignSelf: 'stretch', marginTop: spacing['space-lg'] }} />
      </Card>

      <View style={styles.sectionHead}>
        <Text variant="caption-caps" color="on-surface">
          Curated Archetypes
        </Text>
        <Text variant="caption-caps" color="primary-fixed">
          Instant Setup
        </Text>
      </View>
      <View style={styles.grid}>
        {ARCHETYPE_TEMPLATES.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Add ${t.name}`}
            onPress={() => void createHabit(db, { ...t, templateId: t.id })}
            style={({ pressed }) => [styles.archetype, pressed && { backgroundColor: colors['surface-container'] }]}
          >
            <Icon name={t.emblem} size={22} color="primary-fixed" />
            <View style={{ flex: 1 }}>
              <Text variant="label-md" weight="600" numberOfLines={1}>
                {t.name}
              </Text>
              <Text variant="label-sm" color="on-surface-variant" numberOfLines={1}>
                {t.subtitle}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={[styles.sectionHead, { justifyContent: 'flex-start', gap: spacing['space-sm'] }]}>
        <Icon name="info" size={18} color="primary-fixed" />
        <Text variant="caption-caps" color="on-surface">
          How Habits Work in Streaks
        </Text>
      </View>
      {EXPLAINERS.map((e) => (
        <Card key={e.title} padding={spacing['space-lg'] - 4} style={styles.explainer}>
          <View style={styles.explainerIcon}>
            <Icon name={e.icon} size={20} color="primary-fixed" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline-md">{e.title}</Text>
            <Text variant="body-lg" color="on-surface-variant">
              {e.body}
            </Text>
          </View>
        </Card>
      ))}
    </>
  );
}

const EXPLAINERS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'calendar_month',
    title: 'Independent Cadences',
    body: 'Daily targets, strict weekly quotas, or customized resting days. Each habit operates on an isolated rhythm suited to your physiology.',
  },
  {
    icon: 'touch_app',
    title: 'Hold-to-Complete',
    body: 'A deliberate 450ms sustained press protects your momentum from accidental taps, making each completion physically earned.',
  },
  {
    icon: 'analytics',
    title: 'Per-Habit Metrics',
    body: 'Evaluate unique completion curves, volume streaks, and consistency indices without dilution from other routines.',
  },
];

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-md'], marginTop: spacing['space-sm'] },
  segment: {
    flexDirection: 'row',
    gap: spacing['space-xs'],
    padding: spacing['space-sm'],
    borderRadius: radius['2xl'],
    backgroundColor: colors['surface-container-low'],
  },
  segTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing['space-md'] - 4,
    paddingVertical: spacing['space-sm'],
    borderRadius: radius.lg,
  },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] - 4 },
  scoreIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { marginTop: spacing['space-md'], height: 8, borderRadius: 4, backgroundColor: colors['surface-container'], overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors['primary-fixed'] },
  chips: { flexDirection: 'row', gap: spacing['space-sm'] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing['space-md'],
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container'],
  },
  slot: {
    width: 220,
    padding: spacing['space-md'],
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container'],
    gap: spacing['space-sm'],
  },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  slotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors['primary-fixed'] },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors['surface-container-highest'] },
  slotFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  slotDay: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors['surface-container-highest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['space-sm'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-sm'] + 4 },
  archetype: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-md'] - 4,
    padding: spacing['space-md'],
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container-low'],
  },
  explainer: { flexDirection: 'row', gap: spacing['space-md'] },
  explainerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
