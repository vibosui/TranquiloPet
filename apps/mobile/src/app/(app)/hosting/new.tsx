import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, parsePickerValue } from '@/components/date-time-field';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { type CarePlan, type CarePlanCode, planShortFeatures } from '@/features/hosting/plans';
import { colors, radii, spacing } from '@/theme/tokens';

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  size: string | null;
};

type CaregiverMatch = {
  id: string;
  public_code: string;
  full_name: string;
  avatar_path: string | null;
  plan_codes: string[];
  accepts_multiday: boolean;
  available_weekdays: number[];
  starts_at: string | null;
  ends_at: string | null;
};

type FieldErrors = {
  plan?: string;
  pets?: string;
  startsAt?: string;
  endsAt?: string;
  caregiver?: string;
};

const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function NewHostingScreen() {
  const router = useRouter();
  const { caregiverId: preferredCaregiverId } = useLocalSearchParams<{ caregiverId?: string }>();
  const { profile, user } = useAuth();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [primaryPlanCode, setPrimaryPlanCode] = useState<CarePlanCode | null>(null);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [petPlans, setPetPlans] = useState<Record<string, CarePlanCode>>({});
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [matches, setMatches] = useState<CaregiverMatch[]>([]);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [plansResult, petsResult] = await Promise.all([
      supabase
        .from('care_plans')
        .select('code, name, tagline, description, min_photos_per_day, suggested_photos_per_day, min_videos_per_day, video_max_seconds, activity_required, daily_report, sort_order')
        .order('sort_order'),
      supabase
        .from('pets')
        .select('id, name, species, breed, size')
        .eq('owner_id', user.id)
        .order('created_at'),
    ]);

    if (plansResult.error || petsResult.error) {
      setError('Não foi possível preparar a criação da hospedagem.');
    } else {
      setPlans((plansResult.data ?? []) as CarePlan[]);
      setPets((petsResult.data ?? []) as PetRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPets = useMemo(
    () => pets.filter((pet) => selectedPetIds.includes(pet.id)),
    [pets, selectedPetIds],
  );

  const requiredPlanCodes = useMemo(
    () => Array.from(new Set(selectedPetIds.map((petId) => petPlans[petId]).filter(Boolean))) as CarePlanCode[],
    [petPlans, selectedPetIds],
  );

  function selectPrimaryPlan(code: CarePlanCode) {
    setPrimaryPlanCode(code);
    setPetPlans((current) => {
      const next = { ...current };
      selectedPetIds.forEach((petId) => {
        next[petId] = code;
      });
      return next;
    });
    setMatches([]);
    setSelectedCaregiverId(null);
    setSearched(false);
    setFieldErrors((current) => ({ ...current, plan: undefined, caregiver: undefined }));
  }

  function togglePet(petId: string) {
    if (!primaryPlanCode) {
      setFieldErrors((current) => ({ ...current, plan: 'Escolha primeiro o nível de acompanhamento.' }));
      return;
    }
    const selected = selectedPetIds.includes(petId);
    setSelectedPetIds((current) => selected ? current.filter((id) => id !== petId) : [...current, petId]);
    setPetPlans((current) => {
      const next = { ...current };
      if (selected) delete next[petId];
      else next[petId] = primaryPlanCode;
      return next;
    });
    setMatches([]);
    setSelectedCaregiverId(null);
    setSearched(false);
    setFieldErrors((current) => ({ ...current, pets: undefined, caregiver: undefined }));
  }

  function setPlanForPet(petId: string, code: CarePlanCode) {
    setPetPlans((current) => ({ ...current, [petId]: code }));
    setMatches([]);
    setSelectedCaregiverId(null);
    setSearched(false);
  }

  function validateBeforeSearch() {
    const next: FieldErrors = {};
    if (!primaryPlanCode) next.plan = 'Escolha um plano.';
    if (!selectedPetIds.length) next.pets = 'Selecione ao menos um pet.';
    const start = parsePickerValue(startsAt, 'datetime');
    const end = parsePickerValue(endsAt, 'datetime');
    if (!start) next.startsAt = 'Selecione a data e o horário de início.';
    if (!end) next.endsAt = 'Selecione a data e o horário de término.';
    if (start && end && end <= start) next.endsAt = 'O término precisa acontecer depois do início.';
    setFieldErrors(next);
    return { valid: Object.keys(next).length === 0, start, end };
  }

  async function findCaregivers() {
    if (searching) return;
    const { valid, start, end } = validateBeforeSearch();
    if (!valid || !start || !end) {
      Alert.alert('Revise a hospedagem', 'Plano, pet(s) e período são necessários antes de buscar cuidadores.');
      return;
    }

    setSearching(true);
    setError(null);
    const { data, error: matchError } = await supabase.rpc('list_compatible_caregivers', {
      p_starts_at: start.toISOString(),
      p_ends_at: end.toISOString(),
      p_plan_codes: requiredPlanCodes,
    });

    if (matchError) {
      setError('Não foi possível buscar cuidadores compatíveis agora.');
    } else {
      const nextMatches = (data ?? []) as CaregiverMatch[];
      setMatches(nextMatches);
      setSearched(true);
      const preferred = nextMatches.find((item) => item.id === preferredCaregiverId);
      setSelectedCaregiverId(preferred?.id ?? null);
    }
    setSearching(false);
  }

  async function createHosting() {
    if (!user || !profile || submitting) return;
    const { valid, start, end } = validateBeforeSearch();
    if (!profile.tutor_enabled) {
      Alert.alert('Papel de tutor necessário', 'Ative o papel de Tutor no seu perfil para criar hospedagens.');
      return;
    }
    if (!valid || !start || !end || !selectedCaregiverId) {
      setFieldErrors((current) => ({ ...current, caregiver: selectedCaregiverId ? undefined : 'Escolha um cuidador compatível.' }));
      return;
    }

    const defaultTitle = selectedPets.length === 1
      ? `Hospedagem de ${selectedPets[0].name}`
      : `Hospedagem de ${selectedPets.map((pet) => pet.name).join(', ')}`;

    setSubmitting(true);
    setError(null);
    const { data, error: createError } = await supabase.rpc('create_hosting_draft_with_plans', {
      p_caregiver_id: selectedCaregiverId,
      p_starts_at: start.toISOString(),
      p_ends_at: end.toISOString(),
      p_title: defaultTitle,
      p_pet_plans: selectedPetIds.map((petId) => ({ pet_id: petId, plan_code: petPlans[petId] })),
    });

    if (createError || !data) {
      setError(createError?.message.includes('compatible')
        ? 'A disponibilidade do cuidador mudou. Faça a busca novamente.'
        : 'Não foi possível criar a hospedagem.');
      setSubmitting(false);
      return;
    }

    router.replace({ pathname: '/hosting/[eventId]/handoff', params: { eventId: String(data) } });
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
      title="Escolha o cuidado antes do cuidador"
      subtitle="O plano é definido primeiro. Depois mostramos somente cuidadores compatíveis com o nível escolhido, o período e a disponibilidade informada.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="1. Nível de acompanhamento" description="O cuidado essencial permanece em todos. O que muda é a frequência e o detalhamento do acompanhamento.">
        <View style={styles.planList}>
          {plans.map((plan) => {
            const selected = primaryPlanCode === plan.code;
            return (
              <Pressable
                key={plan.code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => selectPrimaryPlan(plan.code)}
                style={({ pressed }) => [styles.planCard, selected && styles.planCardSelected, pressed && styles.pressed]}>
                <View style={styles.planHeader}>
                  <View style={styles.planCopy}>
                    {plan.code === 'care_plus' ? <Text style={styles.recommended}>MAIS ESCOLHIDO</Text> : null}
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planTagline}>{plan.tagline}</Text>
                  </View>
                  <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '○'}</Text>
                </View>
                {planShortFeatures(plan).map((feature) => <Text key={feature} style={styles.feature}>• {feature}</Text>)}
              </Pressable>
            );
          })}
        </View>
        {fieldErrors.plan ? <Text style={styles.fieldError}>{fieldErrors.plan}</Text> : null}
      </SectionCard>

      <SectionCard title="2. Pet(s)" description="O plano escolhido é aplicado aos pets selecionados. Se necessário, você pode ajustar o plano individualmente por pet antes da busca.">
        {pets.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>Cadastre pelo menos um pet antes de continuar.</Text>
            <PrimaryButton label="Cadastrar pet" onPress={() => router.push('/pets/new')} />
          </View>
        ) : (
          <View style={styles.petList}>
            {pets.map((pet) => {
              const selected = selectedPetIds.includes(pet.id);
              return (
                <View key={pet.id} style={[styles.petWrapper, selected && styles.petWrapperSelected]}>
                  <Pressable accessibilityRole="button" onPress={() => togglePet(pet.id)} style={({ pressed }) => [styles.petCard, pressed && styles.pressed]}>
                    <Text style={styles.petEmoji}>{pet.species === 'cat' ? '🐱' : pet.species === 'dog' ? '🐶' : '🐾'}</Text>
                    <View style={styles.petCopy}>
                      <Text style={styles.petName}>{pet.name}</Text>
                      <Text style={styles.petDetail}>{pet.breed || 'Raça não informada'}{pet.size ? ` • porte ${pet.size}` : ''}</Text>
                    </View>
                    <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '○'}</Text>
                  </Pressable>
                  {selected ? (
                    <View style={styles.petPlanRow}>
                      {plans.map((plan) => (
                        <Pressable key={plan.code} onPress={() => setPlanForPet(pet.id, plan.code)} style={[styles.planChip, petPlans[pet.id] === plan.code && styles.planChipSelected]}>
                          <Text style={[styles.planChipText, petPlans[pet.id] === plan.code && styles.planChipTextSelected]}>{plan.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        {fieldErrors.pets ? <Text style={styles.fieldError}>{fieldErrors.pets}</Text> : null}
      </SectionCard>

      <SectionCard title="3. Período" description="A busca considera os dias disponíveis, a janela de recebimento/entrega e se o cuidador aceita estadias acima de 24 horas.">
        <DateTimeField required label="Início" mode="datetime" value={startsAt} error={fieldErrors.startsAt} placeholder="Selecionar início" onChange={(value) => { setStartsAt(value); setMatches([]); setSearched(false); setSelectedCaregiverId(null); setFieldErrors((current) => ({ ...current, startsAt: undefined, caregiver: undefined })); }} />
        <DateTimeField required label="Término" mode="datetime" value={endsAt} error={fieldErrors.endsAt} placeholder="Selecionar término" onChange={(value) => { setEndsAt(value); setMatches([]); setSearched(false); setSelectedCaregiverId(null); setFieldErrors((current) => ({ ...current, endsAt: undefined, caregiver: undefined })); }} />
        <PrimaryButton label="Buscar cuidadores compatíveis" loading={searching} onPress={() => void findCaregivers()} />
      </SectionCard>

      {searched ? (
        <SectionCard title="4. Cuidador compatível" description="Somente perfis que oferecem todos os planos escolhidos e declararam disponibilidade para este período aparecem aqui.">
          {matches.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum cuidador compatível foi encontrado para esta combinação. Tente outro período ou nível de acompanhamento.</Text>
          ) : (
            <View style={styles.matchList}>
              {matches.map((caregiver) => {
                const selected = selectedCaregiverId === caregiver.id;
                return (
                  <Pressable key={caregiver.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setSelectedCaregiverId(caregiver.id); setFieldErrors((current) => ({ ...current, caregiver: undefined })); }} style={({ pressed }) => [styles.matchCard, selected && styles.matchCardSelected, pressed && styles.pressed]}>
                    <View style={styles.matchHeader}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{caregiver.full_name.slice(0, 1).toUpperCase()}</Text></View>
                      <View style={styles.matchCopy}>
                        <Text style={styles.matchName}>{caregiver.full_name}</Text>
                        <Text style={styles.matchCode}>{caregiver.public_code}</Text>
                      </View>
                      <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '○'}</Text>
                    </View>
                    <Text style={styles.matchMeta}>{caregiver.accepts_multiday ? 'Aceita hospedagem por vários dias' : 'Disponível para estadias de até 24 h'}</Text>
                    <Text style={styles.matchMeta}>Dias: {caregiver.available_weekdays.map((day) => weekdayLabels[day]).join(', ')}</Text>
                    <Text style={styles.matchMeta}>Janela: {String(caregiver.starts_at ?? '').slice(0, 5)}–{String(caregiver.ends_at ?? '').slice(0, 5)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {fieldErrors.caregiver ? <Text style={styles.fieldError}>{fieldErrors.caregiver}</Text> : null}
          <PrimaryButton disabled={!selectedCaregiverId} label="Criar hospedagem" loading={submitting} onPress={() => void createHosting()} />
          <Text style={styles.lockNote}>O plano é congelado por pet quando a hospedagem é criada e não pode ser alterado neste MVP.</Text>
        </SectionCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  planList: { gap: spacing.md },
  planCard: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm },
  planCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planCopy: { flex: 1, minWidth: 0 },
  recommended: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  planName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  planTagline: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  feature: { color: colors.text, fontSize: 12, lineHeight: 17 },
  petList: { gap: spacing.md },
  petWrapper: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: 'hidden' },
  petWrapperSelected: { borderColor: colors.primary },
  petCard: { padding: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  petEmoji: { fontSize: 24 },
  petCopy: { flex: 1, minWidth: 0 },
  petName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  petDetail: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 11 },
  petPlanRow: { padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceMuted, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  planChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.round, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  planChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  planChipText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  planChipTextSelected: { color: colors.surface },
  check: { color: colors.textMuted, fontSize: 22, fontWeight: '900' },
  checkSelected: { color: colors.primary },
  fieldError: { color: colors.error, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  emptyBlock: { gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  matchList: { gap: spacing.md },
  matchCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm },
  matchCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radii.round, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  matchCopy: { flex: 1, minWidth: 0 },
  matchName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  matchCode: { marginTop: spacing.xs, color: colors.primary, fontSize: 11, fontWeight: '800' },
  matchMeta: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  lockNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
