import * as Crypto from 'expo-crypto';

import { accountHashInput, androidAccountIdFromHash, iosAppAccountTokenFromHash } from '@/domain/billing';
import {
  buy,
  finish,
  isUserCancelled,
  ownedPurchases,
  verificationInput,
  type Offer,
  type StorePurchase,
  type StorePurchaseError,
} from '@/services/billing';
import { verifyOnServer } from '@/services/purchaseApi';
import { getPurchaseStatus, setPurchaseStatus } from './purchaseStatus';

/**
 * Purchase pipeline: store sheet → backend verification → finish.
 *
 * A store transaction is finished (Android: acknowledged, iOS: removed from
 * the queue) only after the backend has verified it and recorded the result.
 * If verification can't run (offline, server down), the transaction stays
 * unfinished and is retried on the next launch; Google refunds purchases
 * that are never acknowledged within 3 days, so a user is never charged for
 * Pro they didn't get.
 */
const inFlight = new Set<string>();

export async function accountIds(uid: string) {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, accountHashInput(uid));
  return { androidAccountId: androidAccountIdFromHash(hash), iosAppAccountToken: iosAppAccountTokenFromHash(hash) };
}

export async function startPurchase(offer: Offer, uid: string): Promise<void> {
  setPurchaseStatus({ state: 'purchasing', plan: offer.plan });
  try {
    await buy(offer, await accountIds(uid));
  } catch (e) {
    onStoreError(e as StorePurchaseError);
  }
}

export function onStoreError(e: StorePurchaseError | unknown) {
  if (isUserCancelled(e)) {
    setPurchaseStatus({ state: 'cancelled' });
    return;
  }
  const message = (e as { message?: string })?.message;
  setPurchaseStatus({ state: 'error', message: message || 'The store couldn’t complete the purchase. You weren’t charged.' });
}

/** A Cloud Functions callable error (FirebaseError with a `functions/...` code). */
function functionsError(e: unknown): { code: string; message: string } | null {
  const c = (e as { code?: unknown })?.code;
  return typeof c === 'string' && c.startsWith('functions/') ? { code: c.slice('functions/'.length), message: (e as Error).message } : null;
}

/** Messages from the backend are written for users; network / unknown errors get a retry hint. */
export function serverErrorMessage(e: unknown): string {
  const f = functionsError(e);
  if (f) {
    const code = f.code;
    if (code === 'unauthenticated') return 'Sign in to buy or restore Momentum Pro.';
    if (['already-exists', 'permission-denied', 'invalid-argument', 'failed-precondition', 'unavailable'].includes(code)) return f.message;
  }
  return 'Couldn’t confirm the purchase with our server. It will be retried automatically next time you open the app.';
}

/** Codes where the purchase must NOT be finished (it isn't ours to grant, or verification didn't happen). */
function mustStayUnfinished(e: unknown): boolean {
  return functionsError(e)?.code !== 'invalid-argument';
}

/**
 * Verifies one store purchase and finishes it when the backend accepted it.
 * `interactive` purchases drive the paywall status; launch / restore runs
 * report through their return value.
 */
export async function processPurchase(p: StorePurchase, interactive: boolean): Promise<'granted' | 'pending' | 'inactive' | 'failed'> {
  const input = verificationInput(p);
  const key = input ? (input.platform === 'android' ? input.purchaseToken : input.transactionId) : null;
  if (!input || !key) {
    if (interactive) setPurchaseStatus({ state: 'error', message: 'The store returned an incomplete purchase. Try Restore Purchases.' });
    return 'failed';
  }
  if (inFlight.has(key)) return 'failed';
  inFlight.add(key);
  const current = getPurchaseStatus();
  const plan = current.state === 'purchasing' ? current.plan : null;
  try {
    if (interactive) setPurchaseStatus({ state: p.purchaseState === 'pending' ? 'pending' : 'verifying', plan });
    // Pending payments are recorded too, so the backend can grant Pro when the store confirms them.
    const result = await verifyOnServer(input);
    if (result.state === 'pending') {
      if (interactive) setPurchaseStatus({ state: 'pending', plan });
      return 'pending';
    }
    await finish(p);
    const granted = result.state === 'active' || result.state === 'canceled' || result.state === 'grace';
    if (interactive) {
      setPurchaseStatus(
        granted ? { state: 'success', plan } : { state: 'error', message: 'This purchase is no longer active (expired or refunded).' },
      );
    }
    return granted ? 'granted' : 'inactive';
  } catch (e) {
    if (!mustStayUnfinished(e)) await finish(p).catch(() => undefined);
    if (interactive) setPurchaseStatus({ state: 'error', message: serverErrorMessage(e) });
    else console.warn('[billing] verification failed', functionsError(e)?.code ?? e);
    return 'failed';
  } finally {
    inFlight.delete(key);
  }
}

/** Unfinished / unacknowledged purchases held by the store (crash mid-purchase, pending payments, iOS replays). */
export async function reconcileOnLaunch(): Promise<void> {
  const owned = await ownedPurchases(false).catch(() => []);
  for (const p of owned) await processPurchase(p, false);
}

export type RestoreOutcome = { found: number; granted: number; firstError: string | null };

/** "Restore Purchases": asks the store for this store account's purchases and re-verifies each one. */
export async function restore(): Promise<RestoreOutcome> {
  const owned = await ownedPurchases(true);
  let granted = 0;
  let firstError: string | null = null;
  for (const p of owned) {
    const input = verificationInput(p);
    if (!input) continue;
    try {
      const r = await verifyOnServer(input);
      if (r.state !== 'pending') await finish(p).catch(() => undefined);
      if (r.state === 'active' || r.state === 'canceled' || r.state === 'grace') granted++;
    } catch (e) {
      firstError ??= serverErrorMessage(e);
    }
  }
  return { found: owned.length, granted, firstError };
}
