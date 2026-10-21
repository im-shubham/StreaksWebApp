import { isProActive, type Plan } from './billing';
import type { AccountTier } from './types';

/**
 * Plan limits.
 *
 * - Free: 1 active habit ("Pro Paywall Modal", "Free Habit Limit & Upgrade
 *   Sheet": "The Free plan supports 1 active habit"). Product decision
 *   confirmed by the owner; screens that say 3 are outdated.
 * - Guest: same cap as Free, so staying signed out is never better than
 *   registering. ("Guest Mode Experience" shows 3; superseded.)
 * - Pro: unlimited active habits. Granted only by the backend after it
 *   verifies a store purchase (see src/domain/billing.ts, functions/).
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

/**
 * The tier to enforce right now. A cached 'pro' tier lapses on its own once
 * the cached paid period has passed, even offline, until the server says
 * otherwise (renewals push a new expiry).
 */
export function effectiveTier(
  p: { tier: AccountTier; account_uid?: string | null; pro_plan?: Plan | null; pro_expires_at?: number | null } | null | undefined,
  now: number = Date.now(),
): AccountTier {
  if (!p) return 'guest';
  if (p.tier !== 'pro') return p.tier;
  if (isProActive({ active: true, plan: p.pro_plan ?? null, expiresAt: p.pro_expires_at ?? null }, now)) return 'pro';
  return p.account_uid ? 'free' : 'guest';
}
