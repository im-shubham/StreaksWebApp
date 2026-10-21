import { useSQLiteContext } from 'expo-sqlite';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

import { cacheEntitlement } from '@/db/repositories/profile';
import type { Entitlement } from '@/domain/billing';
import { useAuth } from '@/features/auth/AuthProvider';
import { listenToPurchases, storeAvailability } from '@/services/billing';
import { firestore } from '@/services/firebase';
import { onStoreError, processPurchase, reconcileOnLaunch } from './purchaseFlow';

/**
 * App-wide billing plumbing (renders nothing):
 * - keeps the on-device plan tier in step with the server entitlement
 *   (users/{uid}/entitlements/pro), so renewals, cancellations, payment
 *   failures, refunds and purchases made on another device apply live;
 * - listens for store purchase results and verifies them with the backend;
 * - on launch, re-verifies purchases the store still holds unfinished.
 */
export function BillingCoordinator() {
  const db = useSQLiteContext();
  const { auth } = useAuth();
  const uid = auth.status === 'signedIn' ? auth.user.uid : null;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(firestore(), 'users', uid, 'entitlements', 'pro'),
      (snap) => void cacheEntitlement(db, snap.exists() ? (snap.data() as Entitlement) : null),
      (e) => console.warn('[billing] entitlement listener', e.code),
    );
  }, [db, uid]);

  useEffect(() => {
    if (!uid || !storeAvailability().available) return;
    const stop = listenToPurchases((p) => void processPurchase(p, true), onStoreError);
    void reconcileOnLaunch();
    return stop;
  }, [uid]);

  return null;
}
