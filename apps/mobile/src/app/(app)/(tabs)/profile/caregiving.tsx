import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { type CarePlan, type CarePlanCode, planShortFeatures } from '@/features/hosting/plans';
import { colors, radii, spacing } from '@/theme/tokens';

const weekdays = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

type SettingsPayload = {
  accepts_multiday?: boolean;
  plans?: string[];
  weekdays?: number[];
  starts_at?: string | null;
  ends_at?: string | null;
};

export default function CaregivingSettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<CarePlanCode[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState('08:00');
  const [endsAt, setEndsAt] = useState('20:00');
  const [acceptsMultiday, setAcceptsMultiday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [plansResult, settingsResult] = await Promise.all([
      supabase
        .from('care_plans')
        .select('code, name, tagline, description, min_photos_per_day, suggested_photos_per_day, min_videos_per_day, video_max_seconds, activity_required, daily_report, sort_order')
        .order('sort_order'),
      supabase.rpc('get_my_caregiver_service_settings'),
    ]);

    if (plansResult.error || settingsResult.error) {
      setError('Não foi possível carregar sua disponibilidade.');
    } else {
      setPlans((plansResult.data ?? []) as CarePlan[]);
      const settings = (settingsResult.data ?? {}) as SettingsPayload;
      setSelectedPlans((settings.plans ?? []) as CarePlanCode[]);
      setSelectedWeekdays(settings.weekdays ?? []);
      setStartsAt((settings.starts_at ?? '08:00').slice(0, 5));
      setEndsAt((settings.ends_at ?? '20:00').slice(0, 5));
      setAcceptsMultiday(Boolean(settings.accepts_multiday));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePlan(code: CarePlanCode) {
    setSelectedPlans((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
    setError(null);
  }

  function toggleWeekday(day: number) {
    setSelectedWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
    setError(null);
  }

  async function save() {
    if (saving) return;
    if (!profile?.caregiver_enabled) {
      Alert.alert('Ative o perfil de cuidador', 'A disponibilidade só pode ser publicada por um usuário com o papel Cuidador ativo.');
      return;
    }
    if (!selectedPlans.length) {
      setError('Selecione pelo menos um plano que você consegue oferecer.');
      return;
    }
    if (!selectedWeekdays.length) {
      setError('Selecione pelo menos um dia disponível.');
      return;
    }
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      setError('A janela final precisa ser posterior ao horário inicial.');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.rpc('save_my_caregiver_service_settings', {
      p_plan_codes: selectedPlans,
      p_weekdays: selectedWeekdays,
      p_starts_at: `${startsAt}:00`,
      p_ends_at: `${endsAt}:00`,
      p_accepts_multiday: acceptsMultiday,
    });

    if (saveError) {
      setError('Não foi possível salvar sua disponibilidade.');
    } else {
      Alert.alert('Disponibilidade salva', 'Você poderá aparecer nas buscas quando plano, período e horários forem compatíveis.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Disponibilidade do cuidador">
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DE CUIDADOR"
      onBack={() => router.back()}
      title="Planos e disponibilidade"
      subtitle="Essas informações controlam em quais buscas você aparece. O tutor só encontra cuidadores compatíveis com o plano e o período escolhidos.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Planos que você oferece" description="Ative somente níveis de acompanhamento que você realmente consegue cumprir durante toda a hospedagem.">
        <View style={styles.planList}>
          {plans.map((plan) => {
            const selected = selectedPlans.includes(plan.code);
            return (
              <Pressable key={plan.code} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => togglePlan(plan.code)} style={({ pressed }) => [styles.planCard, selected && styles.planCardSelected, pressed && styles.pressed]}>
                <View style={styles.row}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{plan.name}</Text>
                    <Text style={styles.subtitle}>{plan.tagline}</Text>
                  </View>
                  <Text style={[styles.check, selected && styles.checkSelected]}>{selected ? '✓' : '○'}</Text>
                </View>
                {planShortFeatures(plan).map((feature) => <Text key={feature} style={styles.feature}>• {feature}</Text>)}
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Dias disponíveis" description="Para uma hospedagem de vários dias, todos os dias atravessados pelo período precisam estar marcados como disponíveis.">
        <View style={styles.weekdays}>
          {weekdays.map((day) => {
            const selected = selectedWeekdays.includes(day.value);
            return (
              <Pressable key={day.value} onPress={() => toggleWeekday(day.value)} style={[styles.dayChip, selected && styles.dayChipSelected]}>
                <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Janela de recebimento e entrega" description="O início e o término solicitados pelo tutor precisam cair dentro desta janela nos respectivos dias.">
        <View style={styles.timeGrid}>
          <View style={styles.timeCell}><DateTimeField label="A partir de" mode="time" value={startsAt} onChange={setStartsAt} /></View>
          <View style={styles.timeCell}><DateTimeField label="Até" mode="time" value={endsAt} onChange={setEndsAt} /></View>
        </View>
      </SectionCard>

      <SectionCard title="Hospedagem por mais de um dia">
        <View style={styles.switchRow}>
          <View style={styles.copy}>
            <Text style={styles.title}>Aceito estadias acima de 24 horas</Text>
            <Text style={styles.subtitle}>Se estiver desativado, você só aparece em buscas de até 24 horas.</Text>
          </View>
          <Switch value={acceptsMultiday} onValueChange={setAcceptsMultiday} trackColor={{ true: colors.primarySoft }} thumbColor={acceptsMultiday ? colors.primary : undefined} />
        </View>
      </SectionCard>

      <PrimaryButton label="Salvar disponibilidade" loading={saving} onPress={() => void save()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  planList: { gap: spacing.md },
  planCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm },
  planCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900' },
  subtitle: { marginTop: spacing.xs, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  feature: { color: colors.text, fontSize: 11, lineHeight: 16 },
  check: { color: colors.textMuted, fontSize: 22, fontWeight: '900' },
  checkSelected: { color: colors.primary },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayChip: { minWidth: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.round, backgroundColor: colors.surface, alignItems: 'center' },
  dayChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  dayText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
  dayTextSelected: { color: colors.surface },
  timeGrid: { flexDirection: 'row', gap: spacing.md },
  timeCell: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
});
