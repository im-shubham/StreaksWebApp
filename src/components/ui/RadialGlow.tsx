import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, type ColorToken } from '@/theme';

/**
 * Soft radial light that fades to transparent. React Native has no CSS blur,
 * so this stands in for the Stitch `bg-primary-fixed/15 blur-3xl` backlights
 * without the hard edge a plain translucent circle would have.
 */
export function RadialGlow({
  size,
  color = 'primary-fixed',
  opacity = 0.18,
  style,
}: {
  size: number;
  color?: ColorToken;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `glow-${color}`;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors[color]} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={colors[color]} stopOpacity={opacity * 0.4} />
            <Stop offset="1" stopColor={colors[color]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
