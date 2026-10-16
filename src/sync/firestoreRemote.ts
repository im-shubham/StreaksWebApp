import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import type { RemoteStore } from './types';

/**
 * Firestore layout (see firestore.rules):
 *   users/{uid}/{collection}/{id}   collection ∈ profile, habits, completions, freezeEvents, vacations, milestones
 * Every document carries `serverUpdatedAt` (server timestamp) as the pull cursor.
 */
export function firestoreRemote(db: Firestore): RemoteStore {
  return {
    async push(uid, ops) {
      // Firestore batches allow 500 writes; the engine sends at most 400.
      const batch = writeBatch(db);
      for (const op of ops) {
        batch.set(doc(db, 'users', uid, op.collection, op.id), { ...op.data, serverUpdatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit();
    },

    async pull(uid, name, sinceMs) {
      const q = query(
        collection(db, 'users', uid, name),
        where('serverUpdatedAt', '>', Timestamp.fromMillis(sinceMs)),
        orderBy('serverUpdatedAt'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const { serverUpdatedAt, ...data } = d.data();
        return { id: d.id, data, serverUpdatedAt: (serverUpdatedAt as Timestamp).toMillis() };
      });
    },
  };
}
