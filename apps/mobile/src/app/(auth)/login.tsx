import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { colors, radii, spacing } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { clearError, error, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function handleSignIn() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    clearError();
    try {
      await signIn(email, password);
    } catch {
      // A mensagem sanitizada é exibida pelo contexto.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="HOSPEDA PATAS"
      title="Cuidado que acolhe. Confiança que fica."
      subtitle="Entre para acompanhar hospedagens, conversar com seu contato e manter a rotina do pet registrada.">
      <View style={styles.brandCard}>
        <Text style={styles.brandMark}>HP</Text>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>Hospeda Patas</Text>
          <Text style={styles.brandCaption}>Transparência durante toda a hospedagem.</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Entrar na sua conta">
        <FormField
          label="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          value={email}
          onChangeText={(value) => {
            clearError();
            setEmail(value);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FormField
          ref={passwordRef}
          label="Senha"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          returnKeyType="done"
          value={password}
          onChangeText={(value) => {
            clearError();
            setPassword(value);
          }}
          onSubmitEditing={() => void handleSignIn()}
        />
        <PrimaryButton
          disabled={!canSubmit}
          label="Entrar"
          loading={submitting}
          onPress={() => void handleSignIn()}
        />
      </SectionCard>

      <View style={styles.registerBlock}>
        <Text style={styles.registerCopy}>Ainda não tem uma conta?</Text>
        <SecondaryButton label="Criar conta" onPress={() => router.push('/register')} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    color: colors.surface,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 54,
    textAlign: 'center',
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  brandCaption: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  registerBlock: {
    gap: spacing.md,
  },
  registerCopy: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
