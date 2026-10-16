import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlameMark } from '@/components/streaks/FlameMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { updateProfile } from '@/db/repositories/profile';
import { WEEKDAY_INITIALS } from '@/domain/dates';
import { alpha, colors, glow, radius, spacing } from '@/theme';

/** Stitch: "STREAKS - Welcome & Onboarding". "Get Started" continues as a guest. */
export function WelcomeScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const startAsGuest = async () => {
    await updateProfile(db, { onboarded_at: Date.now() });
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + spacing['space-xl'], paddingBottom: insets.bottom + spacing['space-lg'] }]}
    >
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.badge}>
          <View style={glow}>
            <FlameMark size={88} />
          </View>
        </View>
        <Text variant="display-hero" align="center" style={{ marginTop: spacing['space-lg'] }}>
          STREAKS
        </Text>
        <Text variant="headline-lg" color="primary-fixed" align="center">
          Build habits. Keep your streak.
        </Text>
        <Text variant="body-lg" color="on-surface-variant" align="center" style={{ marginTop: 6 }}>
          Small actions. Big momentum.
        </Text>
      </View>

      {/* Illustrative preview card from the design. */}
      <Card style={{ gap: spacing['space-md'] }}>
        <View style={styles.previewHead}>
          <View>
            <Text variant="caption-caps" color="on-surface-variant">
              Target Protocol
            </Text>
            <Text variant="headline-lg">Deep Work Focus</Text>
          </View>
          <View style={styles.streakChip}>
            <Text variant="label-sm">🔥</Text>
            <Text variant="label-sm" weight="700" color="primary-fixed" uppercase>
              18 Day Streak
            </Text>
          </View>
        </View>
        <View style={styles.week}>
          {WEEKDAY_INITIALS.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <View style={[styles.dayCircle, i === 6 && { backgroundColor: alpha(colors['primary-fixed'], 0.25) }]}>
                <Icon name={i === 6 ? 'bolt' : 'check'} size={20} color={i === 6 ? 'primary-fixed' : 'on-primary-fixed'} />
              </View>
              <Text variant="micro-counter" color={i === 6 ? 'primary-fixed' : 'on-surface-variant'}>
                {i === 6 ? 'Sun' : d}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ gap: spacing['space-sm'] + 4 }}>
        <Button label="Get Started" icon="arrow_forward" onPress={() => void startAsGuest()} style={[{ borderRadius: radius.full, height: 56 }, glow]} />
        <Button
          label="I Already Have an Account"
          variant="secondary"
          onPress={() => router.push('/auth/sign-in')}
          style={{ borderRadius: radius.full, height: 56, backgroundColor: colors['surface-container-low'] }}
        />
        <View style={styles.footer}>
          <Icon name="cloud_done" size={16} color="on-surface-variant" />
          <Text variant="caption-caps" color="on-surface-variant">
            Start as a guest · Create an account anytime
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing['margin-mobile'], gap: spacing['space-xl'] },
  hero: { alignItems: 'center' },
  heroGlow: {
    position: 'absolute',
    top: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: alpha(colors['primary-fixed'], 0.06),
  },
  badge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: alpha(colors['primary-fixed'], 0.15),
  },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors['primary-fixed'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 },
});
