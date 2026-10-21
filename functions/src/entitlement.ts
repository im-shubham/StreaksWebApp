import type { Plan } from './products.js';

/**
 * Normalised purchase state across Google Play and the App Store.
 * - active:   paid and renewing (or lifetime)
 * - canceled: auto-renew off; access continues until expiresAt
 * - grace:    renewal payment failed, store grace period; access continues until expiresAt (grace end)
 * - on_hold:  renewal failed after grace (Play account hold / Apple billing retry); no access
 * - paused:   Play subscription pause; no access
 * - pending:  payment not completed yet (e.g. cash / UPI pending); no access
 * - expired, revoked (refund / chargeback / family sharing removed): no access
 */
export type PurchaseState = 'active' | 'canceled' | 'grace' | 'on_hold' | 'paused' | 'pending' | 'expired' | 'revoked';

export type Platform = 'android' | 'ios';

/** A store purchase as the backend last verified it. Stored in `purchases/{key}` (server only). */
export type PurchaseRecord = {
  key: string;
  uid: string | null;
  platform: Platform;
  plan: Plan;
  productId: string;
  state: PurchaseState;
  /** ms; null for lifetime. For `grace` this is the end of the grace period. */
  expiresAt: number | null;
  autoRenewing: boolean;
  environment: 'production' | 'sandbox';
  purchasedAt: number | null;
  /** Android purchaseToken or iOS originalTransactionId; needed to refresh and acknowledge. */
  storeRef: string;
  /** Play: an upgraded/downgraded subscription points at its successor. */
  replacedBy?: string | null;
  updatedAt: number;
};

/** What the app reads at `users/{uid}/entitlements/pro`. Written only by the backend. */
export type Entitlement = {
  active: boolean;
  plan: Plan | null;
  productId: string | null;
  platform: Platform | null;
  state: PurchaseState | 'none';
  expiresAt: number | null;
  autoRenewing: boolean;
  environment: 'production' | 'sandbox' | null;
  updatedAt: number;
};

export function grantsAccess(r: Pick<PurchaseRecord, 'plan' | 'state' | 'expiresAt' | 'replacedBy'>, now: number): boolean {
  if (r.replacedBy) return false;
  if (r.state !== 'active' && r.state !== 'canceled' && r.state !== 'grace') return false;
  return r.plan === 'lifetime' || (r.expiresAt ?? 0) > now;
}

/**
 * The user's Pro entitlement from all their purchases: lifetime wins, then the
 * subscription that runs longest. With no access, the most recently updated
 * purchase is reported (so the app can say "payment issue" or "expired").
 */
export function deriveEntitlement(records: readonly PurchaseRecord[], now: number): Entitlement {
  const granting = records.filter((r) => grantsAccess(r, now));
  const best =
    granting.find((r) => r.plan === 'lifetime') ??
    [...granting].sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0] ??
    [...records].filter((r) => !r.replacedBy).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!best) {
    return { active: false, plan: null, productId: null, platform: null, state: 'none', expiresAt: null, autoRenewing: false, environment: null, updatedAt: now };
  }
  return {
    active: grantsAccess(best, now),
    plan: best.plan,
    productId: best.productId,
    platform: best.platform,
    state: best.state,
    expiresAt: best.expiresAt,
    autoRenewing: best.autoRenewing,
    environment: best.environment,
    updatedAt: now,
  };
}
