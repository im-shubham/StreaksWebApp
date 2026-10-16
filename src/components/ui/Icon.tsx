import { Text, type StyleProp, type TextStyle } from 'react-native';

import { colors, type ColorToken } from '@/theme';
import { ICON_FONT, ICON_FONT_FILLED } from '@/theme/fonts';
import glyphs from '@/theme/icon-glyphs.generated.json';

export type IconName = keyof typeof glyphs;

type Props = {
  /** Material Symbols name exactly as used in the Stitch markup. */
  name: IconName;
  size?: number;
  color?: ColorToken;
  /** Stitch `font-variation-settings: 'FILL' 1`. */
  filled?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function Icon({ name, size = 24, color = 'on-surface', filled, style, accessibilityLabel }: Props) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      allowFontScaling={false}
      style={[
        {
          fontFamily: filled ? ICON_FONT_FILLED : ICON_FONT,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          textAlign: 'center',
          color: colors[color],
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {String.fromCodePoint(glyphs[name])}
    </Text>
  );
}
