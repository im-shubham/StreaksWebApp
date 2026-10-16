import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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

const HEIGHT: Record<Size, number> = { lg: 54, md: 44, sm: 36 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled,
  loading,
  style,
  pill,
}: Props) {
  const p = PALETTE[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? space(3) : space(5),
          borderRadius: pill || size !== 'lg' ? radius.full : radius['2xl'],
          backgroundColor: colors[pressed ? p.pressed : p.bg],
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[p.fg]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
          <Text variant={size === 'sm' ? 'label-sm' : 'label-md'} weight="700" color={p.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
