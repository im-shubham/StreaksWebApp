import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { heatmap } from '@/domain/insights';
import { historyFrom } from '@/domain/streak';
import type { InsightsState } from '../useInsights';
import { InsightsScreen } from '../InsightsScreen';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
/* eslint-enable @typescript-eslint/no-require-imports */

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { navigate: (...a: unknown[]) => mockNavigate(...a) } }));

let mockState: InsightsState = { state: 'loading' };
jest.mock('../useInsights', () => ({ useInsights: () => mockState }));

const TODAY = '2026-10-17';

describe('InsightsScreen', () => {
  it('shows an honest empty state that sends you to the Streaks tab', async () => {
    mockState = { state: 'empty', reason: 'no-check-ins' };
    await render(<InsightsScreen />);
    expect(screen.getByText('Analytics unlock after your first check-in')).toBeTruthy();
    expect(screen.queryByText('Consistency')).toBeNull();
    await fireEvent.press(screen.getByText('Record First Completion'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('sends you to the Habits tab when there are no habits', async () => {
    mockState = { state: 'empty', reason: 'no-habits' };
    await render(<InsightsScreen />);
    await fireEvent.press(screen.getByText('Create Your First Habit'));
    expect(mockNavigate).toHaveBeenCalledWith('/habits');
  });

  it('shows a distinct error state with retry', async () => {
    const retry = jest.fn();
    mockState = { state: 'error', message: 'database is locked', retry };
    await render(<InsightsScreen />);
    expect(screen.getByText('Couldn’t load your insights')).toBeTruthy();
    expect(screen.queryByText('Analytics unlock after your first check-in')).toBeNull();
    await fireEvent.press(screen.getByText('Try Again'));
    expect(retry).toHaveBeenCalled();
  });

  it('renders the computed sections', async () => {
    const habits = [
      {
        id: 'gym',
        name: 'Morning Gym',
        status: 'active' as const,
        history: historyFrom({ id: 'gym', cadence: { type: 'daily', weekdaysMask: 127, intervalDays: 1, startDate: '2026-10-12' } }, ['2026-10-16', TODAY]),
      },
    ];
    mockState = {
      state: 'ready',
      date: TODAY,
      summary: { from: '2026-10-12', to: TODAY, done: 2, due: 6, missed: 4, rate: 33 },
      current: { days: 2, habitName: 'Morning Gym' },
      best: { days: 2, habitName: 'Morning Gym' },
      heatmap: heatmap(habits, TODAY),
      recent: [{ id: 'gym_2026-10-17', habitId: 'gym', habitName: 'Morning Gym', localDate: TODAY, completedAt: Date.now() }],
    };
    await render(<InsightsScreen />);
    expect(screen.getByText('33')).toBeTruthy();
    expect(screen.getByText('2 of 6 scheduled check-ins')).toBeTruthy();
    expect(screen.getByText('Recent Activity')).toBeTruthy();
    expect(screen.getByText('Sat, Oct 17: Completed (Morning Gym)')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Wed, Oct 14: Missed'));
    expect(screen.getByText('Wed, Oct 14: Missed')).toBeTruthy();
  });
});
