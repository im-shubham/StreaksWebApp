import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { STAGES, STITCH_SCREENS } from '@/design/stitchScreens';
import { spacing } from '@/theme';

/** Temporary body for tabs whose Stitch screens are scheduled for a later stage. */
export function StagePlaceholder({ slugs }: { slugs: string[] }) {
  const screens = STITCH_SCREENS.filter((s) => slugs.includes(s.slug));
  return (
    <Card style={{ gap: spacing['space-md'] }}>
      <Text variant="caption-caps" color="primary-fixed">
        In the build queue
      </Text>
      <Text variant="headline-md">Designs for this tab are scheduled.</Text>
      {screens.map((s) => (
        <View key={s.slug} style={styles.row}>
          <Icon name="pending_actions" size={18} color="on-surface-variant" />
          <Text variant="body-md" style={{ flex: 1 }}>
            {s.title}
          </Text>
          <Text variant="micro-counter" color="on-surface-variant">
            Stage {s.stage} · {STAGES[s.stage]}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-sm'] },
});
