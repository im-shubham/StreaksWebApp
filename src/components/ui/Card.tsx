import { View, type ViewProps } from 'react-native';

import { colors, radius, spacing, type ColorToken } from '@/theme';

type Props = ViewProps & {
  /** Stitch cards are `bg-surface-container-low rounded-xl p-space-lg` by default. */
  tone?: ColorToken;
  padding?: number;
  rounded?: keyof typeof radius;
};

export function Card({ tone = 'surface-container-low', padding = spacing['space-lg'], rounded = 'xl', style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[{ backgroundColor: colors[tone], borderRadius: radius[rounded], padding, overflow: 'hidden' }, style]}
    />
  );
}
