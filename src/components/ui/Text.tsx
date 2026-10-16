import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

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
};

const CAPS_VARIANTS: TypeVariant[] = ['caption-caps', 'micro-counter'];

export function Text({
  variant = 'body-md',
  color = 'on-surface',
  weight,
  uppercase,
  tabular,
  align,
  style,
  ...rest
}: TextProps) {
  const t = typography[variant];
  const w = weight ?? (t.fontWeight as FontWeight);
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[w],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
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
