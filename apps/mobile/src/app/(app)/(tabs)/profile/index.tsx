import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { InfoRow } from '@/components/info-row';
import { PetCard } from '@/components/pet-card';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import { labelForOption, petSpeciesOptions } from '@/features/pets/domain/pet-options';
import { formatBrazilianPhone } from '@/features/shared/domain/brazilian-formatters';
import { colors, radii, spacing } from '@/theme/tokens';

export default function ProfileOverviewScreen() {
  const router = useRouter();
  const {
    currentUser,
    getCaregiverProfileByUserId,
    getTutorProfileByUserId,
    listPetsByOwner,
    signOut,
  } = useAppData();

  useEffect(() => {
    trackUsageInBackground({ eventName: 'profile_viewed', screen: 'profile' });
  }, []);

  if (!currentUser) return null;
  const tutor = getTutorProfileByUserId(currentUser.id);
  const caregiver = getCaregiverProfileByUserId(currentUser.id);
  const pets = listPetsByOwner(currentUser.id);

  function confirmSignOut() {
    Alert.alert('Sair da conta de teste?', 'Os dados locais continuarão salvos neste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          trackUsageInBackground({ eventName: 'demo_logout', screen: 'profile' });
          void signOut();
        },
      },
    ]);
  }

  return (
    <ScreenShell
      eyebrow="MINHA CONTA"
      title="Informações do perfil"
      subtitle="Esta é a identidade única usada nos papéis de tutor e cuidador.">
      <View style={styles.profileHeader}>
        <ProfileAvatar name={currentUser.fullName} uri={currentUser.photos.profileUri} />
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{currentUser.fullName}</Text>
          <Text style={styles.profileEmail}>{currentUser.email}</Text>
          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>CONTA LOCAL</Text>
          </View>
        </View>
      </View>

      <SectionCard title="Dados da conta">
        <InfoRow label="Nome" value={currentUser.fullName} />
        <InfoRow label="E-mail" value={currentUser.email} />
        <InfoRow label="Telefone" last value={formatBrazilianPhone(currentUser.phone)} />
      </SectionCard>

      <SectionCard title="Perfis" description="Ative um ou os dois papéis com a mesma conta.">
        <RoleCard
          title="Tutor"
          active={Boolean(tutor)}
          detail={tutor ? `${tutor.location.cityName} - ${tutor.location.stateCode}` : 'Não cadastrado'}
          onPress={() => router.push(tutor ? '/profile/tutor' : '/tutor/edit')}
        />
        <RoleCard
          title="Cuidador"
          active={Boolean(caregiver)}
          detail={caregiver ? `${caregiver.experienceYears} ano(s) de experiência` : 'Não cadastrado'}
          onPress={() => router.push(caregiver ? '/profile/caregiver' : '/caregiver/edit')}
        />
      </SectionCard>

      <SectionCard
        title="Meus pets"
        description={`${pets.length} registro(s)`}
        action={
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/pets/index')}>
            <Text style={styles.link}>Ver todos</Text>
          </Pressable>
        }>
        {pets.slice(0, 2).map((pet) => (
          <PetCard
            key={pet.id}
            name={pet.name}
            species={labelForOption(petSpeciesOptions, pet.species)}
            breed={pet.breed}
            photoUri={pet.photos.profileUri}
            onPress={() =>
              router.push({ pathname: '/pets/[petId]', params: { petId: pet.id } })
            }
          />
        ))}
        <PrimaryButton label="Cadastrar pet" onPress={() => router.push('/pets/new')} />
      </SectionCard>

      <SecondaryButton destructive label="Sair da conta de teste" onPress={confirmSignOut} />
    </ScreenShell>
  );
}

function RoleCard({
  title,
  active,
  detail,
  onPress,
}: {
  title: string;
  active: boolean;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${active ? 'Ativo' : 'Inativo'}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, pressed && styles.rolePressed]}>
      <View style={styles.roleCopy}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDetail}>{detail}</Text>
      </View>
      <View style={[styles.statusBadge, active ? styles.activeBadge : styles.inactiveBadge]}>
        <Text style={[styles.statusText, active ? styles.activeText : styles.inactiveText]}>
          {active ? 'Ativo' : 'Cadastrar'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: colors.surface,
    fontSize: 21,
    fontWeight: '900',
  },
  profileEmail: {
    marginTop: spacing.xs,
    color: colors.primarySoft,
    fontSize: 13,
  },
  demoBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
  },
  demoBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  roleCard: {
    minHeight: 72,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rolePressed: {
    backgroundColor: colors.primarySoft,
  },
  roleCopy: {
    flex: 1,
  },
  roleTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  roleDetail: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
  },
  activeBadge: {
    backgroundColor: colors.successSoft,
  },
  inactiveBadge: {
    backgroundColor: colors.warningSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activeText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.warning,
  },
  link: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlignVertical: 'center',
  },
});
