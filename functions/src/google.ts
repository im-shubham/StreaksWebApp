import { androidpublisher, auth, type androidpublisher_v3 } from '@googleapis/androidpublisher';
import { createHash } from 'node:crypto';

import type { PurchaseRecord, PurchaseState } from './entitlement.js';
import { ANDROID_PACKAGE, ANDROID_SUBSCRIPTION_ID, androidPlan, LIFETIME_PRODUCT_ID } from './products.js';

export type SubscriptionPurchaseV2 = androidpublisher_v3.Schema$SubscriptionPurchaseV2;
export type ProductPurchase = androidpublisher_v3.Schema$ProductPurchase;

/** The Play Developer API calls the backend needs (faked in tests). */
export interface PlayApi {
  getSubscription(purchaseToken: string): Promise<SubscriptionPurchaseV2>;
  getProduct(productId: string, purchaseToken: string): Promise<ProductPurchase>;
  acknowledgeSubscription(subscriptionId: string, purchaseToken: string): Promise<void>;
  acknowledgeProduct(productId: string, purchaseToken: string): Promise<void>;
}

/** Real client. Uses the function's service account (Application Default Credentials), which must be granted access in Play Console. */
export function playApi(packageName = ANDROID_PACKAGE): PlayApi {
  const client = androidpublisher({
    version: 'v3',
    auth: new auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] }),
  });
  return {
    async getSubscription(token) {
      return (await client.purchases.subscriptionsv2.get({ packageName, token })).data;
    },
    async getProduct(productId, token) {
      return (await client.purchases.products.get({ packageName, productId, token })).data;
    },
    async acknowledgeSubscription(subscriptionId, token) {
      await client.purchases.subscriptions.acknowledge({ packageName, subscriptionId, token, requestBody: {} });
    },
    async acknowledgeProduct(productId, token) {
      await client.purchases.products.acknowledge({ packageName, productId, token, requestBody: {} });
    },
  };
}

export const androidKey = (purchaseToken: string) => `android_${createHash('sha256').update(purchaseToken).digest('hex').slice(0, 40)}`;

const SUBSCRIPTION_STATES: Record<string, PurchaseState> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
  SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_PENDING: 'pending',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
};

export type MappedPlayPurchase = Omit<PurchaseRecord, 'uid' | 'updatedAt'> & {
  accountId: string | null;
  needsAcknowledge: boolean;
  linkedPurchaseToken: string | null;
};

export function mapSubscription(sub: SubscriptionPurchaseV2, purchaseToken: string): MappedPlayPurchase | null {
  const item = sub.lineItems?.find((li) => li.productId === ANDROID_SUBSCRIPTION_ID) ?? sub.lineItems?.[0];
  const plan = androidPlan(item?.productId, item?.offerDetails?.basePlanId);
  if (!item || !plan || plan === 'lifetime') return null;
  const state = SUBSCRIPTION_STATES[sub.subscriptionState ?? ''] ?? 'expired';
  return {
    key: androidKey(purchaseToken),
    platform: 'android',
    plan,
    productId: item.productId ?? ANDROID_SUBSCRIPTION_ID,
    state,
    expiresAt: item.expiryTime ? Date.parse(item.expiryTime) : null,
    autoRenewing: !!item.autoRenewingPlan?.autoRenewEnabled,
    environment: sub.testPurchase ? 'sandbox' : 'production',
    purchasedAt: sub.startTime ? Date.parse(sub.startTime) : null,
    storeRef: purchaseToken,
    accountId: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    needsAcknowledge: sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && (state === 'active' || state === 'grace' || state === 'canceled'),
    linkedPurchaseToken: sub.linkedPurchaseToken ?? null,
  };
}

/** purchaseState: 0 purchased, 1 canceled (refunded/voided), 2 pending. purchaseType 0 = license-tester (test) purchase. */
export function mapProduct(p: ProductPurchase, purchaseToken: string): MappedPlayPurchase | null {
  if (p.productId && p.productId !== LIFETIME_PRODUCT_ID) return null;
  const state: PurchaseState = p.purchaseState === 0 ? 'active' : p.purchaseState === 2 ? 'pending' : 'revoked';
  return {
    key: androidKey(purchaseToken),
    platform: 'android',
    plan: 'lifetime',
    productId: LIFETIME_PRODUCT_ID,
    state,
    expiresAt: null,
    autoRenewing: false,
    environment: p.purchaseType === 0 ? 'sandbox' : 'production',
    purchasedAt: p.purchaseTimeMillis ? Number(p.purchaseTimeMillis) : null,
    storeRef: purchaseToken,
    accountId: p.obfuscatedExternalAccountId ?? null,
    needsAcknowledge: p.acknowledgementState === 0 && state === 'active',
    linkedPurchaseToken: null,
  };
}
