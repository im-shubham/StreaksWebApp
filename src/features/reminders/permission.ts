import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import {
  getReminderPermission,
  openNotificationSettings,
  requestReminderPermission,
  type ReminderPermission,
} from '@/services/notifications';

/** Current notification permission, refreshed when the app returns from Settings. */
export function useReminderPermission() {
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const refresh = useCallback(() => {
    void getReminderPermission()
      .then(setPermission)
      .catch(() => setPermission('unsupported'));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  return { permission, refresh };
}

/**
 * Asks for permission if the user hasn't decided; if they said no before,
 * explains how to turn it on. Resolves true when reminders can be shown.
 */
export async function ensureReminderPermission(): Promise<boolean> {
  const result = await requestReminderPermission().catch(() => 'unsupported' as const);
  if (result === 'granted') return true;
  if (result === 'denied') {
    Alert.alert(
      'Notifications are off',
      'Your reminder is saved, but MOMENTUM isn’t allowed to show notifications. Turn them on in Settings.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void openNotificationSettings() },
      ],
    );
  }
  return false;
}
