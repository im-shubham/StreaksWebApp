import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';

import { appStoreApi, type AppStoreApi } from './apple.js';
import { enforcePlanLimit } from './enforce.js';
import { playApi, type PlayApi } from './google.js';
import { BillingError, handleAppleNotification, handlePlayNotification, parseVerifyInput, verifyPurchase as verify, type Deps, type PlayNotification } from './handlers.js';

initializeApp();

/** App Store Connect API key (In-App Purchase). Set with `firebase functions:secrets:set APPLE_IAP_PRIVATE_KEY`. */
const APPLE_IAP_PRIVATE_KEY = defineSecret('APPLE_IAP_PRIVATE_KEY');
const APPLE_IAP_KEY_ID = defineString('APPLE_IAP_KEY_ID', { default: '' });
const APPLE_IAP_ISSUER_ID = defineString('APPLE_IAP_ISSUER_ID', { default: '' });
/** Numeric Apple ID of the app (App Store Connect → App Information); required to verify production notifications. */
const APPLE_APP_APPLE_ID = defineInt('APPLE_APP_APPLE_ID', { default: 0 });
/** Pub/Sub topic configured in Play Console → Monetization setup → Real-time developer notifications. */
const PLAY_RTDN_TOPIC = 'play-billing';
/**
 * Region of the Firestore database. A Firestore-triggered function must run
 * there (multi-region nam5 → us-central1, eur3 → europe-west1). Written to
 * functions/.env.<projectId> by scripts/setup-firebase.ps1.
 */
const FIRESTORE_REGION = defineString('FIRESTORE_REGION', { default: 'us-central1' });

/** Placeholder secret value used until an App Store Connect In-App Purchase key is added. */
const APPLE_NOT_CONFIGURED = 'not-configured';

let play: PlayApi | undefined;
let apple: AppStoreApi | undefined;
const deps = (): Deps => ({
  db: getFirestore(),
  play: () => (play ??= playApi()),
  apple: () => {
    const privateKey = APPLE_IAP_PRIVATE_KEY.value();
    if (!APPLE_IAP_KEY_ID.value() || !APPLE_IAP_ISSUER_ID.value() || !privateKey || privateKey.trim() === APPLE_NOT_CONFIGURED) {
      throw new BillingError('failed-precondition', 'App Store purchases aren’t set up yet.');
    }
    return (apple ??= appStoreApi({
      privateKey,
      keyId: APPLE_IAP_KEY_ID.value(),
      issuerId: APPLE_IAP_ISSUER_ID.value(),
      appAppleId: APPLE_APP_APPLE_ID.value() || undefined,
    }));
  },
  now: () => Date.now(),
});

/** Called by the app after a store purchase or restore. Requires a signed-in user. */
export const verifyPurchase = onCall({ secrets: [APPLE_IAP_PRIVATE_KEY], maxInstances: 10 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in to buy or restore MOMENTUM Pro.');
  try {
    const input = parseVerifyInput(req.data);
    const result = await verify(deps(), req.auth.uid, input);
    logger.info('purchase verified', { uid: req.auth.uid, platform: input.platform, state: result.state });
    return result;
  } catch (e) {
    if (e instanceof BillingError) throw new HttpsError(e.code, e.message);
    logger.error('verifyPurchase failed', e);
    throw new HttpsError('unavailable', 'Couldn’t confirm the purchase with the store. It will be retried automatically.');
  }
});

/** Google Play Real-time Developer Notifications. */
export const playBillingNotifications = onMessagePublished({ topic: PLAY_RTDN_TOPIC, maxInstances: 10 }, async (event) => {
  const n = event.data.message.json as PlayNotification;
  const outcome = await handlePlayNotification(deps(), n);
  logger.info('play notification', { outcome });
});

/** App Store Server Notifications V2 endpoint (set its URL in App Store Connect). */
export const appStoreNotifications = onRequest({ secrets: [APPLE_IAP_PRIVATE_KEY], maxInstances: 10 }, async (req, res) => {
  const signedPayload = (req.body as { signedPayload?: unknown })?.signedPayload;
  if (req.method !== 'POST' || typeof signedPayload !== 'string') {
    res.status(400).send('expected signedPayload');
    return;
  }
  try {
    const outcome = await handleAppleNotification(deps(), signedPayload);
    logger.info('app store notification', { outcome });
    res.status(200).send('ok');
  } catch (e) {
    logger.error('app store notification rejected', e);
    res.status(400).send('invalid notification');
  }
});

/** Free plan limit, enforced server-side whenever a habit becomes active. */
export const enforceHabitLimit = onDocumentWritten({ document: 'users/{uid}/habits/{habitId}', region: FIRESTORE_REGION }, async (event) => {
  const after = event.data?.after.data();
  if (!after || after.status !== 'active' || after.deletedAt) return;
  const paused = await enforcePlanLimit(getFirestore(), event.params.uid, Date.now());
  if (paused) logger.info('free plan limit enforced', { uid: event.params.uid, paused });
});
