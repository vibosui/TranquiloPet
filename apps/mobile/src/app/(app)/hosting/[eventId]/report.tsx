import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type ReportEntry = {
  entry_type: string;
  happened_at: string;
  pet_id: string | null;
  title: string;
  body: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  media_type: string | null;
  duration_seconds: number | null;
};

type ProgressRow = {
  pet_id: string;
  pet_name: string;
  plan_name: string;
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
};

type SignedEntry = ReportEntry & { signedUrl?: string };

export default function HostingReportScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [entries, setEntries] = useState<SignedEntry[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<{ uri: string; caption: string } | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const [entriesResult, progressResult] = await Promise.all([
      supabase.rpc('get_event_report_entries', { p_event_id: eventId }),
      supabase.rpc('get_event_plan_progress', { p_event_id: eventId }),
    ]);

    if (entriesResult.error || progressResult.error) {
      setError('Não foi possível montar o relatório desta hospedagem.');
      setLoading(false);
      return;
    }

    const rawEntries = (entriesResult.data ?? []) as ReportEntry[];
    const signedEntries = await Promise.all(rawEntries.map(async (entry) => {
      if (!entry.storage_bucket || !entry.storage_path) return entry;
      const { data } = await supabase.storage.from(entry.storage_bucket).createSignedUrl(entry.storage_path, 60 * 60);
      return { ...entry, signedUrl: data?.signedUrl };
    }));

    setEntries(signedEntries);
    setProgress((progressResult.data ?? []) as ProgressRow[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const premiumProgress = useMemo(() => progress.filter((row) => row.daily_report), [progress]);

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Relatório da hospedagem">
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        eyebrow="PREMIUM • RELATÓRIO AUTOMÁTICO"
        onBack={() => router.back()}
        title="Tudo em ordem cronológica"
        subtitle="Este relatório é montado automaticamente a partir dos registros reais da hospedagem. Não há resumo por IA nem conteúdo inventado.">
        {error ? <ErrorBanner message={error} /> : null}

        <SectionCard title="Linha do tempo" description="Datas, horários, mensagens mediadas, tarefas, ocorrências e evidências aparecem na sequência em que foram registradas.">
          <View style={styles.timeline}>
            {entries.length === 0 ? <Text style={styles.muted}>Nenhum registro disponível ainda.</Text> : entries.map((entry, index) => (
              <View key={`${entry.happened_at}-${index}`} style={styles.entry}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryTime}>{formatDateTime(entry.happened_at)}</Text>
                </View>
                {entry.body ? <Text style={styles.entryBody}>{entry.body}</Text> : null}
                {entry.media_type === 'photo' && entry.signedUrl ? (
                  <Pressable onPress={() => setExpandedPhoto({ uri: entry.signedUrl!, caption: entry.title })}>
                    <Image source={{ uri: entry.signedUrl }} style={styles.image} resizeMode="cover" />
                  </Pressable>
                ) : null}
                {entry.media_type === 'video' && entry.signedUrl ? (
                  <ReportVideo uri={entry.signedUrl} duration={entry.duration_seconds} />
                ) : null}
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Indicadores por período" description="Os indicadores são contagens diretas dos registros do sistema.">
          <View style={styles.indicatorList}>
            {premiumProgress.length === 0 ? (
              <Text style={styles.muted}>Este evento não possui um pet Premium com períodos monitorados.</Text>
            ) : premiumProgress.map((row) => (
              <View key={`${row.pet_id}-${row.sequence_no}`} style={styles.indicatorCard}>
                <Text style={styles.petTitle}>{row.pet_name} • {row.plan_name} • período {row.sequence_no}</Text>
                <Text style={styles.period}>{formatDateTime(row.starts_at)} → {formatDateTime(row.ends_at)}</Text>
                <View style={styles.metrics}>
                  <Indicator label="Fotos" value={`${row.photos_done}/${row.min_photos}`} ok={row.photos_done >= row.min_photos} />
                  <Indicator label="Vídeos" value={`${row.videos_done}/${row.min_videos}`} ok={row.videos_done >= row.min_videos} />
                  {row.activity_required ? <Indicator label="Atividade" value={row.activity_done ? '✓' : 'Pendente'} ok={row.activity_done} /> : null}
                </View>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScreenShell>

      <PhotoLightbox uri={expandedPhoto?.uri ?? null} caption={expandedPhoto?.caption} onClose={() => setExpandedPhoto(null)} />
    </>
  );
}

function ReportVideo({ uri, duration }: { uri: string; duration: number | null }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return (
    <View style={styles.videoWrap}>
      <VideoView player={player} style={styles.video} nativeControls allowsFullscreen />
      <Text style={styles.mediaMeta}>Vídeo curto{duration ? ` • ${duration.toFixed(1)}s` : ''}</Text>
    </View>
  );
}

function Indicator({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={[styles.metric, ok && styles.metricOk]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, ok && styles.metricValueOk]}>{value}</Text>
    </View>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  timeline: { gap: spacing.md },
  entry: { padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, gap: spacing.sm },
  entryHeader: { gap: spacing.xs },
  entryTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  entryTime: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  entryBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  image: { width: '100%', height: 210, borderRadius: radii.md, backgroundColor: colors.primarySoft },
  videoWrap: { gap: spacing.xs },
  video: { width: '100%', height: 220, borderRadius: radii.md },
  mediaMeta: { color: colors.textMuted, fontSize: 10 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  indicatorList: { gap: spacing.md },
  indicatorCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, gap: spacing.sm },
  petTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  period: { color: colors.textMuted, fontSize: 10 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: 82, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.errorSoft },
  metricOk: { backgroundColor: colors.successSoft },
  metricLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  metricValue: { marginTop: 2, color: colors.error, fontSize: 12, fontWeight: '900' },
  metricValueOk: { color: colors.success },
});
