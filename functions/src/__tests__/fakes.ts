import { Environment, Status, Type, AutoRenewStatus } from '@apple/app-store-server-library';

import type { AppleNotification, AppleSubscriptionStatus, AppleTransaction, AppStoreApi } from '../apple.js';
import type { PlayApi, ProductPurchase, SubscriptionPurchaseV2 } from '../google.js';

export const DAY = 86_400_000;
export const NOW = Date.UTC(2026, 9, 21, 12);

export function playSub(o: {
  state?: string;
  basePlan?: string;
  expiry?: number;
  autoRenew?: boolean;
  ack?: 'ACKNOWLEDGEMENT_STATE_PENDING' | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  accountId?: string | null;
  test?: boolean;
  linked?: string;
} = {}): SubscriptionPurchaseV2 {
  return {
    subscriptionState: o.state ?? 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: o.ack ?? 'ACKNOWLEDGEMENT_STATE_PENDING',
    startTime: new Date(NOW - DAY).toISOString(),
    linkedPurchaseToken: o.linked ?? null,
    testPurchase: o.test === false ? undefined : {},
    externalAccountIdentifiers: o.accountId === null ? undefined : { obfuscatedExternalAccountId: o.accountId },
    lineItems: [
      {
        productId: 'momentum_pro',
        expiryTime: new Date(o.expiry ?? NOW + 30 * DAY).toISOString(),
        offerDetails: { basePlanId: o.basePlan ?? 'monthly' },
        autoRenewingPlan: { autoRenewEnabled: o.autoRenew ?? true },
      },
    ],
  };
}

export function playProduct(o: { state?: number; ack?: number; accountId?: string | null } = {}): ProductPurchase {
  return {
    productId: 'momentum_pro_lifetime',
    purchaseState: o.state ?? 0,
    acknowledgementState: o.ack ?? 0,
    purchaseType: 0,
    purchaseTimeMillis: String(NOW - DAY),
    obfuscatedExternalAccountId: o.accountId ?? undefined,
  };
}

/** Fake Play API: tokens map to canned responses; records acknowledgements. */
export class FakePlay implements PlayApi {
  subs = new Map<string, SubscriptionPurchaseV2>();
  products = new Map<string, ProductPurchase>();
  acks: string[] = [];
  async getSubscription(token: string) {
    const s = this.subs.get(token);
    if (!s) throw Object.assign(new Error('not found'), { code: 404 });
    return s;
  }
  async getProduct(_id: string, token: string) {
    const p = this.products.get(token);
    if (!p) throw Object.assign(new Error('not found'), { code: 404 });
    return p;
  }
  async acknowledgeSubscription(_id: string, token: string) {
    this.acks.push(token);
  }
  async acknowledgeProduct(_id: string, token: string) {
    this.acks.push(token);
  }
}

export function appleTx(o: Partial<AppleTransaction> = {}): AppleTransaction {
  return {
    bundleId: 'app.streaks.mobile',
    productId: 'momentum_pro_monthly',
    transactionId: '2000000000000001',
    originalTransactionId: '2000000000000001',
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
    purchaseDate: NOW - DAY,
    originalPurchaseDate: NOW - DAY,
    expiresDate: NOW + 29 * DAY,
    environment: Environment.SANDBOX,
    ...o,
  };
}

export function appleStatus(status: Status, tx: AppleTransaction, o: { autoRenew?: boolean; graceUntil?: number } = {}): AppleSubscriptionStatus {
  return {
    status,
    transaction: tx,
    renewal: {
      originalTransactionId: tx.originalTransactionId,
      autoRenewStatus: o.autoRenew === false ? AutoRenewStatus.OFF : AutoRenewStatus.ON,
      gracePeriodExpiresDate: o.graceUntil,
    },
  };
}

/** Fake App Store API: "signed payloads" are just JSON here; verification itself is Apple's library. */
export class FakeApple implements AppStoreApi {
  txs = new Map<string, AppleTransaction>();
  statuses = new Map<string, AppleSubscriptionStatus>();
  async getTransaction(id: string) {
    const t = this.txs.get(id);
    if (!t) throw Object.assign(new Error('not found'), { httpStatusCode: 404 });
    return t;
  }
  async getSubscriptionStatus(originalTransactionId: string) {
    return this.statuses.get(originalTransactionId) ?? null;
  }
  async decodeNotification(signedPayload: string): Promise<AppleNotification> {
    if (!signedPayload.startsWith('{')) throw new Error('signature verification failed');
    return JSON.parse(signedPayload) as AppleNotification;
  }
}
