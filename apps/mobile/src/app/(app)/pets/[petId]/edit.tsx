import { useLocalSearchParams } from 'expo-router';

import { PetFormScreen } from '@/features/pets/components/pet-form-screen';

export default function EditPetScreen() {
  const params = useLocalSearchParams<{ petId: string }>();
  return <PetFormScreen petId={params.petId} />;
}

