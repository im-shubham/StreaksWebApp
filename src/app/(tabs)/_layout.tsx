import { Tabs } from 'expo-router';

import { TabBar } from '@/components/shell/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
