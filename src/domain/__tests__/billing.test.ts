import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';

import * as server from '../../../functions/src/products';
import {
  accountHashInput,
  androidAccountIdFromHash,
  ANDROID_BASE_PLANS,
  ANDROID_SUBSCRIPTION_ID,
  describeEntitlement,
  IOS_PRODUCTS,
  iosAppAccountTokenFromHash,
  isProActive,
  LIFETIME_PRODUCT_ID,
  type Entitlement,
} from '../billing';
import { effectiveTier } from '../plans';

const NOW = Date.UTC(2026, 9, 21);
const DAY = 86_400_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('catalog', () => {
  it('matches the backend catalog exactly', () => {
    expect(ANDROID_SUBSCRIPTION_ID).toBe(server.ANDROID_SUBSCRIPTION_ID);
    expect(ANDROID_BASE_PLANS).toEqual(server.ANDROID_BASE_PLANS);
    expect(LIFETIME_PRODUCT_ID).toBe(server.LIFETIME_PRODUCT_ID);
    expect(IOS_PRODUCTS).toEqual(server.IOS_PRODUCTS);
  });
});

describe('account binding ids', () => {
  it('match the backend’s vectors for the same uid', () => {
    const hash = sha(accountHashInput('user-123'));
    expect(androidAccountIdFromHash(hash)).toBe('bdb10cd30c9620ca839fe91bfacc4775e15874ae73c6b4cc3f2b9861712715bf');
    expect(iosAppAccountTokenFromHash(hash)).toBe('bdb10cd3-0c96-50ca-839f-e91bfacc4775');
    expect(androidAccountIdFromHash(hash).length).toBeLessThanOrEqual(64);
  });
});

const ent = (o: Partial<Entitlement>): Entitlement => ({
  active: true,
  plan: 'monthly',
  productId: 'momentum_pro',
  platform: 'android',
  state: 'active',
  expiresAt: NOW + 10 * DAY,
  autoRenewing: true,
  environment: 'sandbox',
  updatedAt: NOW,
  ...o,
});

describe('isProActive / effectiveTier', () => {
  it('honours the paid period even without a server update (offline expiry)', () => {
    expect(isProActive(ent({}), NOW)).toBe(true);
    expect(isProActive(ent({}), NOW + 11 * DAY)).toBe(false);
    expect(isProActive(ent({ plan: 'lifetime', expiresAt: null }), NOW + 3650 * DAY)).toBe(true);
    expect(isProActive(ent({ active: false }), NOW)).toBe(false);
    expect(isProActive(null, NOW)).toBe(false);
  });

  it('a cached Pro tier lapses to Free / Guest once the cached period ends', () => {
    const cached = { tier: 'pro' as const, account_uid: 'u', pro_plan: 'monthly' as const, pro_expires_at: NOW + DAY };
    expect(effectiveTier(cached, NOW)).toBe('pro');
    expect(effectiveTier(cached, NOW + 2 * DAY)).toBe('free');
    expect(effectiveTier({ ...cached, account_uid: null }, NOW + 2 * DAY)).toBe('guest');
    expect(effectiveTier({ tier: 'free', account_uid: 'u' }, NOW)).toBe('free');
    expect(effectiveTier({ tier: 'pro', pro_plan: 'lifetime', pro_expires_at: null }, NOW)).toBe('pro');
  });
});

describe('describeEntitlement', () => {
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  it('explains renewals, cancellations and payment problems', () => {
    expect(describeEntitlement(ent({}), NOW, fmt).detail).toBe(`Renews on ${fmt(NOW + 10 * DAY)}.`);
    expect(describeEntitlement(ent({ state: 'canceled', autoRenewing: false }), NOW, fmt).detail).toMatch(/Cancelled\. Pro stays on until/);
    expect(describeEntitlement(ent({ state: 'grace' }), NOW, fmt)).toMatchObject({ title: 'Payment issue', tone: 'warning' });
    expect(describeEntitlement(ent({ state: 'on_hold', active: false }), NOW, fmt)).toMatchObject({ title: 'Payment failed', tone: 'warning' });
    expect(describeEntitlement(ent({ state: 'revoked', active: false }), NOW, fmt).title).toBe('Pro removed');
    expect(describeEntitlement(ent({}), NOW + 11 * DAY, fmt).title).toBe('Pro expired');
    expect(describeEntitlement(ent({ plan: 'lifetime', expiresAt: null }), NOW, fmt).title).toBe('Pro · Lifetime');
    expect(describeEntitlement(null, NOW, fmt).title).toBe('Free plan');
  });
});
