import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { InfoRow } from '@/components/info-row';
import { PhotoGallery } from '@/components/photo-gallery';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import {
  acceptedSizeOptions,
  acceptedSpeciesOptions,
  availabilityOptions,
  careServiceOptions,
} from '@/features/caregivers/domain/caregiver-options';
import { colors, radii, spacing } from '@/theme/tokens';

function labels<T extends string>(values: readonly T[], options: readonly { value: T; label: string }[]) {
  return values.map((value) => options.find((option) => option.value === value)?.label ?? value).join(', ');
}

function maskCpf(cpf: string) {
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : 'Não informado';
}

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const {
    currentUser,
    getCaregiverPrivateDataByUserId,
    getCaregiverProfileByUserId,
  } = useAppData();
  if (!currentUser) return null;

  const profile = getCaregiverProfileByUserId(currentUser.id);
  const privateData = getCaregiverPrivateDataByUserId(currentUser.id);

  if (!profile) {
    return (
      <ScreenShell onBack={() => router.back()} title="Perfil de cuidador">
        <EmptyState
          title="Perfil ainda não cadastrado"
          description="Informe sua experiência e os serviços que deseja oferecer."
          actionLabel="Cadastrar perfil"
          onAction={() => router.replace('/caregiver/edit')}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DE CUIDADOR"
      onBack={() => router.back()}
      title="Verificar informações"
      subtitle="Dados públicos e privados permanecem separados nesta visualização.">
      <View style={styles.identity}>
        <ProfileAvatar
          name={currentUser.fullName}
          uri={profile.photos.profileUri ?? currentUser.photos.profileUri}
        />
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{currentUser.fullName}</Text>
          <Text style={styles.location}>
            {profile.location.cityName} - {profile.location.stateCode}
          </Text>
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>PERFIL ATIVO</Text>
          </View>
        </View>
      </View>

      <SectionCard title="Apresentação pública">
        <Text style={styles.bodyText}>{profile.bio}</Text>
        <InfoRow label="Experiência" value={`${profile.experienceYears} ano(s)`} />
        <InfoRow label="Espécies" value={labels(profile.acceptedSpecies, acceptedSpeciesOptions)} />
        <InfoRow label="Portes" value={labels(profile.acceptedSizes, acceptedSizeOptions)} />
        <InfoRow label="Serviços" value={labels(profile.offeredServices, careServiceOptions)} />
        <InfoRow
          label="Disponibilidade"
          last
          value={profile.availability
            .map(
              (value) =>
                availabilityOptions.find((option) => option.value === value)?.label ?? value,
            )
            .join(', ')}
        />
      </SectionCard>

      <SectionCard
        title="Dados privados"
        description="CPF nunca será exibido no perfil público do cuidador.">
        <InfoRow label="CPF" last value={privateData ? maskCpf(privateData.cpf) : undefined} />
      </SectionCard>

      <SectionCard title="Fotos adicionais">
        <PhotoGallery uris={profile.photos.galleryUris} />
      </SectionCard>

      <PrimaryButton label="Editar perfil de cuidador" onPress={() => router.push('/caregiver/edit')} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  location: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.successSoft,
  },
  activeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
  },
  bodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
});
