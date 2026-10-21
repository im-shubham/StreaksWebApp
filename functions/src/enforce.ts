import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import type { Entitlement } from './entitlement.js';

/** Must match PLAN_LIMITS.free in src/domain/plans.ts. */
export const FREE_MAX_ACTIVE_HABITS = 1;

type HabitDoc = { status?: string; isPrimary?: number; createdAt?: number; deletedAt?: number | null };

export function isProNow(e: Partial<Entitlement> | undefined, now: number): boolean {
  return !!e?.active && (e.plan === 'lifetime' || (e.expiresAt ?? 0) > now);
}

/**
 * Server-side Free plan limit. Without an active Pro entitlement, a user
 * keeps at most one active habit: the pinned (primary) one, else the oldest.
 * Extra active habits are paused, never deleted, with a fresh updatedAt and
 * serverUpdatedAt so every device pulls the change (sync is last-write-wins).
 * Returns the number of habits paused.
 */
export async function enforcePlanLimit(db: Firestore, uid: string, now: number): Promise<number> {
  const entitlement = (await db.doc(`users/${uid}/entitlements/pro`).get()).data() as Partial<Entitlement> | undefined;
  if (isProNow(entitlement, now)) return 0;
  const snap = await db.collection(`users/${uid}/habits`).where('status', '==', 'active').get();
  const active = snap.docs.filter((d) => !(d.data() as HabitDoc).deletedAt);
  if (active.length <= FREE_MAX_ACTIVE_HABITS) return 0;
  active.sort((a, b) => {
    const x = a.data() as HabitDoc;
    const y = b.data() as HabitDoc;
    return (y.isPrimary ?? 0) - (x.isPrimary ?? 0) || (x.createdAt ?? 0) - (y.createdAt ?? 0);
  });
  const batch = db.batch();
  for (const d of active.slice(FREE_MAX_ACTIVE_HABITS)) {
    batch.update(d.ref, { status: 'paused', isPrimary: 0, updatedAt: now, serverUpdatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  return active.length - FREE_MAX_ACTIVE_HABITS;
}
