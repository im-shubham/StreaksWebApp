import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { fireTime, type PlannedReminder } from '@/domain/reminders';
import type { ReminderPermission } from '@/services/notifications';
import { ReminderPromptCard } from '../ReminderPromptCard';
import { maybeSendWelcome, PROMPT_DISMISSED_KEY, WELCOME_SENT_KEY } from '../welcome';

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous */
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */

const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    getItemSync: (k: string) => mockStore.get(k) ?? null,
  },
}));
const mockSendWelcome = jest.fn(async () => undefined);
const mockOpenSettings = jest.fn();
jest.mock('@/services/notifications', () => ({
  sendWelcomeNotification: (...a: unknown[]) => mockSendWelcome(...(a as [])),
  openNotificationSettings: () => mockOpenSettings(),
}));
let mockPermission: ReminderPermission = 'undetermined';
const mockEnsure = jest.fn(async () => true);
jest.mock('../permission', () => ({
  useReminderPermission: () => ({ permission: mockPermission, refresh: jest.fn() }),
  ensureReminderPermission: () => mockEnsure(),
}));
const mockSetReminder = jest.fn(async () => undefined);
jest.mock('@/db/repositories/habits', () => ({ setHabitReminder: (...a: unknown[]) => mockSetReminder(...(a as [])) }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));

const NOW = fireTime('2026-10-21', '07:00');
const first: PlannedReminder = { id: 'g_2026-10-21', habitId: 'g', date: '2026-10-21', fireAt: fireTime('2026-10-21', '08:00').getTime(), title: 'Daily Workout', body: '' };
const gym = { id: 'g', name: 'Daily Workout', status: 'active' as const, reminderEnabled: false, reminderTime: null, executionTime: '06:30' };

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockPermission = 'undetermined';
});

describe('welcome notification', () => {
  it('is sent once per install, naming the first real reminder', async () => {
    expect(await maybeSendWelcome(first, NOW)).toBe(true);
    expect(mockSendWelcome).toHaveBeenCalledWith({ title: 'Daily Workout', when: 'today at 8:00 AM' });
    expect(mockStore.has(WELCOME_SENT_KEY)).toBe(true);
    expect(await maybeSendWelcome(first, NOW)).toBe(false);
    expect(mockSendWelcome).toHaveBeenCalledTimes(1);
  });

  it('waits until a reminder is actually scheduled', async () => {
    expect(await maybeSendWelcome(undefined, NOW)).toBe(false);
    expect(mockSendWelcome).not.toHaveBeenCalled();
    expect(mockStore.has(WELCOME_SENT_KEY)).toBe(false);
  });
});

describe('ReminderPromptCard', () => {
  it('turns on a reminder at the habit’s own time, then asks the OS', async () => {
    await render(<ReminderPromptCard habits={[gym]} primary={gym} />);
    expect(screen.getByText('Get a reminder for Daily Workout at 6:30 AM, only on days it’s due.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Turn On Reminders'));
    expect(mockSetReminder).toHaveBeenCalledWith({}, 'g', true, '06:30');
    expect(mockEnsure).toHaveBeenCalled();
  });

  it('links to Settings when notifications were denied', async () => {
    mockPermission = 'denied';
    await render(<ReminderPromptCard habits={[gym]} primary={gym} />);
    await fireEvent.press(screen.getByText('Open Settings'));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('stays hidden once reminders work, and after Not Now', async () => {
    mockPermission = 'granted';
    const withReminder = { ...gym, reminderEnabled: true, reminderTime: '07:00' };
    await render(<ReminderPromptCard habits={[withReminder]} primary={withReminder} />);
    expect(screen.queryByText('Never miss a check-in')).toBeNull();

    mockPermission = 'undetermined';
    await render(<ReminderPromptCard habits={[gym]} primary={gym} />);
    await fireEvent.press(screen.getByText('Not Now'));
    expect(screen.queryByText('Never miss a check-in')).toBeNull();
    expect(mockStore.has(PROMPT_DISMISSED_KEY)).toBe(true);
  });
});
