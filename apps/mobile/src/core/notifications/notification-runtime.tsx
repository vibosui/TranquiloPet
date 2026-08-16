import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  event_id: string | null;
  payload: Record<string, unknown> | null;
};

function notificationUrl(data: Record<string, unknown> | undefined) {
  const explicitUrl = data?.url;
  if (typeof explicitUrl === 'string' && explicitUrl.startsWith('/')) return explicitUrl;
  const eventId = data?.event_id;
  if (typeof eventId === 'string' && eventId) return `/hosting/${eventId}`;
  return '/notifications';
}

async function markNotificationRead(notificationId: unknown, userId: string | null) {
  if (typeof notificationId !== 'string' || !userId) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

async function registerDevice(userId: string) {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('hosting-updates', {
      name: 'Atualizações de hospedagem',
      description: 'Fotos, checklist, ocorrências, respostas e mudanças da hospedagem.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#FF7325',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const requested = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (requested.status !== 'granted') return false;

  if (!Device.isDevice) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return false;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return false;

    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS,
        device_label: Device.modelName ?? Device.deviceName ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' },
    );
    return !error;
  } catch {
    // Expo Go no Android não fornece push remoto no SDK 54. O fallback
    // por Realtime + notificação local continua funcionando durante o beta.
    return false;
  }
}

async function presentLocalNotification(row: NotificationRow) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: row.title,
      body: row.body,
      sound: 'default',
      data: {
        ...(row.payload ?? {}),
        notification_id: row.id,
        event_id: row.event_id,
        url: notificationUrl(row.payload ?? undefined),
      },
    },
    trigger: null,
  });
}

export function NotificationRuntime({ children }: PropsWithChildren) {
  const { loading, user } = useAuth();
  const [remotePushReady, setRemotePushReady] = useState(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    if (loading || !user?.id || Platform.OS === 'web') {
      setRemotePushReady(false);
      return;
    }

    let active = true;
    void registerDevice(user.id).then((ready) => {
      if (active) setRemotePushReady(ready);
    });
    return () => {
      active = false;
    };
  }, [loading, user?.id]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (remotePushReady) return;
          void presentLocalNotification(payload.new as NotificationRow);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [remotePushReady, user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const redirect = (notification: Notifications.Notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      void markNotificationRead(data.notification_id, userIdRef.current);
      router.push(notificationUrl(data) as Href);
    };

    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse?.notification) redirect(initialResponse.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });

    return () => subscription.remove();
  }, []);

  return children;
}
