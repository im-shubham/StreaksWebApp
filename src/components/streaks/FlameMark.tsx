import Svg, { Path } from 'react-native-svg';

import { colors, type ColorToken } from '@/theme';

/**
 * "Stylized Neon Kinetic Flame Vector" — path copied verbatim from the
 * Main Dashboard Stitch markup (viewBox 0 0 48 48).
 *
 * Also stands in for the header logo until the original Stitch logo image is
 * exported (its URL is private; see design/stitch/README.md).
 */
const FLAME_PATH =
  'M26.4 3.2C26.1 4.5 25.8 6.1 24.8 7.4C23.6 8.9 21.8 10.3 20.3 12.1C17.1 16 15 20.5 15 25.8C15 31.4 19 36 24.6 36C30.2 36 34.2 31.4 34.2 25.8C34.2 19.3 29.8 13.9 29.8 13.9C29.8 13.9 29.4 19.1 26.6 21.2C25.4 22.1 23.7 22.2 23.7 22.2C23.7 22.2 25.5 17.8 24.1 14.5C23.2 12.4 21.3 10.8 21.3 10.8C21.3 10.8 26.9 7.7 26.4 3.2ZM24.6 28.2C22.6 28.2 21 29.8 21 31.8C21 33.8 22.6 35.4 24.6 35.4C26.6 35.4 28.2 33.8 28.2 31.8C28.2 29.8 26.6 28.2 24.6 28.2Z';

export function FlameMark({ size = 80, color = 'primary-fixed' }: { size?: number; color?: ColorToken }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path d={FLAME_PATH} fill={colors[color]} />
    </Svg>
  );
}
