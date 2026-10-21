import type { Firestore } from 'firebase-admin/firestore';

import { androidAccountId, iosAppAccountToken } from './accounts.js';
import { mapAppleTransaction, type AppStoreApi } from './apple.js';
import type { Entitlement, PurchaseState } from './entitlement.js';
import { androidKey, mapProduct, mapSubscription, type MappedPlayPurchase, type PlayApi } from './google.js';
import { ANDROID_PACKAGE, ANDROID_SUBSCRIPTION_ID, iosPlan, LIFETIME_PRODUCT_ID } from './products.js';
import { markReplaced, PurchaseOwnedElsewhereError, savePurchase, updatePurchaseState } from './store.js';

export type Deps = { db: Firestore; play: () => PlayApi; apple: () => AppStoreApi; now: () => number };

/** Errors the callable maps to HttpsError codes; messages are shown to the user. */
export class BillingError extends Error {
  constructor(
    public readonly code: 'invalid-argument' | 'permission-denied' | 'already-exists' | 'failed-precondition' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

export type VerifyInput =
  | { platform: 'android'; productId: string; purchaseToken: string }
  | { platform: 'ios'; transactionId: string };

export type VerifyResult = { state: PurchaseState; entitlement: Entitlement | null };

export function parseVerifyInput(data: unknown): VerifyInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 4096;
  if (d.platform === 'android' && str(d.productId) && str(d.purchaseToken)) {
    return { platform: 'android', productId: d.productId as string, purchaseToken: d.purchaseToken as string };
  }
  if (d.platform === 'ios' && str(d.transactionId)) return { platform: 'ios', transactionId: d.transactionId as string };
  throw new BillingError('invalid-argument', 'Missing or invalid purchase details.');
}

async function fetchPlay(play: PlayApi, productId: string, token: string): Promise<MappedPlayPurchase | null> {
  if (productId === LIFETIME_PRODUCT_ID) return mapProduct(await play.getProduct(productId, token), token);
  if (productId === ANDROID_SUBSCRIPTION_ID) return mapSubscription(await play.getSubscription(token), token);
  return null;
}

/**
 * Verifies a purchase with the store for the signed-in user, binds it to the
 * account, acknowledges it (Play), and returns the resulting entitlement.
 * The app finishes the store transaction only after this succeeds.
 */
export async function verifyPurchase(deps: Deps, uid: string, input: VerifyInput): Promise<VerifyResult> {
  const now = deps.now();
  if (input.platform === 'android') {
    const play = deps.play();
    const p = await fetchPlay(play, input.productId, input.purchaseToken);
    if (!p) throw new BillingError('invalid-argument', 'This product isn’t part of MOMENTUM Pro.');
    if (p.accountId && p.accountId !== androidAccountId(uid)) {
      throw new BillingError('permission-denied', 'This purchase was made from a different MOMENTUM account.');
    }
    const { accountId: _a, needsAcknowledge, linkedPurchaseToken, ...record } = p;
    const { entitlement } = await bind(deps.db, record, uid, now);
    if (linkedPurchaseToken) await markReplaced(deps.db, androidKey(linkedPurchaseToken), record.key, now);
    if (needsAcknowledge) {
      if (record.plan === 'lifetime') await play.acknowledgeProduct(LIFETIME_PRODUCT_ID, input.purchaseToken);
      else await play.acknowledgeSubscription(ANDROID_SUBSCRIPTION_ID, input.purchaseToken);
    }
    return { state: record.state, entitlement };
  }

  const apple = deps.apple();
  const tx = await apple.getTransaction(input.transactionId);
  if (!iosPlan(tx.productId)) throw new BillingError('invalid-argument', 'This product isn’t part of MOMENTUM Pro.');
  if (tx.appAccountToken && tx.appAccountToken !== iosAppAccountToken(uid)) {
    throw new BillingError('permission-denied', 'This purchase was made from a different MOMENTUM account.');
  }
  const status = iosPlan(tx.productId) === 'lifetime' ? null : await apple.getSubscriptionStatus(tx.originalTransactionId!);
  const mapped = mapAppleTransaction(tx, status, now);
  if (!mapped) throw new BillingError('invalid-argument', 'This purchase isn’t for MOMENTUM.');
  const { appAccountToken: _t, ...record } = mapped;
  const { entitlement } = await bind(deps.db, record, uid, now);
  return { state: record.state, entitlement };
}

async function bind(db: Firestore, record: Parameters<typeof savePurchase>[1], uid: string, now: number) {
  try {
    return await savePurchase(db, record, uid, now);
  } catch (e) {
    if (e instanceof PurchaseOwnedElsewhereError) throw new BillingError('already-exists', e.message);
    throw e;
  }
}

/** Google Play Real-time Developer Notification (Pub/Sub message `data`, already base64-decoded JSON). */
export type PlayNotification = {
  packageName?: string;
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string };
  oneTimeProductNotification?: { notificationType?: number; purchaseToken?: string; sku?: string };
  voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
  testNotification?: unknown;
};

/**
 * Renewals, cancellations, grace / account hold, pauses, expiry, refunds.
 * Re-reads the purchase from the Play API (the notification itself is only a
 * hint) and updates the bound user, if any. Unbound purchases are recorded
 * and get bound when the app verifies them.
 */
export async function handlePlayNotification(deps: Deps, n: PlayNotification): Promise<string> {
  if (n.testNotification) return 'test';
  if (n.packageName !== ANDROID_PACKAGE) return 'ignored: other package';
  const now = deps.now();
  if (n.voidedPurchaseNotification?.purchaseToken) {
    await updatePurchaseState(deps.db, androidKey(n.voidedPurchaseNotification.purchaseToken), { state: 'revoked' }, now);
    return 'voided';
  }
  const sub = n.subscriptionNotification;
  const one = n.oneTimeProductNotification;
  const token = sub?.purchaseToken ?? one?.purchaseToken;
  if (!token) return 'ignored: no token';
  const productId = sub ? ANDROID_SUBSCRIPTION_ID : (one?.sku ?? LIFETIME_PRODUCT_ID);
  const p = await fetchPlay(deps.play(), productId, token);
  if (!p) return 'ignored: unknown product';
  const { accountId: _a, needsAcknowledge: _n, linkedPurchaseToken, ...record } = p;
  await savePurchase(deps.db, record, null, now);
  if (linkedPurchaseToken) await markReplaced(deps.db, androidKey(linkedPurchaseToken), record.key, now);
  return `updated: ${record.state}`;
}

/**
 * App Store Server Notifications V2. The signed payload is verified against
 * Apple's root certificates; the current state is then re-read from the App
 * Store Server API for subscriptions.
 */
export async function handleAppleNotification(deps: Deps, signedPayload: string): Promise<string> {
  const apple = deps.apple();
  const n = await apple.decodeNotification(signedPayload);
  if (n.notificationType === 'TEST') return 'test';
  const tx = n.transaction;
  if (!tx?.originalTransactionId || !iosPlan(tx.productId)) return 'ignored';
  const now = deps.now();
  const status = iosPlan(tx.productId) === 'lifetime' ? null : await apple.getSubscriptionStatus(tx.originalTransactionId);
  const mapped = mapAppleTransaction(tx, status, now);
  if (!mapped) return 'ignored';
  const { appAccountToken: _t, ...record } = mapped;
  await savePurchase(deps.db, record, null, now);
  return `updated: ${record.state}`;
}
