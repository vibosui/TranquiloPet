import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { planName } from '@/features/hosting/plans';
import { colors, radii, spacing } from '@/theme/tokens';

type HostingStatus = 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

type EventPet = {
  pet_id: string;
  pet_snapshot: unknown;
  plan_code?: string | null;
  plan_snapshot?: unknown;
};

type ProgressRow = {
  pet_id: string;
  pet_name: string;
  plan_code: string;
  plan_name: string;
  period_id: string;
  sequence_no: number;
  starts_at: string;
  ends_at: string;
  min_photos: number;
  photos_done: number;
  min_videos: number;
  videos_done: number;
  activity_required: boolean;
  activity_done: boolean;
  daily_report: boolean;
  video_max_seconds: number;
};

type Props = {
  eventId: string;
  eventStatus: HostingStatus;
  isCaregiver: boolean;
  pets: EventPet[];
  onChanged: () => void | Promise<void>;
};

function extensionForAsset(asset: ImagePicker.ImagePickerAsset, mediaType: 'photo' | 'video') {
  const candidate = asset.fileName?.split('.').pop()?.toLowerCase();
  if (candidate && /^[a-z0-9]{2,5}$/.test(candidate)) return candidate;
  if (mediaType === 'video') return asset.mimeType === 'video/quicktime' ? 'mov' : 'mp4';
  if (asset.mimeType === 'image/png') return 'png';
  if (asset.mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function formatPeriod(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
}

export function PlanCareControls({ eventId, eventStatus, isCaregiver, pets, onChanged }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: progressError } = await supabase.rpc('get_event_plan_progress', { p_event_id: eventId });
    if (progressError) {
      setError('Não foi possível atualizar o acompanhamento do plano.');
    } else {
      setProgress((data ?? []) as ProgressRow[]);
      setError(null);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProgressRow[]>();
    progress.forEach((row) => map.set(row.pet_id, [...(map.get(row.pet_id) ?? []), row]));
    return map;
  }, [progress]);

  const hasPremiumReport = progress.some((row) => row.daily_report);

  async function captureMedia(petId: string, mediaType: 'photo' | 'video', maxSeconds: number) {
    if (!user || !isCaregiver || eventStatus !== 'in_progress' || busyKey) return;
    const key = `${petId}:${mediaType}`;
    setBusyKey(key);
    setError(null);

    try {
      const result = await ImagePicker.launchCameraAsync(
        mediaType === 'video'
          ? {
              mediaTypes: ['videos'],
              allowsEditing: false,
              videoMaxDuration: maxSeconds,
              videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
            }
          : {
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.82,
              exif: false,
            },
      );
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const durationSeconds = mediaType === 'video' ? (asset.duration ?? 0) / 1000 : null;
      if (mediaType === 'video' && (!durationSeconds || durationSeconds > maxSeconds + 0.25)) {
        Alert.alert('Vídeo fora do limite', `Grave um vídeo de até ${maxSeconds} segundos.`);
        return;
      }

      const extension = extensionForAsset(asset, mediaType);
      const storagePath = `${user.id}/${eventId}/${petId}/${mediaType}-${Date.now()}.${extension}`;
      const binary = await fetch(asset.uri).then((response) => response.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from('event-updates').upload(storagePath, binary, {
        contentType: asset.mimeType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: registerError } = await supabase.rpc('register_event_plan_media', {
        p_event_id: eventId,
        p_pet_id: petId,
        p_media_type: mediaType,
        p_storage_path: storagePath,
        p_duration_seconds: durationSeconds,
      });
      if (registerError) throw registerError;

      await load();
      await onChanged();
    } catch {
      setError(mediaType === 'video' ? 'Não foi possível registrar o vídeo.' : 'Não foi possível registrar a foto.');
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} />;

  if (!progress.length) {
    return (
      <View style={styles.legacyBox}>
        <Text style={styles.legacyTitle}>Hospedagem criada antes dos planos</Text>
        <Text style={styles.muted}>Este evento continua funcionando sem impor retroativamente as novas cotas de acompanhamento.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {pets.map((pet) => {
        const rows = grouped.get(pet.pet_id) ?? [];
        if (!rows.length) return null;
        const current = rows.find((row) => {
          const now = Date.now();
          return now >= new Date(row.starts_at).getTime() && now <= new Date(row.ends_at).getTime();
        }) ?? rows.find((row) => row.photos_done < row.min_photos || row.videos_done < row.min_videos || (row.activity_required && !row.activity_done)) ?? rows[rows.length - 1];

        return (
          <View key={pet.pet_id} style={styles.petCard}>
            <View style={styles.petHeader}>
              <View style={styles.copy}>
                <Text style={styles.petName}>{current.pet_name}</Text>
                <Text style={styles.planBadge}>{planName(current.plan_code)}</Text>
              </View>
              <Text style={styles.periodBadge}>Período {current.sequence_no}</Text>
            </View>
            <Text style={styles.period}>{formatPeriod(current.starts_at, current.ends_at)}</Text>

            <View style={styles.metrics}>
              <Metric label="Fotos" value={`${current.photos_done}/${current.min_photos} mín.`} done={current.photos_done >= current.min_photos} />
              {current.min_videos > 0 ? <Metric label="Vídeos" value={`${current.videos_done}/${current.min_videos} mín.`} done={current.videos_done >= current.min_videos} /> : null}
              {current.activity_required ? <Metric label="Atividade" value={current.activity_done ? 'Concluída' : 'Pendente'} done={current.activity_done} /> : null}
            </View>

            <Text style={styles.muted}>Fotos de tarefas e fotos solicitadas pelo tutor também contam para o mínimo deste período.</Text>

            {isCaregiver && eventStatus === 'in_progress' ? (
              <View style={styles.actions}>
                <Pressable disabled={Boolean(busyKey)} onPress={() => void captureMedia(pet.pet_id, 'photo', current.video_max_seconds)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Text style={styles.actionText}>{busyKey === `${pet.pet_id}:photo` ? 'Enviando...' : '📷 Registrar foto'}</Text>
                </Pressable>
                {current.min_videos > 0 ? (
                  <Pressable disabled={Boolean(busyKey)} onPress={() => void captureMedia(pet.pet_id, 'video', current.video_max_seconds)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                    <Text style={styles.actionText}>{busyKey === `${pet.pet_id}:video` ? 'Enviando...' : `🎥 Vídeo até ${current.video_max_seconds}s`}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {hasPremiumReport ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/hosting/[eventId]/report', params: { eventId } })} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
          <View style={styles.copy}>
            <Text style={styles.reportTitle}>📄 Relatório automático</Text>
            <Text style={styles.muted}>Linha do tempo com horários, mensagens mediadas, tarefas, ocorrências, fotos, vídeos e indicadores.</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <View style={[styles.metric, done && styles.metricDone]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, done && styles.metricValueDone]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  petCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm },
  petHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  petName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  planBadge: { marginTop: spacing.xs, color: colors.primary, fontSize: 11, fontWeight: '900' },
  periodBadge: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  period: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 92, flexGrow: 1, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.errorSoft },
  metricDone: { backgroundColor: colors.successSoft },
  metricLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  metricValue: { marginTop: 2, color: colors.error, fontSize: 12, fontWeight: '900' },
  metricValueDone: { color: colors.success },
  muted: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  error: { color: colors.error, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  actionText: { color: colors.surface, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  reportButton: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reportTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  arrow: { color: colors.primary, fontSize: 26 },
  legacyBox: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  legacyTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.75 },
});
