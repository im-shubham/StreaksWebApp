import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { enforcePlanLimit } from './enforce.js';
import { deriveEntitlement, type Entitlement, type PurchaseRecord } from './entitlement.js';

/**
 * Firestore layout (server-written only; see firestore.rules):
 *   purchases/{key}                  PurchaseRecord, binds one store purchase to one uid
 *   users/{uid}/entitlements/pro     Entitlement, read by the app
 */
export class PurchaseOwnedElsewhereError extends Error {
  constructor() {
    super('This purchase is already linked to a different MOMENTUM account.');
    this.name = 'PurchaseOwnedElsewhereError';
  }
}

export const entitlementRef = (db: Firestore, uid: string) => db.doc(`users/${uid}/entitlements/pro`);

/**
 * Saves a verified purchase. `uid` is the caller (verifyPurchase) or null
 * (store notifications, which only update purchases already bound to a user).
 * The first account to verify a purchase owns it; another account gets
 * PurchaseOwnedElsewhereError. Recomputes the owner's entitlement.
 */
export async function savePurchase(
  db: Firestore,
  purchase: Omit<PurchaseRecord, 'uid' | 'updatedAt'>,
  uid: string | null,
  now: number,
): Promise<{ owner: string | null; entitlement: Entitlement | null }> {
  const ref = db.collection('purchases').doc(purchase.key);
  const owner = await db.runTransaction(async (t) => {
    const existing = (await t.get(ref)).data() as PurchaseRecord | undefined;
    if (existing?.uid && uid && existing.uid !== uid) throw new PurchaseOwnedElsewhereError();
    const finalUid = existing?.uid ?? uid;
    const record: PurchaseRecord = { ...purchase, replacedBy: existing?.replacedBy ?? null, uid: finalUid, updatedAt: now };
    t.set(ref, record);
    return finalUid;
  });
  return { owner, entitlement: owner ? await recomputeEntitlement(db, owner, now) : null };
}

/** Marks an older Play purchase as superseded by an upgrade/downgrade, so it stops granting access. */
export async function markReplaced(db: Firestore, oldKey: string, newKey: string, now: number): Promise<void> {
  const ref = db.collection('purchases').doc(oldKey);
  const snap = await ref.get();
  if (snap.exists) await ref.update({ replacedBy: newKey, updatedAt: now });
}

export async function updatePurchaseState(db: Firestore, key: string, patch: Partial<PurchaseRecord>, now: number): Promise<Entitlement | null> {
  const ref = db.collection('purchases').doc(key);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: now });
  const uid = (snap.data() as PurchaseRecord).uid;
  return uid ? recomputeEntitlement(db, uid, now) : null;
}

/** Rebuilds users/{uid}/entitlements/pro from all of the user's purchases; enforces Free limits on downgrade. */
export async function recomputeEntitlement(db: Firestore, uid: string, now: number): Promise<Entitlement> {
  const snap = await db.collection('purchases').where('uid', '==', uid).get();
  const entitlement = deriveEntitlement(snap.docs.map((d) => d.data() as PurchaseRecord), now);
  await entitlementRef(db, uid).set({ ...entitlement, serverUpdatedAt: FieldValue.serverTimestamp() });
  if (!entitlement.active) await enforcePlanLimit(db, uid, now);
  return entitlement;
}
