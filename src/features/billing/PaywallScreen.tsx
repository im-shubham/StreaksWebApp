import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { RadialGlow } from '@/components/ui/RadialGlow';
import { Text } from '@/components/ui/Text';
import { useLiveQuery } from '@/db/live';
import { PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import { PLAN_COPY, type Plan } from '@/domain/billing';
import { effectiveTier } from '@/domain/plans';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadOffers, storeAvailability, type Offer } from '@/services/billing';
import { alpha, colors, glow, radius, spacing } from '@/theme';
import { restore, startPurchase } from './purchaseFlow';
import { setPurchaseStatus, usePurchaseStatus, type PurchaseStatus } from './purchaseStatus';

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

/** Percent saved by yearly vs 12 × monthly, from the store's own prices; null unless comparable. */
export function yearlySavings(offers: readonly Offer[]): number | null {
  const m = offers.find((o) => o.plan === 'monthly');
  const y = offers.find((o) => o.plan === 'yearly');
  if (!m?.priceAmount || !y?.priceAmount || m.currency !== y.currency) return null;
  const pct = Math.floor((1 - y.priceAmount / (m.priceAmount * 12)) * 100);
  return pct > 0 ? pct : null;
}

type Load = { state: 'loading' } | { state: 'unavailable'; reason: string } | { state: 'empty' } | { state: 'ready'; offers: Offer[] };

/** Stitch: "STREAKS Pro Paywall" + "Purchase States", with real store prices and only real Pro benefits. */
export function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const profile = useLiveQuery<ProfileRow>(PROFILE_SQL, [], ['profile'])?.[0];
  const status = usePurchaseStatus();
  const [load, setLoad] = useState<Load>(() => {
    const store = storeAvailability();
    return store.available ? { state: 'loading' } : { state: 'unavailable', reason: store.reason };
  });
  const [selected, setSelected] = useState<Plan>('yearly');
  const [restoring, setRestoring] = useState(false);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  const signedIn = auth.status === 'signedIn';
  const isPro = effectiveTier(profile) === 'pro';

  const apply = useCallback((offers: Offer[]) => {
    setLoad(offers.length ? { state: 'ready', offers } : { state: 'empty' });
    setSelected((s) => (offers.some((o) => o.plan === s) ? s : (offers[0]?.plan ?? s)));
  }, []);

  const fetchOffers = useCallback(() => {
    setLoad({ state: 'loading' });
    loadOffers().then(apply, () => setLoad({ state: 'empty' }));
  }, [apply]);

  useEffect(() => {
    setPurchaseStatus({ state: 'idle' });
    if (storeAvailability().available) loadOffers().then(apply, () => setLoad({ state: 'empty' }));
    return () => setPurchaseStatus({ state: 'idle' });
  }, [apply]);

  const offers = load.state === 'ready' ? load.offers : [];
  const offer = offers.find((o) => o.plan === selected) ?? null;
  const savings = yearlySavings(offers);
  const busy = status.state === 'purchasing' || status.state === 'verifying';

  const onRestore = async () => {
    setRestoring(true);
    setRestoreNote(null);
    try {
      const r = await restore();
      setRestoreNote(
        r.granted > 0
          ? 'Purchases restored. Momentum Pro is active.'
          : (r.firstError ?? (r.found ? 'No active Momentum Pro purchase was found.' : `No purchases found for this ${STORE_NAME} account.`)),
      );
    } catch {
      setRestoreNote(`Couldn’t reach ${STORE_NAME}. Check your connection and try again.`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="close" accessibilityLabel="Close" tone="surface-container" color="on-surface" onPress={() => router.back()} />
        <Text variant="headline-md" align="center" style={{ flex: 1 }}>
          Momentum Pro
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing['space-xl'] }]} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.badge}>
            <Icon name="bolt" size={16} color="primary-fixed" filled />
            <Text variant="caption-caps" color="primary-fixed">
              Momentum Pro
            </Text>
          </View>
          <View style={styles.hero}>
            <RadialGlow size={200} opacity={0.22} style={{ position: 'absolute' }} />
            <BrandLogo size={96} />
          </View>
          <Text variant="headline-xl" align="center">
            Unlimited momentum.
          </Text>
          <Text variant="body-md" color="on-surface-variant" align="center" style={{ marginTop: spacing['space-xs'] }}>
            Track every habit you care about. The Free plan is limited to 1 active habit.
          </Text>
        </View>

        <Benefit icon="all_inclusive" title="Unlimited Active Habits" tag="No limit" body="Run as many habits at once as you like. Free stays capped at 1." />
        <Benefit icon="verified" title="Everything Else Stays" tag="Included" body="Streaks, reminders, insights and cloud sync keep working on every plan." />

        {isPro ? (
          <Card style={{ gap: spacing['space-md'] }}>
            <View style={styles.row}>
              <Icon name="workspace_premium" size={24} color="primary-fixed" filled />
              <Text variant="headline-md" style={{ flex: 1 }}>
                You’re on Momentum Pro
              </Text>
            </View>
            <Button label="Manage Subscription" variant="secondary" size="md" onPress={() => router.replace('/pro-manage')} />
          </Card>
        ) : status.state === 'verifying' || status.state === 'pending' || status.state === 'success' ? (
          <StatusPanel status={status} />
        ) : (
          <>
            <PlanList load={load} selected={selected} onSelect={setSelected} savings={savings} onRetry={fetchOffers} />

            {status.state === 'error' ? <Notice icon="error" tone="error" text={status.message} /> : null}

            {!signedIn ? (
              <View style={{ gap: spacing['space-sm'] }}>
                <Text variant="body-md" color="on-surface-variant" align="center">
                  Pro is linked to your account so it works on all your devices.
                </Text>
                <Button label="Create a Free Account to Upgrade" icon="person_add" onPress={() => router.push('/auth/sign-up')} />
                <Button label="I Already Have an Account" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
              </View>
            ) : offer ? (
              <View style={{ gap: spacing['space-sm'] }}>
                <Button
                  label={offer.kind === 'subs' ? `Subscribe · ${offer.price}/${PLAN_COPY[offer.plan].period}` : `Buy Lifetime · ${offer.price}`}
                  icon="arrow_forward"
                  iconPosition="trailing"
                  loading={busy}
                  disabled={busy}
                  onPress={() => auth.status === 'signedIn' && void startPurchase(offer, auth.user.uid)}
                  style={[{ borderRadius: radius['2xl'], minHeight: 56 }, glow]}
                />
                <Text variant="label-sm" color="on-surface-variant" align="center">
                  {offer.kind === 'subs'
                    ? `Renews automatically at ${offer.price} per ${PLAN_COPY[offer.plan].period} until cancelled. Cancel anytime in your ${STORE_NAME} subscriptions${Platform.OS === 'ios' ? ' at least 24 hours before the period ends' : ''}.`
                    : 'One-time payment. No subscription, no renewals.'}
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.links}>
          {signedIn && storeAvailability().available ? (
            <Pressable accessibilityRole="button" onPress={() => void onRestore()} disabled={restoring} hitSlop={8}>
              <Text variant="label-md" weight="600" color="on-surface-variant" style={styles.link}>
                {restoring ? 'Restoring…' : 'Restore Purchases'}
              </Text>
            </Pressable>
          ) : null}
          {TERMS_URL ? <LinkText label="Terms of Use" url={TERMS_URL} /> : null}
          {PRIVACY_URL ? <LinkText label="Privacy Policy" url={PRIVACY_URL} /> : null}
        </View>
        {restoreNote ? (
          <Text variant="label-md" color="on-surface-variant" align="center" accessibilityRole="alert">
            {restoreNote}
          </Text>
        ) : null}
        <View style={[styles.row, { justifyContent: 'center' }]}>
          <Icon name="verified_user" size={16} color="outline" />
          <Text variant="label-sm" color="outline">
            Payments handled securely by {STORE_NAME}.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Benefit({ icon, title, tag, body }: { icon: IconName; title: string; tag: string; body: string }) {
  return (
    <Card padding={spacing['space-md']} style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Icon name={icon} size={22} color="primary-fixed" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Text variant="label-md" weight="600" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <View style={styles.tag}>
            <Text variant="micro-counter" color="primary-fixed">
              {tag}
            </Text>
          </View>
        </View>
        <Text variant="body-md" color="on-surface-variant">
          {body}
        </Text>
      </View>
    </Card>
  );
}

function PlanList({
  load,
  selected,
  onSelect,
  savings,
  onRetry,
}: {
  load: Load;
  selected: Plan;
  onSelect: (p: Plan) => void;
  savings: number | null;
  onRetry: () => void;
}) {
  if (load.state === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors['primary-fixed']} />
        <Text variant="label-md" color="on-surface-variant">
          Loading prices from {STORE_NAME}…
        </Text>
      </View>
    );
  }
  if (load.state === 'unavailable') return <Notice icon="info" tone="neutral" text={load.reason} />;
  if (load.state === 'empty') {
    return (
      <Card style={{ gap: spacing['space-md'] }}>
        <Text variant="body-md" color="on-surface-variant">
          Plans aren’t available right now. Check your connection and try again.
        </Text>
        <Button label="Try Again" icon="refresh" variant="secondary" size="md" onPress={onRetry} />
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing['space-sm'] }} accessibilityRole="radiogroup">
      {load.offers.map((o) => {
        const active = o.plan === selected;
        const copy = PLAN_COPY[o.plan];
        return (
          <Pressable
            key={o.plan}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${copy.title}, ${o.price}${copy.period ? ` per ${copy.period}` : ', one time'}`}
            onPress={() => onSelect(o.plan)}
            style={[styles.plan, active && styles.planActive]}
          >
            {o.plan === 'yearly' && savings ? (
              <View style={styles.saveTag}>
                <Text variant="micro-counter" color="on-primary-fixed">
                  Save {savings}%
                </Text>
              </View>
            ) : null}
            <View style={[styles.radio, active && { borderColor: colors['primary-fixed'] }]}>{active ? <View style={styles.radioDot} /> : null}</View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="headline-md" numberOfLines={1}>
                {copy.title}
              </Text>
              <Text variant="label-sm" color="on-surface-variant">
                {copy.note}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="headline-md" color={active ? 'primary-fixed' : 'on-surface'} tabular>
                {o.price}
              </Text>
              <Text variant="micro-counter" color="outline">
                {copy.period ? `/ ${copy.period}` : 'once'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatusPanel({ status }: { status: Extract<PurchaseStatus, { state: 'verifying' | 'pending' | 'success' }> }) {
  const view = {
    verifying: { icon: 'lock' as IconName, title: 'Confirming your purchase', body: `Checking the transaction with ${STORE_NAME}. This takes a few seconds.` },
    pending: {
      icon: 'hourglass_top' as IconName,
      title: 'Payment pending',
      body: `${STORE_NAME} is still processing your payment. Pro unlocks automatically once it’s confirmed. You can close this screen.`,
    },
    success: { icon: 'workspace_premium' as IconName, title: 'Welcome to Momentum Pro', body: 'Unlimited active habits are unlocked on all your devices.' },
  }[status.state];
  return (
    <Card style={styles.statusCard} accessibilityRole="alert">
      <View style={styles.statusIcon}>
        {status.state === 'verifying' ? <ActivityIndicator color={colors['primary-fixed']} /> : <Icon name={view.icon} size={32} color="primary-fixed" filled />}
      </View>
      <Text variant="headline-md" align="center">
        {view.title}
      </Text>
      <Text variant="body-md" color="on-surface-variant" align="center">
        {view.body}
      </Text>
      {status.state !== 'verifying' ? (
        <Button label={status.state === 'success' ? 'Continue' : 'Close'} onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      ) : null}
    </Card>
  );
}

function Notice({ icon, tone, text }: { icon: IconName; tone: 'error' | 'neutral'; text: string }) {
  return (
    <View style={styles.notice} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={20} color={tone === 'error' ? 'error' : 'on-surface-variant'} filled={tone === 'error'} />
      <Text variant="label-md" color="on-surface" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function LinkText({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} hitSlop={8}>
      <Text variant="label-md" weight="600" color="on-surface-variant" style={styles.link}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['space-sm'] },
  body: { paddingHorizontal: spacing['margin-mobile'], paddingTop: spacing['space-sm'], gap: spacing['space-md'] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
  },
  hero: { width: 160, height: 140, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'] },
  benefit: { flexDirection: 'row', gap: spacing['space-md'] - 4, alignItems: 'flex-start' },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.DEFAULT, backgroundColor: colors['surface-container-high'] },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-md'] - 4,
    padding: spacing['space-md'],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors['surface-container-low'],
  },
  planActive: { borderColor: colors['primary-fixed'], backgroundColor: alpha(colors['primary-fixed'], 0.06) },
  saveTag: {
    position: 'absolute',
    top: -10,
    right: spacing['space-md'],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors['primary-fixed'],
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors['primary-fixed'] },
  center: { alignItems: 'center', gap: spacing['space-sm'], paddingVertical: spacing['space-lg'] },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-sm'] + 4,
    padding: spacing['space-md'],
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container'],
  },
  statusCard: { alignItems: 'center', gap: spacing['space-md'], paddingVertical: spacing['space-xl'] },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors['primary-fixed'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing['space-md'] },
  link: { textDecorationLine: 'underline' },
});
