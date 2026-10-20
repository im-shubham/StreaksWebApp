import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { RadialGlow } from '@/components/ui/RadialGlow';
import { Text } from '@/components/ui/Text';
import { colors, glow, radius, spacing } from '@/theme';
import { authErrorMessage, requestPasswordReset } from './authErrors';
import { useAuth } from './AuthProvider';

export const RESEND_SECONDS = 60;

const STEPS = [
  { title: 'Open the link', body: 'Tap the reset link in the email we sent.' },
  { title: 'Choose a new password', body: 'Set it on the secure page that opens.' },
  { title: 'Sign in again', body: 'Your habits and streaks sync back to this phone.' },
];

/** Stitch: "STREAKS - Password Reset Email Sent". */
export function ResetEmailSentScreen() {
  const insets = useSafeAreaInsets();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { resetPassword } = useAuth();
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [status, setStatus] = useState<{ kind: 'sent' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await requestPasswordReset(resetPassword, email);
      setStatus({ kind: 'sent', text: 'Sent again. The newest link is the one that works.' });
      setWait(RESEND_SECONDS);
    } catch (e) {
      setStatus({ kind: 'error', text: authErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const toSignIn = () => router.dismissTo('/auth/sign-in');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={toSignIn} />
        <Text variant="headline-md" align="center" numberOfLines={1} style={{ flex: 1 }}>
          Reset Email Sent
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]}>
        <View style={{ flexDirection: 'row' }}>
          <View style={styles.pill}>
            <View style={styles.dot} />
            <Text variant="caption-caps" color="primary-fixed">
              Reset Link Sent
            </Text>
          </View>
        </View>

        <Card style={styles.hero}>
          <RadialGlow size={200} opacity={0.18} style={{ position: 'absolute', top: -20, alignSelf: 'center' }} />
          <View style={styles.ring}>
            <View style={styles.mailCore}>
              <Icon name="mark_email_read" size={36} color="primary-fixed" />
            </View>
          </View>
        </Card>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text variant="headline-xl" align="center" accessibilityRole="header">
            Check your inbox.
          </Text>
          <Text variant="body-md" color="on-surface-variant" align="center">
            If an account exists for this email, we’ve sent it a password reset link:
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${email}. Change email`}
            onPress={() => router.replace({ pathname: '/auth/forgot-password', params: { email } })}
            style={styles.emailChip}
          >
            <Icon name="alternate_email" size={18} color="primary-fixed" />
            <Text variant="label-md" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
              {email}
            </Text>
            <Icon name="edit" size={18} color="on-surface-variant" />
          </Pressable>
        </View>

        <Card padding={spacing['space-md']} style={{ gap: spacing['space-sm'] }}>
          <View style={styles.rowBetween}>
            <Text variant="caption-caps" color="on-surface-variant">
              Next Steps
            </Text>
            <Text variant="caption-caps" color="primary-fixed">
              3 Steps
            </Text>
          </View>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.stepNum}>
                <Text variant="label-md" weight="700" color="primary-fixed">
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label-md" weight="600">
                  {s.title}
                </Text>
                <Text variant="label-sm" color="on-surface-variant">
                  {s.body}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {Platform.OS === 'ios' ? (
          <Button
            label="Open Mail App"
            icon="north_east"
            iconPosition="trailing"
            onPress={() => void Linking.openURL('message://').catch(() => undefined)}
            style={[{ borderRadius: radius['2xl'], minHeight: 56 }, glow]}
          />
        ) : null}

        <View style={{ alignItems: 'center', gap: 6 }}>
          {wait > 0 ? (
            <View style={styles.resendRow}>
              <Icon name="sync" size={18} color="on-surface-variant" />
              <Text variant="body-md" color="on-surface-variant" tabular>
                Didn’t receive it? Resend in {wait}s
              </Text>
            </View>
          ) : (
            <Button label="Resend Email" icon="sync" variant="secondary" size="md" loading={busy} onPress={() => void resend()} />
          )}
          {status ? (
            <Text variant="label-md" color={status.kind === 'error' ? 'error' : 'primary-fixed'} align="center" accessibilityRole="alert">
              {status.text}
            </Text>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" onPress={toSignIn} hitSlop={8} style={styles.signIn}>
          <Text variant="body-md" weight="600" color="on-surface-variant">
            Return to Sign In
          </Text>
          <Icon name="arrow_forward" size={18} color="on-surface-variant" />
        </Pressable>

        <Card tone="surface-container-lowest" padding={spacing['space-md']} style={styles.info}>
          <Icon name="info" size={18} color="on-surface-variant" />
          <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
            Check your spam or promotions folder if the email doesn’t arrive within a few minutes. The link expires after 1 hour.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['space-sm'] },
  body: { paddingHorizontal: spacing['margin-mobile'], paddingTop: spacing['space-sm'], gap: spacing['space-md'] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors['primary-fixed'] },
  hero: { alignItems: 'center', paddingVertical: spacing['space-xl'] },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 10,
    borderColor: colors['surface-container'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailCore: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors['surface-container-highest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    minHeight: 44,
    marginTop: spacing['space-sm'],
    paddingHorizontal: spacing['space-md'],
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-md'] - 4,
    padding: spacing['space-sm'] + 4,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container'],
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-highest'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  signIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  info: { flexDirection: 'row', gap: spacing['space-sm'], alignItems: 'flex-start' },
});
