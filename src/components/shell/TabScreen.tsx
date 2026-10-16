import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { AppHeader } from './AppHeader';

/** Tab screen scaffold: header + scrollable body padded above the tab bar. */
export function TabScreen({ title, children, avatarInitial }: { title: string; children: ReactNode; avatarInitial?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <AppHeader title={title} avatarInitial={avatarInitial} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 64 + insets.bottom + spacing['space-xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: { paddingHorizontal: spacing['margin-mobile'], paddingTop: spacing['space-sm'], gap: spacing['space-md'] },
});
