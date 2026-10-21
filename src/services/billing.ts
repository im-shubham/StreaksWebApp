import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as Iap from 'expo-iap';
import { Platform } from 'react-native';

import {
  ANDROID_BASE_PLANS,
  ANDROID_SUBSCRIPTION_ID,
  IOS_PRODUCTS,
  LIFETIME_PRODUCT_ID,
  PLAN_ORDER,
  type Plan,
} from '@/domain/billing';

/**
 * Google Play Billing / StoreKit through expo-iap. The native module exists
 * only in development and release builds (not Expo Go), so expo-iap is
 * loaded lazily: importing it eagerly could crash the whole app in Expo Go.
 */
export type StoreAvailability = { available: true } | { available: false; reason: string };

/** A purchasable plan with the store's own localized price (never computed by us). */
export type Offer = {
  plan: Plan;
  productId: string;
  kind: 'subs' | 'in-app';
  /** Store-formatted, e.g. "₹49.00" or "$1.99". For subscriptions: the recurring price. */
  price: string;
  priceAmount: number | null;
  currency: string | null;
  /** Android base plan offer token (required to buy that base plan). */
  offerToken?: string;
};

export type StorePurchase = Iap.Purchase;
export type StorePurchaseError = Parameters<Parameters<typeof Iap.purchaseErrorListener>[0]>[0];

let iap: typeof Iap | null | undefined;
function lib(): typeof Iap | null {
  if (iap !== undefined) return iap;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module comment
    iap = require('expo-iap') as typeof Iap;
  } catch {
    iap = null;
  }
  return iap;
}

let connected: Promise<boolean> | null = null;

export function storeAvailability(): StoreAvailability {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { available: false, reason: 'Purchases are available in the iOS and Android app.' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !lib()) {
    return { available: false, reason: 'Purchases need the installed MOMENTUM app (a development or store build), not Expo Go.' };
  }
  return { available: true };
}

/** Opens the store connection once. Resolves false when the store can't be reached. */
export function connectStore(): Promise<boolean> {
  if (!storeAvailability().available) return Promise.resolve(false);
  const m = lib()!;
  connected ??= m.initConnection().then(
    (ok) => !!ok,
    () => {
      connected = null;
      return false;
    },
  );
  return connected;
}

type AndroidSubOffer = NonNullable<Iap.ProductSubscriptionAndroid['subscriptionOffers']>[number];

/** The plain base plan offer (one pricing phase, i.e. no intro discount) when present. */
function pickBasePlanOffer(offers: readonly AndroidSubOffer[], basePlanId: string): AndroidSubOffer | undefined {
  const forPlan = offers.filter((o) => o.basePlanIdAndroid === basePlanId && o.offerTokenAndroid);
  return forPlan.find((o) => (o.pricingPhasesAndroid?.pricingPhaseList.length ?? 1) === 1) ?? forPlan[0];
}

function recurringPrice(o: AndroidSubOffer): { price: string; amount: number | null; currency: string | null } {
  const phases = o.pricingPhasesAndroid?.pricingPhaseList ?? [];
  const last = phases[phases.length - 1];
  if (last) return { price: last.formattedPrice, amount: Number(last.priceAmountMicros) / 1e6, currency: last.priceCurrencyCode };
  return { price: o.displayPrice, amount: o.price ?? null, currency: o.currency ?? null };
}

/** Plans the store can sell right now, in display order. Missing products are left out. */
export async function loadOffers(): Promise<Offer[]> {
  const m = lib();
  if (!m || !(await connectStore())) return [];
  const offers: Offer[] = [];
  if (Platform.OS === 'android') {
    const [subs, life] = await Promise.all([
      m.fetchProducts({ skus: [ANDROID_SUBSCRIPTION_ID], type: 'subs' }) as Promise<Iap.ProductSubscription[]>,
      m.fetchProducts({ skus: [LIFETIME_PRODUCT_ID], type: 'in-app' }) as Promise<Iap.Product[]>,
    ]);
    const sub = subs.find((p) => p.id === ANDROID_SUBSCRIPTION_ID && p.platform === 'android') as Iap.ProductSubscriptionAndroid | undefined;
    for (const plan of ['monthly', 'yearly'] as const) {
      const o = sub ? pickBasePlanOffer(sub.subscriptionOffers ?? [], ANDROID_BASE_PLANS[plan]) : undefined;
      if (!o?.offerTokenAndroid) continue;
      const p = recurringPrice(o);
      offers.push({ plan, productId: ANDROID_SUBSCRIPTION_ID, kind: 'subs', price: p.price, priceAmount: p.amount, currency: p.currency, offerToken: o.offerTokenAndroid });
    }
    const l = life.find((p) => p.id === LIFETIME_PRODUCT_ID);
    if (l) offers.push({ plan: 'lifetime', productId: l.id, kind: 'in-app', price: l.displayPrice, priceAmount: l.price ?? null, currency: l.currency });
  } else {
    const [subs, life] = await Promise.all([
      m.fetchProducts({ skus: [IOS_PRODUCTS.monthly, IOS_PRODUCTS.yearly], type: 'subs' }) as Promise<Iap.ProductSubscription[]>,
      m.fetchProducts({ skus: [IOS_PRODUCTS.lifetime], type: 'in-app' }) as Promise<Iap.Product[]>,
    ]);
    for (const p of [...subs, ...life]) {
      const plan = (Object.keys(IOS_PRODUCTS) as Plan[]).find((k) => IOS_PRODUCTS[k] === p.id);
      if (plan) offers.push({ plan, productId: p.id, kind: plan === 'lifetime' ? 'in-app' : 'subs', price: p.displayPrice, priceAmount: p.price ?? null, currency: p.currency });
    }
  }
  return PLAN_ORDER.flatMap((plan) => offers.filter((o) => o.plan === plan));
}

/**
 * Starts the store purchase sheet. The outcome arrives via `listenToPurchases`.
 * The purchase is tagged with the account's ids so the backend can check it
 * belongs to this user.
 */
export async function buy(offer: Offer, ids: { androidAccountId: string; iosAppAccountToken: string }): Promise<void> {
  const m = lib();
  if (!m || !(await connectStore())) throw new Error(storeAvailability().available ? 'The store is unavailable right now.' : (storeAvailability() as { reason: string }).reason);
  if (offer.kind === 'subs') {
    await m.requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: offer.productId, appAccountToken: ids.iosAppAccountToken },
        google: {
          skus: [offer.productId],
          obfuscatedAccountId: ids.androidAccountId,
          subscriptionOffers: offer.offerToken ? [{ sku: offer.productId, offerToken: offer.offerToken }] : null,
        },
      },
    });
  } else {
    await m.requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku: offer.productId, appAccountToken: ids.iosAppAccountToken },
        google: { skus: [offer.productId], obfuscatedAccountId: ids.androidAccountId },
      },
    });
  }
}

/** Purchase results (success, pending, error, cancel) from the store. */
export function listenToPurchases(onPurchase: (p: StorePurchase) => void, onError: (e: StorePurchaseError) => void): () => void {
  const m = lib();
  if (!m) return () => undefined;
  const a = m.purchaseUpdatedListener(onPurchase);
  const b = m.purchaseErrorListener(onError);
  return () => {
    a.remove();
    b.remove();
  };
}

export function isUserCancelled(e: unknown): boolean {
  const m = lib();
  return !!m && m.isUserCancelledError(e as never);
}

/** Completes the store transaction. Call only after the backend verified it. */
export async function finish(p: StorePurchase): Promise<void> {
  await lib()?.finishTransaction({ purchase: p, isConsumable: false });
}

/** Purchases the store still holds for this store account (restore / unfinished on launch). */
export async function ownedPurchases(restore = false): Promise<StorePurchase[]> {
  const m = lib();
  if (!m || !(await connectStore())) return [];
  if (restore) await m.restorePurchases();
  return m.getAvailablePurchases();
}

/** Opens Google Play / App Store subscription management (cancel, change plan, fix payment). */
export async function openSubscriptionManagement(): Promise<void> {
  const m = lib();
  if (!m) return;
  await m.deepLinkToSubscriptions({ skuAndroid: ANDROID_SUBSCRIPTION_ID, packageNameAndroid: 'app.streaks.mobile' });
}

/** What the backend needs to verify a store purchase. */
export function verificationInput(p: StorePurchase):
  | { platform: 'android'; productId: string; purchaseToken: string }
  | { platform: 'ios'; transactionId: string }
  | null {
  // A device only ever holds purchases from its own store.
  if (Platform.OS === 'android') {
    return p.purchaseToken ? { platform: 'android', productId: p.productId, purchaseToken: p.purchaseToken } : null;
  }
  const transactionId = (p as Iap.PurchaseIOS).transactionId ?? p.id;
  return transactionId ? { platform: 'ios', transactionId } : null;
}
