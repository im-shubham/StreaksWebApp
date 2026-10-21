import { useSyncExternalStore } from 'react';

import type { Plan } from '@/domain/billing';

/**
 * The purchase in progress, for the paywall (Stitch "Purchase States").
 * Every state reflects a real store / backend event.
 */
export type PurchaseStatus =
  | { state: 'idle' }
  | { state: 'purchasing'; plan: Plan }
  | { state: 'verifying'; plan: Plan | null }
  | { state: 'pending'; plan: Plan | null }
  | { state: 'success'; plan: Plan | null }
  | { state: 'cancelled' }
  | { state: 'error'; message: string };

let status: PurchaseStatus = { state: 'idle' };
const listeners = new Set<() => void>();

export function setPurchaseStatus(next: PurchaseStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export const getPurchaseStatus = () => status;

export function usePurchaseStatus(): PurchaseStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}
