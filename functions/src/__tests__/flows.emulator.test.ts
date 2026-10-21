/**
 * Purchase flows end to end against the Firestore emulator: real Firestore
 * transactions and queries, the real handlers and store/enforcement code,
 * with Google Play / App Store APIs replaced by fakes.
 *
 *   cd functions && npm run test:emulator
 */
import { Status, Type } from '@apple/app-store-server-library';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { androidAccountId, iosAppAccountToken } from '../accounts.js';
import { enforcePlanLimit } from '../enforce.js';
import type { Entitlement, PurchaseRecord } from '../entitlement.js';
import { androidKey } from '../google.js';
import { BillingError, handleAppleNotification, handlePlayNotification, verifyPurchase, type Deps } from '../handlers.js';
import { appleStatus, appleTx, DAY, FakeApple, FakePlay, NOW, playProduct, playSub } from './fakes.js';

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;

describe('purchase flows (Firestore emulator)', { skip: !enabled && 'set FIRESTORE_EMULATOR_HOST (npm run test:emulator)' }, () => {
  let app: App;
  let db: Firestore;
  let play: FakePlay;
  let apple: FakeApple;
  let clock: number;
  let deps: Deps;

  const entitlement = async (uid: string) => (await db.doc(`users/${uid}/entitlements/pro`).get()).data() as Entitlement | undefined;
  const purchase = async (key: string) => (await db.doc(`purchases/${key}`).get()).data() as PurchaseRecord | undefined;
  const rtdn = (token: string, notificationType = 2) =>
    handlePlayNotification(deps, { packageName: 'app.streaks.mobile', subscriptionNotification: { notificationType, purchaseToken: token, subscriptionId: 'momentum_pro' } });
  const habit = (uid: string, id: string, o: Record<string, unknown>) =>
    db.doc(`users/${uid}/habits/${id}`).set({ status: 'active', isPrimary: 0, createdAt: NOW, updatedAt: NOW, deletedAt: null, ...o });

  before(() => {
    app = initializeApp({ projectId: 'demo-momentum' }, `t${Date.now()}`);
    db = getFirestore(app);
  });
  after(async () => {
    await deleteApp(app);
  });
  beforeEach(async () => {
    await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-momentum/databases/(default)/documents`, { method: 'DELETE' });
    play = new FakePlay();
    apple = new FakeApple();
    clock = NOW;
    deps = { db, play: () => play, apple: () => apple, now: () => clock };
  });

  it('Android monthly: verifies, binds, acknowledges, grants Pro; renewals and cancellation flow through notifications', async () => {
    play.subs.set('tok1', playSub({ accountId: androidAccountId('alice') }));
    const r = await verifyPurchase(deps, 'alice', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok1' });
    assert.equal(r.state, 'active');
    assert.equal(r.entitlement?.active, true);
    assert.deepEqual(play.acks, ['tok1']);
    assert.equal((await purchase(androidKey('tok1')))?.uid, 'alice');
    assert.equal((await entitlement('alice'))?.plan, 'monthly');

    // Renewal (SUBSCRIPTION_RENEWED = 2): new expiry.
    play.subs.set('tok1', playSub({ accountId: androidAccountId('alice'), expiry: NOW + 60 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok1', 2);
    assert.equal((await entitlement('alice'))?.expiresAt, NOW + 60 * DAY);

    // Cancelled (3): keeps access until expiry, then loses it.
    play.subs.set('tok1', playSub({ state: 'SUBSCRIPTION_STATE_CANCELED', autoRenew: false, expiry: NOW + 60 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok1', 3);
    const cancelled = await entitlement('alice');
    assert.deepEqual([cancelled?.active, cancelled?.state, cancelled?.autoRenewing], [true, 'canceled', false]);

    clock = NOW + 61 * DAY;
    play.subs.set('tok1', playSub({ state: 'SUBSCRIPTION_STATE_EXPIRED', autoRenew: false, expiry: NOW + 60 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok1', 13);
    assert.deepEqual([(await entitlement('alice'))?.active, (await entitlement('alice'))?.state], [false, 'expired']);
  });

  it('failed renewal: grace keeps Pro, account hold removes it and the Free limit pauses extra habits (primary kept)', async () => {
    play.subs.set('tok', playSub({ accountId: androidAccountId('bob') }));
    await verifyPurchase(deps, 'bob', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok' });
    await habit('bob', 'h1', { createdAt: NOW - 3 * DAY });
    await habit('bob', 'h2', { createdAt: NOW - 2 * DAY, isPrimary: 1 });
    await habit('bob', 'h3', { createdAt: NOW - DAY });
    await habit('bob', 'gone', { createdAt: NOW, deletedAt: NOW });

    play.subs.set('tok', playSub({ state: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', expiry: NOW + 3 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok', 6);
    assert.deepEqual([(await entitlement('bob'))?.active, (await entitlement('bob'))?.state], [true, 'grace']);
    assert.equal((await db.doc('users/bob/habits/h3').get()).data()?.status, 'active', 'nothing paused while in grace');

    play.subs.set('tok', playSub({ state: 'SUBSCRIPTION_STATE_ON_HOLD', expiry: NOW - 1, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok', 5);
    assert.deepEqual([(await entitlement('bob'))?.active, (await entitlement('bob'))?.state], [false, 'on_hold']);
    const status = async (id: string) => (await db.doc(`users/bob/habits/${id}`).get()).data();
    assert.equal((await status('h2'))?.status, 'active', 'primary habit stays active');
    assert.equal((await status('h1'))?.status, 'paused');
    assert.equal((await status('h3'))?.status, 'paused');
    assert.equal((await status('h1'))?.updatedAt, clock, 'fresh updatedAt so devices pull the pause');
    assert.ok((await status('h1'))?.serverUpdatedAt, 'serverUpdatedAt set for the sync cursor');

    // Payment fixed → active again (habits stay paused; the user resumes what they want).
    play.subs.set('tok', playSub({ expiry: NOW + 30 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await rtdn('tok', 1);
    assert.equal((await entitlement('bob'))?.active, true);
  });

  it('one purchase unlocks one account: restore from another account is refused; obfuscated account mismatch is refused', async () => {
    play.subs.set('tok', playSub({ accountId: null }));
    await verifyPurchase(deps, 'alice', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok' });
    await assert.rejects(verifyPurchase(deps, 'mallory', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok' }), (e: unknown) => e instanceof BillingError && e.code === 'already-exists');
    assert.equal((await entitlement('mallory')), undefined);

    play.subs.set('tok2', playSub({ accountId: androidAccountId('alice') }));
    await assert.rejects(verifyPurchase(deps, 'mallory', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok2' }), (e: unknown) => e instanceof BillingError && e.code === 'permission-denied');

    // Same account restoring again is fine and idempotent.
    const again = await verifyPurchase(deps, 'alice', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'tok' });
    assert.equal(again.entitlement?.active, true);
  });

  it('pending payment (e.g. UPI pending): no Pro, no acknowledgement, granted once Play reports it paid', async () => {
    play.products.set('ptok', playProduct({ state: 2, accountId: androidAccountId('carol') }));
    const r = await verifyPurchase(deps, 'carol', { platform: 'android', productId: 'momentum_pro_lifetime', purchaseToken: 'ptok' });
    assert.deepEqual([r.state, r.entitlement?.active, play.acks.length], ['pending', false, 0]);

    play.products.set('ptok', playProduct({ state: 0, accountId: androidAccountId('carol') }));
    await handlePlayNotification(deps, { packageName: 'app.streaks.mobile', oneTimeProductNotification: { notificationType: 1, purchaseToken: 'ptok', sku: 'momentum_pro_lifetime' } });
    const e = await entitlement('carol');
    assert.deepEqual([e?.active, e?.plan], [true, 'lifetime']);
    // The app's next verify (on launch) acknowledges it.
    await verifyPurchase(deps, 'carol', { platform: 'android', productId: 'momentum_pro_lifetime', purchaseToken: 'ptok' });
    assert.deepEqual(play.acks, ['ptok']);
  });

  it('refund / chargeback (voided purchase) revokes Pro', async () => {
    play.products.set('ltok', playProduct({ accountId: androidAccountId('dan') }));
    await verifyPurchase(deps, 'dan', { platform: 'android', productId: 'momentum_pro_lifetime', purchaseToken: 'ltok' });
    assert.equal((await entitlement('dan'))?.active, true);
    await handlePlayNotification(deps, { packageName: 'app.streaks.mobile', voidedPurchaseNotification: { purchaseToken: 'ltok', productType: 2 } });
    assert.deepEqual([(await entitlement('dan'))?.active, (await entitlement('dan'))?.state], [false, 'revoked']);
  });

  it('upgrade monthly → yearly: the old token is superseded', async () => {
    play.subs.set('m', playSub({ accountId: androidAccountId('erin') }));
    await verifyPurchase(deps, 'erin', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'm' });
    play.subs.set('y', playSub({ basePlan: 'yearly', expiry: NOW + 365 * DAY, linked: 'm', accountId: androidAccountId('erin') }));
    await verifyPurchase(deps, 'erin', { platform: 'android', productId: 'momentum_pro', purchaseToken: 'y' });
    assert.equal((await purchase(androidKey('m')))?.replacedBy, androidKey('y'));
    assert.equal((await entitlement('erin'))?.plan, 'yearly');
  });

  it('notifications for unknown products, other apps and test pings change nothing', async () => {
    assert.equal(await handlePlayNotification(deps, { testNotification: { version: '1.0' } }), 'test');
    assert.equal(await handlePlayNotification(deps, { packageName: 'com.other', subscriptionNotification: { purchaseToken: 'x' } }), 'ignored: other package');
    assert.equal((await db.collection('purchases').get()).size, 0);
  });

  it('iOS yearly: verified via App Store Server API, bound by appAccountToken, billing retry then refund', async () => {
    const tx = appleTx({ productId: 'momentum_pro_yearly', appAccountToken: iosAppAccountToken('fay'), expiresDate: NOW + 365 * DAY });
    apple.txs.set(tx.transactionId!, tx);
    apple.statuses.set(tx.originalTransactionId!, appleStatus(Status.ACTIVE, tx));
    const r = await verifyPurchase(deps, 'fay', { platform: 'ios', transactionId: tx.transactionId! });
    assert.deepEqual([r.state, r.entitlement?.plan, r.entitlement?.active], ['active', 'yearly', true]);

    await assert.rejects(verifyPurchase(deps, 'gus', { platform: 'ios', transactionId: tx.transactionId! }), (e: unknown) => e instanceof BillingError && e.code === 'permission-denied');

    apple.statuses.set(tx.originalTransactionId!, appleStatus(Status.BILLING_RETRY, tx));
    await handleAppleNotification(deps, JSON.stringify({ notificationType: 'DID_FAIL_TO_RENEW', subtype: null, transaction: tx }));
    assert.deepEqual([(await entitlement('fay'))?.active, (await entitlement('fay'))?.state], [false, 'on_hold']);

    apple.statuses.set(tx.originalTransactionId!, appleStatus(Status.REVOKED, { ...tx, revocationDate: NOW }));
    await handleAppleNotification(deps, JSON.stringify({ notificationType: 'REFUND', subtype: null, transaction: tx }));
    assert.equal((await entitlement('fay'))?.state, 'revoked');
  });

  it('iOS lifetime restore on a new device; an unverifiable notification is rejected', async () => {
    const life = appleTx({ productId: 'momentum_pro_lifetime', type: Type.NON_CONSUMABLE, transactionId: '9', originalTransactionId: '9', expiresDate: undefined });
    apple.txs.set('9', life);
    await verifyPurchase(deps, 'hal', { platform: 'ios', transactionId: '9' });
    const restored = await verifyPurchase(deps, 'hal', { platform: 'ios', transactionId: '9' });
    assert.deepEqual([restored.entitlement?.active, restored.entitlement?.plan], [true, 'lifetime']);
    await assert.rejects(handleAppleNotification(deps, 'forged.jws.payload'));
  });

  it('enforcePlanLimit leaves Pro users and single-habit Free users alone', async () => {
    play.subs.set('t', playSub({ accountId: androidAccountId('ivy') }));
    await verifyPurchase(deps, 'ivy', { platform: 'android', productId: 'momentum_pro', purchaseToken: 't' });
    await habit('ivy', 'a', {});
    await habit('ivy', 'b', {});
    assert.equal(await enforcePlanLimit(db, 'ivy', clock), 0);
    await habit('jo', 'only', {});
    assert.equal(await enforcePlanLimit(db, 'jo', clock), 0);
    await habit('jo', 'second', { createdAt: NOW + 1 });
    assert.equal(await enforcePlanLimit(db, 'jo', clock), 1);
    assert.equal((await db.doc('users/jo/habits/second').get()).data()?.status, 'paused');
  });
});
