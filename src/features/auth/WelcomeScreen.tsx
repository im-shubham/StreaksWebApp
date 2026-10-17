import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlameMark } from '@/components/streaks/FlameMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { RadialGlow } from '@/components/ui/RadialGlow';
import { Text } from '@/components/ui/Text';
import { updateProfile } from '@/db/repositories/profile';
import { WEEKDAY_INITIALS } from '@/domain/dates';
import { alpha, colors, glow, radius, spacing } from '@/theme';

/** Staggered entrance; disabled automatically when the OS "Reduce Motion" setting is on. */
const enter = (delay: number) => FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

/**
 * Stitch: "STREAKS - Welcome & Onboarding". "Get Started" continues as a guest.
 *
 * Sizes follow the Stitch markup (display-hero-mobile title, headline-md
 * tagline, body-md subtitle, w-28 badge with a w-16 flame, p-space-md card,
 * h-14 pill buttons with gap-space-sm). Short screens (iPhone SE / mini)
 * tighten vertical spacing; the action buttons stay docked to the bottom
 * safe area and the content scrolls only if Dynamic Type makes it taller
 * than the screen.
 */
export function WelcomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const [starting, setStarting] = useState(false);

  const startAsGuest = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await updateProfile(db, { onboarded_at: Date.now() });
      router.replace('/');
    } finally {
      setStarting(false);
    }
  };

  const badge = compact ? 96 : 112;
  const gap = compact ? spacing['space-lg'] : spacing['space-xl'];

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={[
        styles.body,
        { paddingTop: insets.top + (compact ? spacing['space-md'] : spacing['space-xl']), paddingBottom: insets.bottom + spacing['space-md'] },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Hero + preview are centred in the space above the docked actions. */}
      <View style={{ flex: 1, justifyContent: 'center', gap }}>
        <View style={styles.hero}>
          <RadialGlow size={320} opacity={0.14} style={styles.backlight} />
          <Animated.View entering={ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System)} style={styles.badgeWrap}>
            <PulseHalo size={badge} />
            <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
              <View style={glow}>
                <FlameMark size={compact ? 56 : 64} />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={enter(120)} style={styles.titles}>
            <Text variant="display-hero-mobile" align="center" uppercase fit accessibilityRole="header">
              Streaks
            </Text>
            <Text variant="headline-md" color="primary-fixed" align="center" style={{ marginTop: spacing['space-xs'] }}>
              Build habits. Keep your streak.
            </Text>
          </Animated.View>
          <Animated.View entering={enter(200)}>
            <Text variant="body-md" color="secondary" align="center" style={{ marginTop: 4 }}>
              Small actions. Big momentum.
            </Text>
          </Animated.View>
        </View>

        {/* Illustrative preview card from the design. */}
        <Animated.View entering={enter(300)}>
          <Card padding={spacing['space-md']} style={{ gap: spacing['space-md'] }}>
            <View style={styles.previewHead}>
              <View style={{ flexShrink: 1 }}>
                <Text variant="caption-caps" color="secondary">
                  Target Protocol
                </Text>
                <Text variant="headline-md" fit style={{ marginTop: 2 }}>
                  Deep Work Focus
                </Text>
              </View>
              <View style={styles.streakChip}>
                <Text variant="micro-counter">🔥</Text>
                <Text variant="micro-counter" weight="700" color="primary-fixed" numberOfLines={1}>
                  18 Day Streak
                </Text>
              </View>
            </View>
            <View style={styles.week}>
              {WEEKDAY_INITIALS.map((d, i) => {
                const today = i === 6;
                return (
                  <View key={i} style={styles.day}>
                    <View style={[styles.dayCircle, today && { backgroundColor: alpha(colors['primary-fixed'], 0.25) }]}>
                      <Icon name={today ? 'bolt' : 'check'} size={18} color={today ? 'primary-fixed' : 'on-primary-fixed'} filled />
                    </View>
                    <Text variant="micro-counter" color={today ? 'primary-fixed' : 'secondary'}>
                      {today ? 'Sun' : d}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      </View>

      <View style={[styles.actions, { marginTop: gap }]}>
        <Animated.View entering={enter(420)}>
          <Button
            label="Get Started"
            icon="arrow_forward"
            iconPosition="trailing"
            loading={starting}
            onPress={() => void startAsGuest()}
            style={[{ borderRadius: radius.full, minHeight: 56 }, glow]}
          />
        </Animated.View>
        <Animated.View entering={enter(500)}>
          <Button
            label="I Already Have an Account"
            variant="secondary"
            onPress={() => router.push('/auth/sign-in')}
            style={{ borderRadius: radius.full, minHeight: 56, backgroundColor: colors['surface-container-low'] }}
          />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(620).duration(400).reduceMotion(ReduceMotion.System)} style={styles.footer}>
          <Icon name="cloud_done" size={13} color="secondary" />
          <Text variant="micro-counter" color="secondary" align="center" style={{ flexShrink: 1 }}>
            Start as a guest · Create an account anytime
          </Text>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

/** Soft breathing glow behind the badge (Stitch `animate-pulse`); static when Reduce Motion is on. */
function PulseHalo({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1));
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.get() * 0.45,
    transform: [{ scale: 0.92 + pulse.get() * 0.1 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <RadialGlow size={size + 56} opacity={0.32} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: spacing['margin-mobile'] },
  hero: { alignItems: 'center' },
  backlight: { position: 'absolute', top: -40 },
  badgeWrap: { alignItems: 'center', justifyContent: 'center', padding: spacing['space-md'] },
  badge: { backgroundColor: colors['surface-container-low'], alignItems: 'center', justifyContent: 'center' },
  titles: { alignItems: 'center', alignSelf: 'stretch', marginTop: spacing['space-sm'] },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing['space-sm'] },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: alpha(colors['primary-container'], 0.15),
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors['primary-fixed'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing['space-sm'] },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: spacing['space-xs'], opacity: 0.7 },
});
