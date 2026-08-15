import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { InfoRow } from '@/components/info-row';
import { PetCard } from '@/components/pet-card';
import { PhotoGallery } from '@/components/photo-gallery';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import { labelForOption, petSpeciesOptions } from '@/features/pets/domain/pet-options';
import { formatBrazilianPhone } from '@/features/shared/domain/brazilian-formatters';
import { colors, spacing } from '@/theme/tokens';

export default function TutorProfileScreen() {
  const router = useRouter();
  const { currentUser, getTutorProfileByUserId, listPetsByOwner } = useAppData();
  if (!currentUser) return null;

  const profile = getTutorProfileByUserId(currentUser.id);
  const pets = listPetsByOwner(currentUser.id);

  if (!profile) {
    return (
      <ScreenShell onBack={() => router.back()} title="Perfil de tutor">
        <EmptyState
          title="Perfil ainda não cadastrado"
          description="Cadastre sua localização e informações para começar a solicitar cuidados."
          actionLabel="Cadastrar perfil"
          onAction={() => router.replace('/tutor/edit')}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DE TUTOR"
      onBack={() => router.back()}
      title="Verificar informações"
      subtitle="Confira os dados que serão usados durante as solicitações de serviço.">
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
        </View>
      </View>

      <SectionCard title="Dados de contato">
        <InfoRow label="E-mail" value={currentUser.email} />
        <InfoRow label="Telefone" value={formatBrazilianPhone(currentUser.phone)} />
        <InfoRow
          label="Localização"
          last
          value={`${profile.location.cityName} - ${profile.location.stateCode}`}
        />
      </SectionCard>

      <SectionCard title="Apresentação">
        <Text style={styles.bodyText}>{profile.bio || 'Nenhuma apresentação informada.'}</Text>
      </SectionCard>

      <SectionCard title="Fotos adicionais">
        <PhotoGallery uris={profile.photos.galleryUris} />
      </SectionCard>

      <SectionCard title="Meus pets" description={`${pets.length} pet(s) cadastrado(s)`}>
        {pets.map((pet) => (
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
        <PrimaryButton label="Cadastrar novo pet" onPress={() => router.push('/pets/new')} />
      </SectionCard>

      <PrimaryButton label="Editar perfil de tutor" onPress={() => router.push('/tutor/edit')} />
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
  bodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
});
