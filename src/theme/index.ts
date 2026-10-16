import { stitchColors, stitchRadius, stitchSpacing, stitchTypography } from './tokens.generated';

/**
 * Design tokens for the "Obsidian Velocity" Stitch design system.
 *
 * Raw values come from tokens.generated.ts (extracted from the Stitch
 * screens). This file only adds names for colors the screens use outside the
 * Tailwind config, plus RN-specific font mapping. Do not invent new colors
 * here; add them to Stitch and regenerate.
 */
export const colors = {
  ...stitchColors,
  // Arbitrary values used directly in Stitch screen markup.
  warning: '#ffb020', // at-risk / streak-expiring accents
  black: '#000000',
  white: '#ffffff',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;

export const radius = stitchRadius;

/** Tailwind numeric spacing step (`gap-3` = 12px) plus the named Stitch spacing. */
export const space = (n: number) => n * 4;
export const spacing = stitchSpacing;

export const fontFamily = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fontFamily;
export type TypeVariant = keyof typeof stitchTypography;

export const typography = stitchTypography;

/** Neon bloom used only on completion / active streak states (see DESIGN.md). */
export const glow = {
  shadowColor: stitchColors['primary-fixed'],
  shadowOpacity: 0.45,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
} as const;

/** Hold-to-complete threshold from the Stitch design spec. */
export const HOLD_TO_COMPLETE_MS = 450;

/** Alpha helper for hex tokens, e.g. alpha(colors['primary-fixed'], 0.1). */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
