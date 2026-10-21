import {
  APIException,
  AppStoreServerAPIClient,
  AutoRenewStatus,
  Environment,
  SignedDataVerifier,
  Status,
  Type,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { PurchaseRecord, PurchaseState } from './entitlement.js';
import { IOS_BUNDLE_ID, iosPlan } from './products.js';

export type AppleTransaction = JWSTransactionDecodedPayload;
export type AppleRenewal = JWSRenewalInfoDecodedPayload;
export type AppleSubscriptionStatus = { status: number; transaction: AppleTransaction; renewal: AppleRenewal | null };
export type AppleNotification = {
  notificationType: string;
  subtype: string | null;
  transaction: AppleTransaction | null;
};

/** The App Store Server API / JWS calls the backend needs (faked in tests). All results are signature-verified. */
export interface AppStoreApi {
  getTransaction(transactionId: string): Promise<AppleTransaction>;
  getSubscriptionStatus(originalTransactionId: string): Promise<AppleSubscriptionStatus | null>;
  decodeNotification(signedPayload: string): Promise<AppleNotification>;
}

export type AppleConfig = { privateKey: string; keyId: string; issuerId: string; appAppleId?: number; bundleId?: string };

function rootCertificates(): Buffer[] {
  const dir = path.join(__dirname, '..', 'certs');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.cer'))
    .map((f) => readFileSync(path.join(dir, f)));
}

/**
 * Real client. Calls Production first and falls back to Sandbox for
 * TestFlight / sandbox-tester transactions, as Apple recommends.
 */
export function appStoreApi(cfg: AppleConfig): AppStoreApi {
  const bundleId = cfg.bundleId ?? IOS_BUNDLE_ID;
  const envs = [Environment.PRODUCTION, Environment.SANDBOX] as const;
  const certs = rootCertificates();
  const clients = new Map(envs.map((e) => [e, new AppStoreServerAPIClient(cfg.privateKey, cfg.keyId, cfg.issuerId, bundleId, e)]));
  const verifiers = new Map(envs.map((e) => [e, new SignedDataVerifier(certs, true, e, bundleId, e === Environment.PRODUCTION ? cfg.appAppleId : undefined)]));

  async function inEitherEnv<T>(fn: (env: Environment) => Promise<T>): Promise<T> {
    try {
      return await fn(Environment.PRODUCTION);
    } catch (e) {
      if (e instanceof APIException && e.httpStatusCode === 404) return fn(Environment.SANDBOX);
      throw e;
    }
  }

  return {
    getTransaction: (id) =>
      inEitherEnv(async (env) => {
        const res = await clients.get(env as (typeof envs)[number])!.getTransactionInfo(id);
        return verifiers.get(env as (typeof envs)[number])!.verifyAndDecodeTransaction(res.signedTransactionInfo!);
      }),
    getSubscriptionStatus: (originalTransactionId) =>
      inEitherEnv(async (env) => {
        const res = await clients.get(env as (typeof envs)[number])!.getAllSubscriptionStatuses(originalTransactionId);
        const verifier = verifiers.get(env as (typeof envs)[number])!;
        const last = res.data?.flatMap((g) => g.lastTransactions ?? []).find((t) => t.originalTransactionId === originalTransactionId);
        if (!last?.signedTransactionInfo) return null;
        return {
          status: Number(last.status),
          transaction: await verifier.verifyAndDecodeTransaction(last.signedTransactionInfo),
          renewal: last.signedRenewalInfo ? await verifier.verifyAndDecodeRenewalInfo(last.signedRenewalInfo) : null,
        };
      }),
    async decodeNotification(signedPayload) {
      let lastError: unknown;
      for (const env of envs) {
        try {
          const verifier = verifiers.get(env)!;
          const n = await verifier.verifyAndDecodeNotification(signedPayload);
          const tx = n.data?.signedTransactionInfo ? await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo) : null;
          return { notificationType: String(n.notificationType ?? ''), subtype: n.subtype ? String(n.subtype) : null, transaction: tx };
        } catch (e) {
          lastError = e; // wrong environment for this payload; try the other one
        }
      }
      throw lastError;
    },
  };
}

export const iosKey = (originalTransactionId: string) => `ios_${originalTransactionId}`;

export type MappedApplePurchase = Omit<PurchaseRecord, 'uid' | 'updatedAt'> & { appAccountToken: string | null };

/**
 * Lifetime: active unless refunded/revoked. Subscriptions: from the
 * subscription status when available (active / billing retry / grace /
 * expired / revoked), else from the transaction's own expiry.
 */
export function mapAppleTransaction(tx: AppleTransaction, status: AppleSubscriptionStatus | null, now: number): MappedApplePurchase | null {
  const plan = iosPlan(tx.productId);
  if (!plan || !tx.originalTransactionId || tx.bundleId !== IOS_BUNDLE_ID) return null;
  const environment = tx.environment === Environment.PRODUCTION ? 'production' : 'sandbox';
  const base = {
    key: iosKey(tx.originalTransactionId),
    platform: 'ios' as const,
    plan,
    productId: tx.productId!,
    environment: environment as 'production' | 'sandbox',
    purchasedAt: tx.originalPurchaseDate ?? tx.purchaseDate ?? null,
    storeRef: tx.originalTransactionId,
    appAccountToken: tx.appAccountToken ?? null,
  };

  if (plan === 'lifetime' || tx.type === Type.NON_CONSUMABLE) {
    return { ...base, plan: 'lifetime', state: tx.revocationDate ? 'revoked' : 'active', expiresAt: null, autoRenewing: false };
  }

  const latest = status?.transaction ?? tx;
  const renewal = status?.renewal ?? null;
  const autoRenewing = renewal ? renewal.autoRenewStatus === AutoRenewStatus.ON : false;
  let state: PurchaseState;
  let expiresAt = latest.expiresDate ?? null;
  switch (status?.status) {
    case Status.ACTIVE:
      state = autoRenewing ? 'active' : 'canceled';
      break;
    case Status.BILLING_GRACE_PERIOD:
      state = 'grace';
      expiresAt = renewal?.gracePeriodExpiresDate ?? expiresAt;
      break;
    case Status.BILLING_RETRY:
      state = 'on_hold';
      break;
    case Status.REVOKED:
      state = 'revoked';
      break;
    case Status.EXPIRED:
      state = 'expired';
      break;
    default:
      state = latest.revocationDate ? 'revoked' : (expiresAt ?? 0) > now ? (autoRenewing ? 'active' : 'canceled') : 'expired';
  }
  return { ...base, productId: latest.productId ?? base.productId, plan: iosPlan(latest.productId) ?? plan, state, expiresAt, autoRenewing };
}
