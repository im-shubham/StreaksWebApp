import type { IconName } from '@/components/ui/Icon';
import type { LocalDate } from './dates';

export type CadenceType = 'daily' | 'specific_days' | 'interval';
export type HabitStatus = 'active' | 'paused' | 'archived';
export type CompletionSource = 'hold' | 'notification' | 'widget' | 'manual' | 'template';
export type FreezeKind = 'auto' | 'manual' | 'repair';
export type AccountTier = 'guest' | 'free' | 'pro';

export type Cadence = {
  type: CadenceType;
  /** Bit i set = weekday i scheduled (Mon = bit 0). Used by specific_days. */
  weekdaysMask: number;
  /** Every N days counted from startDate. Used by interval. */
  intervalDays: number;
  startDate: LocalDate;
};

export type Habit = {
  id: string;
  name: string;
  category: HabitCategory;
  emblem: IconName;
  cadence: Cadence;
  /** Optional weekly quota shown as "5x / week". */
  weeklyTarget: number | null;
  /** Free-text target, e.g. "45 min strength", "10 pages". */
  targetLabel: string | null;
  executionTime: string | null; // 'HH:mm'
  reminderEnabled: boolean;
  reminderTime: string | null; // 'HH:mm'
  notes: string | null;
  status: HabitStatus;
  /** Pinned to the dashboard hero ("On Dashboard"). */
  isPrimary: boolean;
  sortOrder: number;
  templateId: string | null;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export type Completion = {
  id: string;
  habitId: string;
  localDate: LocalDate;
  completedAt: number;
  source: CompletionSource;
  value: number | null;
  note: string | null;
};

export type FreezeEvent = {
  id: string;
  habitId: string;
  localDate: LocalDate;
  kind: FreezeKind;
  createdAt: number;
};

export type Vacation = {
  id: string;
  startDate: LocalDate;
  endDate: LocalDate;
  /** null = protects all habits. */
  habitIds: string[] | null;
  endedEarlyOn: LocalDate | null;
};

/** Categories offered by the Stitch Create/Edit Habit screens. */
export const HABIT_CATEGORIES = {
  fitness: { label: 'Fitness', long: 'Health & Fitness' },
  study: { label: 'Study', long: 'Deep Study' },
  craft: { label: 'Career & Craft', long: 'Creative Craft' },
  mindfulness: { label: 'Mindfulness', long: 'Mindfulness' },
  wellness: { label: 'Wellness', long: 'Wellness' },
} as const;
export type HabitCategory = keyof typeof HABIT_CATEGORIES;

/**
 * "Visual Emblem" grid from the Create Habit screen, in design order.
 * Each emblem implies a default category label shown beside the grid.
 */
export const EMBLEMS: { icon: IconName; category: HabitCategory }[] = [
  { icon: 'fitness_center', category: 'fitness' },
  { icon: 'menu_book', category: 'study' },
  { icon: 'school', category: 'study' },
  { icon: 'terminal', category: 'craft' },
  { icon: 'spa', category: 'mindfulness' },
  { icon: 'directions_walk', category: 'fitness' },
  { icon: 'water_drop', category: 'wellness' },
  { icon: 'bedtime', category: 'wellness' },
  { icon: 'edit_note', category: 'craft' },
  { icon: 'adjust', category: 'mindfulness' },
];
