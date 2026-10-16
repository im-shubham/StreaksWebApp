import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { alpha, colors } from '@/theme';

/** Bottom nav from the Stitch tab screens (`nav.fixed.bottom-0 h-16 bg-surface/90 backdrop-blur-xl`). */
export const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Streaks', icon: 'local_fire_department' },
  habits: { label: 'Habits', icon: 'view_kanban' },
  insights: { label: 'Insights', icon: 'donut_large' },
  profile: { label: 'Profile', icon: 'tune' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.surface, 0.9) }]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? 'primary-fixed' : 'on-surface-variant';
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              }}
            >
              <Icon name={tab.icon} size={24} color={color} filled={focused} />
              <Text variant="micro-counter" color={color} weight={focused ? '700' : '600'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -1 },
    elevation: 12,
  },
  row: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4 },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
