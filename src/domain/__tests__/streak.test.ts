import { describe, expect, it } from '@jest/globals';

import { describeCadence, isScheduled } from '../cadence';
import { addDays, diffDays, weekdayIndex, weekDates } from '../dates';
import { bestStreak, consistency, currentStreak, dayStatus, historyFrom } from '../streak';
import type { Cadence } from '../types';

// 2024-10-21 is a Monday.
const MON = '2024-10-21';
const daily = (startDate = '2024-10-01'): Cadence => ({ type: 'daily', weekdaysMask: 0b1111111, intervalDays: 1, startDate });
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('dates', () => {
  it('uses Monday-first weekdays', () => {
    expect(weekdayIndex(MON)).toBe(0);
    expect(weekdayIndex('2024-10-27')).toBe(6);
    expect(weekDates('2024-10-24')[0]).toBe(MON);
  });

  it('handles month and DST boundaries', () => {
    expect(addDays('2024-10-31', 1)).toBe('2024-11-01');
    expect(diffDays('2024-03-09', '2024-03-11')).toBe(2);
    expect(addDays('2024-11-02', 2)).toBe('2024-11-04');
  });
});

describe('cadence', () => {
  it('schedules specific weekdays', () => {
    const monFri: Cadence = { type: 'specific_days', weekdaysMask: 0b0011111, intervalDays: 1, startDate: '2024-10-01' };
    expect(isScheduled(monFri, MON)).toBe(true);
    expect(isScheduled(monFri, '2024-10-26')).toBe(false);
    expect(describeCadence(monFri)).toBe('Mon-Fri');
  });

  it('schedules intervals from the start date', () => {
    const every3: Cadence = { type: 'interval', weekdaysMask: 0, intervalDays: 3, startDate: MON };
    expect([0, 1, 2, 3, 6].map((n) => isScheduled(every3, addDays(MON, n)))).toEqual([true, false, false, true, true]);
  });

  it('never schedules before the start date', () => {
    expect(isScheduled(daily(MON), addDays(MON, -1))).toBe(false);
  });
});

describe('streak engine', () => {
  const habit = { id: 'h1', cadence: daily() };

  it('counts consecutive completions and keeps the chain while today is pending', () => {
    const h = historyFrom(habit, days('2024-10-03', 18)); // Oct 3..20
    expect(currentStreak(h, '2024-10-21')).toBe(18);
    expect(dayStatus(h, '2024-10-21', '2024-10-21')).toBe('pending');
  });

  it('breaks on a missed scheduled day', () => {
    const h = historyFrom(habit, [...days('2024-10-01', 5), ...days('2024-10-07', 3)]);
    expect(currentStreak(h, '2024-10-09')).toBe(3);
    expect(bestStreak(h, '2024-10-09')).toBe(5);
  });

  it('does not break on rest days', () => {
    const weekdays: Cadence = { type: 'specific_days', weekdaysMask: 0b0011111, intervalDays: 1, startDate: '2024-10-14' };
    const h = historyFrom({ id: 'h', cadence: weekdays }, [...days('2024-10-14', 5), MON]);
    expect(dayStatus(h, '2024-10-19', MON)).toBe('rest');
    expect(currentStreak(h, MON)).toBe(6);
  });

  it('counts freezes toward the streak (repair: 24d -> 25d)', () => {
    const done = days('2024-10-01', 24);
    const missed = addDays('2024-10-01', 24);
    const unrepaired = historyFrom(habit, done);
    const repaired = historyFrom(habit, done, [missed]);
    const t = addDays(missed, 1);
    expect(currentStreak(unrepaired, t)).toBe(0);
    expect(currentStreak(repaired, t)).toBe(25);
  });

  it('shields vacation days without adding to the streak', () => {
    const vacation = { id: 'v', startDate: '2024-10-24', endDate: '2024-10-28', habitIds: null, endedEarlyOn: null };
    const h = historyFrom(habit, days('2024-10-06', 18), [], [vacation]); // Oct 6..23
    expect(dayStatus(h, '2024-10-25', '2024-10-25')).toBe('shielded');
    expect(currentStreak(h, '2024-10-25')).toBe(18);
  });

  it('only shields habits in the vacation scope', () => {
    const vacation = { id: 'v', startDate: '2024-10-24', endDate: '2024-10-28', habitIds: ['other'], endedEarlyOn: null };
    const h = historyFrom(habit, [], [], [vacation]);
    expect(dayStatus(h, '2024-10-24', '2024-10-25')).toBe('missed');
  });

  it('stops shielding after ending a vacation early', () => {
    const vacation = { id: 'v', startDate: '2024-10-24', endDate: '2024-10-28', habitIds: null, endedEarlyOn: '2024-10-26' };
    const h = historyFrom(habit, [], [], [vacation]);
    expect(dayStatus(h, '2024-10-25', '2024-10-27')).toBe('shielded');
    expect(dayStatus(h, '2024-10-26', '2024-10-27')).toBe('missed');
  });

  it('reports consistency and null before any data', () => {
    const h = historyFrom({ id: 'h', cadence: daily(MON) }, [MON, addDays(MON, 1), addDays(MON, 3)]);
    expect(consistency(h, MON, addDays(MON, 3))).toBe(75);
    expect(consistency(historyFrom({ id: 'h', cadence: daily(MON) }, []), MON, MON)).toBeNull();
  });
});
