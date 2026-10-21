/**
 * MOMENTUM Pro: store catalog and entitlement rules shared by the app.
 * Mirrors functions/src/products.ts and functions/src/entitlement.ts (a test
 * checks the catalogs agree). Prices are never defined here: the app shows
 * the localized price strings returned by Google Play / the App Store.
 */
export type Plan = 'monthly' | 'yearly' | 'lifetime';
export const PLAN_ORDER: Plan[] = ['yearly', 'monthly', 'lifetime'];

export const ANDROID_SUBSCRIPTION_ID = 'momentum_pro';
export const ANDROID_BASE_PLANS: Record<'monthly' | 'yearly', string> = { monthly: 'monthly', yearly: 'yearly' };
export const LIFETIME_PRODUCT_ID = 'momentum_pro_lifetime';
export const IOS_PRODUCTS: Record<Plan, string> = {
  monthly: 'momentum_pro_monthly',
  yearly: 'momentum_pro_yearly',
  lifetime: 'momentum_pro_lifetime',
};

export const PLAN_COPY: Record<Plan, { title: string; period: string | null; note: string }> = {
  yearly: { title: 'Yearly', period: 'year', note: 'Billed once a year. Cancel anytime.' },
  monthly: { title: 'Monthly', period: 'month', note: 'Billed monthly. No commitment.' },
  lifetime: { title: 'Lifetime', period: null, note: 'One payment. Pro forever, no renewal.' },
};

export type PurchaseState = 'active' | 'canceled' | 'grace' | 'on_hold' | 'paused' | 'pending' | 'expired' | 'revoked';

/** users/{uid}/entitlements/pro, written only by the backend after verifying with the store. */
export type Entitlement = {
  active: boolean;
  plan: Plan | null;
  productId: string | null;
  platform: 'android' | 'ios' | null;
  state: PurchaseState | 'none';
  expiresAt: number | null;
  autoRenewing: boolean;
  environment: 'production' | 'sandbox' | null;
  updatedAt: number;
};

/** Pro right now: the server said active, and (unless lifetime) the paid period hasn't run out since. */
export function isProActive(e: Pick<Entitlement, 'active' | 'plan' | 'expiresAt'> | null | undefined, now: number = Date.now()): boolean {
  return !!e?.active && (e.plan === 'lifetime' || (e.expiresAt ?? 0) > now);
}

/** Store-side account ids, from the hex SHA-256 of `momentum:${uid}` (same as functions/src/accounts.ts). */
export const accountHashInput = (uid: string) => `momentum:${uid}`;

/** Google Play obfuscatedAccountId. */
export const androidAccountIdFromHash = (sha256Hex: string) => sha256Hex.toLowerCase();

/** StoreKit appAccountToken: UUID (v5 layout) from the first 16 bytes of the hash. */
export function iosAppAccountTokenFromHash(sha256Hex: string): string {
  const b = sha256Hex.toLowerCase().slice(0, 32).match(/../g)!.map((h) => parseInt(h, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** How the subscription screen describes the current state. */
export function describeEntitlement(e: Entitlement | null, now: number = Date.now(), formatDate: (ms: number) => string): {
  title: string;
  detail: string;
  tone: 'good' | 'warning' | 'neutral';
} {
  if (!e || e.state === 'none') return { title: 'Free plan', detail: 'Upgrade to unlock unlimited active habits.', tone: 'neutral' };
  const until = e.expiresAt ? formatDate(e.expiresAt) : '';
  const active = isProActive(e, now);
  if (e.plan === 'lifetime' && active) return { title: 'Pro · Lifetime', detail: 'Yours forever. No renewals.', tone: 'good' };
  const plan = e.plan ? PLAN_COPY[e.plan].title : 'Pro';
  switch (active ? e.state : e.state === 'active' || e.state === 'canceled' || e.state === 'grace' ? 'expired' : e.state) {
    case 'active':
      return { title: `Pro · ${plan}`, detail: e.autoRenewing ? `Renews on ${until}.` : `Ends on ${until}.`, tone: 'good' };
    case 'canceled':
      return { title: `Pro · ${plan}`, detail: `Cancelled. Pro stays on until ${until}, then won’t renew.`, tone: 'neutral' };
    case 'grace':
      return { title: 'Payment issue', detail: `Your last renewal failed. Update your payment method by ${until} to keep Pro.`, tone: 'warning' };
    case 'on_hold':
      return { title: 'Payment failed', detail: 'Pro is paused until the store can charge your payment method. Fix it in the store to restore Pro.', tone: 'warning' };
    case 'paused':
      return { title: 'Subscription paused', detail: 'Resume it from the store’s subscription settings.', tone: 'neutral' };
    case 'pending':
      return { title: 'Payment pending', detail: 'Pro unlocks as soon as the store confirms your payment.', tone: 'neutral' };
    case 'revoked':
      return { title: 'Pro removed', detail: 'This purchase was refunded or revoked.', tone: 'neutral' };
    default:
      return { title: 'Pro expired', detail: 'Resubscribe or restore a purchase to unlock Pro again.', tone: 'neutral' };
  }
}
