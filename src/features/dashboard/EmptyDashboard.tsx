import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { TemplateRow } from '@/components/habits/TemplateRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { createHabit } from '@/db/repositories/habits';
import { formatMonthDay, type LocalDate } from '@/domain/dates';
import { QUICK_START_TEMPLATES } from '@/domain/templates';
import { withLimit } from '@/features/habits/habitActions';
import { colors, radius, spacing } from '@/theme';

/** Stitch: "STREAKS - Empty Dashboard". */
export function EmptyDashboard({ date }: { date: LocalDate }) {
  const db = useSQLiteContext();
  return (
    <>
      <View style={styles.metaRow}>
        <Pill label={`Today • ${formatMonthDay(date)}`} dot="primary-fixed" variant="caption-caps" color="on-surface" />
        <Pill label="0 Active • Day 1" icon="hourglass_empty" variant="caption-caps" />
      </View>

      <Card style={styles.hero}>
        <View style={styles.orbit}>
          <Svg width={176} height={176} style={StyleSheet.absoluteFill}>
            <Circle cx={88} cy={88} r={86} stroke={colors['surface-container-highest']} strokeWidth={1.5} strokeDasharray="3 6" fill="none" />
            <Circle cx={88} cy={88} r={68} stroke={colors['surface-container-high']} strokeWidth={2} fill="none" />
          </Svg>
          <View style={styles.orbitDot} />
          <View style={styles.core}>
            <Icon name="local_fire_department" size={32} color="primary-fixed" />
          </View>
        </View>
        <Text variant="caption-caps" color="primary-fixed" style={{ marginTop: spacing['space-lg'] }}>
          Fresh Slate
        </Text>
        <Text variant="headline-xl" align="center" style={{ fontSize: 28, lineHeight: 34 }}>
          Your streak starts today.
        </Text>
        <Text variant="body-lg" color="on-surface-variant" align="center" style={{ marginTop: spacing['space-sm'] }}>
          Every legendary chain begins with a single check-in. Build your first ritual and start locking in daily
          discipline.
        </Text>
        <Button
          label="Create Your First Habit"
          icon="add"
          onPress={() => router.push('/habit/new')}
          style={{ alignSelf: 'stretch', marginTop: spacing['space-lg'] }}
        />
      </Card>

      <View style={styles.sectionHead}>
        <Text variant="caption-caps" color="on-surface-variant">
          Popular Protocols to Get Started
        </Text>
        <Text variant="micro-counter" color="outline">
          Tap + to adopt
        </Text>
      </View>
      <View style={{ gap: spacing['space-sm'] }}>
        {QUICK_START_TEMPLATES.map((t) => (
          <TemplateRow
            key={t.id}
            icon={t.emblem}
            title={t.name}
            subtitle={t.subtitle}
            actionLabel="Quick Add"
            onAction={() => void withLimit(() => createHabit(db, { ...t, templateId: t.id }))}
          />
        ))}
      </View>

      <Card tone="surface-container-lowest" padding={spacing['space-md'] + 4} style={styles.tip}>
        <View style={styles.tipIcon}>
          <Icon name="bolt" size={20} color="primary-fixed" filled />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption-caps" color="primary-fixed">
            The 21-Day Rule
          </Text>
          <Text variant="body-md" color="on-surface-variant">
            Commit for 3 weeks to shift conscious effort into automatic instinct. Every day marked fuels perpetual
            kinetic velocity.
          </Text>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  hero: { alignItems: 'center', paddingVertical: spacing['space-xl'] },
  orbit: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  orbitDot: {
    position: 'absolute',
    top: 14,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors['primary-fixed'],
  },
  core: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['space-sm'] },
  tip: { flexDirection: 'row', gap: spacing['space-md'], alignItems: 'flex-start' },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
