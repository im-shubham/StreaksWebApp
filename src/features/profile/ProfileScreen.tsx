import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { TabScreen } from '@/components/shell/TabScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { useLiveQuery } from '@/db/live';
import { PROFILE_SQL, type ProfileRow } from '@/db/repositories/profile';
import { formatClock } from '@/domain/dates';
import { PLAN_LIMITS } from '@/domain/plans';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHabitBoard } from '@/features/habits/useHabitBoard';
import { wipeLocalData } from '@/sync/engine';
import { useSyncStatus, type SyncStatus } from '@/sync/status';
import type { LocalDb } from '@/sync/types';
import { colors, radius, spacing, type ColorToken } from '@/theme';

/** Stitch: "STREAKS - Profile & Settings" (account + sync + sign out for the MVP). */
export function ProfileScreen() {
  const sqlite = useSQLiteContext();
  const { auth, signOut, syncNow } = useAuth();
  const sync = useSyncStatus();
  const board = useHabitBoard();
  const profile = useLiveQuery<ProfileRow>(PROFILE_SQL, [], ['profile'])?.[0];
  const pending = useLiveQuery<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox', [], ['sync_outbox'])?.[0]?.n ?? 0;
  const [busy, setBusy] = useState(false);

  const signedIn = auth.status === 'signedIn';
  const name = profile?.display_name || (signedIn ? auth.user.email?.split('@')[0] : null) || 'Guest';
  const tier = profile?.tier ?? 'guest';
  const activeCount = board.loading ? 0 : board.active.length;

  const confirmSignOut = () => {
    const unsynced = pending > 0 && sync.state !== 'idle';
    Alert.alert(
      'Sign Out of STREAKS?',
      unsynced
        ? `${pending} change${pending === 1 ? '' : 's'} haven’t reached the cloud yet and will be lost. This device’s copy of your habits is removed on sign out.`
        : 'Your habits are saved to your account. This device’s copy is removed and comes back when you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await signOut();
              router.replace('/welcome');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmResetGuest = () =>
    Alert.alert('Delete all guest data?', 'Removes every habit and check-in from this device. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await wipeLocalData(sqlite as unknown as LocalDb);
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <TabScreen title="Profile" avatarInitial={name[0]?.toUpperCase()}>
      <Card style={styles.identity}>
        <View style={styles.avatar}>
          <Text variant="headline-lg" color="on-primary-fixed">
            {name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline-md" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="body-md" color="on-surface-variant" numberOfLines={2}>
            {signedIn ? auth.user.email : 'Local device storage · Unsynced'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <Pill label={tier === 'guest' ? 'Guest' : tier === 'pro' ? 'Pro' : 'Free Plan'} tone="surface-container-high" color="primary-fixed" variant="micro-counter" />
            <Pill
              label={`${activeCount} / ${PLAN_LIMITS[tier].maxActiveHabits} Active`}
              tone="surface-container-high"
              variant="micro-counter"
            />
          </View>
        </View>
      </Card>

      {signedIn ? (
        <SyncCard status={sync} pending={pending} onSync={() => void syncNow()} />
      ) : (
        <Card style={{ gap: spacing['space-md'] }}>
          <View style={styles.row}>
            <Icon name="warning" size={22} color="warning" filled />
            <View style={{ flex: 1 }}>
              <Text variant="label-md" weight="600">
                Streaks are saved locally
              </Text>
              <Text variant="body-md" color="on-surface-variant">
                Deleting the app or switching phones loses your streak. Create a free account to back it up and sync.
              </Text>
            </View>
          </View>
          <Button label="Create Free Account" icon="person_add" onPress={() => router.push('/auth/sign-up')} />
          <Button label="I Already Have an Account" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
        </Card>
      )}

      <Text variant="caption-caps" color="on-surface-variant" style={{ marginTop: spacing['space-sm'] }}>
        Account Control
      </Text>
      <Card padding={spacing['space-sm']}>
        {signedIn ? (
          <Row icon="logout" label="Sign Out" color="on-surface" onPress={confirmSignOut} disabled={busy} />
        ) : (
          <Row icon="delete_forever" label="Delete All Guest Data" sub="Removes habits and history from this device" color="error" onPress={confirmResetGuest} />
        )}
      </Card>

      <Text variant="micro-counter" color="outline" align="center" style={{ marginTop: spacing['space-md'] }}>
        STREAKS · v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </TabScreen>
  );
}

function SyncCard({ status, pending, onSync }: { status: SyncStatus; pending: number; onSync: () => void }) {
  const last = 'lastSyncedAt' in status && status.lastSyncedAt ? formatClock(status.lastSyncedAt) : null;
  const view: { icon: IconName; color: ColorToken; title: string; sub: string } =
    status.state === 'syncing'
      ? { icon: 'sync', color: 'primary-fixed', title: 'Syncing…', sub: `${pending} pending change${pending === 1 ? '' : 's'}` }
      : status.state === 'idle'
        ? pending > 0
          ? { icon: 'cloud_upload', color: 'warning', title: `${pending} change${pending === 1 ? '' : 's'} waiting`, sub: last ? `Last synced ${last}` : 'Not synced yet' }
          : { icon: 'cloud_done', color: 'primary-fixed', title: 'Cloud Sync Active', sub: last ? `Synced at ${last}` : 'Up to date' }
        : status.state === 'offline'
          ? { icon: 'cloud_off', color: 'warning', title: 'Offline', sub: `${pending} change${pending === 1 ? '' : 's'} saved on device · will sync when online` }
          : status.state === 'error'
            ? { icon: 'sync_problem', color: 'error', title: 'Sync failed', sub: status.message }
            : { icon: 'cloud_off', color: 'on-surface-variant', title: 'Sync off', sub: 'Sign in to sync' };
  return (
    <Card style={{ gap: spacing['space-md'] }}>
      <View style={styles.row}>
        <Icon name={view.icon} size={24} color={view.color} />
        <View style={{ flex: 1 }}>
          <Text variant="caption-caps" color="on-surface-variant">
            Cloud Sync
          </Text>
          <Text variant="label-md" weight="600" color={view.color === 'error' ? 'error' : 'on-surface'}>
            {view.title}
          </Text>
          <Text variant="body-md" color="on-surface-variant">
            {view.sub}
          </Text>
        </View>
      </View>
      <Button label="Sync Now" icon="sync" variant="secondary" size="md" onPress={onSync} loading={status.state === 'syncing'} />
    </Card>
  );
}

function Row({
  icon,
  label,
  sub,
  color,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  color: ColorToken;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={sub}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors['surface-container'] }, disabled && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={22} color={color} />
      <View style={{ flex: 1 }}>
        <Text variant="label-md" weight="600" color={color}>
          {label}
        </Text>
        {sub ? (
          <Text variant="label-md" color="on-surface-variant">
            {sub}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron_right" size={20} color="outline" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors['primary-fixed'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing['space-md'] - 4, alignItems: 'flex-start' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-md'] - 4, padding: spacing['space-md'] - 4, borderRadius: radius.lg },
});
