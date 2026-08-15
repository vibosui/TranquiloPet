import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function getPlatformName() {
  if (Platform.OS === 'android') return 'Android';
  if (Platform.OS === 'ios') return 'iOS';
  return 'Web';
}

export default function HomeScreen() {
  const [interactionCount, setInteractionCount] = useState(0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandMark} accessibilityElementsHidden>
          <Text style={styles.brandEmoji}>🐾</Text>
        </View>

        <Text style={styles.eyebrow}>PET MARKETPLACE</Text>
        <Text style={styles.title}>O app está funcionando!</Text>
        <Text style={styles.subtitle}>
          Esta é nossa primeira tela executando com Expo e React Native.
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusDot} />
            <Text style={styles.statusTitle}>Ambiente conectado</Text>
          </View>
          <Text style={styles.statusText}>Plataforma detectada: {getPlatformName()}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Testar interação"
          accessibilityHint="Incrementa o contador de testes"
          onPress={() => setInteractionCount((currentCount) => currentCount + 1)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Testar interação</Text>
        </Pressable>

        <Text accessibilityLiveRegion="polite" style={styles.feedback}>
          {interactionCount === 0
            ? 'Toque no botão para validar a interação.'
            : `Interações registradas: ${interactionCount}`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6FAF7',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brandMark: {
    width: 88,
    height: 88,
    marginBottom: 24,
    borderRadius: 28,
    backgroundColor: '#DDF3E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: {
    fontSize: 42,
  },
  eyebrow: {
    marginBottom: 8,
    color: '#267344',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#173C28',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 360,
    marginTop: 12,
    color: '#53665A',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
    maxWidth: 380,
    marginTop: 32,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9E7DD',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    marginRight: 10,
    borderRadius: 5,
    backgroundColor: '#2FA866',
  },
  statusTitle: {
    color: '#173C28',
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    marginTop: 8,
    color: '#66766B',
    fontSize: 14,
  },
  button: {
    width: '100%',
    maxWidth: 380,
    minHeight: 52,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: '#267344',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#1D5B35',
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  feedback: {
    minHeight: 20,
    marginTop: 14,
    color: '#66766B',
    fontSize: 14,
    textAlign: 'center',
  },
});
