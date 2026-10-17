import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space, type ColorToken } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text, type TextProps } from './Text';

type Props = {
  label: string;
  icon?: IconName;
  /** Leading status dot (`w-2 h-2 rounded-full`). */
  dot?: ColorToken;
  tone?: ColorToken;
  color?: ColorToken;
  variant?: TextProps['variant'];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Pill({
  label,
  icon,
  dot,
  tone = 'surface-container',
  color = 'on-surface-variant',
  variant = 'label-sm',
  onPress,
  style,
}: Props) {
  const content = (
    <View style={[styles.pill, { backgroundColor: colors[tone] }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: colors[dot] }]} /> : null}
      {icon ? <Icon name={icon} size={16} color={color} /> : null}
      <Text variant={variant} color={color} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    gap: space(1.5),
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
