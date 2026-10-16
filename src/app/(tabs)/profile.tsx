import { StagePlaceholder } from '@/components/shell/StagePlaceholder';
import { TabScreen } from '@/components/shell/TabScreen';

export default function ProfileTab() {
  return (
    <TabScreen title="Profile">
      <StagePlaceholder slugs={['profile-settings', 'app-icon-picker-custom-themes']} />
    </TabScreen>
  );
}
