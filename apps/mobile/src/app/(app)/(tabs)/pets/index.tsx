import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetCard } from '@/components/pet-card';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { useAppData } from '@/core/state/app-data-context';
import {
  labelForOption,
  petCareOptions,
  petSpeciesOptions,
} from '@/features/pets/domain/pet-options';

export default function MyPetsScreen() {
  const router = useRouter();
  const { currentUser, listPetsByOwner } = useAppData();
  if (!currentUser) return null;
  const pets = listPetsByOwner(currentUser.id);

  return (
    <ScreenShell
      eyebrow="MEUS PETS"
      title="Companheiros cadastrados"
      subtitle="Abra um pet para verificar ou atualizar seus cuidados e comportamento.">
      {pets.length === 0 ? (
        <EmptyState
          icon={<Text style={{ fontSize: 28 }}>🐾</Text>}
          title="Nenhum pet cadastrado"
          description="Cadastre o primeiro pet para completar o perfil de tutor."
          actionLabel="Cadastrar pet"
          onAction={() => router.push('/pets/new')}
        />
      ) : (
        pets.map((pet) => (
          <PetCard
            key={pet.id}
            name={pet.name}
            species={labelForOption(petSpeciesOptions, pet.species)}
            breed={pet.breed}
            detail={pet.ageYears === null ? undefined : `${pet.ageYears} ano(s)`}
            photoUri={pet.photos.profileUri}
            careTags={pet.careTags.map((tag) => labelForOption(petCareOptions, tag))}
            onPress={() =>
              router.push({ pathname: '/pets/[petId]', params: { petId: pet.id } })
            }
          />
        ))
      )}

      {pets.length > 0 ? (
        <PrimaryButton label="Cadastrar outro pet" onPress={() => router.push('/pets/new')} />
      ) : null}
    </ScreenShell>
  );
}
