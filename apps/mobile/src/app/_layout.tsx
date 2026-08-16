import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/core/auth/auth-context';
import { colors, spacing } from '@/theme/tokens';

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="dark" />
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
});
