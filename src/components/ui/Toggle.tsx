import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

/** Lime pill switch from the Create Habit "Daily Push Trigger" row. */
export function Toggle({ value, onChange, accessibilityLabel }: { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      style={[styles.track, { backgroundColor: colors[value ? 'primary-fixed' : 'surface-container-highest'] }]}
    >
      <View
        style={[
          styles.thumb,
          value
            ? { alignSelf: 'flex-end', backgroundColor: colors['on-primary-fixed-variant'] }
            : { alignSelf: 'flex-start', backgroundColor: colors.outline },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 56, height: 32, borderRadius: radius.full, padding: 4, justifyContent: 'center' },
  thumb: { width: 24, height: 24, borderRadius: 12 },
});
