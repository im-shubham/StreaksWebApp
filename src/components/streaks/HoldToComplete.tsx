import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, glow, HOLD_TO_COMPLETE_MS } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Habit emblem shown while pending. */
  icon: IconName;
  completed: boolean;
  /** Completion time label shown under DONE ("7:14 AM"). */
  completedLabel?: string;
  onComplete: () => void;
  /** Outer diameter. Dashboard hero = 140, in-card gauge = 64. */
  size?: number;
  /** Dashboard hero uses 1500ms; the in-card gauge spec is 450ms. */
  duration?: number;
  accessibilityLabel: string;
};

/**
 * Hold-to-complete gauge, ported from the Main Dashboard Stitch interaction:
 * a ring fills while the user presses; releasing early rewinds it; reaching
 * 100% fires a heavy haptic and flips to the DONE state.
 */
export function HoldToComplete({
  icon,
  completed,
  completedLabel,
  onComplete,
  size = 140,
  duration = HOLD_TO_COMPLETE_MS,
  accessibilityLabel,
}: Props) {
  const stroke = size >= 100 ? 6 : 4;
  const r = (size - stroke) / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(completed ? 1 : 0);
  const pad = useSharedValue(1);

  // Sync with external state (e.g. undo, or completion from another screen).
  // Only progress: resetting `pad` here would cancel the completion punch.
  useEffect(() => {
    progress.set(completed ? 1 : 0);
  }, [completed, progress]);

  const finish = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const onPressIn = () => {
    if (completed) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const remaining = duration * (1 - progress.get());
    progress.set(
      withTiming(1, { duration: remaining, easing: Easing.linear }, (done) => {
        if (done) {
          pad.set(withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 160 })));
          scheduleOnRN(finish);
        }
      }),
    );
  };

  const onPressOut = () => {
    if (completed || progress.get() >= 1) return;
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: 180 }));
  };

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }));
  // Pad shrinks slightly while held (scale 1 -> 0.95), then punches on completion.
  const padStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ scale: p < 1 ? 1 - p * 0.05 : pad.get() }] };
  });

  const compact = size < 100;
  const inner = size - stroke * 2 - (compact ? 4 : 12);
  const iconSize = compact ? Math.round(inner * 0.6) : 32;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: completed }}
      accessibilityHint={completed ? undefined : 'Press and hold to complete'}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors['surface-container-highest']} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors['primary-fixed']}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={ringProps}
          fill="none"
        />
      </Svg>
      <Animated.View
        style={[
          styles.pad,
          { width: inner, height: inner, borderRadius: inner / 2 },
          { backgroundColor: colors[completed ? 'primary-fixed' : 'surface-container-high'] },
          completed && glow,
          padStyle,
        ]}
      >
        <Icon
          name={completed ? 'done_all' : icon}
          size={iconSize}
          color={completed ? 'on-primary-fixed' : 'primary-fixed'}
          filled={!completed}
        />
        {compact ? null : (
          <View style={styles.labels}>
            <Text variant="label-sm" weight="700" color={completed ? 'on-primary-fixed' : 'on-surface'} uppercase>
              {completed ? 'Done' : 'Hold'}
            </Text>
            <Text variant="micro-counter" weight="500" color={completed ? 'on-primary-fixed' : 'outline'} style={{ textTransform: 'none' }}>
              {completed ? completedLabel ?? '' : `${(duration / 1000).toFixed(duration % 1000 ? 1 : 0)}s to finish`}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', justifyContent: 'center' },
  labels: { alignItems: 'center', marginTop: 4 },
});
