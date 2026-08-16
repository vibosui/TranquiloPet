import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type HostingEvent = {
  id: string;
  title: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
};

const statusLabel: Record<HostingEvent['status'], string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  accepted: 'Aceita',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

function formatPeriod(start: string | null, end: string | null) {
  if (!start) return 'Período ainda não definido';
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const startLabel = formatter.format(new Date(start));
  if (!end) return startLabel;
  return `${startLabel} → ${formatter.format(new Date(end))}`;
}

export default function HostingListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<HostingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);
    setError(null);

    const { data: authenticated, error: authError } = await supabase.auth.getUser();
    if (authError || !authenticated.user) {
      setEvents([]);
      setError('Sua sessão não pôde ser validada. Entre novamente para carregar as hospedagens.');
      setLoading(false);
      return;
    }

    if (authenticated.user.id !== user.id) {
      setEvents([]);
      setError('A sessão ativa não corresponde ao perfil exibido. Saia e entre novamente.');
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase.rpc('list_my_hosting_events');

    if (queryError) {
      setError('Não foi possível carregar suas hospedagens.');
    } else {
      setEvents((data ?? []) as HostingEvent[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents(false);
    }, [loadEvents]),
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`hosting-list:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hosting_events' },
        () => void loadEvents(false),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadEvents, user]);

  return (
    <ScreenShell
      eyebrow="HOSPEDAGENS"
      title="Acompanhe cada evento"
      subtitle="Cada hospedagem tem seu próprio chat, checklist, fotos e registro de entrega.">
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Buscando hospedagens...</Text>
        </View>
      ) : error ? (
        <SectionCard title="Não foi possível carregar" description={error}>
          <PrimaryButton label="Tentar novamente" onPress={() => void loadEvents()} />
        </SectionCard>
      ) : events.length === 0 ? (
        <SectionCard
          title="Nenhuma hospedagem criada"
          description="Primeiro conecte-se ao tutor ou cuidador pelo código HP. Depois vocês poderão criar o primeiro evento.">
          <PrimaryButton label="Ir para contatos" onPress={() => router.push('/contacts')} />
        </SectionCard>
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <Pressable
              key={event.id}
              accessibilityLabel={`Abrir ${event.title || 'hospedagem'}`}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/hosting/[eventId]', params: { eventId: event.id } })
              }
              style={({ pressed }) => [styles.eventCard, pressed && styles.eventCardPressed]}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{event.title || 'Hospedagem'}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{statusLabel[event.status]}</Text>
                </View>
              </View>
              <Text style={styles.period}>{formatPeriod(event.starts_at, event.ends_at)}</Text>
              <Text style={styles.openHint}>Abrir evento →</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.note}>
        O histórico permanece separado por evento, mesmo quando tutor e cuidador fazem várias hospedagens juntos.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  muted: {
    color: colors.textMuted,
  },
  list: {
    gap: spacing.md,
  },
  eventCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  eventCardPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.995 }],
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eventTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
  },
  statusText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  period: {
    color: colors.textMuted,
    fontSize: 13,
  },
  openHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
