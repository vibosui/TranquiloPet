import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth, type HospedaProfile } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type Connection = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
};

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  approximate_weight_kg: number | null;
  size: string | null;
  primary_photo_path: string | null;
  identification_notes: string | null;
  dossier: unknown;
  updated_at: string;
};

function parseLocalDateTime(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date;
}

export default function NewHostingScreen() {
  const router = useRouter();
  const { connectionId } = useLocalSearchParams<{ connectionId?: string }>();
  const { profile, user } = useAuth();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [caregiver, setCaregiver] = useState<HospedaProfile | null>(null);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !connectionId) {
      setError('Selecione um contato antes de criar a hospedagem.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [{ data: connectionData, error: connectionError }, { data: petData, error: petError }] =
      await Promise.all([
        supabase
          .from('connections')
          .select('id, user_a_id, user_b_id, status')
          .eq('id', connectionId)
          .single(),
        supabase
          .from('pets')
          .select(
            'id, owner_id, name, species, breed, sex, birth_date, approximate_weight_kg, size, primary_photo_path, identification_notes, dossier, updated_at',
          )
          .order('created_at', { ascending: true }),
      ]);

    if (connectionError || !connectionData) {
      setError('Não foi possível abrir este contato.');
      setLoading(false);
      return;
    }
    if (petError) {
      setError('Não foi possível carregar seus pets.');
      setLoading(false);
      return;
    }

    const nextConnection = connectionData as Connection;
    const otherUserId =
      nextConnection.user_a_id === user.id ? nextConnection.user_b_id : nextConnection.user_a_id;
    const { data: caregiverData, error: caregiverError } = await supabase
      .from('profiles')
      .select(
        'id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at',
      )
      .eq('id', otherUserId)
      .single();

    if (caregiverError || !caregiverData) {
      setError('Não foi possível carregar o perfil do contato.');
    } else {
      setConnection(nextConnection);
      setCaregiver(caregiverData as HospedaProfile);
      setPets((petData ?? []) as PetRow[]);
    }
    setLoading(false);
  }, [connectionId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPets = useMemo(
    () => pets.filter((pet) => selectedPetIds.includes(pet.id)),
    [pets, selectedPetIds],
  );

  async function createHosting() {
    if (!user || !profile || !connection || !caregiver || submitting) return;
    if (!profile.tutor_enabled) {
      setError('Ative o papel de Tutor no seu perfil antes de criar uma hospedagem.');
      return;
    }
    if (!caregiver.caregiver_enabled) {
      setError('Este contato ainda não ativou o papel de Cuidador.');
      return;
    }
    if (selectedPets.length === 0) {
      setError('Selecione pelo menos um pet para a hospedagem.');
      return;
    }

    const startDate = parseLocalDateTime(startsAt);
    const endDate = parseLocalDateTime(endsAt);
    if (!startDate || !endDate) {
      setError('Informe início e fim no formato AAAA-MM-DD HH:mm.');
      return;
    }
    if (endDate <= startDate) {
      setError('O término da hospedagem precisa ocorrer depois do início.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const defaultTitle =
      selectedPets.length === 1
        ? `Hospedagem de ${selectedPets[0].name}`
        : `Hospedagem de ${selectedPets.map((pet) => pet.name).join(', ')}`;

    const { data: eventData, error: eventError } = await supabase
      .from('hosting_events')
      .insert({
        connection_id: connection.id,
        tutor_id: user.id,
        caregiver_id: caregiver.id,
        title: title.trim() || defaultTitle,
        status: 'draft',
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        tutor_instructions: instructions.trim() || null,
      })
      .select('id')
      .single();

    if (eventError || !eventData) {
      setError('Não foi possível criar a hospedagem.');
      setSubmitting(false);
      return;
    }

    const capturedAt = new Date().toISOString();
    const eventPetRows = selectedPets.map((pet) => ({
      event_id: eventData.id,
      pet_id: pet.id,
      pet_snapshot: {
        captured_at: capturedAt,
        source_updated_at: pet.updated_at,
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        sex: pet.sex,
        birth_date: pet.birth_date,
        approximate_weight_kg: pet.approximate_weight_kg,
        size: pet.size,
        primary_photo_path: pet.primary_photo_path,
        identification_notes: pet.identification_notes,
        dossier: pet.dossier,
      },
      handoff_snapshot: {
        prepared: false,
        recorded_at: '',
        items: [],
        item_quantities: '',
        pet_state: '',
        observation: '',
        photos: [],
      },
    }));

    const { error: petSnapshotError } = await supabase
      .from('hosting_event_pets')
      .insert(eventPetRows);

    if (petSnapshotError) {
      await supabase.from('hosting_events').delete().eq('id', eventData.id);
      setError('A hospedagem foi iniciada, mas não conseguimos registrar o snapshot dos pets. Tente novamente.');
      setSubmitting(false);
      return;
    }

    await supabase.from('contact_chat_preferences').upsert({
      user_id: user.id,
      connection_id: connection.id,
      active_event_id: eventData.id,
    });

    router.replace({
      pathname: '/hosting/[eventId]/handoff',
      params: { eventId: eventData.id },
    });
  }

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Nova hospedagem">
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="NOVA HOSPEDAGEM"
      onBack={() => router.back()}
      title={caregiver ? `Com ${caregiver.full_name}` : 'Prepare o evento'}
      subtitle="O dossiê atual de cada pet será congelado neste evento para preservar exatamente o que foi combinado.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="1. Escolha o pet" description="Você pode incluir mais de um pet na mesma hospedagem.">
        {pets.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>Você precisa cadastrar ao menos um pet primeiro.</Text>
            <PrimaryButton label="Cadastrar pet" onPress={() => router.push('/pets/new')} />
          </View>
        ) : (
          <View style={styles.petList}>
            {pets.map((pet) => {
              const selected = selectedPetIds.includes(pet.id);
              return (
                <Pressable
                  key={pet.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setSelectedPetIds((current) =>
                      selected ? current.filter((id) => id !== pet.id) : [...current, pet.id],
                    )
                  }
                  style={({ pressed }) => [
                    styles.petCard,
                    selected && styles.petCardSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.petEmoji}>{pet.species === 'cat' ? '🐱' : pet.species === 'dog' ? '🐶' : '🐾'}</Text>
                  <View style={styles.petCopy}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petDetail}>{pet.breed || 'Raça não informada'}</Text>
                  </View>
                  <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '○'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard title="2. Período">
        <FormField
          label="Título da hospedagem"
          hint="Opcional. Se deixar vazio, usamos o nome dos pets."
          placeholder="Ex.: Fim de semana da Luna"
          value={title}
          onChangeText={setTitle}
        />
        <FormField
          required
          label="Início"
          hint="Formato temporário do MVP: AAAA-MM-DD HH:mm"
          placeholder="2026-08-20 18:00"
          value={startsAt}
          onChangeText={setStartsAt}
        />
        <FormField
          required
          label="Término"
          placeholder="2026-08-23 18:00"
          value={endsAt}
          onChangeText={setEndsAt}
        />
      </SectionCard>

      <SectionCard
        title="3. Orientações desta hospedagem"
        description="Use apenas para algo específico deste evento. A rotina permanente deve ficar no dossiê do pet.">
        <FormField
          label="Observações do evento"
          multiline
          textAlignVertical="top"
          placeholder="Ex.: nesta semana está usando uma ração diferente..."
          value={instructions}
          onChangeText={setInstructions}
        />
      </SectionCard>

      <SectionCard
        title="O que acontece ao continuar?"
        description="Criamos um rascunho, congelamos o dossiê dos pets e abrimos o registro de entrega. Depois você monta o checklist e envia o evento ao cuidador." />

      <PrimaryButton
        disabled={pets.length === 0}
        label="Criar rascunho e preparar entrega"
        loading={submitting}
        onPress={() => void createHosting()}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBlock: {
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  petList: {
    gap: spacing.sm,
  },
  petCard: {
    minHeight: 68,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  petCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.75,
  },
  petEmoji: {
    fontSize: 26,
  },
  petCopy: {
    flex: 1,
  },
  petName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  petDetail: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
  },
  check: {
    color: colors.border,
    fontSize: 24,
    fontWeight: '900',
  },
  checkSelected: {
    color: colors.primary,
  },
});
