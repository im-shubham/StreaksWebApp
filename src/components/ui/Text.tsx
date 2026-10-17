import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, fontFamily, typography, type ColorToken, type FontWeight, type TypeVariant } from '@/theme';

export type TextProps = RNTextProps & {
  /** Stitch type scale token (`font-headline-md` etc.). */
  variant?: TypeVariant;
  color?: ColorToken;
  /** Overrides the variant weight, as Stitch markup often does (`font-semibold`). */
  weight?: FontWeight;
  /** Stitch micro-caps are always uppercase. */
  uppercase?: boolean;
  /** Tabular figures for streak counters and metrics. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  /** Single line that shrinks (down to 70%) instead of overflowing, for headings and numerals. */
  fit?: boolean;
};

const CAPS_VARIANTS: TypeVariant[] = ['caption-caps', 'micro-counter'];

/** Stitch screens are authored on a 390pt-wide canvas (iPhone 12–16). */
const DESIGN_WIDTH = 390;

/**
 * Width-responsive size: large display/headline text scales down on narrower
 * iPhones (SE / mini) so it keeps the Stitch proportions; body and label text
 * keeps its size for readability.
 */
export function responsiveFontSize(size: number, windowWidth: number): number {
  const ratio = windowWidth / DESIGN_WIDTH;
  if (size >= 28) return Math.round(size * Math.min(1, Math.max(0.8, ratio)));
  if (size >= 18) return Math.round(size * Math.min(1, Math.max(0.9, ratio)));
  return size;
}

/**
 * Upper bound for iOS Dynamic Type / Android font scale per style. Body copy
 * may grow the most; display numerals and micro-caps are layout-critical.
 */
function maxScaleFor(variant: TypeVariant): number {
  if (variant.startsWith('display') || variant === 'headline-xl') return 1.1;
  if (variant.startsWith('headline') || CAPS_VARIANTS.includes(variant)) return 1.2;
  return 1.35;
}

export function Text({
  variant = 'body-md',
  color = 'on-surface',
  weight,
  uppercase,
  tabular,
  align,
  fit,
  style,
  ...rest
}: TextProps) {
  const { width } = useWindowDimensions();
  const t = typography[variant];
  const w = weight ?? (t.fontWeight as FontWeight);
  const fontSize = responsiveFontSize(t.fontSize, width);
  const k = fontSize / t.fontSize;
  return (
    <RNText
      maxFontSizeMultiplier={maxScaleFor(variant)}
      {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 } : null)}
      {...rest}
      style={[
        {
          fontFamily: fontFamily[w],
          fontSize,
          lineHeight: Math.round(t.lineHeight * k),
          letterSpacing: t.letterSpacing * k,
          color: colors[color],
          textAlign: align,
          textTransform: uppercase ?? CAPS_VARIANTS.includes(variant) ? 'uppercase' : undefined,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
