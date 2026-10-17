import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, glow, HOLD_TO_COMPLETE_MS, radius, spacing } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Habit emblem shown while pending. */
  icon: IconName;
  /** Completed in SQLite. */
  completed: boolean;
  /** Completion time label shown under DONE ("7:14 AM"). */
  completedLabel?: string;
  /** Persists the completion. May be async; a rejection rewinds the gauge. */
  onComplete: () => Promise<unknown> | void;
  /** Outer diameter of the ring. Dashboard hero = 140, chip = 36. */
  size?: number;
  /** Hold time before completion. */
  duration?: number;
  /** Chip layout: small ring + label, the whole chip is the hold target (Habits Manager). */
  label?: string;
  accessibilityLabel: string;
};

/**
 * Hold-to-complete, from the Main Dashboard Stitch interaction.
 *
 * Built on a Gesture Handler LongPress so the hold survives small finger
 * movement inside scroll views. The gesture *activating* after `duration`
 * is what completes the habit (not the animation finishing); releasing
 * earlier rewinds the ring. Completion fires at most once per hold, and the
 * DONE state shows immediately while the SQLite write commits.
 */
export function HoldToComplete({
  icon,
  completed,
  completedLabel,
  onComplete,
  size = 140,
  duration = HOLD_TO_COMPLETE_MS,
  label,
  accessibilityLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [prevCompleted, setPrevCompleted] = useState(completed);
  // Adjust state on prop change (React's recommended pattern, no effect needed):
  // once SQLite reports the completion, drop the optimistic flag.
  if (completed !== prevCompleted) {
    setPrevCompleted(completed);
    if (completed) setPending(false);
  }
  const done = completed || pending;

  const stroke = size >= 100 ? 6 : 3;
  const r = (size - stroke) / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(done ? 1 : 0);
  const pad = useSharedValue(1);
  /** A save is in flight: ignore further activations (no duplicate completions). */
  const firing = useSharedValue(false);

  // Sync the ring with persisted state (e.g. undo from the habit menu).
  useEffect(() => {
    if (!firing.get()) progress.set(done ? 1 : 0);
  }, [done, progress, firing]);

  const complete = () => {
    if (firing.get() || completed) return;
    firing.set(true);
    setPending(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Promise.resolve()
      .then(onComplete)
      .catch((e: unknown) => {
        console.warn('[hold-to-complete] save failed', e);
        setPending(false);
        progress.set(withTiming(0, { duration: 200 }));
      })
      .finally(() => {
        firing.set(false);
      });
  };

  const startFeedback = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const gesture = Gesture.LongPress()
    .enabled(!done)
    .minDuration(duration)
    .maxDistance(40)
    .shouldCancelWhenOutside(false)
    .withTestId('hold-to-complete')
    .onBegin(() => {
      scheduleOnRN(startFeedback);
      progress.set(withTiming(1, { duration: duration * (1 - progress.get()), easing: Easing.linear }));
    })
    .onStart(() => {
      // Held for the full duration: this is the completion signal.
      cancelAnimation(progress);
      progress.set(1);
      if (!reduceMotion) pad.set(withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 160 })));
      scheduleOnRN(complete);
    })
    .onFinalize((_e, success) => {
      if (!success) {
        // Released (or moved away) before the hold finished: rewind.
        cancelAnimation(progress);
        progress.set(withTiming(0, { duration: 180 }));
      }
    });

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }));
  // Pad shrinks slightly while held (1 → 0.95), then punches on completion.
  const padStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return { transform: [{ scale: p < 1 ? 1 - p * 0.05 : pad.get() }] };
  });

  const ring = (
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
  );

  const a11y = {
    accessible: true,
    accessibilityRole: 'button' as const,
    accessibilityLabel,
    accessibilityState: { checked: done, disabled: done },
    accessibilityHint: done ? undefined : `Press and hold for ${(duration / 1000).toFixed(1)} seconds to complete`,
    // Screen-reader users can't long-press; a double-tap action completes instead.
    accessibilityActions: done ? undefined : [{ name: 'activate' as const }],
    onAccessibilityAction: () => complete(),
  };

  if (label) {
    const inner = size - stroke * 2 - 4;
    return (
      <GestureDetector gesture={gesture}>
        <View {...a11y} style={styles.chip}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {ring}
            <Animated.View
              style={[
                { width: inner, height: inner, borderRadius: inner / 2, alignItems: 'center', justifyContent: 'center' },
                done && { backgroundColor: colors['primary-fixed'] },
                padStyle,
              ]}
            >
              {done ? <Icon name="check" size={Math.round(inner * 0.7)} color="on-primary-fixed" /> : null}
            </Animated.View>
          </View>
          <Text variant="label-md" weight="600" color="primary-fixed" numberOfLines={1} style={{ flexShrink: 1 }}>
            {done ? 'Done' : label}
          </Text>
        </View>
      </GestureDetector>
    );
  }

  const inner = size - stroke * 2 - 12;
  return (
    <GestureDetector gesture={gesture}>
      <View {...a11y} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {ring}
        <Animated.View
          style={[
            styles.pad,
            { width: inner, height: inner, borderRadius: inner / 2 },
            { backgroundColor: colors[done ? 'primary-fixed' : 'surface-container-high'] },
            done && glow,
            padStyle,
          ]}
        >
          <Icon name={done ? 'done_all' : icon} size={32} color={done ? 'on-primary-fixed' : 'primary-fixed'} filled={!done} />
          <View style={styles.labels}>
            <Text variant="label-sm" weight="700" color={done ? 'on-primary-fixed' : 'on-surface'} uppercase>
              {done ? 'Done' : 'Hold'}
            </Text>
            <Text variant="micro-counter" weight="500" color={done ? 'on-primary-fixed' : 'outline'} style={{ textTransform: 'none' }}>
              {done ? completedLabel ?? '' : `${(duration / 1000).toFixed(duration % 1000 ? 1 : 0)}s to finish`}
            </Text>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', justifyContent: 'center' },
  labels: { alignItems: 'center', marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing['space-sm'],
    paddingLeft: 6,
    paddingRight: spacing['space-md'],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
});
