import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { InfoRow } from '@/components/info-row';
import { PhotoGallery } from '@/components/photo-gallery';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import {
  labelForOption,
  petBehaviorOptions,
  petCareOptions,
  petSizeOptions,
  petSpeciesOptions,
} from '@/features/pets/domain/pet-options';
import { colors, radii, spacing } from '@/theme/tokens';

export default function PetDetailsScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { currentUser, getPetById } = useAppData();
  const pet = getPetById(petId);
  const canViewPet = Boolean(pet && currentUser && pet.ownerUserId === currentUser.id);

  useEffect(() => {
    if (canViewPet) {
      trackUsageInBackground({ eventName: 'pet_profile_viewed', screen: 'pet_profile' });
    }
  }, [canViewPet, currentUser?.id, pet?.id]);

  if (!currentUser) return null;

  if (!pet || pet.ownerUserId !== currentUser.id) {
    return (
      <ScreenShell onBack={() => router.back()} title="Pet não encontrado">
        <ErrorBanner message="O pet não existe ou pertence a outra conta de demonstração." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DO PET"
      onBack={() => router.back()}
      title="Verificar informações"
      subtitle="Revise os dados antes de solicitar um cuidador.">
      <View style={styles.identity}>
        <ProfileAvatar name={pet.name} size={96} uri={pet.photos.profileUri} />
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{pet.name}</Text>
          <Text style={styles.summary}>
            {labelForOption(petSpeciesOptions, pet.species)}
            {pet.breed ? ` · ${pet.breed}` : ''}
          </Text>
        </View>
      </View>

      <SectionCard title="Identificação">
        <InfoRow label="Espécie" value={labelForOption(petSpeciesOptions, pet.species)} />
        <InfoRow label="Raça" value={pet.breed || undefined} />
        <InfoRow label="Idade" value={pet.ageYears === null ? undefined : `${pet.ageYears} ano(s)`} />
        <InfoRow label="Porte" value={labelForOption(petSizeOptions, pet.size)} />
        <InfoRow label="Características" last value={pet.characteristics || undefined} />
      </SectionCard>

      <SectionCard title="Cuidados especiais">
        <TagList
          empty="Nenhum cuidado especial marcado."
          labels={pet.careTags.map((tag) => labelForOption(petCareOptions, tag))}
        />
        {pet.careTags.includes('medication') && pet.medicationDetails ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Medicação</Text>
            <Text style={styles.notes}>{pet.medicationDetails}</Text>
          </View>
        ) : null}
        {pet.additionalNotes ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Observações adicionais</Text>
            <Text style={styles.notes}>{pet.additionalNotes}</Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Análise comportamental">
        <TagList
          empty="Nenhuma característica comportamental marcada."
          labels={pet.behavior.traits.map((tag) => labelForOption(petBehaviorOptions, tag))}
        />
        {pet.behavior.notes ? <Text style={styles.notes}>{pet.behavior.notes}</Text> : null}
      </SectionCard>

      <SectionCard title="Fotos adicionais">
        <PhotoGallery uris={pet.photos.galleryUris} />
      </SectionCard>

      <PrimaryButton
        label="Editar informações do pet"
        onPress={() =>
          router.push({ pathname: '/pets/[petId]/edit', params: { petId: pet.id } })
        }
      />
    </ScreenShell>
  );
}

function TagList({ labels, empty }: { labels: readonly string[]; empty: string }) {
  if (!labels.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.tags}>
      {labels.map((label) => (
        <View key={label} style={styles.tag}>
          <Text style={styles.tagText}>{label}</Text>
        </View>
      ))}
    </View>
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
    fontSize: 24,
    fontWeight: '900',
  },
  summary: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
  },
  tagText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  notes: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  noteBlock: {
    gap: spacing.xs,
  },
  noteLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
