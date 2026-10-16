/**
 * Streak tiers named in the Stitch designs (Milestone Celebration,
 * Habit Details "Gold Tier Streak (21 Days)", Dashboard "3 days to Gold Tier").
 */
export const MILESTONES = [
  { days: 7, name: 'Iron Foundation' },
  { days: 21, name: 'Gold Tier' },
  { days: 30, name: 'Habit Instinct' },
  { days: 100, name: 'Centurion Mastery' },
] as const;

export type Milestone = (typeof MILESTONES)[number];

export function nextMilestone(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.days > streak) ?? null;
}

/** Milestone reached exactly at this streak value, if any (for celebrations). */
export function milestoneAt(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.days === streak) ?? null;
}
