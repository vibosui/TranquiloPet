import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PetSnapshotModal } from '@/components/pet-snapshot-modal';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type CarePetRow = {
  event_id: string;
  pet_id: string;
  event_title: string | null;
  event_status: 'accepted' | 'in_progress';
  starts_at: string | null;
  ends_at: string | null;
  pet_snapshot: unknown;
  handoff_snapshot: unknown;
};

const statusLabel: Record<CarePetRow['event_status'], string> = {
  accepted: 'Hospedagem aceita',
  in_progress: 'Em andamento',
};

function snapshotString(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start) return 'Período ainda não definido';
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const startLabel = formatter.format(new Date(start));
  return end ? `${startLabel} → ${formatter.format(new Date(end))}` : startLabel;
}

export default function PetsUnderCareScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<CarePetRow[]>([]);
  const [selected, setSelected] = useState<CarePetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPets = useCallback(async (showLoading = true) => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase.rpc('list_pets_under_my_care');

    if (queryError) {
      setError('Não foi possível carregar os pets sob seus cuidados.');
    } else {
      setRows((data ?? []) as CarePetRow[]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadPets();
    }, [loadPets]),
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`care-pets:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hosting_events' },
        () => void loadPets(false),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hosting_event_pets' },
        () => void loadPets(false),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPets, user]);

  if (!profile?.caregiver_enabled) {
    return (
      <ScreenShell onBack={() => router.back()} title="Painel do cuidador">
        <SectionCard
          title="Perfil de cuidador necessário"
          description="Ative seu perfil de cuidador para acessar pets vinculados às suas hospedagens." />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        eyebrow="PAINEL DO CUIDADOR"
        onBack={() => router.back()}
        title="Pets sob meus cuidados"
        subtitle="Aqui você consulta somente a cópia das informações enviada pelo tutor para cada hospedagem. O cadastro original do pet nunca pode ser alterado pelo cuidador.">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Buscando pets das hospedagens ativas...</Text>
          </View>
        ) : error ? (
          <SectionCard title="Não foi possível carregar" description={error}>
            <PrimaryButton label="Tentar novamente" onPress={() => void loadPets()} />
          </SectionCard>
        ) : rows.length === 0 ? (
          <SectionCard
            title="Nenhum pet sob seus cuidados agora"
            description="Quando você aceitar uma hospedagem, os snapshots dos pets daquele evento aparecerão aqui em modo somente leitura." />
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const name = snapshotString(row.pet_snapshot, 'name') ?? 'Pet';
              const species = snapshotString(row.pet_snapshot, 'species');
              return (
                <View key={`${row.event_id}:${row.pet_id}`} style={styles.petCard}>
                  <Pressable
                    accessibilityLabel={`Ver informações de ${name}`}
                    accessibilityRole="button"
                    onPress={() => setSelected(row)}
                    style={({ pressed }) => [styles.snapshotButton, pressed && styles.pressed]}>
                    <View style={styles.petIcon}>
                      <Text style={styles.petEmoji}>
                        {species === 'cat' ? '🐱' : species === 'dog' ? '🐶' : '🐾'}
                      </Text>
                    </View>
                    <View style={styles.petCopy}>
                      <Text style={styles.petName}>{name}</Text>
                      <Text style={styles.eventTitle}>{row.event_title || 'Hospedagem'}</Text>
                      <Text style={styles.period}>{formatPeriod(row.starts_at, row.ends_at)}</Text>
                      <Text style={styles.readOnlyHint}>Ver snapshot completo · somente leitura →</Text>
                    </View>
                  </Pressable>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{statusLabel[row.event_status]}</Text>
                  </View>
                  <SecondaryButton
                    label="Abrir hospedagem"
                    onPress={() =>
                      router.push({
                        pathname: '/hosting/[eventId]',
                        params: { eventId: row.event_id },
                      })
                    }
                  />
                </View>
              );
            })}
          </View>
        )}

        <SectionCard
          title="Por que é somente leitura?"
          description="O tutor continua sendo o único responsável pelo cadastro permanente do pet. Durante a hospedagem, você recebe um snapshot imutável para consultar rotina, saúde, comportamento, alimentação e orientações de emergência." />
      </ScreenShell>

      <PetSnapshotModal
        visible={Boolean(selected)}
        snapshot={selected?.pet_snapshot}
        handoffSnapshot={selected?.handoff_snapshot}
        onClose={() => setSelected(null)}
      />
    </>
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
    textAlign: 'center',
  },
  list: {
    gap: spacing.md,
  },
  petCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  snapshotButton: {
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.72,
  },
  petIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petEmoji: {
    fontSize: 25,
  },
  petCopy: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  eventTitle: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  period: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  readOnlyHint: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  statusPill: {
    alignSelf: 'flex-start',
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
});
