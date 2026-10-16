import type { AccountTier } from './types';

/**
 * Plan limits.
 *
 * - Free: 1 active habit ("Pro Paywall Modal", "Free Habit Limit & Upgrade
 *   Sheet": "The Free plan supports 1 active habit"). Product decision
 *   confirmed by the owner; screens that say 3 are outdated.
 * - Guest: same cap as Free, so staying signed out is never better than
 *   registering. ("Guest Mode Experience" shows 3; superseded.)
 * - Pro: deferred (purchases not implemented yet).
 *
 * Real prices must come from the store at runtime, never from constants.
 */
export const PLAN_LIMITS: Record<AccountTier, { maxActiveHabits: number; freezeCapacity: number }> = {
  guest: { maxActiveHabits: 1, freezeCapacity: 1 },
  free: { maxActiveHabits: 1, freezeCapacity: 3 },
  pro: { maxActiveHabits: Number.POSITIVE_INFINITY, freezeCapacity: 3 },
};

export function canAddHabit(tier: AccountTier, activeCount: number): boolean {
  return activeCount < PLAN_LIMITS[tier].maxActiveHabits;
}

export class HabitLimitError extends Error {
  constructor(public readonly tier: AccountTier) {
    super(`The ${tier === 'pro' ? 'Pro' : 'Free'} plan supports ${PLAN_LIMITS[tier].maxActiveHabits} active habit.`);
    this.name = 'HabitLimitError';
  }
}
