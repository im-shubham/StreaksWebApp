import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { fireTime, isValidTime, MAX_PENDING, planReminders, planSignature, type ReminderHabit } from '../reminders';
import { historyFrom } from '../streak';
import type { Cadence, HabitStatus, Vacation } from '../types';

// 2026-10-19 is a Monday.
const MON = '2026-10-19';
const at = (date: string, hhmm: string) => fireTime(date, hhmm);

function habit(
  id: string,
  cadence: Partial<Cadence> = {},
  opts: { done?: string[]; frozen?: string[]; vacations?: Vacation[]; status?: HabitStatus; enabled?: boolean; time?: string | null; target?: string } = {},
): ReminderHabit {
  const c: Cadence = { type: 'daily', weekdaysMask: 127, intervalDays: 1, startDate: '2026-09-01', ...cadence };
  return {
    habit: {
      id,
      name: `Habit ${id}`,
      status: opts.status ?? 'active',
      reminderEnabled: opts.enabled ?? true,
      reminderTime: opts.time === undefined ? '08:00' : opts.time,
      targetLabel: opts.target ?? null,
    },
    history: historyFrom({ id, cadence: c }, opts.done ?? [], opts.frozen ?? [], opts.vacations ?? []),
  };
}

describe('planReminders', () => {
  it('plans one reminder per due day at the local reminder time, nearest first', () => {
    const plan = planReminders([habit('a')], at(MON, '07:00'));
    expect(plan).toHaveLength(14);
    expect(plan[0]).toMatchObject({ id: `a_${MON}`, date: MON, fireAt: at(MON, '08:00').getTime(), title: 'Habit a' });
    expect(plan.at(-1)?.date).toBe(addDays(MON, 13));
  });

  it('skips today once the time has passed', () => {
    expect(planReminders([habit('a')], at(MON, '08:00'))[0].date).toBe(addDays(MON, 1));
  });

  it('skips a day that is already checked in (completing cancels today’s reminder)', () => {
    const plan = planReminders([habit('a', {}, { done: [MON] })], at(MON, '07:00'));
    expect(plan[0].date).toBe(addDays(MON, 1));
  });

  it('only reminds on scheduled days', () => {
    const monWedFri = habit('a', { type: 'specific_days', weekdaysMask: 0b0010101 });
    const days = planReminders([monWedFri], at(MON, '07:00'), 7).map((r) => r.date);
    expect(days).toEqual([MON, '2026-10-21', '2026-10-23']);
    const everyThird = habit('b', { type: 'interval', intervalDays: 3, startDate: MON });
    expect(planReminders([everyThird], at(MON, '07:00'), 7).map((r) => r.date)).toEqual([MON, '2026-10-22', '2026-10-25']);
  });

  it('does not remind before a habit starts', () => {
    const plan = planReminders([habit('a', { startDate: '2026-10-21' })], at(MON, '07:00'), 4);
    expect(plan.map((r) => r.date)).toEqual(['2026-10-21', '2026-10-22']);
  });

  it('skips frozen and vacation days', () => {
    const vacation: Vacation = { id: 'v', startDate: '2026-10-20', endDate: '2026-10-21', habitIds: null, endedEarlyOn: null };
    const plan = planReminders([habit('a', {}, { frozen: ['2026-10-22'], vacations: [vacation] })], at(MON, '07:00'), 5);
    expect(plan.map((r) => r.date)).toEqual([MON, '2026-10-23']);
  });

  it('ignores paused habits, disabled reminders and missing or invalid times', () => {
    const habits = [
      habit('p', {}, { status: 'paused' }),
      habit('off', {}, { enabled: false }),
      habit('none', {}, { time: null }),
      habit('bad', {}, { time: '25:00' }),
    ];
    expect(planReminders(habits, at(MON, '07:00'))).toEqual([]);
  });

  it('caps the queue for the iOS 64-notification limit, keeping the soonest', () => {
    const habits = ['a', 'b', 'c', 'd', 'e'].map((id, i) => habit(id, {}, { time: `${String(i + 6).padStart(2, "0")}:00` }));
    const plan = planReminders(habits, at(MON, '05:00'));
    expect(plan).toHaveLength(MAX_PENDING);
    expect(plan.every((r, i) => i === 0 || r.fireAt >= plan[i - 1].fireAt)).toBe(true);
    expect(plan.at(-1)?.date).toBe(addDays(MON, 11));
  });

  it('mentions today’s live streak and the target, never a made-up number for later days', () => {
    const h = habit('a', {}, { done: ['2026-10-17', '2026-10-18'], target: '10 pages' });
    const [todays, tomorrows] = planReminders([h], at(MON, '07:00'));
    expect(todays.body).toBe('10 pages. Keep your 2-day streak going. Hold to check in.');
    expect(tomorrows.body).toBe('10 pages. Time to check in. Small actions, big momentum.');
  });

  it('signature changes only when the plan does', () => {
    const now = at(MON, '07:00');
    expect(planSignature(planReminders([habit('a')], now))).toBe(planSignature(planReminders([habit('a')], now)));
    expect(planSignature(planReminders([habit('a', {}, { time: '09:00' })], now))).not.toBe(planSignature(planReminders([habit('a')], now)));
  });
});

describe('isValidTime', () => {
  it('accepts HH:mm only', () => {
    expect(['00:00', '23:59', '08:30'].every(isValidTime)).toBe(true);
    expect(['24:00', '8:30', '12:60', '', null].some((t) => isValidTime(t as string | null))).toBe(false);
  });
});
