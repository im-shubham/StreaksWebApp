import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { HoldToComplete } from '../HoldToComplete';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Callbacks are driven in the exact order the native LongPress recognizer
 * delivers them. (RNGH's fireGestureHandler() pads every sequence with END,
 * which routes an early release through ACTIVE and can't express "released
 * before minDuration".)
 *   full hold:      onBegin → onStart (at minDuration) → onFinalize(true)
 *   early release:  onBegin → onFinalize(false)
 */
type Handlers = {
  onBegin?: (e: unknown) => void;
  onStart?: (e: unknown) => void;
  onFinalize?: (e: unknown, success: boolean) => void;
};
const handlers = () => (getByGestureTestId('hold-to-complete') as unknown as { handlers: Handlers }).handlers;

async function hold(full: boolean) {
  const h = handlers();
  await act(async () => {
    h.onBegin?.({});
    if (full) h.onStart?.({});
    h.onFinalize?.({}, full);
  });
}

async function setup(onComplete: () => Promise<unknown> | void = jest.fn(async () => undefined)) {
  await render(<HoldToComplete icon="fitness_center" completed={false} onComplete={onComplete} accessibilityLabel="Hold to complete Gym" />);
  return onComplete as jest.Mock;
}

describe('HoldToComplete', () => {
  it('completes once when held for the full duration and shows DONE', async () => {
    const onComplete = await setup();
    await hold(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('does not complete when released early', async () => {
    const onComplete = await setup();
    await hold(false);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText('Hold')).toBeTruthy();
  });

  it('ignores a second activation while the first save is in flight', async () => {
    let resolve: (() => void) | undefined;
    const onComplete = jest.fn(() => new Promise<void>((r) => (resolve = r)));
    await setup(onComplete);
    const h = handlers();
    await act(async () => {
      h.onBegin?.({});
      h.onStart?.({});
      h.onStart?.({}); // duplicate activation
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    await act(async () => resolve?.());
  });

  it('rewinds to the pending state when saving fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onComplete = jest.fn(async () => {
      throw new Error('disk full');
    });
    await setup(onComplete);
    await hold(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hold')).toBeTruthy();
    warn.mockRestore();
  });

  it('is disabled once the habit is already completed', async () => {
    const onComplete = jest.fn<() => void>();
    await render(<HoldToComplete icon="fitness_center" completed onComplete={onComplete} accessibilityLabel="Done" />);
    expect(screen.getByText('Done')).toBeTruthy();
    expect((getByGestureTestId('hold-to-complete') as unknown as { config: { enabled?: boolean } }).config.enabled).toBe(false);
  });
});
