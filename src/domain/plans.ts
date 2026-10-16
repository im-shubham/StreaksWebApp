import type { AccountTier } from './types';

/**
 * Plan limits. The Stitch screens disagree on some of these numbers, so they
 * live here as one product decision rather than being copied from any one
 * screen:
 *
 * - Free active-habit cap: 1 in "Pro Paywall Modal" and "Free Habit Limit &
 *   Upgrade Sheet"; 3 in "Premium Feature Comparison" and "Streaks Pro Paywall".
 * - Guest cap: 3 in "Guest Mode Experience".
 * - Yearly price: $29.99 in the paywall modal, $39.99 elsewhere. Real prices
 *   must come from the store at runtime, never from constants.
 */
export const PLAN_LIMITS: Record<AccountTier, { maxActiveHabits: number; freezeCapacity: number }> = {
  guest: { maxActiveHabits: 3, freezeCapacity: 1 },
  free: { maxActiveHabits: 3, freezeCapacity: 3 },
  pro: { maxActiveHabits: Number.POSITIVE_INFINITY, freezeCapacity: 3 },
};

export function canAddHabit(tier: AccountTier, activeCount: number): boolean {
  return activeCount < PLAN_LIMITS[tier].maxActiveHabits;
}
