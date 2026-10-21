import { Status, Type } from '@apple/app-store-server-library';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { androidAccountId, iosAppAccountToken } from '../accounts.js';
import { mapAppleTransaction } from '../apple.js';
import { deriveEntitlement, grantsAccess, type PurchaseRecord } from '../entitlement.js';
import { mapProduct, mapSubscription } from '../google.js';
import { androidPlan, iosPlan } from '../products.js';
import { appleStatus, appleTx, DAY, NOW, playProduct, playSub } from './fakes.js';

const rec = (o: Partial<PurchaseRecord>): PurchaseRecord => ({
  key: 'k',
  uid: 'u',
  platform: 'android',
  plan: 'monthly',
  productId: 'momentum_pro',
  state: 'active',
  expiresAt: NOW + DAY,
  autoRenewing: true,
  environment: 'sandbox',
  purchasedAt: NOW - DAY,
  storeRef: 't',
  updatedAt: NOW,
  ...o,
});

describe('account binding ids', () => {
  it('are stable, store-safe and shared with the app (same vectors in src/domain/__tests__/billing.test.ts)', () => {
    // sha256("momentum:user-123"), cross-checked with `sha256sum`.
    assert.equal(androidAccountId('user-123'), 'bdb10cd30c9620ca839fe91bfacc4775e15874ae73c6b4cc3f2b9861712715bf');
    assert.equal(iosAppAccountToken('user-123'), 'bdb10cd3-0c96-50ca-839f-e91bfacc4775');
    assert.match(iosAppAccountToken('user-123'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(iosAppAccountToken('a'), iosAppAccountToken('b'));
  });
});

describe('catalog', () => {
  it('maps store products to plans', () => {
    assert.equal(androidPlan('momentum_pro', 'monthly'), 'monthly');
    assert.equal(androidPlan('momentum_pro', 'yearly'), 'yearly');
    assert.equal(androidPlan('momentum_pro_lifetime'), 'lifetime');
    assert.equal(androidPlan('momentum_pro', 'weekly'), null);
    assert.equal(androidPlan('coins_100'), null);
    assert.equal(iosPlan('momentum_pro_yearly'), 'yearly');
    assert.equal(iosPlan('other'), null);
  });
});

describe('entitlement rules', () => {
  it('grants access while active, cancelled-but-paid or in grace; not on hold, paused, pending, expired or revoked', () => {
    assert.equal(grantsAccess(rec({ state: 'active' }), NOW), true);
    assert.equal(grantsAccess(rec({ state: 'canceled' }), NOW), true);
    assert.equal(grantsAccess(rec({ state: 'canceled', expiresAt: NOW - 1 }), NOW), false);
    assert.equal(grantsAccess(rec({ state: 'grace' }), NOW), true);
    for (const state of ['on_hold', 'paused', 'pending', 'expired', 'revoked'] as const) assert.equal(grantsAccess(rec({ state }), NOW), false, state);
    assert.equal(grantsAccess(rec({ state: 'active', expiresAt: NOW - 1 }), NOW), false, 'past expiry without a renewal');
    assert.equal(grantsAccess(rec({ plan: 'lifetime', expiresAt: null }), NOW), true);
    assert.equal(grantsAccess(rec({ replacedBy: 'newer' }), NOW), false);
  });

  it('prefers lifetime, then the longest subscription, and reports the latest state when nothing grants access', () => {
    const monthly = rec({ key: 'm', expiresAt: NOW + 5 * DAY });
    const yearly = rec({ key: 'y', plan: 'yearly', expiresAt: NOW + 300 * DAY });
    const lifetime = rec({ key: 'l', plan: 'lifetime', productId: 'momentum_pro_lifetime', expiresAt: null });
    assert.equal(deriveEntitlement([monthly, yearly], NOW).plan, 'yearly');
    assert.equal(deriveEntitlement([monthly, yearly, lifetime], NOW).plan, 'lifetime');
    const held = deriveEntitlement([rec({ state: 'on_hold', updatedAt: NOW })], NOW);
    assert.deepEqual([held.active, held.state], [false, 'on_hold']);
    assert.deepEqual(deriveEntitlement([], NOW), { active: false, plan: null, productId: null, platform: null, state: 'none', expiresAt: null, autoRenewing: false, environment: null, updatedAt: NOW });
  });
});

describe('Google Play mapping', () => {
  it('maps subscription states, plan, expiry, auto-renew, test purchases and acknowledgement', () => {
    const m = mapSubscription(playSub({ basePlan: 'yearly', accountId: 'acc' }), 'tok')!;
    assert.deepEqual([m.plan, m.state, m.autoRenewing, m.environment, m.needsAcknowledge, m.accountId], ['yearly', 'active', true, 'sandbox', true, 'acc']);
    assert.equal(m.expiresAt, NOW + 30 * DAY);
    const states: Record<string, string> = {
      SUBSCRIPTION_STATE_CANCELED: 'canceled',
      SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
      SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
      SUBSCRIPTION_STATE_PAUSED: 'paused',
      SUBSCRIPTION_STATE_PENDING: 'pending',
      SUBSCRIPTION_STATE_EXPIRED: 'expired',
      SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
    };
    for (const [s, expected] of Object.entries(states)) assert.equal(mapSubscription(playSub({ state: s }), 'tok')!.state, expected, s);
    assert.equal(mapSubscription(playSub({ state: 'SUBSCRIPTION_STATE_PENDING' }), 'tok')!.needsAcknowledge, false, 'pending purchases cannot be acknowledged');
    assert.equal(mapSubscription(playSub({ ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }), 'tok')!.needsAcknowledge, false);
    assert.equal(mapSubscription(playSub({ basePlan: 'weekly' }), 'tok'), null);
  });

  it('maps the lifetime one-time product, including pending and refunded', () => {
    assert.deepEqual(
      (({ plan, state, expiresAt, needsAcknowledge }) => ({ plan, state, expiresAt, needsAcknowledge }))(mapProduct(playProduct(), 'tok')!),
      { plan: 'lifetime', state: 'active', expiresAt: null, needsAcknowledge: true },
    );
    assert.equal(mapProduct(playProduct({ state: 2 }), 'tok')!.state, 'pending');
    assert.equal(mapProduct(playProduct({ state: 1 }), 'tok')!.state, 'revoked');
  });
});

describe('App Store mapping', () => {
  it('maps subscription statuses including grace and billing retry', () => {
    const tx = appleTx();
    assert.equal(mapAppleTransaction(tx, appleStatus(Status.ACTIVE, tx), NOW)!.state, 'active');
    assert.equal(mapAppleTransaction(tx, appleStatus(Status.ACTIVE, tx, { autoRenew: false }), NOW)!.state, 'canceled');
    const grace = mapAppleTransaction(tx, appleStatus(Status.BILLING_GRACE_PERIOD, tx, { graceUntil: NOW + 6 * DAY }), NOW)!;
    assert.deepEqual([grace.state, grace.expiresAt], ['grace', NOW + 6 * DAY]);
    assert.equal(mapAppleTransaction(tx, appleStatus(Status.BILLING_RETRY, tx), NOW)!.state, 'on_hold');
    assert.equal(mapAppleTransaction(tx, appleStatus(Status.EXPIRED, tx), NOW)!.state, 'expired');
    assert.equal(mapAppleTransaction(tx, appleStatus(Status.REVOKED, tx), NOW)!.state, 'revoked');
  });

  it('maps lifetime (non-consumable) and its refund; rejects other apps', () => {
    const life = appleTx({ productId: 'momentum_pro_lifetime', type: Type.NON_CONSUMABLE, expiresDate: undefined });
    assert.deepEqual([mapAppleTransaction(life, null, NOW)!.plan, mapAppleTransaction(life, null, NOW)!.state], ['lifetime', 'active']);
    assert.equal(mapAppleTransaction({ ...life, revocationDate: NOW }, null, NOW)!.state, 'revoked');
    assert.equal(mapAppleTransaction(appleTx({ bundleId: 'com.other.app' }), null, NOW), null);
  });
});
