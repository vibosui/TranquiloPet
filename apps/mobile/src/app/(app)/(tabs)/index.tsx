import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import {
  checkMonitorConnection,
  trackUsageInBackground,
} from '@/features/analytics/usage-tracker';
import { colors, radii, spacing } from '@/theme/tokens';

type MonitorStatus = 'checking' | 'not_configured' | 'offline' | 'online';

export default function HomeScreen() {
  const router = useRouter();
  const {
    currentUser,
    getCaregiverProfileByUserId,
    getTutorProfileByUserId,
    listPetsByOwner,
  } = useAppData();
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>('checking');

  useEffect(() => {
    trackUsageInBackground({ eventName: 'app_opened', screen: 'home' });
    let active = true;
    void checkMonitorConnection().then((status) => {
      if (active) setMonitorStatus(status);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!currentUser) return null;

  const tutor = getTutorProfileByUserId(currentUser.id);
  const caregiver = getCaregiverProfileByUserId(currentUser.id);
  const pets = listPetsByOwner(currentUser.id);
  const firstName = currentUser.fullName.split(' ')[0];

  return (
    <ScreenShell
      eyebrow="AMBIENTE DE TESTE"
      title={`Olá, ${firstName}`}
      subtitle="Confira seus perfis e mantenha as informações dos pets atualizadas.">
      <View style={styles.metrics}>
        <MetricCard label="Pets" value={String(pets.length)} />
        <MetricCard label="Perfis ativos" value={String(Number(Boolean(tutor)) + Number(Boolean(caregiver)))} />
      </View>

      <SectionCard title="Próximos passos" description="Escolha o que deseja revisar ou cadastrar.">
        <ActionCard
          title="Meus pets"
          description={`${pets.length} pet(s) vinculado(s) a esta conta`}
          status="Ver e atualizar"
          onPress={() => router.navigate('/pets/index')}
        />
        <ActionCard
          title="Perfil de tutor"
          description={tutor ? `${tutor.location.cityName} - ${tutor.location.stateCode}` : 'Ainda não ativado'}
          status={tutor ? 'Conferir perfil' : 'Cadastrar'}
          onPress={() => router.push(tutor ? '/profile/tutor' : '/tutor/edit')}
        />
        <ActionCard
          title="Perfil de cuidador"
          description={caregiver ? `${caregiver.experienceYears} ano(s) de experiência` : 'Ainda não ativado'}
          status={caregiver ? 'Conferir perfil' : 'Cadastrar'}
          onPress={() => router.push(caregiver ? '/profile/caregiver' : '/caregiver/edit')}
        />
      </SectionCard>

      <View style={styles.monitorCard}>
        <View
          style={[
            styles.statusDot,
            monitorStatus === 'online' && styles.statusOnline,
            monitorStatus === 'offline' && styles.statusOffline,
          ]}
        />
        <View style={styles.monitorCopy}>
          <Text style={styles.monitorTitle}>
            {monitorStatus === 'online'
              ? 'Monitor local conectado'
              : monitorStatus === 'checking'
                ? 'Verificando monitor local...'
                : 'Monitor opcional desconectado'}
          </Text>
          <Text style={styles.monitorText}>O cadastro funciona normalmente mesmo sem o monitor.</Text>
        </View>
      </View>

      <PrimaryButton label="Cadastrar novo pet" onPress={() => router.push('/pets/new')} />

      <Text style={styles.devNote}>
        Câmera, upload remoto, GPS, notificações, pagamentos e sincronização em segundo plano estão desligados.
      </Text>
    </ScreenShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  title,
  description,
  status,
  onPress,
}: {
  title: string;
  description: string;
  status: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}. ${status}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Text style={styles.actionStatus}>{status}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  metricValue: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
  },
  actionCard: {
    minHeight: 76,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionPressed: {
    backgroundColor: colors.primarySoft,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  actionDescription: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
  },
  actionStatus: {
    maxWidth: 90,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  monitorCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: radii.round,
    backgroundColor: colors.warning,
  },
  statusOnline: {
    backgroundColor: colors.success,
  },
  statusOffline: {
    backgroundColor: colors.error,
  },
  monitorCopy: {
    flex: 1,
  },
  monitorTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  monitorText: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  devNote: {
    paddingHorizontal: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
