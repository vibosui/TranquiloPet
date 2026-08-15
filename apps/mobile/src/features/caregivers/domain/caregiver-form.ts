import type {
  CareService,
  PhotoCollection,
  PetSize,
  PetSpecies,
  UpsertCaregiverProfileInput,
} from '@/core/domain/entities';
import {
  type LocationDraft,
  type LocationFieldErrors,
  validateLocationDraft,
} from '@/features/locations';
import {
  isValidCpf,
  normalizeMultilineText,
  normalizeText,
  onlyDigits,
} from '@/features/shared/domain/brazilian-formatters';
import { locationDraftToLocation } from '@/features/tutors/domain/tutor-form';

export type CaregiverFormDraft = {
  location: LocationDraft;
  cpf: string;
  bio: string;
  experienceYears: string;
  acceptedSpecies: PetSpecies[];
  acceptedSizes: PetSize[];
  offeredServices: CareService[];
  availability: string[];
  photos: PhotoCollection;
};

export type CaregiverFormErrors = {
  location?: LocationFieldErrors;
} & Partial<
  Record<
    | 'cpf'
    | 'bio'
    | 'experienceYears'
    | 'acceptedSpecies'
    | 'acceptedSizes'
    | 'offeredServices'
    | 'availability',
    string
  >
>;

export function validateCaregiverForm(draft: CaregiverFormDraft): CaregiverFormErrors {
  const errors: CaregiverFormErrors = {};
  const locationErrors = validateLocationDraft(draft.location);
  if (locationErrors.state || locationErrors.city) {
    errors.location = locationErrors;
  }
  if (!isValidCpf(draft.cpf)) errors.cpf = 'Informe um CPF ficticio valido para o teste.';
  const bio = normalizeText(draft.bio);
  if (bio.length < 20 || bio.length > 700) {
    errors.bio = 'Conte sua experiencia em 20 a 700 caracteres.';
  }
  const experience = Number(draft.experienceYears);
  if (!Number.isInteger(experience) || experience < 0 || experience > 70) {
    errors.experienceYears = 'Informe entre 0 e 70 anos.';
  }
  if (!draft.acceptedSpecies.length) errors.acceptedSpecies = 'Escolha ao menos uma especie.';
  if (!draft.acceptedSizes.length) errors.acceptedSizes = 'Escolha ao menos um porte.';
  if (!draft.offeredServices.length) errors.offeredServices = 'Escolha ao menos um servico.';
  if (!draft.availability.length) errors.availability = 'Escolha ao menos uma disponibilidade.';
  return errors;
}

export function caregiverDraftToInput(
  userId: string,
  draft: CaregiverFormDraft,
): { profile: UpsertCaregiverProfileInput; cpf: string } {
  return {
    profile: {
      userId,
      location: locationDraftToLocation(draft.location),
      bio: normalizeMultilineText(draft.bio),
      experienceYears: Number(draft.experienceYears),
      acceptedSpecies: [...draft.acceptedSpecies],
      acceptedSizes: [...draft.acceptedSizes],
      offeredServices: [...draft.offeredServices],
      availability: [...draft.availability],
      photos: draft.photos,
    },
    cpf: onlyDigits(draft.cpf),
  };
}
