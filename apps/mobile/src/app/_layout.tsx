import { Stack, type ErrorBoundaryProps, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/core/auth/auth-context';
import { NotificationRuntime } from '@/core/notifications/notification-runtime';
import { colors, radii, spacing } from '@/theme/tokens';

function RootNavigator() {
  const { loading, user } = useAuth();
  const segments = useSegments();
  const viewingDemo = segments[0] === 'demo';

  if (loading && !viewingDemo) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.brand}>Hospeda Patas</Text>
        <Text style={styles.loadingText}>Preparando seu espaço de cuidado...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="demo" />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorEyebrow}>HOSPEDA PATAS</Text>
      <Text style={styles.errorTitle}>O aplicativo encontrou um erro.</Text>
      <Text style={styles.errorText}>
        Em vez de deixar a tela em branco, esta tela mantém o diagnóstico visível para o beta.
      </Text>
      <View style={styles.errorBox}>
        <Text selectable style={styles.errorMessage}>{error.message}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.retryButton}>
        <Text style={styles.retryButtonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationRuntime>
        <RootNavigator />
        <StatusBar style="dark" />
      </NotificationRuntime>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  loadingText: {
    maxWidth: 360,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorScreen: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  errorMessage: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '900',
  },
});
