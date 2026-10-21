import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Offer } from '@/services/billing';
import { PaywallScreen, yearlySavings } from '../PaywallScreen';
import { setPurchaseStatus } from '../purchaseStatus';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
let mockAuth: { status: string; user?: { uid: string } } = { status: 'signedIn', user: { uid: 'u1' } };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ auth: mockAuth }) }));
let mockProfile: Record<string, unknown> = { tier: 'free', account_uid: 'u1' };
jest.mock('@/db/live', () => ({ useLiveQuery: () => [mockProfile] }));

let mockAvailability: { available: boolean; reason?: string } = { available: true };
let mockOffers: Offer[] = [];
const mockStart = jest.fn(async (_o: unknown, _uid: unknown) => undefined);
jest.mock('@/services/billing', () => ({
  storeAvailability: () => mockAvailability,
  loadOffers: async () => mockOffers,
}));
jest.mock('../purchaseFlow', () => ({
  startPurchase: (o: unknown, uid: unknown) => mockStart(o, uid),
  restore: async () => ({ found: 0, granted: 0, firstError: null }),
}));

/** Exactly what Google Play / the App Store return for an Indian and a US account. */
const INDIA: Offer[] = [
  { plan: 'yearly', productId: 'momentum_pro', kind: 'subs', price: '₹199.00', priceAmount: 199, currency: 'INR', offerToken: 'y' },
  { plan: 'monthly', productId: 'momentum_pro', kind: 'subs', price: '₹49.00', priceAmount: 49, currency: 'INR', offerToken: 'm' },
  { plan: 'lifetime', productId: 'momentum_pro_lifetime', kind: 'in-app', price: '₹399.00', priceAmount: 399, currency: 'INR' },
];
const US: Offer[] = [
  { plan: 'yearly', productId: 'momentum_pro', kind: 'subs', price: '$9.99', priceAmount: 9.99, currency: 'USD', offerToken: 'y' },
  { plan: 'monthly', productId: 'momentum_pro', kind: 'subs', price: '$1.99', priceAmount: 1.99, currency: 'USD', offerToken: 'm' },
];

async function show() {
  await render(<PaywallScreen />);
  await act(async () => undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { status: 'signedIn', user: { uid: 'u1' } };
  mockProfile = { tier: 'free', account_uid: 'u1' };
  mockAvailability = { available: true };
  mockOffers = INDIA;
  setPurchaseStatus({ state: 'idle' });
});

describe('PaywallScreen', () => {
  it('shows the store’s localized prices verbatim, with the yearly saving computed from them', async () => {
    await show();
    for (const price of ['₹199.00', '₹49.00', '₹399.00']) expect(screen.getByText(price)).toBeTruthy();
    expect(screen.getByText('Save 66%')).toBeTruthy();
    expect(screen.getByText('Subscribe · ₹199.00/year')).toBeTruthy();
    expect(screen.getByText(/Renews automatically at ₹199.00 per year until cancelled/)).toBeTruthy();
  });

  it('a US store account sees dollar prices, and only the plans the store returned', async () => {
    mockOffers = US;
    await show();
    expect(screen.getByText('$1.99')).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText('Lifetime')).toBeNull();
    expect(screen.getByText(`Save ${yearlySavings(US)}%`)).toBeTruthy();
  });

  it('buys the selected plan for the signed-in account', async () => {
    await show();
    await fireEvent.press(screen.getByLabelText('Lifetime, ₹399.00, one time'));
    await fireEvent.press(screen.getByText('Buy Lifetime · ₹399.00'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ plan: 'lifetime', price: '₹399.00' }), 'u1');
    expect(screen.getByText('One-time payment. No subscription, no renewals.')).toBeTruthy();
  });

  it('guests are asked to create an account (Pro is account-linked)', async () => {
    mockAuth = { status: 'signedOut' };
    await show();
    await fireEvent.press(screen.getByText('Create a Free Account to Upgrade'));
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-up');
    expect(screen.queryByText(/Subscribe ·/)).toBeNull();
  });

  it('explains when purchases can’t work here (Expo Go)', async () => {
    mockAvailability = { available: false, reason: 'Purchases need the installed MOMENTUM app (a development or store build), not Expo Go.' };
    await show();
    expect(screen.getByText(/not Expo Go/)).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it('no products from the store: no invented prices, offers a retry', async () => {
    mockOffers = [];
    await show();
    expect(screen.getByText(/Plans aren’t available right now/)).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('shows real purchase states: verifying, pending, success, error', async () => {
    await show();
    await act(async () => setPurchaseStatus({ state: 'verifying', plan: 'yearly' }));
    expect(screen.getByText('Confirming your purchase')).toBeTruthy();
    await act(async () => setPurchaseStatus({ state: 'pending', plan: 'yearly' }));
    expect(screen.getByText('Payment pending')).toBeTruthy();
    await act(async () => setPurchaseStatus({ state: 'success', plan: 'yearly' }));
    expect(screen.getByText('Welcome to Momentum Pro')).toBeTruthy();
    await act(async () => setPurchaseStatus({ state: 'error', message: 'This purchase is already linked to a different MOMENTUM account.' }));
    expect(screen.getByText('This purchase is already linked to a different MOMENTUM account.')).toBeTruthy();
  });

  it('Pro users see their status instead of plans', async () => {
    mockProfile = { tier: 'pro', account_uid: 'u1', pro_plan: 'lifetime', pro_expires_at: null };
    await show();
    expect(screen.getByText('You’re on Momentum Pro')).toBeTruthy();
    expect(screen.queryByText('₹49.00')).toBeNull();
  });
});
