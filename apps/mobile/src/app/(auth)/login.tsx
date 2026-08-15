import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import { SearchSelectField, type SearchSelectOption } from '@/features/locations';
import { colors, spacing } from '@/theme/tokens';

type UserOption = SearchSelectOption & { email: string };

export default function LoginScreen() {
  const router = useRouter();
  const { clearError, database, error, signInByEmail } = useAppData();
  const [selectedEmail, setSelectedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userOptions = useMemo<readonly UserOption[]>(
    () =>
      (database?.users ?? []).map((user) => ({
        key: user.id,
        label: user.fullName,
        searchText: `${user.fullName} ${user.email}`,
        email: user.email,
      })),
    [database?.users],
  );

  async function handleSignIn() {
    if (!selectedEmail || submitting) return;
    setSubmitting(true);
    clearError();
    try {
      await signInByEmail(selectedEmail);
      trackUsageInBackground({ eventName: 'demo_login_succeeded', screen: 'login' });
    } catch {
      // O contexto apresenta uma mensagem sanitizada no banner.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="AMBIENTE LOCAL"
      title="Bem-vindo ao Tranquilo Pet"
      subtitle="Escolha uma das contas fictícias para testar. Nenhuma senha ou token é armazenado.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard
        title="Acesso de demonstração"
        description="Pesquise pelo nome ou e-mail de qualquer um dos 10 usuários.">
        <SearchSelectField
          label="Usuário de teste"
          options={userOptions}
          selectedKey={userOptions.find((option) => option.email === selectedEmail)?.key}
          selectedLabel={
            userOptions.find((option) => option.email === selectedEmail)?.label
          }
          placeholder="Selecionar usuário"
          searchPlaceholder="Buscar nome ou e-mail"
          onSelect={(option) => {
            clearError();
            setSelectedEmail(option.email);
          }}
        />

        {selectedEmail ? (
          <View style={styles.selection}>
            <Text style={styles.selectionLabel}>Conta selecionada</Text>
            <Text selectable style={styles.selectionValue}>
              {selectedEmail}
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          disabled={!selectedEmail}
          label="Entrar no ambiente de teste"
          loading={submitting}
          onPress={() => void handleSignIn()}
        />
      </SectionCard>

      <View style={styles.registerBlock}>
        <Text style={styles.registerCopy}>Quer testar um cadastro do zero?</Text>
        <SecondaryButton label="Criar nova conta local" onPress={() => router.push('/register')} />
      </View>

      <Text style={styles.note}>
        Os dados ficam somente neste aparelho e podem ser removidos ao limpar os dados do Expo Go.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  selection: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  selectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  selectionValue: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
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
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
