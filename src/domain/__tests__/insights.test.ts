import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { addDays, dateRange } from '../dates';
import {
  dayAggregate,
  heatmap,
  HEATMAP_WEEKS,
  periodStart,
  recentActivity,
  streakHighlights,
  summarizePeriod,
  type InsightsHabit,
} from '../insights';
import { historyFrom } from '../streak';
import type { Cadence, HabitStatus } from '../types';

// 2026-10-12 is a Monday.
const MON = '2026-10-12';
const WED = '2026-10-14';
const SAT = '2026-10-17';
const SUN = '2026-10-18';

const daily = (startDate: string): Cadence => ({ type: 'daily', weekdaysMask: 127, intervalDays: 1, startDate });
const monWedFri = (startDate: string): Cadence => ({ type: 'specific_days', weekdaysMask: 0b0010101, intervalDays: 1, startDate });

function habit(
  id: string,
  cadence: Cadence,
  done: string[],
  opts: { status?: HabitStatus; frozen?: string[]; name?: string } = {},
): InsightsHabit {
  return {
    id,
    name: opts.name ?? id,
    status: opts.status ?? 'active',
    history: historyFrom({ id, cadence }, done, opts.frozen ?? []),
  };
}

describe('completion rate', () => {
  it('counts scheduled, decided days only; today counts once done', () => {
    const gym = habit('gym', daily('2026-09-01'), [MON, '2026-10-13']);
    expect(summarizePeriod([gym], 'week', WED)).toMatchObject({ from: MON, done: 2, due: 2, missed: 0, rate: 100 });

    const doneToday = habit('gym', daily('2026-09-01'), [MON, '2026-10-13', WED]);
    expect(summarizePeriod([doneToday], 'week', WED)).toMatchObject({ done: 3, due: 3, rate: 100 });
  });

  it('counts misses in the denominator', () => {
    const gym = habit('gym', daily('2026-09-01'), [MON]);
    expect(summarizePeriod([gym], 'week', WED)).toMatchObject({ done: 1, due: 2, missed: 1, rate: 50 });
  });

  it('frozen days count as done, matching the per-habit consistency rule', () => {
    const gym = habit('gym', daily('2026-09-01'), [MON], { frozen: ['2026-10-13'] });
    expect(summarizePeriod([gym], 'week', WED).rate).toBe(100);
  });

  it('pools all habits by scheduled occurrences, not by habit average', () => {
    const a = habit('a', daily('2026-09-01'), [MON, '2026-10-13']); // 2/2
    const b = habit('b', monWedFri('2026-09-01'), []); // Mon missed, Wed pending -> 0/1
    expect(summarizePeriod([a, b], 'week', WED)).toMatchObject({ done: 2, due: 3, rate: 67 });
  });
});

describe('period boundaries (local calendar dates)', () => {
  it('week runs Monday..today and resets on Monday', () => {
    expect(periodStart('week', SUN, [])).toBe(MON);
    expect(periodStart('week', '2026-10-19', [])).toBe('2026-10-19');
    const gym = habit('gym', daily('2026-09-01'), dateRange(MON, SUN));
    // Monday morning of a new week: nothing decided yet -> no rate, not 0%.
    expect(summarizePeriod([gym], 'week', '2026-10-19')).toMatchObject({ due: 0, rate: null });
    expect(summarizePeriod([gym], 'week', SUN)).toMatchObject({ done: 7, due: 7, rate: 100 });
  });

  it('month starts on the 1st, ignoring the previous month', () => {
    const gym = habit('gym', daily('2026-09-01'), ['2026-10-30', '2026-10-31']);
    expect(summarizePeriod([gym], 'month', '2026-11-02')).toMatchObject({ from: '2026-11-01', done: 0, due: 1, rate: 0 });
    expect(summarizePeriod([gym], 'month', '2026-10-31')).toMatchObject({ from: '2026-10-01', done: 2, due: 31 });
    expect(periodStart('month', '2028-02-29', [])).toBe('2028-02-01');
  });

  it('all time starts at the earliest habit start or check-in', () => {
    const gym = habit('gym', daily('2026-10-01'), []);
    const read = habit('read', daily('2026-10-05'), ['2026-09-20']);
    expect(periodStart('all', SAT, [gym, read])).toBe('2026-09-20');
    expect(periodStart('all', SAT, [])).toBe(SAT);
  });
});

describe('schedules', () => {
  it('rest days are excluded from the denominator', () => {
    const gym = habit('gym', monWedFri('2026-09-01'), [MON, '2026-10-16']); // Wed missed
    expect(summarizePeriod([gym], 'week', SUN)).toMatchObject({ done: 2, due: 3, rate: 67 });
    expect(dayAggregate([gym], '2026-10-13', SUN).kind).toBe('rest');
  });

  it('interval habits are only due every N days', () => {
    const run = habit('run', { type: 'interval', weekdaysMask: 127, intervalDays: 3, startDate: MON }, [MON]);
    // Due Mon and Thu; Thu missed. Sat/Sun are rest.
    expect(summarizePeriod([run], 'week', SUN)).toMatchObject({ done: 1, due: 2, rate: 50 });
  });

  it('a completion on a rest day still counts', () => {
    const gym = habit('gym', monWedFri('2026-09-01'), [MON, '2026-10-13']);
    expect(dayAggregate([gym], '2026-10-13', WED)).toMatchObject({ kind: 'complete', done: 1, due: 1 });
  });
});

describe('habits created mid-period', () => {
  it('are only measured from their start date', () => {
    const gym = habit('gym', daily('2026-10-15'), ['2026-10-15']); // Thu start, Fri missed
    expect(summarizePeriod([gym], 'week', SAT)).toMatchObject({ done: 1, due: 2, rate: 50 });
    expect(dayAggregate([gym], '2026-10-13', SAT).kind).toBe('rest');
  });

  it('a habit created today has no rate until it is done', () => {
    const gym = habit('gym', daily(SAT), []);
    expect(summarizePeriod([gym], 'month', SAT).rate).toBeNull();
    expect(dayAggregate([gym], SAT, SAT).kind).toBe('pending');
  });
});

describe('paused habits', () => {
  it('keep their check-ins but do not invent misses', () => {
    const old = habit('old', daily('2026-09-01'), [MON], { status: 'paused' });
    expect(summarizePeriod([old], 'week', SAT)).toMatchObject({ done: 1, due: 1, rate: 100 });
    expect(dayAggregate([old], WED, SAT).kind).toBe('rest');
  });
});

describe('streak highlights', () => {
  it('reuses the streak engine: longest current run among active habits, best ever overall', () => {
    const gym = habit('gym', daily('2026-10-01'), dateRange('2026-10-01', '2026-10-10'), { name: 'Gym' }); // best 10, broken
    const read = habit('read', daily('2026-10-01'), dateRange('2026-10-14', SAT), { name: 'Reading' }); // current 4
    const paused = habit('p', daily('2026-09-01'), dateRange('2026-09-01', '2026-09-20'), { status: 'paused', name: 'Old' });
    const { current, best } = streakHighlights([gym, read, paused], SAT);
    expect(current).toEqual({ days: 4, habitName: 'Reading' });
    expect(best).toEqual({ days: 20, habitName: 'Old' });
  });

  it('is zero with no history', () => {
    expect(streakHighlights([], SAT)).toEqual({ current: { days: 0, habitName: null }, best: { days: 0, habitName: null } });
  });
});

describe('heatmap', () => {
  it('covers 14 Monday-start weeks ending with the current week', () => {
    const gym = habit('gym', daily('2026-10-01'), ['2026-10-15', SAT]);
    const weeks = heatmap([gym], SAT);
    expect(weeks).toHaveLength(HEATMAP_WEEKS);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe(addDays(MON, -7 * 13));
    expect(weeks[13].map((d) => d.kind)).toEqual(['missed', 'missed', 'missed', 'complete', 'missed', 'complete', 'future']);
    expect(weeks[0][0].kind).toBe('rest'); // before the habit existed
  });

  it('distinguishes partial days, today-pending and names who checked in', () => {
    const a = habit('a', daily('2026-10-01'), [SAT], { name: 'Gym' });
    const b = habit('b', daily('2026-10-01'), [], { name: 'Reading' });
    expect(dayAggregate([a, b], SAT, SAT)).toMatchObject({ kind: 'partial', done: 1, due: 1, pending: 1, completedNames: ['Gym'] });
    expect(dayAggregate([b], SAT, SAT).kind).toBe('pending');
  });

  it('is all rest/future with no habits', () => {
    const kinds = new Set(heatmap([], SAT).flat().map((d) => d.kind));
    expect([...kinds].sort()).toEqual(['future', 'rest']);
  });
});

describe('recent activity', () => {
  const gym = habit('gym', daily('2026-10-01'), []);
  it('lists newest check-ins first with habit names, skipping unknown habits and duplicates', () => {
    const items = recentActivity(
      [
        { id: 'gym_2026-10-15', habitId: 'gym', localDate: '2026-10-15', completedAt: 5 },
        { id: 'gym_2026-10-17', habitId: 'gym', localDate: SAT, completedAt: 9 },
        { id: 'gym_2026-10-17b', habitId: 'gym', localDate: SAT, completedAt: 1 },
        { id: 'x_2026-10-17', habitId: 'archived', localDate: SAT, completedAt: 10 },
      ],
      [gym],
    );
    expect(items.map((i) => [i.habitName, i.localDate])).toEqual([
      ['gym', SAT],
      ['gym', '2026-10-15'],
    ]);
  });

  it('is empty with no history', () => {
    expect(recentActivity([], [gym])).toEqual([]);
  });
});

describe('local dates across time zones', () => {
  /**
   * The process time zone can't be switched inside a Jest worker, so the
   * date helpers run in a child Node process with TZ set (dates.ts has no
   * imports, so Node can load it directly with type stripping).
   */
  const inTz = (tz: string, expr: string): unknown => {
    const datesTs = path.resolve(__dirname, '../dates.ts');
    const out = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', '-e', `import(${JSON.stringify(datesTs)}).then((d) => console.log(JSON.stringify(${expr})))`],
      { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
    );
    return JSON.parse(out);
  };

  it('uses the device calendar day, not UTC', () => {
    // 11:00 UTC on Tuesday is already Wednesday in Kiritimati (UTC+14).
    expect(inTz('Pacific/Kiritimati', 'd.today(new Date(Date.UTC(2026, 9, 13, 11)))')).toBe(WED);
    // 03:00 UTC on Monday is still Sunday in Los Angeles, so it belongs to the previous week.
    expect(inTz('America/Los_Angeles', '[d.today(new Date(Date.UTC(2026, 9, 19, 3))), d.startOfWeek(d.today(new Date(Date.UTC(2026, 9, 19, 3))))]')).toEqual([SUN, MON]);
  });

  it('day arithmetic is stable across a DST change', () => {
    expect(inTz('America/New_York', "[d.dateRange('2026-10-31', '2026-11-02'), d.addDays('2026-11-01', 1), d.weekdayIndex('2026-11-01')]")).toEqual([
      ['2026-10-31', '2026-11-01', '2026-11-02'],
      '2026-11-02',
      6,
    ]);
  });

  it('summaries work purely on local date strings', () => {
    const gym = habit('gym', daily('2026-10-26'), dateRange('2026-10-26', '2026-11-01'));
    expect(summarizePeriod([gym], 'week', '2026-11-01')).toMatchObject({ from: '2026-10-26', done: 7, due: 7 });
  });
});
