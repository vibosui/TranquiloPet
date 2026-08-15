import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import {
  checkMonitorConnection,
  trackUsageInBackground,
} from '@/features/analytics/usage-tracker';
import { colors, radii, spacing } from '@/theme/tokens';

type MonitorStatus = 'checking' | 'not_configured' | 'offline' | 'online';

const monitorStatusCopy: Record<MonitorStatus, string> = {
  checking: 'Verificando monitor local…',
  not_configured: 'Monitor local não configurado',
  offline: 'Monitor local desconectado',
  online: 'Monitor local conectado',
};

export default function HomeScreen() {
  const router = useRouter();
  const [interactionCount, setInteractionCount] = useState(0);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus>('checking');
  const interactionCountRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    trackUsageInBackground({ eventName: 'app_opened', screen: 'home' });
    void checkMonitorConnection().then((status) => {
      if (isMounted) setMonitorStatus(status);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  function handleInteractionTest() {
    const nextCount = interactionCountRef.current + 1;
    interactionCountRef.current = nextCount;
    setInteractionCount(nextCount);
    trackUsageInBackground({
      eventName: 'interaction_test_pressed',
      screen: 'home',
      metadata: { count: nextCount },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <Text style={styles.brandEmoji}>🐾</Text>
          </View>
          <View>
            <Text style={styles.brandName}>Tranquilo Pet</Text>
            <Text style={styles.brandCaption}>Cuidado perto de você</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>AMBIENTE DE TESTE</Text>
          <Text style={styles.title}>Seu pet bem cuidado. Você tranquilo.</Text>
          <Text style={styles.subtitle}>
            Vamos começar criando um perfil de tutor simples e funcional.
          </Text>
        </View>

        <View style={styles.monitorCard}>
          <View
            style={[
              styles.statusDot,
              monitorStatus === 'online' && styles.statusDotOnline,
              monitorStatus === 'offline' && styles.statusDotOffline,
            ]}
          />
          <View style={styles.monitorCopy}>
            <Text style={styles.monitorTitle}>{monitorStatusCopy[monitorStatus]}</Text>
            <Text style={styles.monitorText}>Eventos também aparecem no terminal do Metro.</Text>
          </View>
        </View>

        <PrimaryButton
          label="Criar perfil de tutor"
          accessibilityHint="Abre o formulário de cadastro de tutor"
          onPress={() => router.push('/tutor/register')}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registrar interação de teste"
          onPress={handleInteractionTest}
          style={({ pressed }) => [styles.testButton, pressed && styles.testButtonPressed]}>
          <Text style={styles.testButtonLabel}>Testar interação</Text>
          <Text accessibilityLiveRegion="polite" style={styles.testCount}>
            {interactionCount === 0 ? 'Nenhum toque registrado' : `${interactionCount} toque(s)`}
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: {
    fontSize: 26,
  },
  brandName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  brandCaption: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
  },
  hero: {
    flex: 1,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },
  eyebrow: {
    marginBottom: spacing.md,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    maxWidth: 390,
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  subtitle: {
    maxWidth: 380,
    marginTop: spacing.lg,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 25,
  },
  monitorCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: radii.round,
    backgroundColor: colors.warning,
  },
  statusDotOnline: {
    backgroundColor: colors.success,
  },
  statusDotOffline: {
    backgroundColor: colors.error,
  },
  monitorCopy: {
    flex: 1,
  },
  monitorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  monitorText: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  testButton: {
    minHeight: 62,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  testButtonLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  testCount: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
