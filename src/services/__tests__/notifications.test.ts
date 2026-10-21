import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PlannedReminder } from '@/domain/reminders';

const mockN = {
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async (): Promise<Record<string, unknown>> => ({ granted: false, status: 'undetermined', ios: { status: 0 } })),
  requestPermissionsAsync: jest.fn(async (): Promise<Record<string, unknown>> => ({ granted: true, status: 'granted', ios: { status: 2 } })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
};
jest.mock('@/services/expoNotifications', () => mockN);

type Svc = typeof import('../notifications');
let svc: Svc;

const reminder = (id: string, fireAt: number): PlannedReminder => ({
  id,
  habitId: id.split('_')[0],
  date: id.split('_')[1],
  fireAt,
  title: 'Gym',
  body: 'Time to check in.',
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module state per test
    svc = require('../notifications') as Svc;
  });
});

describe('notifications service', () => {
  it('replaces the OS queue with the plan using one-off date triggers and the Mark Done category', async () => {
    await svc.applyReminderPlan([reminder('gym_2026-10-20', 1000), reminder('gym_2026-10-21', 2000)]);
    expect(mockN.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockN.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockN.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'gym_2026-10-20',
      content: expect.objectContaining({ title: 'Gym', categoryIdentifier: svc.REMINDER_CATEGORY, data: { habitId: 'gym', date: '2026-10-20' } }),
      trigger: { type: 'date', date: 1000, channelId: svc.REMINDER_CHANNEL },
    });
    expect(mockN.setNotificationCategoryAsync).toHaveBeenCalledWith(svc.REMINDER_CATEGORY, [
      expect.objectContaining({ identifier: svc.ACTION_COMPLETE, buttonTitle: 'Mark Done' }),
    ]);
  });

  it('does nothing when the plan has not changed, and clears everything for an empty plan', async () => {
    const plan = [reminder('gym_2026-10-20', 1000)];
    await svc.applyReminderPlan(plan);
    await svc.applyReminderPlan(plan);
    expect(mockN.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    await svc.applyReminderPlan([]);
    expect(mockN.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(mockN.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('retries the whole plan if scheduling failed part-way', async () => {
    mockN.scheduleNotificationAsync.mockRejectedValueOnce(new Error('boom'));
    const plan = [reminder('gym_2026-10-20', 1000)];
    await expect(svc.applyReminderPlan(plan)).rejects.toThrow('boom');
    await svc.applyReminderPlan(plan);
    expect(mockN.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });

  it('only shows the OS prompt when the user has not decided, and tells listeners the answer', async () => {
    const seen: string[] = [];
    svc.onReminderPermissionChange((p) => seen.push(p));
    expect(await svc.requestReminderPermission()).toBe('granted');
    expect(mockN.requestPermissionsAsync).toHaveBeenCalledTimes(1);

    mockN.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', ios: { status: 1 } });
    expect(await svc.requestReminderPermission()).toBe('denied');
    expect(mockN.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['granted', 'denied']);
  });

  it('treats iOS provisional authorization as allowed', async () => {
    mockN.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'granted', ios: { status: 3 } });
    expect(await svc.getReminderPermission()).toBe('granted');
  });
});
