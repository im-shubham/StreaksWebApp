import { httpsCallable } from 'firebase/functions';

import type { Entitlement, PurchaseState } from '@/domain/billing';
import { cloudFunctions } from './firebase';

export type VerifyInput =
  | { platform: 'android'; productId: string; purchaseToken: string }
  | { platform: 'ios'; transactionId: string };

export type VerifyResult = { state: PurchaseState; entitlement: Entitlement | null };

/**
 * Asks the backend (functions/src/handlers.ts) to verify a store purchase with
 * Google Play / the App Store and grant Pro to the signed-in account.
 * Throws a FirebaseError whose message is safe to show.
 */
export async function verifyOnServer(input: VerifyInput): Promise<VerifyResult> {
  const call = httpsCallable<VerifyInput, VerifyResult>(cloudFunctions(), 'verifyPurchase');
  return (await call(input)).data;
}
