import type { NewHabit } from '@/db/repositories/habits';

export type HabitTemplate = NewHabit & { id: string; subtitle: string };

/** "Popular Protocols to Get Started" from the Empty Dashboard design. */
export const QUICK_START_TEMPLATES: HabitTemplate[] = [
  {
    id: 'daily-workout',
    name: 'Daily Workout',
    subtitle: '30 mins physical training',
    category: 'fitness',
    emblem: 'fitness_center',
    cadenceType: 'daily',
    targetLabel: '30 min training',
  },
  {
    id: 'morning-reading',
    name: 'Morning Reading',
    subtitle: '10 pages of deliberate focus',
    category: 'study',
    emblem: 'menu_book',
    cadenceType: 'daily',
    targetLabel: '10 pages',
  },
  {
    id: 'deep-hydration',
    name: 'Deep Hydration',
    subtitle: '2.5L clean water daily',
    category: 'wellness',
    emblem: 'water_drop',
    cadenceType: 'daily',
    targetLabel: '2.5L water',
  },
];

/** "Curated Archetypes" from the Empty Habits Manager design. */
export const ARCHETYPE_TEMPLATES: HabitTemplate[] = [
  {
    id: 'physical-fitness',
    name: 'Physical Fitness',
    subtitle: '5x weekly cadence',
    category: 'fitness',
    emblem: 'fitness_center',
    cadenceType: 'specific_days',
    weekdaysMask: 0b0011111,
    weeklyTarget: 5,
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness',
    subtitle: 'Daily 10m anchor',
    category: 'mindfulness',
    emblem: 'self_improvement',
    cadenceType: 'daily',
    targetLabel: '10 min',
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    subtitle: 'Mon–Fri intervals',
    category: 'craft',
    emblem: 'psychology',
    cadenceType: 'specific_days',
    weekdaysMask: 0b0011111,
  },
  {
    id: 'sleep-hygiene',
    name: 'Sleep Hygiene',
    subtitle: 'Nightly milestone',
    category: 'wellness',
    emblem: 'bedtime',
    cadenceType: 'daily',
  },
];
