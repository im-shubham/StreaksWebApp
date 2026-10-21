/**
 * Store product catalog. Must match src/domain/billing.ts in the app (a test
 * in the app suite checks they agree) and the products created in Play
 * Console / App Store Connect. Prices live in the stores, never here.
 */
export const ANDROID_PACKAGE = 'app.streaks.mobile';
export const IOS_BUNDLE_ID = 'app.streaks.mobile';

export type Plan = 'monthly' | 'yearly' | 'lifetime';

/** Google Play: one subscription with two base plans, plus a one-time product. */
export const ANDROID_SUBSCRIPTION_ID = 'momentum_pro';
export const ANDROID_BASE_PLANS: Record<'monthly' | 'yearly', string> = { monthly: 'monthly', yearly: 'yearly' };
export const LIFETIME_PRODUCT_ID = 'momentum_pro_lifetime';

/** App Store: two auto-renewable subscriptions in one group, plus a non-consumable. */
export const IOS_PRODUCTS: Record<Plan, string> = {
  monthly: 'momentum_pro_monthly',
  yearly: 'momentum_pro_yearly',
  lifetime: 'momentum_pro_lifetime',
};

export function iosPlan(productId: string | null | undefined): Plan | null {
  const hit = (Object.keys(IOS_PRODUCTS) as Plan[]).find((p) => IOS_PRODUCTS[p] === productId);
  return hit ?? null;
}

export function androidPlan(productId: string | null | undefined, basePlanId?: string | null): Plan | null {
  if (productId === LIFETIME_PRODUCT_ID) return 'lifetime';
  if (productId !== ANDROID_SUBSCRIPTION_ID) return null;
  if (basePlanId === ANDROID_BASE_PLANS.monthly) return 'monthly';
  if (basePlanId === ANDROID_BASE_PLANS.yearly) return 'yearly';
  return null;
}
