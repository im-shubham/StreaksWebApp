import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { useLiveQuery } from '@/db/live';
import { PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import { describeEntitlement, isProActive, PLAN_COPY, type Entitlement, type PurchaseState } from '@/domain/billing';
import { formatMonthDay, toLocalDate } from '@/domain/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { openSubscriptionManagement, storeAvailability } from '@/services/billing';
import { colors, radius, spacing, type ColorToken } from '@/theme';
import { restore } from './purchaseFlow';

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
const storeName = (p: 'android' | 'ios' | null) => (p === 'ios' ? 'App Store' : p === 'android' ? 'Google Play' : 'the store');
const formatDate = (ms: number) => {
  const d = new Date(ms);
  return `${formatMonthDay(toLocalDate(d))}, ${d.getFullYear()}`;
};

/** The cached server entitlement as the domain type. */
export function entitlementFromProfile(p: ProfileRow | undefined): Entitlement | null {
  if (!p?.pro_state) return null;
  return {
    active: p.tier === 'pro',
    plan: p.pro_plan,
    productId: null,
    platform: p.pro_platform,
    state: p.pro_state as PurchaseState,
    expiresAt: p.pro_expires_at,
    autoRenewing: p.pro_auto_renewing === 1,
    environment: p.pro_environment as Entitlement['environment'],
    updatedAt: p.pro_checked_at ?? 0,
  };
}

/** Stitch: "Restore Purchases & Subscription Management". */
export function ManageProScreen() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const profile = useLiveQuery<ProfileRow>(PROFILE_SQL, [], ['profile'])?.[0];
  const [restoring, setRestoring] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [now] = useState(Date.now);
  const e = entitlementFromProfile(profile);
  const view = describeEntitlement(e, now, formatDate);
  const active = isProActive(e, now);
  const subscription = e?.plan === 'monthly' || e?.plan === 'yearly';
  const otherStore = !!e?.platform && e.platform !== Platform.OS;
  const toneColor: ColorToken = view.tone === 'good' ? 'primary-fixed' : view.tone === 'warning' ? 'warning' : 'on-surface-variant';

  const onRestore = async () => {
    setRestoring(true);
    setNote(null);
    try {
      const r = await restore();
      setNote(r.granted > 0 ? 'Purchases restored.' : (r.firstError ?? (r.found ? 'No active Momentum Pro purchase was found.' : `No purchases found for this ${STORE_NAME} account.`)));
    } catch {
      setNote(`Couldn’t reach ${STORE_NAME}. Check your connection and try again.`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="arrow_back" accessibilityLabel="Go Back" tone="transparent" color="on-surface" iconSize={24} onPress={() => router.back()} />
        <Text variant="headline-md" align="center" style={{ flex: 1 }}>
          Subscription
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]}>
        <Card style={{ gap: spacing['space-md'] }}>
          <View style={styles.row}>
            <View style={styles.iconTile}>
              <Icon name={view.tone === 'warning' ? 'warning' : 'workspace_premium'} size={24} color={toneColor} filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline-md">{view.title}</Text>
              <Text variant="body-md" color="on-surface-variant">
                {view.detail}
              </Text>
            </View>
          </View>
          {e?.plan || e?.platform ? (
            <View style={styles.pills}>
              {e?.plan ? <Pill label={PLAN_COPY[e.plan].title} tone="surface-container-high" color="primary-fixed" variant="micro-counter" /> : null}
              {e?.platform ? <Pill label={storeName(e.platform)} icon="storefront" tone="surface-container-high" variant="micro-counter" /> : null}
              {e?.environment === 'sandbox' ? <Pill label="Test purchase" icon="science" tone="surface-container-high" color="warning" variant="micro-counter" /> : null}
            </View>
          ) : null}
          {otherStore ? (
            <Text variant="label-md" color="on-surface-variant">
              Bought on {storeName(e?.platform ?? null)}. Manage or cancel it from a device using that store.
            </Text>
          ) : null}
        </Card>

        {auth.status !== 'signedIn' ? (
          <Card style={{ gap: spacing['space-md'] }}>
            <Text variant="body-md" color="on-surface-variant">
              Sign in to see or restore Momentum Pro. Purchases are linked to your account.
            </Text>
            <Button label="Sign In" onPress={() => router.push('/auth/sign-in')} />
          </Card>
        ) : (
          <View style={{ gap: spacing['space-sm'] }}>
            {subscription && !otherStore && storeAvailability().available ? (
              <Button
                label={view.tone === 'warning' ? 'Fix Payment Method' : 'Manage Subscription'}
                icon="open_in_new"
                onPress={() => void openSubscriptionManagement()}
              />
            ) : null}
            {!active ? <Button label="See Plans" icon="bolt" onPress={() => router.push('/pro')} /> : null}
            {storeAvailability().available ? (
              <Button label="Restore Purchases" icon="restore" variant="secondary" loading={restoring} onPress={() => void onRestore()} />
            ) : (
              <Text variant="label-md" color="on-surface-variant" align="center">
                {(storeAvailability() as { reason: string }).reason}
              </Text>
            )}
            {note ? (
              <Text variant="label-md" color="on-surface-variant" align="center" accessibilityRole="alert">
                {note}
              </Text>
            ) : null}
          </View>
        )}

        <Card tone="surface-container-lowest" padding={spacing['space-md']} style={styles.row}>
          <Icon name="info" size={18} color="on-surface-variant" />
          <Text variant="label-md" color="on-surface-variant" style={{ flex: 1 }}>
            Cancelling keeps Pro until the end of the period you paid for. If Pro ends, your habits are kept: extra active habits are paused, never deleted.
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-md'] - 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
