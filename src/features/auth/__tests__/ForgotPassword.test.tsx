import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { RESEND_SECONDS, ResetEmailSentScreen } from '../ResetEmailSentScreen';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockRouter = { replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

const mockReset = jest.fn<(email: string) => Promise<void>>();
jest.mock('../AuthProvider', () => ({ useAuth: () => ({ resetPassword: mockReset }) }));
jest.mock('@/services/firebase', () => ({ isFirebaseConfigured: true }));

const fbError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockReset.mockResolvedValue(undefined);
});

describe('ForgotPasswordScreen', () => {
  it('prefills the email from Sign In and opens the confirmation after sending', async () => {
    mockParams = { email: 'alex@example.com' };
    await render(<ForgotPasswordScreen />);
    expect(screen.getByDisplayValue('alex@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByText('Send Reset Link'));
    expect(mockReset).toHaveBeenCalledWith('alex@example.com');
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth/reset-email-sent', params: { email: 'alex@example.com' } });
  });

  it('validates the email before calling Firebase', async () => {
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Account Email Address'), 'not-an-email');
    await fireEvent.press(screen.getByText('Send Reset Link'));
    expect(mockReset).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the email address you signed up with.')).toBeTruthy();
  });

  it('does not reveal whether an account exists', async () => {
    mockParams = { email: 'nobody@example.com' };
    mockReset.mockRejectedValueOnce(fbError('auth/user-not-found'));
    await render(<ForgotPasswordScreen />);
    await fireEvent.press(screen.getByText('Send Reset Link'));
    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it('shows real failures and stays on the screen', async () => {
    mockParams = { email: 'alex@example.com' };
    mockReset.mockRejectedValueOnce(fbError('auth/network-request-failed'));
    await render(<ForgotPasswordScreen />);
    await fireEvent.press(screen.getByText('Send Reset Link'));
    expect(screen.getByText('No connection to Firebase. Check your internet connection.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('ResetEmailSentScreen', () => {
  it('shows the address and only allows a resend after the countdown', async () => {
    jest.useFakeTimers();
    try {
      mockParams = { email: 'alex@example.com' };
      await render(<ResetEmailSentScreen />);
      expect(screen.getByText('alex@example.com')).toBeTruthy();
      expect(screen.getByText(`Didn’t receive it? Resend in ${RESEND_SECONDS}s`)).toBeTruthy();
      expect(screen.queryByText('Resend Email')).toBeNull();

      for (let i = 0; i < RESEND_SECONDS; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
      }
      await fireEvent.press(screen.getByText('Resend Email'));
      expect(mockReset).toHaveBeenCalledWith('alex@example.com');
      expect(screen.getByText('Sent again. The newest link is the one that works.')).toBeTruthy();
      expect(screen.getByText(`Didn’t receive it? Resend in ${RESEND_SECONDS}s`)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns to Sign In', async () => {
    mockParams = { email: 'alex@example.com' };
    await render(<ResetEmailSentScreen />);
    await fireEvent.press(screen.getByText('Return to Sign In'));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/auth/sign-in');
  });
});
