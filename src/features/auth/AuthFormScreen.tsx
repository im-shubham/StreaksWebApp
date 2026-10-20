import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthDivider, GoogleButton } from '@/components/ui/GoogleButton';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { isFirebaseConfigured } from '@/services/firebase';
import { googleAvailability } from '@/services/googleSignIn';
import { colors, glow, radius, spacing } from '@/theme';
import { authErrorMessage, EMAIL_RE } from './authErrors';
import { useAuth } from './AuthProvider';


/**
 * Stitch: "STREAKS - Sign In" / "STREAKS - Create Account" (email + password).
 * Apple/Google, Face ID and the streak teaser card are deferred, so they're
 * omitted rather than shown as dead controls.
 */
export function AuthFormScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const insets = useSafeAreaInsets();
  const { auth, signIn, signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const signUpMode = mode === 'sign-up';

  // Navigate only after AuthProvider has linked the account to local data.
  useEffect(() => {
    if (submitted && auth.status === 'signedIn') router.replace('/');
  }, [submitted, auth.status]);

  const emailError = email && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address.' : null;
  const passwordRules = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password) && /\d/.test(password), label: '1 uppercase letter & 1 number' },
  ];

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    if (signUpMode && !passwordRules.every((r) => r.ok)) return setError('Password does not meet the requirements.');
    setBusy(true);
    try {
      if (signUpMode) await signUp(name, email, password);
      else await signIn(email, password);
      setSubmitted(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const availability = googleAvailability();
    if (!availability.available) {
      Alert.alert('Google sign-in unavailable', availability.reason);
      return;
    }
    setGoogleBusy(true);
    try {
      if ((await signInWithGoogle()) === 'success') setSubmitted(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setGoogleBusy(false);
    }
  };

  const forgot = () => router.push({ pathname: '/auth/forgot-password', params: { email: email.trim() } });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={() => router.back()} />
        <Text variant="headline-md" align="center" style={{ flex: 1 }}>
          {signUpMode ? 'Create Account' : 'Sign In'}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}>
            <BrandLogo size={72} />
            <Text variant="caption-caps" color="primary-fixed" style={{ marginTop: spacing['space-lg'] }}>
              {signUpMode ? 'Join Momentum' : 'Momentum Engine'}
            </Text>
            <Text variant="headline-xl" align="center">
              {signUpMode ? 'Start your streak.' : 'Welcome back.'}
            </Text>
            <Text variant="body-md" color="on-surface-variant" align="center" style={{ marginTop: 6 }}>
              {signUpMode
                ? 'Set up your profile to sync your habits and streaks across devices.'
                : 'Continue building momentum and protecting your active streaks.'}
            </Text>
          </View>

          {!isFirebaseConfigured ? (
            <Card tone="surface-container" padding={spacing['space-md']} style={styles.notice}>
              <Icon name="cloud_off" size={20} color="warning" />
              <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
                Cloud accounts aren’t configured in this build yet. You can keep using MOMENTUM as a guest; your habits
                stay on this device.
              </Text>
            </Card>
          ) : null}

          {isFirebaseConfigured ? (
            <View style={{ gap: spacing['space-md'] }}>
              <GoogleButton
                label={signUpMode ? 'Sign up with Google' : 'Continue with Google'}
                onPress={() => void google()}
                loading={googleBusy || (submitted && auth.status !== 'signedIn' && !busy)}
              />
              <AuthDivider label={signUpMode ? 'or create with email' : 'or continue with email'} />
            </View>
          ) : null}

          <View style={{ gap: spacing['space-md'] }}>
            {signUpMode ? (
              <TextField label="Full Name" icon="person" placeholder="Alex Chen" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
            ) : null}
            <TextField
              label={signUpMode ? 'Email Address' : 'Account Email'}
              icon="mail"
              placeholder="alex.chen@domain.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={signUpMode ? 'username' : 'emailAddress'}
              error={emailError}
            />
            <TextField
              label={signUpMode ? 'Master Password' : 'Security Key / Password'}
              icon="lock"
              placeholder="••••••••••••"
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
              autoComplete={signUpMode ? 'new-password' : 'current-password'}
              textContentType={signUpMode ? 'newPassword' : 'password'}
              accessory={signUpMode ? undefined : { label: 'Forgot?', onPress: forgot }}
              onSubmitEditing={() => void submit()}
              returnKeyType="go"
            />
            {signUpMode ? (
              <View style={{ gap: 6, paddingHorizontal: 4 }}>
                {passwordRules.map((r) => (
                  <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={r.ok ? 'check_circle' : 'radio_button_unchecked'} size={16} color={r.ok ? 'primary-fixed' : 'outline'} />
                    <Text variant="label-md" color={r.ok ? 'on-surface' : 'on-surface-variant'}>
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {error ? (
            <Card tone="surface-container" padding={spacing['space-md']} style={styles.notice}>
              <Icon name="error" size={20} color="error" filled />
              <Text variant="label-md" color="on-surface" style={{ flex: 1 }}>
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label={signUpMode ? 'Create Account' : 'Sign In'}
            icon={signUpMode ? 'person_add' : 'arrow_forward'}
            onPress={() => void submit()}
            loading={busy || (submitted && auth.status !== 'signedIn')}
            disabled={!isFirebaseConfigured}
            style={[{ borderRadius: radius['2xl'], minHeight: 56 }, isFirebaseConfigured && glow]}
          />

          <View style={styles.switchRow}>
            <Text variant="body-md" color="on-surface-variant">
              {signUpMode ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <Pressable onPress={() => router.replace(signUpMode ? '/auth/sign-in' : '/auth/sign-up')} hitSlop={8}>
              <Text variant="body-md" weight="600" color="primary-fixed">
                {signUpMode ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['space-sm'] },
  body: { paddingHorizontal: spacing['margin-mobile'] + 4, paddingTop: spacing['space-md'], gap: spacing['space-lg'] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'] + 4, borderRadius: radius.xl },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
});
