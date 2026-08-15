import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppDataProvider, useAppData } from '@/core/state/app-data-context';
import { colors, spacing } from '@/theme/tokens';

function RootNavigator() {
  const { currentUser, demoDataAvailable, error, loading } = useAppData();

  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparando o ambiente de demonstração...</Text>
      </View>
    );
  }

  if (!demoDataAvailable) {
    return (
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.loading}>
        <Text style={styles.unavailableTitle}>Dados demo indisponíveis</Text>
        <Text style={styles.loadingText}>{error}</Text>
        <Text style={styles.loadingText}>
          Este build não habilitou o laboratório local. Nenhum dado foi lido ou criado.
        </Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!currentUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(currentUser)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppDataProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </AppDataProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    maxWidth: 360,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  unavailableTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
});
