import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { TabScreen } from '@/components/shell/TabScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { RadialGlow } from '@/components/ui/RadialGlow';
import { Text } from '@/components/ui/Text';
import { addDays, diffDays, formatClock, formatMonthDay, WEEKDAY_INITIALS, WEEKDAY_SHORT, weekdayIndex, type LocalDate } from '@/domain/dates';
import type { DayAggregate, DayKind, InsightsPeriod } from '@/domain/insights';
import { alpha, colors, radius, spacing, type ColorToken } from '@/theme';
import { useInsights, type InsightsData } from './useInsights';

/**
 * Stitch: "STREAKS - Insights & Analytics" / "Empty Insights & Analytics".
 * Only sections backed by real data are built: consistency, streaks,
 * completion heatmap and recent check-ins.
 */
export function InsightsScreen() {
  const [period, setPeriod] = useState<InsightsPeriod>('week');
  const insights = useInsights(period);

  return (
    <TabScreen title="Insights">
      <View style={styles.intro}>
        <Text variant="headline-lg">Insights</Text>
        <Text variant="body-md" color="on-surface-variant">
          Your consistency, over time.
        </Text>
      </View>

      {insights.state === 'loading' ? null : insights.state === 'error' ? (
        <ErrorState message={insights.message} onRetry={insights.retry} />
      ) : insights.state === 'empty' ? (
        <EmptyInsights reason={insights.reason} />
      ) : (
        <>
          <PeriodTabs value={period} onChange={setPeriod} />
          <Overview data={insights} period={period} />
          <StreakAndTotals data={insights} period={period} />
          <Heatmap weeks={insights.heatmap} today={insights.date} />
          <RecentActivity data={insights} />
        </>
      )}
    </TabScreen>
  );
}

const fade = (delay = 0) => FadeInDown.delay(delay).duration(360).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

const PERIODS: { key: InsightsPeriod; label: string; caption: string }[] = [
  { key: 'week', label: 'Week', caption: 'This week' },
  { key: 'month', label: 'Month', caption: 'This month' },
  { key: 'all', label: 'All Time', caption: 'All time' },
];

function PeriodTabs({ value, onChange }: { value: InsightsPeriod; onChange: (p: InsightsPeriod) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {PERIODS.map((p) => {
        const active = p.key === value;
        return (
          <Pressable
            key={p.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(p.key)}
            style={[styles.tab, active && { backgroundColor: colors['primary-fixed'] }]}
          >
            <Text variant="caption-caps" color={active ? 'surface-container-lowest' : 'on-surface-variant'} numberOfLines={1}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const RING = { size: 224, r: 68, stroke: 9 };
const CIRC = 2 * Math.PI * RING.r;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Consistency ring; the arc eases to its new value (instant with Reduce Motion). */
function ConsistencyRing({ rate }: { rate: number | null }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    const target = (rate ?? 0) / 100;
    progress.set(reduceMotion ? target : withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [rate, reduceMotion, progress]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - progress.get()) }));
  return (
    <Svg width={RING.size} height={RING.size} viewBox="0 0 160 160" style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={80} cy={80} r={RING.r} stroke={colors['surface-container-highest']} strokeWidth={RING.stroke} fill="none" />
      {rate ? (
        <AnimatedCircle
          cx={80}
          cy={80}
          r={RING.r}
          stroke={colors['primary-fixed']}
          strokeWidth={RING.stroke + 0.5}
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          fill="none"
          animatedProps={arc}
        />
      ) : null}
    </Svg>
  );
}

function Overview({ data, period }: { data: InsightsData; period: InsightsPeriod }) {
  const { summary } = data;
  return (
    <Animated.View entering={fade()}>
      <Card style={styles.hero}>
        <RadialGlow size={192} opacity={0.1} style={styles.heroGlow} />
        <View style={styles.ring}>
          <ConsistencyRing rate={summary.rate} />
          <View style={styles.ringLabel} pointerEvents="none">
            <Text variant="caption-caps" color="on-surface-variant" style={{ marginBottom: 4 }}>
              Consistency
            </Text>
            {/* Re-keyed so a new value fades in instead of snapping. */}
            <Animated.View key={`${period}:${summary.rate}`} entering={FadeIn.duration(260).reduceMotion(ReduceMotion.System)} style={styles.value}>
              <Text variant="display-hero-mobile" tabular accessibilityLabel={summary.rate === null ? 'No consistency yet' : `${summary.rate} percent`}>
                {summary.rate === null ? '--' : summary.rate}
              </Text>
              <Text variant="headline-md" weight="700" color="primary-fixed" style={{ marginLeft: 2 }}>
                %
              </Text>
            </Animated.View>
            <Text variant="micro-counter" color="outline" style={{ marginTop: 6 }}>
              {summary.from === summary.to ? formatMonthDay(summary.from) : `${formatMonthDay(summary.from)} – ${formatMonthDay(summary.to)}`}
            </Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Icon name={summary.due ? 'task_alt' : 'event_available'} size={16} color="primary-fixed" filled />
          <Text variant="caption-caps" color="primary-fixed" numberOfLines={2} style={{ flexShrink: 1, textTransform: 'none' }}>
            {summary.due
              ? `${summary.done} of ${summary.due} scheduled check-ins`
              : 'Nothing due yet in this period'}
          </Text>
        </View>
      </Card>
    </Animated.View>
  );
}

function StreakAndTotals({ data, period }: { data: InsightsData; period: InsightsPeriod }) {
  const caption = PERIODS.find((p) => p.key === period)!.caption;
  return (
    <Animated.View entering={fade(80)} style={{ gap: spacing['space-xs'] }}>
      <View style={styles.gridRow}>
        <Metric
          title="Current Streak"
          icon="local_fire_department"
          iconColor="primary-fixed"
          filled
          value={data.current.days}
          unit={data.current.days === 1 ? 'Day' : 'Days'}
          foot={data.current.days > 0 ? data.current.habitName ?? 'Active run' : 'No active run'}
          footColor={data.current.days > 0 ? 'primary-fixed' : 'outline'}
          dot={data.current.days > 0}
        />
        <Metric
          title="Best Streak"
          icon="emoji_events"
          iconColor="secondary"
          value={data.best.days}
          unit={data.best.days === 1 ? 'Day' : 'Days'}
          foot={data.best.habitName ?? 'All-time best'}
        />
      </View>
      <View style={styles.gridRow}>
        <Metric title="Completed" icon="event_available" iconColor="on-surface" value={data.summary.done} foot={caption} />
        <Metric title="Missed" icon="event_busy" iconColor="on-surface-variant" value={data.summary.missed} foot={caption} />
      </View>
    </Animated.View>
  );
}

function Metric({
  title,
  icon,
  iconColor,
  filled,
  value,
  unit,
  foot,
  footColor = 'outline',
  dot,
}: {
  title: string;
  icon: IconName;
  iconColor: ColorToken;
  filled?: boolean;
  value: number;
  unit?: string;
  foot: string;
  footColor?: ColorToken;
  dot?: boolean;
}) {
  return (
    <Card padding={spacing['space-md'] - 2} style={styles.metric}>
      <View style={styles.metricHead}>
        <Text variant="caption-caps" color="on-surface-variant" numberOfLines={2} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        <View style={styles.metricIcon}>
          <Icon name={icon} size={16} color={iconColor} filled={filled} />
        </View>
      </View>
      <Text variant="headline-lg" tabular numberOfLines={1}>
        {value}
        {unit ? (
          <Text variant="label-sm" weight="400" color="on-surface-variant">
            {` ${unit}`}
          </Text>
        ) : null}
      </Text>
      <View style={styles.metricFoot}>
        {dot ? <View style={styles.dot} /> : null}
        <Text variant="micro-counter" color={footColor} numberOfLines={1} style={{ flexShrink: 1 }}>
          {foot}
        </Text>
      </View>
    </Card>
  );
}

const CELL: Record<DayKind, { fill: string; border?: string }> = {
  complete: { fill: colors['primary-fixed'] },
  partial: { fill: colors['on-primary-fixed-variant'] },
  missed: { fill: alpha(colors.error, 0.3) },
  pending: { fill: colors['surface-container-highest'] },
  rest: { fill: colors['surface-container'] },
  future: { fill: 'transparent', border: colors['surface-container-highest'] },
};

const LEGEND: { kind: DayKind; label: string }[] = [
  { kind: 'complete', label: 'Done' },
  { kind: 'partial', label: 'Partial' },
  { kind: 'missed', label: 'Missed' },
  { kind: 'rest', label: 'Rest' },
  { kind: 'future', label: 'Upcoming' },
];

function describeDay(d: DayAggregate): { text: string; badge: string | null } {
  const head = `${WEEKDAY_SHORT[weekdayIndex(d.date)]}, ${formatMonthDay(d.date)}`;
  const names = d.completedNames.length ? ` (${d.completedNames.join(' + ')})` : '';
  switch (d.kind) {
    case 'complete':
      return { text: `${head}: Completed${names}`, badge: `${d.done}/${d.due} done` };
    case 'partial':
      return { text: `${head}: Partly done${names}`, badge: `${d.done}/${d.due + d.pending} done` };
    case 'missed':
      return { text: `${head}: Missed`, badge: `0/${d.due} done` };
    case 'pending':
      return { text: `${head}: Due today`, badge: `0/${d.pending} done` };
    case 'rest':
      return { text: `${head}: Rest day`, badge: null };
    case 'future':
      return { text: `${head}: Upcoming`, badge: null };
  }
}

function Heatmap({ weeks, today }: { weeks: DayAggregate[][]; today: LocalDate }) {
  const [selected, setSelected] = useState<LocalDate>(today);
  const day = weeks.flat().find((d) => d.date === selected) ?? weeks.flat().find((d) => d.date === today)!;
  const info = describeDay(day);
  return (
    <Animated.View entering={fade(160)}>
      <Card padding={spacing['space-md']}>
        <View style={styles.sectionHead}>
          <View style={{ flexShrink: 1 }}>
            <Text variant="headline-md" numberOfLines={1}>
              {weeks.length}-Week Matrix
            </Text>
            <Text variant="caption-caps" color="outline">
              Mon – Sun Cadence
            </Text>
          </View>
        </View>

        <View style={styles.matrix}>
          {weeks.map((week, w) => (
            <Animated.View
              key={week[0].date}
              entering={FadeIn.delay(160 + w * 22).duration(240).reduceMotion(ReduceMotion.System)}
              style={styles.column}
            >
              {week.map((d) => {
                const c = CELL[d.kind];
                const isSelected = d.date === day.date;
                return (
                  <Pressable
                    key={d.date}
                    accessibilityRole="button"
                    accessibilityLabel={describeDay(d).text}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelected(d.date)}
                    hitSlop={2}
                    style={[styles.cell, isSelected && { borderColor: colors['primary-fixed'] }]}
                  >
                    <View style={[styles.cellFill, { backgroundColor: c.fill }, c.border ? { borderWidth: 1, borderColor: c.border } : null]} />
                  </Pressable>
                );
              })}
            </Animated.View>
          ))}
        </View>

        <View style={styles.legend}>
          {LEGEND.map((l) => (
            <View key={l.kind} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: CELL[l.kind].fill }, CELL[l.kind].border ? { borderWidth: 1, borderColor: CELL[l.kind].border } : null]} />
              <Text variant="micro-counter" color="outline">
                {l.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.inspector}>
          <View style={[styles.dot, { backgroundColor: CELL[day.kind].fill === 'transparent' ? colors.outline : CELL[day.kind].fill }]} />
          <Text variant="label-sm" numberOfLines={2} style={{ flex: 1 }}>
            {info.text}
          </Text>
          {info.badge ? (
            <Text variant="micro-counter" color="primary-fixed">
              {info.badge}
            </Text>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

function relativeDay(date: LocalDate, today: LocalDate): string {
  const ago = diffDays(date, today);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return `${WEEKDAY_SHORT[weekdayIndex(date)]}, ${formatMonthDay(date)}`;
}

function RecentActivity({ data }: { data: InsightsData }) {
  return (
    <Animated.View entering={fade(240)}>
      <Card padding={spacing['space-md']}>
        <View style={styles.sectionHead}>
          <View style={{ flexShrink: 1 }}>
            <Text variant="headline-md">Recent Activity</Text>
            <Text variant="caption-caps" color="outline">
              Latest check-ins
            </Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {data.recent.map((a) => (
            <View key={a.id} style={styles.activity}>
              <View style={styles.activityIcon}>
                <Icon name="task_alt" size={18} color="primary-fixed" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label-md" weight="600" numberOfLines={1}>
                  {a.habitName}
                </Text>
                <Text variant="label-sm" color="on-surface-variant" numberOfLines={1}>
                  {relativeDay(a.localDate, data.date)}
                  {a.localDate === data.date || a.localDate === addDays(data.date, -1) ? ` · ${formatClock(a.completedAt)}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

/** Stitch "Empty Insights & Analytics", trimmed to what the app actually computes. */
function EmptyInsights({ reason }: { reason: 'no-habits' | 'no-check-ins' }) {
  const noHabits = reason === 'no-habits';
  return (
    <>
      <Animated.View entering={fade()}>
        <Card style={styles.emptyHero}>
          <View style={styles.emptyBadge}>
            <View style={[styles.dot, { backgroundColor: colors['primary-fixed'] }]} />
            <Text variant="caption-caps" color="primary-fixed">
              {noHabits ? 'No habits yet' : 'Awaiting first check-in'}
            </Text>
          </View>
          <View style={styles.emptyRing}>
            <Svg width={140} height={140} viewBox="0 0 140 140" style={StyleSheet.absoluteFill}>
              <Circle cx={70} cy={70} r={60} stroke={colors['surface-container-high']} strokeWidth={8} fill="none" />
              <Circle cx={70} cy={70} r={60} stroke={alpha(colors['primary-fixed'], 0.35)} strokeWidth={8} strokeDasharray="2 8" strokeLinecap="round" fill="none" />
            </Svg>
            <View style={styles.value}>
              <Text variant="headline-xl">--</Text>
              <Text variant="label-md" color="on-surface-variant">
                %
              </Text>
            </View>
          </View>
          <Text variant="headline-md" align="center">
            {noHabits ? 'Create a habit to start tracking' : 'Analytics unlock after your first check-in'}
          </Text>
          <Text variant="body-md" color="on-surface-variant" align="center">
            {noHabits
              ? 'Insights are built only from your own habit history.'
              : 'Your consistency score, streaks and heatmap appear once you complete a habit.'}
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={fade(80)}>
        <Card padding={spacing['space-md']}>
          <View style={[styles.sectionHead, { alignItems: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Icon name="calendar_view_month" size={20} color="on-surface-variant" />
              <Text variant="label-md" weight="600" style={{ flexShrink: 1 }}>
                Cadence Matrix Preview
              </Text>
            </View>
            <Text variant="micro-counter" color="outline">
              28-Day Horizon
            </Text>
          </View>
          <View style={styles.ghost}>
            <View style={styles.ghostRow}>
              {WEEKDAY_INITIALS.map((l, i) => (
                <Text key={i} variant="micro-counter" color="outline" align="center" style={{ flex: 1 }}>
                  {l}
                </Text>
              ))}
            </View>
            {[0, 1, 2, 3].map((r) => (
              <View key={r} style={styles.ghostRow}>
                {WEEKDAY_INITIALS.map((_, i) => (
                  <View key={i} style={styles.ghostCell} />
                ))}
              </View>
            ))}
            <View style={styles.ghostPill}>
              <Icon name="lock_open" size={14} color="primary-fixed" />
              <Text variant="label-sm" weight="700" numberOfLines={1}>
                Unlocks with daily momentum
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={fade(160)}>
        {noHabits ? (
          <Button label="Create Your First Habit" icon="add" onPress={() => router.navigate('/habits')} />
        ) : (
          <Button label="Record First Completion" icon="arrow_forward" iconPosition="trailing" onPress={() => router.navigate('/')} />
        )}
      </Animated.View>
    </>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ gap: spacing['space-md'] }} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: spacing['space-md'] - 4, alignItems: 'flex-start' }}>
        <Icon name="sync_problem" size={24} color="error" />
        <View style={{ flex: 1 }}>
          <Text variant="label-md" weight="600" color="error">
            Couldn’t load your insights
          </Text>
          <Text variant="body-md" color="on-surface-variant">
            Reading your habit history on this device failed. Nothing was changed.
          </Text>
          <Text variant="label-sm" color="outline" numberOfLines={2} style={{ marginTop: 4 }}>
            {message}
          </Text>
        </View>
      </View>
      <Button label="Try Again" icon="refresh" variant="secondary" size="md" onPress={onRetry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4, paddingTop: spacing['space-xs'] },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.full, backgroundColor: colors['surface-container-lowest'] },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  hero: { alignItems: 'center' },
  heroGlow: { position: 'absolute', top: -64, alignSelf: 'center' },
  ring: { width: RING.size, height: RING.size, alignItems: 'center', justifyContent: 'center', marginVertical: spacing['space-xs'] },
  ringLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  value: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing['space-xs'],
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
    maxWidth: '100%',
  },
  gridRow: { flexDirection: 'row', gap: spacing['space-xs'] },
  metric: { flex: 1, minWidth: 0, gap: 4 },
  metricHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors['surface-container-highest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors['primary-fixed'] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: spacing['space-sm'] },
  matrix: { flexDirection: 'row', gap: 3 },
  column: { flex: 1 },
  cell: { aspectRatio: 1, padding: 1.5, borderRadius: 4, borderWidth: 1.5, borderColor: 'transparent' },
  cellFill: { flex: 1, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: spacing['space-sm'] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  inspector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing['space-md'],
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container'],
  },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors['surface-container'] },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors['surface-container-highest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHero: { alignItems: 'center', gap: spacing['space-md'] },
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  emptyRing: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ghost: { padding: spacing['space-sm'], gap: 6, borderRadius: radius.lg, backgroundColor: colors['surface-container-lowest'] },
  ghostRow: { flexDirection: 'row', gap: 6 },
  ghostCell: { flex: 1, height: 28, borderRadius: radius.DEFAULT, backgroundColor: colors['surface-container'] },
  ghostPill: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
});
