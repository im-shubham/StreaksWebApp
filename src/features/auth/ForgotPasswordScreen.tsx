import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { isFirebaseConfigured } from '@/services/firebase';
import { alpha, colors, glow, radius, spacing } from '@/theme';
import { authErrorMessage, EMAIL_RE, requestPasswordReset } from './authErrors';
import { useAuth } from './AuthProvider';

/** Stitch: "STREAKS - Forgot Password" (Firebase password reset email). */
export function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = EMAIL_RE.test(email.trim());
  const fieldError = touched && email && !valid ? 'Enter a valid email address.' : null;

  const send = async () => {
    setTouched(true);
    setError(null);
    if (!valid) return setError('Enter the email address you signed up with.');
    setBusy(true);
    try {
      await requestPasswordReset(resetPassword, email);
      router.replace({ pathname: '/auth/reset-email-sent', params: { email: email.trim() } });
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={() => router.back()} />
        <Text variant="headline-md" align="center" style={{ flex: 1 }}>
          Forgot Password
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.badgeRow}>
            <View style={styles.pill}>
              <View style={styles.dot} />
              <Text variant="caption-caps" color="primary-fixed">
                Account Recovery
              </Text>
            </View>
          </View>

          <Card style={styles.hero}>
            <View style={[styles.keyTile, glow]}>
              <Icon name="key" size={28} color="primary-fixed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline-lg">Reset your password.</Text>
              <Text variant="body-md" color="on-surface-variant" style={{ marginTop: 4 }}>
                Enter your account email and we’ll send you a link to set a new password.
              </Text>
            </View>
          </Card>

          <Card style={{ gap: spacing['space-md'] }}>
            <TextField
              label="Account Email Address"
              icon="alternate_email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus={!params.email}
              error={fieldError}
              onSubmitEditing={() => void send()}
              returnKeyType="send"
            />
            <View style={styles.hint}>
              <Icon name="timer" size={18} color="primary-fixed" />
              <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
                The link expires after 1 hour.
              </Text>
            </View>

            {!isFirebaseConfigured ? (
              <Notice icon="cloud_off" color="warning" text="Cloud accounts aren’t configured in this build, so password reset is unavailable." />
            ) : null}
            {error ? <Notice icon="error" color="error" text={error} /> : null}

            <Button
              label="Send Reset Link"
              icon="arrow_forward"
              iconPosition="trailing"
              onPress={() => void send()}
              loading={busy}
              disabled={!isFirebaseConfigured}
              style={[{ borderRadius: radius['2xl'], minHeight: 56 }, isFirebaseConfigured && glow]}
            />
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Icon name="keyboard_backspace" size={20} color="on-surface-variant" />
              <Text variant="body-md" color="on-surface-variant">
                Back to Sign In
              </Text>
            </Pressable>
          </Card>

          <Card tone="surface-container-low" padding={spacing['space-md']} style={styles.info}>
            <View style={styles.infoIcon}>
              <Icon name="shield" size={22} color="primary-fixed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label-md" weight="600">
                Signed up with Google?
              </Text>
              <Text variant="label-md" color="on-surface-variant" style={{ marginTop: 2 }}>
                You don’t need a password. Go back and use Continue with Google.
              </Text>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Notice({ icon, color, text }: { icon: 'error' | 'cloud_off'; color: 'error' | 'warning'; text: string }) {
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Icon name={icon} size={20} color={color} filled={icon === 'error'} />
      <Text variant="label-md" color="on-surface" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['space-sm'] },
  body: { paddingHorizontal: spacing['margin-mobile'], paddingTop: spacing['space-sm'], gap: spacing['space-md'] },
  badgeRow: { flexDirection: 'row' },
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
  hero: { flexDirection: 'row', gap: spacing['space-md'], alignItems: 'flex-start' },
  keyTile: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-sm'] + 4,
    padding: spacing['space-md'],
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container'],
  },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  info: { flexDirection: 'row', gap: spacing['space-md'] - 4, alignItems: 'flex-start' },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors['primary-fixed'], 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
