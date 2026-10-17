import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { APP_NAME, BrandLogo } from '@/components/brand/BrandLogo';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { alpha, colors, radius, spacing } from '@/theme';

export const HEADER_HEIGHT = 64;

/**
 * Tab-screen header from the Stitch tab screens: brand logo, app-name
 * micro-caps over the screen title, "All Daily" filter pill, avatar.
 */
export function AppHeader({ title, avatarInitial }: { title: string; avatarInitial?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <BrandLogo size={36} />
          <View>
            <Text variant="caption-caps" color="primary-fixed">
              {APP_NAME}
            </Text>
            <Text variant="headline-md" style={{ lineHeight: 22 }}>
              {title}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {/* Habit filter; options arrive with multi-cadence filtering (Stage 2). */}
          <View style={styles.filter}>
            <Text variant="label-sm" weight="500" numberOfLines={1}>
              All Daily
            </Text>
            <Icon name="expand_more" size={18} color="outline" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="User Profile"
            onPress={() => router.navigate('/profile')}
            style={styles.avatarHit}
          >
            <View style={styles.avatar}>
              {avatarInitial ? (
                <Text variant="label-md" weight="700">
                  {avatarInitial}
                </Text>
              ) : (
                <Icon name="person" size={20} color="on-surface-variant" filled />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: alpha(colors.surface, 0.95),
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 1 },
    elevation: 8,
    zIndex: 10,
  },
  row: {
    height: HEADER_HEIGHT,
    paddingHorizontal: spacing['margin-mobile'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['space-sm'],
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'], flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-xs'] },
  filter: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors['surface-container-high'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
