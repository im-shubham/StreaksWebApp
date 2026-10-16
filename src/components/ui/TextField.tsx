import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radius, spacing, typography } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: IconName;
  /** Right-aligned label accessory, e.g. "Forgot?" */
  accessory?: { label: string; onPress: () => void };
  error?: string | null;
  secure?: boolean;
};

/** Labeled input from the Stitch auth screens (icon, focus ring, eye toggle). */
export function TextField({ label, icon, accessory, error, secure, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: spacing['space-sm'] }}>
      <View style={styles.labelRow}>
        <Text variant="label-md" weight="600" color="on-surface-variant">
          {label}
        </Text>
        {accessory ? (
          <Pressable onPress={accessory.onPress} hitSlop={8} accessibilityRole="button">
            <Text variant="label-md" weight="600" color="primary-fixed">
              {accessory.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View
        style={[
          styles.box,
          focused && { borderColor: colors['primary-fixed'] },
          !!error && { borderColor: colors.error },
        ]}
      >
        {icon ? <Icon name={icon} size={22} color="on-surface-variant" /> : null}
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure ? hidden : undefined}
          placeholderTextColor={colors.outline}
          selectionColor={colors['primary-fixed']}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'visibility' : 'visibility_off'} size={22} color="on-surface-variant" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color="error" filled />
          <Text variant="label-sm" color="error" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  box: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-sm'] + 4,
    paddingHorizontal: spacing['space-md'],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors['surface-container-high'],
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors['on-surface'],
    fontFamily: fontFamily['400'],
    fontSize: typography['body-lg'].fontSize,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
