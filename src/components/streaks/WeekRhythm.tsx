import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { WEEKDAY_INITIALS } from '@/domain/dates';
import type { WeekDay } from '@/features/habits/useHabitBoard';
import { colors, radius } from '@/theme';

/**
 * Main Dashboard "Weekly Rhythm" row: 40px day circles with a caption.
 * done → lime check, today → lime ring "TODAY", rest → lock, future → muted.
 */
export function WeekRhythm({ days }: { days: WeekDay[] }) {
  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const done = d.status === 'completed' || d.status === 'frozen';
        const caption = done
          ? d.status === 'frozen'
            ? 'Frozen'
            : '100%'
          : d.isToday
            ? 'Active'
            : d.status === 'rest'
              ? 'Rest'
              : d.status === 'shielded'
                ? 'Shielded'
                : d.status === 'missed'
                  ? 'Missed'
                  : '';
        return (
          <View key={d.date} style={styles.col}>
            <Text variant="micro-counter" color={d.isToday ? 'primary-fixed' : 'on-surface-variant'}>
              {WEEKDAY_INITIALS[i]}
            </Text>
            <View
              style={[
                styles.circle,
                done && { backgroundColor: colors[d.status === 'frozen' ? 'tertiary-fixed-dim' : 'primary-fixed'] },
                !done && d.isToday && styles.today,
                !done && !d.isToday && { backgroundColor: colors['surface-container'] },
              ]}
            >
              {done ? (
                <Icon name={d.status === 'frozen' ? 'ac_unit' : 'check'} size={20} color="on-primary-fixed" />
              ) : d.isToday ? (
                <Text variant="micro-counter" color="primary-fixed">
                  Today
                </Text>
              ) : d.status === 'missed' ? (
                <Icon name="close" size={18} color="error" />
              ) : d.status === 'shielded' ? (
                <Icon name="beach_access" size={18} color="tertiary-fixed-dim" />
              ) : (
                <Icon name={d.status === 'rest' ? 'lock_clock' : 'lock'} size={18} color="outline" />
              )}
            </View>
            <Text variant="micro-counter" weight="500" color={d.isToday ? 'primary-fixed' : 'on-surface-variant'} style={styles.caption}>
              {caption}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: 6, flex: 1 },
  circle: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: colors['primary-fixed'] },
  caption: { textTransform: 'none', letterSpacing: 0.5 },
});
