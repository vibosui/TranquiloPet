import type {
  Pet,
  PetBehaviorTag,
  PetCareTag,
  PetSize,
  PetSpecies,
  PhotoCollection,
  UpsertPetInput,
} from '@/core/domain/entities';
import {
  normalizeMultilineText,
  normalizeText,
} from '@/features/shared/domain/brazilian-formatters';

export type PetFormDraft = {
  id?: string;
  name: string;
  species: PetSpecies | null;
  breed: string;
  ageYears: string;
  size: PetSize | null;
  characteristics: string;
  careTags: PetCareTag[];
  medicationDetails: string;
  behaviorTraits: PetBehaviorTag[];
  behaviorNotes: string;
  additionalNotes: string;
  photos: PhotoCollection;
};

export type PetFormErrors = Partial<
  Record<'name' | 'species' | 'breed' | 'ageYears' | 'size' | 'medicationDetails', string>
>;

export function createPetFormDraft(pet?: Pet | null): PetFormDraft {
  if (!pet) {
    return {
      name: '',
      species: null,
      breed: '',
      ageYears: '',
      size: null,
      characteristics: '',
      careTags: [],
      medicationDetails: '',
      behaviorTraits: [],
      behaviorNotes: '',
      additionalNotes: '',
      photos: { profileUri: null, galleryUris: [] },
    };
  }

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    ageYears: pet.ageYears === null ? '' : String(pet.ageYears),
    size: pet.size,
    characteristics: pet.characteristics,
    careTags: [...pet.careTags],
    medicationDetails: pet.medicationDetails,
    behaviorTraits: [...pet.behavior.traits],
    behaviorNotes: pet.behavior.notes,
    additionalNotes: pet.additionalNotes,
    photos: pet.photos,
  };
}

export function validatePetForm(draft: PetFormDraft): PetFormErrors {
  const errors: PetFormErrors = {};
  const name = normalizeText(draft.name);
  if (name.length < 2 || name.length > 60) errors.name = 'Informe um nome de 2 a 60 caracteres.';
  if (!draft.species) errors.species = 'Selecione a especie.';
  if (normalizeText(draft.breed).length > 80) errors.breed = 'Use no maximo 80 caracteres.';
  if (draft.ageYears.trim()) {
    const age = Number(draft.ageYears);
    if (!Number.isFinite(age) || age < 0 || age > 80) errors.ageYears = 'Informe uma idade valida.';
  }
  if (!draft.size) errors.size = 'Selecione o porte.';
  if (draft.careTags.includes('medication') && normalizeText(draft.medicationDetails).length < 3) {
    errors.medicationDetails = 'Explique a medicacao, dose ou horario.';
  }
  return errors;
}

export function petDraftToInput(ownerUserId: string, draft: PetFormDraft): UpsertPetInput {
  if (!draft.species || !draft.size) throw new Error('Pet invalido.');
  const medicationDetails = draft.careTags.includes('medication')
    ? normalizeMultilineText(draft.medicationDetails)
    : '';
  return {
    id: draft.id,
    ownerUserId,
    name: normalizeText(draft.name),
    species: draft.species,
    breed: normalizeText(draft.breed),
    ageYears: draft.ageYears.trim() ? Number(draft.ageYears) : null,
    size: draft.size,
    characteristics: normalizeMultilineText(draft.characteristics),
    careTags: [...draft.careTags],
    behavior: {
      traits: [...draft.behaviorTraits],
      notes: normalizeMultilineText(draft.behaviorNotes),
    },
    medicationDetails,
    additionalNotes: normalizeMultilineText(draft.additionalNotes),
    photos: draft.photos,
  };
}
