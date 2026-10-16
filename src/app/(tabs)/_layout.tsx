import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/shell/TabBar';
import { useLiveQuery } from '@/db/live';
import { PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import { colors } from '@/theme';

export default function TabsLayout() {
  const profile = useLiveQuery<ProfileRow>(PROFILE_SQL, [], ['profile']);
  if (!profile) return null;
  // First launch (or after sign-out): choose guest or account on Welcome.
  if (!profile[0]?.onboarded_at) return <Redirect href="/welcome" />;

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
