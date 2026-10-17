import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, radius, space, type ColorToken } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Icon after the label (e.g. "Get Started →"). */
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Full pill shape, used by "Quick Add" / "Hold to Complete" chips. */
  pill?: boolean;
};

const PALETTE: Record<Variant, { bg: ColorToken; fg: ColorToken; pressed: ColorToken }> = {
  primary: { bg: 'primary-fixed', fg: 'on-primary-fixed', pressed: 'primary-fixed-dim' },
  secondary: { bg: 'surface-container-high', fg: 'on-surface', pressed: 'surface-container-highest' },
  ghost: { bg: 'transparent', fg: 'on-surface', pressed: 'surface-container' },
};

/** Minimum heights (DESIGN.md primary CTA is 54). minHeight, not height, so larger text never clips. */
const HEIGHT: Record<Size, number> = { lg: 54, md: 44, sm: 36 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** DESIGN.md: "Pressed state scales down to 0.98 opacity 0.9". */
const PRESSED_SCALE = 0.98;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'leading',
  disabled,
  loading,
  style,
  pill,
}: Props) {
  const p = PALETTE[variant];
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  // Tracked in state: Animated components don't support Pressable's style *function*.
  const [isPressed, setIsPressed] = useState(false);

  const animated = useAnimatedStyle(() => {
    const v = pressed.get();
    return { transform: [{ scale: 1 - v * (1 - PRESSED_SCALE) }], opacity: 1 - v * 0.1 };
  });

  const press = (to: 0 | 1) => {
    setIsPressed(to === 1);
    pressed.set(reduceMotion ? withTiming(to, { duration: 0 }) : withSpring(to, { damping: 18, stiffness: 420, mass: 0.6 }));
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => press(1)}
      onPressOut={() => press(0)}
      style={[
        styles.base,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? space(3) : space(5),
          borderRadius: pill || size !== 'lg' ? radius.full : radius['2xl'],
          backgroundColor: colors[isPressed ? p.pressed : p.bg],
        },
        disabled && { opacity: 0.4 },
        style,
        !disabled && animated,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[p.fg]} />
      ) : (
        <>
          {icon && iconPosition === 'leading' ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
          <Text
            variant={size === 'sm' ? 'label-sm' : 'label-md'}
            weight="700"
            color={p.fg}
            numberOfLines={1}
            style={styles.label}
          >
            {label}
          </Text>
          {icon && iconPosition === 'trailing' ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingVertical: space(2),
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});
