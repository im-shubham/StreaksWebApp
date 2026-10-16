import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, type ColorToken } from '@/theme';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: ColorToken;
  color?: ColorToken;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Circular 44px touch target (`min-h-[44px] min-w-[44px] rounded-full`). */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'surface-container',
  color = 'on-surface-variant',
  size = 44,
  iconSize = 20,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors[pressed ? 'surface-container-high' : tone],
        },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}
