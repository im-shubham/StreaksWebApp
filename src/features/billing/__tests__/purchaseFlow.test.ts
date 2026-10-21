import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { processPurchase, restore, startPurchase } from '../purchaseFlow';
import { getPurchaseStatus, setPurchaseStatus } from '../purchaseStatus';

const mockFinish = jest.fn(async (_p: unknown) => undefined);
const mockVerify = jest.fn<(input: unknown) => Promise<{ state: string; entitlement: unknown }>>();
const mockOwned = jest.fn(async (_restore?: boolean): Promise<unknown[]> => []);
const mockBuy = jest.fn(async (_o: unknown, _ids: unknown) => undefined);
let mockCancelled = false;

jest.mock('@/services/billing', () => ({
  finish: (p: unknown) => mockFinish(p),
  buy: (o: unknown, ids: unknown) => mockBuy(o, ids),
  ownedPurchases: (r?: boolean) => mockOwned(r),
  isUserCancelled: () => mockCancelled,
  verificationInput: (p: { purchaseToken?: string; productId: string }) =>
    p.purchaseToken ? { platform: 'android', productId: p.productId, purchaseToken: p.purchaseToken } : null,
}));
jest.mock('@/services/purchaseApi', () => ({ verifyOnServer: (i: unknown) => mockVerify(i) }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_a: string, s: string) => (jest.requireActual('crypto') as typeof import('crypto')).createHash('sha256').update(s).digest('hex'),
}));

const purchase = (token = 'tok', state: 'purchased' | 'pending' = 'purchased') => ({ productId: 'momentum_pro', purchaseToken: token, purchaseState: state }) as never;
/** Shape of the FirebaseError a callable throws. */
const fbErr = (code: string, msg: string) => Object.assign(new Error(msg), { code: `functions/${code}`, name: 'FirebaseError' });

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelled = false;
  setPurchaseStatus({ state: 'idle' });
});

describe('purchase pipeline', () => {
  it('tags the purchase with this account’s store ids', async () => {
    await startPurchase({ plan: 'yearly', productId: 'momentum_pro', kind: 'subs', price: '₹199.00', priceAmount: 199, currency: 'INR', offerToken: 'ot' }, 'user-123');
    expect(mockBuy).toHaveBeenCalledWith(expect.objectContaining({ plan: 'yearly' }), {
      androidAccountId: 'bdb10cd30c9620ca839fe91bfacc4775e15874ae73c6b4cc3f2b9861712715bf',
      iosAppAccountToken: 'bdb10cd3-0c96-50ca-839f-e91bfacc4775',
    });
    expect(getPurchaseStatus()).toEqual({ state: 'purchasing', plan: 'yearly' });
  });

  it('cancelling the store sheet is not an error', async () => {
    mockCancelled = true;
    mockBuy.mockRejectedValueOnce(new Error('user cancelled'));
    await startPurchase({ plan: 'monthly', productId: 'momentum_pro', kind: 'subs', price: '$1.99', priceAmount: 1.99, currency: 'USD' }, 'u');
    expect(getPurchaseStatus()).toEqual({ state: 'cancelled' });
  });

  it('finishes the transaction only after the server verified it', async () => {
    mockVerify.mockImplementationOnce(async () => {
      expect(mockFinish).not.toHaveBeenCalled();
      return { state: 'active', entitlement: { active: true } };
    });
    expect(await processPurchase(purchase(), true)).toBe('granted');
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(getPurchaseStatus().state).toBe('success');
  });

  it('pending payment: recorded on the server, not finished, shown as pending', async () => {
    mockVerify.mockResolvedValueOnce({ state: 'pending', entitlement: null });
    expect(await processPurchase(purchase('p', 'pending'), true)).toBe('pending');
    expect(mockFinish).not.toHaveBeenCalled();
    expect(getPurchaseStatus().state).toBe('pending');
  });

  it('server unreachable: not finished (retried next launch; Play refunds if never acknowledged)', async () => {
    mockVerify.mockRejectedValueOnce(new Error('network'));
    expect(await processPurchase(purchase(), true)).toBe('failed');
    expect(mockFinish).not.toHaveBeenCalled();
    expect(getPurchaseStatus()).toMatchObject({ state: 'error', message: expect.stringMatching(/retried automatically/) });
  });

  it('purchase owned by another account: not finished, server message shown', async () => {
    mockVerify.mockRejectedValueOnce(fbErr('already-exists', 'This purchase is already linked to a different MOMENTUM account.'));
    await processPurchase(purchase(), true);
    expect(mockFinish).not.toHaveBeenCalled();
    expect(getPurchaseStatus()).toEqual({ state: 'error', message: 'This purchase is already linked to a different MOMENTUM account.' });
  });

  it('expired / refunded purchase: finished (clears the queue) but reported as inactive', async () => {
    mockVerify.mockResolvedValueOnce({ state: 'expired', entitlement: { active: false } });
    expect(await processPurchase(purchase(), true)).toBe('inactive');
    expect(mockFinish).toHaveBeenCalled();
    expect(getPurchaseStatus().state).toBe('error');
  });

  it('the same transaction is never verified twice at once (listener + launch reconciliation)', async () => {
    let release!: () => void;
    mockVerify.mockImplementationOnce(() => new Promise((r) => (release = () => r({ state: 'active', entitlement: null }))));
    const first = processPurchase(purchase('same'), false);
    expect(await processPurchase(purchase('same'), false)).toBe('failed');
    release();
    expect(await first).toBe('granted');
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('restore re-verifies everything the store holds and reports the outcome', async () => {
    mockOwned.mockResolvedValueOnce([purchase('a'), purchase('b')]);
    mockVerify.mockResolvedValueOnce({ state: 'active', entitlement: null }).mockRejectedValueOnce(fbErr('already-exists', 'Linked elsewhere.'));
    expect(await restore()).toEqual({ found: 2, granted: 1, firstError: 'Linked elsewhere.' });
    expect(mockOwned).toHaveBeenCalledWith(true);
    mockOwned.mockResolvedValueOnce([]);
    expect(await restore()).toEqual({ found: 0, granted: 0, firstError: null });
  });
});
