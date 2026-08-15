import type { Location, PhotoCollection, UpsertTutorProfileInput } from '@/core/domain/entities';
import {
  getBrazilianState,
  isValidLocationDraft,
  type LocationDraft,
  type LocationFieldErrors,
  validateLocationDraft,
} from '@/features/locations';
import {
  normalizeMultilineText,
  normalizeText,
} from '@/features/shared/domain/brazilian-formatters';

export type TutorFormDraft = {
  location: LocationDraft;
  bio: string;
  photos: PhotoCollection;
};

export type TutorFormErrors = {
  location?: LocationFieldErrors;
  bio?: string;
};

export function createEmptyTutorForm(photos: PhotoCollection): TutorFormDraft {
  return {
    location: { stateCode: '', stateName: '', cityId: null, cityName: '' },
    bio: '',
    photos,
  };
}

export function validateTutorForm(draft: TutorFormDraft): TutorFormErrors {
  const errors: TutorFormErrors = {};
  const locationErrors = validateLocationDraft(draft.location);
  if (locationErrors.state || locationErrors.city) {
    errors.location = locationErrors;
  }
  if (normalizeText(draft.bio).length > 500) {
    errors.bio = 'A apresentacao deve ter no maximo 500 caracteres.';
  }
  return errors;
}

export function locationDraftToLocation(draft: LocationDraft): Location {
  const state = getBrazilianState(draft.stateCode);
  if (!state || draft.cityId === null || !isValidLocationDraft(draft)) {
    throw new Error('Localizacao invalida.');
  }

  return {
    stateIbgeId: String(state.id),
    stateCode: state.code,
    stateName: state.name,
    cityIbgeId: String(draft.cityId),
    cityName: draft.cityName,
  };
}

export function locationToDraft(location: Location): LocationDraft {
  return {
    stateCode: location.stateCode,
    stateName: location.stateName,
    cityId: Number(location.cityIbgeId),
    cityName: location.cityName,
  };
}

export function tutorDraftToInput(
  userId: string,
  draft: TutorFormDraft,
): UpsertTutorProfileInput {
  return {
    userId,
    location: locationDraftToLocation(draft.location),
    bio: normalizeMultilineText(draft.bio),
    photos: draft.photos,
  };
}
