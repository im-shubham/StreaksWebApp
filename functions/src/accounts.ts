import { createHash } from 'node:crypto';

/**
 * Store-side account identifiers derived from the Firebase uid, so a
 * purchase can be tied to the account that made it without sending the uid
 * itself to Google or Apple. The app computes the same values
 * (src/domain/billing.ts); shared test vectors keep them in step.
 */

/** Google Play `obfuscatedAccountId` (max 64 chars): hex SHA-256 of the uid. */
export function androidAccountId(uid: string): string {
  return createHash('sha256').update(`momentum:${uid}`).digest('hex');
}

/** StoreKit `appAccountToken` (must be a UUID): name-based UUID (v5 layout) from SHA-256 of the uid. */
export function iosAppAccountToken(uid: string): string {
  const b = createHash('sha256').update(`momentum:${uid}`).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
