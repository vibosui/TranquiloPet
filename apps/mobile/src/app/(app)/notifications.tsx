import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type NotificationRow = {
  id: string;
  event_id: string | null;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: loadError } = await supabase
      .from('notifications')
      .select('id, event_id, type, title, body, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (loadError) setError('Não foi possível carregar suas notificações.');
    else {
      setRows((data ?? []) as NotificationRow[]);
      setError(null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notification-center:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user?.id]);

  const unread = useMemo(() => rows.filter((row) => !row.read_at).length, [rows]);

  async function openNotification(row: NotificationRow) {
    if (!user?.id) return;
    if (!row.read_at) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('user_id', user.id);
    }
    if (row.event_id) {
      router.push({ pathname: '/hosting/[eventId]', params: { eventId: row.event_id } });
    } else {
      await load();
    }
  }

  async function markAllRead() {
    if (!user?.id || unread === 0) return;
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (updateError) setError('Não foi possível marcar as notificações como lidas.');
    else await load();
  }

  return (
    <ScreenShell
      eyebrow="ATUALIZAÇÕES"
      onBack={() => router.back()}
      title="Notificações"
      subtitle={unread ? `${unread} atualização(ões) ainda não lida(s).` : 'Você está em dia com as hospedagens.'}>
      {error ? <ErrorBanner message={error} /> : null}
      {unread > 0 ? <SecondaryButton label="Marcar todas como lidas" onPress={() => void markAllRead()} /> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhuma notificação ainda</Text>
          <Text style={styles.emptyText}>
            Solicitações, respostas, fotos, vídeos, checklist, ocorrências e mudanças de estado aparecerão aqui.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => void openNotification(row)}
              style={({ pressed }) => [
                styles.card,
                !row.read_at && styles.cardUnread,
                pressed && styles.pressed,
              ]}>
              <View style={styles.header}>
                <View style={[styles.dot, row.read_at && styles.dotRead]} />
                <Text style={styles.title}>{row.title}</Text>
                <Text style={styles.time}>{formatDate(row.created_at)}</Text>
              </View>
              <Text style={styles.body}>{row.body}</Text>
              {row.event_id ? <Text style={styles.link}>Abrir hospedagem ›</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotRead: { backgroundColor: colors.border },
  title: { flex: 1, minWidth: 0, color: colors.text, fontSize: 13, fontWeight: '900' },
  time: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  link: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  empty: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
