import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { formatBrazilianPhone } from '@/features/shared/domain/brazilian-formatters';
import { colors, radii, spacing } from '@/theme/tokens';

export default function ProfileOverviewScreen() {
  const router = useRouter();
  const { clearError, error, profile, refreshProfile, signOut, user } = useAuth();
  const [savingRole, setSavingRole] = useState<'tutor' | 'caregiver' | null>(null);

  if (!user || !profile) return null;

  async function toggleRole(role: 'tutor' | 'caregiver') {
    if (savingRole) return;
    setSavingRole(role);
    clearError();

    const column = role === 'tutor' ? 'tutor_enabled' : 'caregiver_enabled';
    const currentValue = role === 'tutor' ? profile.tutor_enabled : profile.caregiver_enabled;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [column]: !currentValue })
      .eq('id', user.id);

    if (updateError) {
      Alert.alert('Não foi possível atualizar', 'Tente novamente em alguns instantes.');
    } else {
      await refreshProfile();
    }
    setSavingRole(null);
  }

  function confirmSignOut() {
    Alert.alert('Sair da conta?', 'Você poderá entrar novamente usando seu e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  }

  return (
    <ScreenShell
      eyebrow="MINHA CONTA"
      title="Sua identidade Hospeda Patas"
      subtitle="O mesmo usuário pode atuar como tutor, cuidador ou nos dois papéis. Seu código permanece o mesmo.">
      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.full_name.slice(0, 1).toUpperCase() || 'H'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{profile.full_name || 'Usuário Hospeda Patas'}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          <View style={styles.cloudBadge}>
            <Text style={styles.cloudBadgeText}>CONTA SINCRONIZADA</Text>
          </View>
        </View>
      </View>

      <SectionCard
        title="Código de identificação"
        description="Compartilhe apenas quando quiser criar um contato. O código é permanente e o QR Code usará exatamente esta identificação.">
        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>SEU CÓDIGO</Text>
            <Text selectable style={styles.codeValue}>{profile.public_code}</Text>
          </View>
          <View style={styles.qrPlaceholder} accessibilityLabel="QR Code será disponibilizado nesta área">
            <Text style={styles.qrGlyph}>▦</Text>
          </View>
        </View>
        <PrimaryButton label="Adicionar alguém pelo código" onPress={() => router.push('/contacts')} />
      </SectionCard>

      <SectionCard
        title="Como você usa o Hospeda Patas?"
        description="Durante o MVP você pode ativar os papéis diretamente. Os formulários detalhados de tutor e cuidador serão ligados a estes estados.">
        <RoleCard
          title="Tutor"
          description="Cria o dossiê do pet, prepara a hospedagem e acompanha checklist e fotos."
          active={profile.tutor_enabled}
          loading={savingRole === 'tutor'}
          onPress={() => void toggleRole('tutor')}
        />
        <RoleCard
          title="Cuidador"
          description="Recebe a hospedagem, executa tarefas e registra evidências do cuidado."
          active={profile.caregiver_enabled}
          loading={savingRole === 'caregiver'}
          onPress={() => void toggleRole('caregiver')}
        />
      </SectionCard>

      <SectionCard title="Dados da conta">
        <ProfileRow label="Nome" value={profile.full_name || 'Não informado'} />
        <ProfileRow label="E-mail" value={user.email || 'Não informado'} />
        <ProfileRow
          label="Telefone"
          value={profile.phone ? formatBrazilianPhone(profile.phone) : 'Não informado'}
          last
        />
      </SectionCard>

      <SectionCard
        title="Privacidade por padrão"
        description="Fotos de pets e evidências são armazenadas em buckets privados. O acesso funcional será limitado aos participantes de cada hospedagem por políticas do Supabase." />

      <SecondaryButton destructive label="Sair da conta" onPress={confirmSignOut} />
    </ScreenShell>
  );
}

function ProfileRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.profileRow, last && styles.profileRowLast]}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text selectable style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

function RoleCard({
  title,
  description,
  active,
  loading,
  onPress,
}: {
  title: string;
  description: string;
  active: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${active ? 'Ativo' : 'Inativo'}`}
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        active && styles.roleCardActive,
        pressed && styles.roleCardPressed,
      ]}>
      <View style={styles.roleCopy}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDescription}>{description}</Text>
      </View>
      <View style={[styles.roleStatus, active && styles.roleStatusActive]}>
        <Text style={[styles.roleStatusText, active && styles.roleStatusTextActive]}>
          {loading ? '...' : active ? 'Ativo' : 'Ativar'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '900',
  },
  profileEmail: {
    marginTop: spacing.xs,
    color: colors.primarySoft,
    fontSize: 13,
  },
  cloudBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
  },
  cloudBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  codeCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  codeValue: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  qrPlaceholder: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrGlyph: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
  },
  roleCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleCardPressed: {
    opacity: 0.75,
  },
  roleCopy: {
    flex: 1,
  },
  roleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  roleDescription: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  roleStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceMuted,
  },
  roleStatusActive: {
    backgroundColor: colors.primary,
  },
  roleStatusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  roleStatusTextActive: {
    color: colors.surface,
  },
  profileRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  profileRowLast: {
    borderBottomWidth: 0,
  },
  profileRowLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  profileRowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
