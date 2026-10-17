import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/** Template list row with emblem tile and a "+ Quick Add" pill (Empty Dashboard / Empty Habits Manager). */
export function TemplateRow({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card padding={spacing['space-md'] - 2} style={styles.row}>
      <View style={styles.emblem}>
        <Icon name={icon} size={24} color="on-surface" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label-md" weight="600" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="body-md" color="on-surface-variant" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
          {subtitle}
        </Text>
      </View>
      <Button label={actionLabel} icon="add" variant="secondary" size="md" onPress={onAction} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors['surface-container-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
