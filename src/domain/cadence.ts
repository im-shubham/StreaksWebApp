import { diffDays, weekdayIndex, type LocalDate } from './dates';
import type { Cadence } from './types';

export const ALL_WEEKDAYS_MASK = 0b1111111;

export function isScheduled(cadence: Cadence, date: LocalDate): boolean {
  if (diffDays(cadence.startDate, date) < 0) return false;
  switch (cadence.type) {
    case 'daily':
      return true;
    case 'specific_days':
      return (cadence.weekdaysMask & (1 << weekdayIndex(date))) !== 0;
    case 'interval':
      return diffDays(cadence.startDate, date) % Math.max(1, cadence.intervalDays) === 0;
  }
}

export function maskHas(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}

export function toggleMask(mask: number, weekday: number): number {
  return mask ^ (1 << weekday);
}

export function maskCount(mask: number): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (maskHas(mask, i)) n++;
  return n;
}

/** Scheduled days per week, for "7 OF 7 DAYS" style labels. */
export function daysPerWeek(cadence: Cadence): number {
  switch (cadence.type) {
    case 'daily':
      return 7;
    case 'specific_days':
      return maskCount(cadence.weekdaysMask);
    case 'interval':
      return Math.round((7 / Math.max(1, cadence.intervalDays)) * 10) / 10;
  }
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Daily", "Mon-Fri", "Mon, Wed, Fri", "Every 2 days". */
export function describeCadence(cadence: Cadence): string {
  if (cadence.type === 'daily') return 'Daily';
  if (cadence.type === 'interval') {
    return cadence.intervalDays <= 1 ? 'Daily' : `Every ${cadence.intervalDays} days`;
  }
  const days = DAY_NAMES.filter((_, i) => maskHas(cadence.weekdaysMask, i));
  if (days.length === 7) return 'Daily';
  // Contiguous run → "Mon-Sat"
  const idx = DAY_NAMES.map((_, i) => i).filter((i) => maskHas(cadence.weekdaysMask, i));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && idx.length > 2) return `${days[0]}-${days[days.length - 1]}`;
  return days.join(', ');
}
