import { StagePlaceholder } from '@/components/shell/StagePlaceholder';
import { TabScreen } from '@/components/shell/TabScreen';

export default function InsightsTab() {
  return (
    <TabScreen title="Insights">
      <StagePlaceholder slugs={['insights-analytics', 'empty-insights-analytics']} />
    </TabScreen>
  );
}
