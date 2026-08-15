import { emptyPhotoCollection } from '@/core/domain/entities';
import {
  createPetFormDraft,
  petDraftToInput,
  validatePetForm,
} from '@/features/pets/domain/pet-form';

const validDraft = {
  name: 'Luna',
  species: 'dog' as const,
  breed: 'Vira-lata',
  ageYears: '4',
  size: 'medium' as const,
  characteristics: 'Muito curiosa',
  careTags: ['medication'] as const,
  medicationDetails: '1 comprimido as 20h',
  behaviorTraits: ['anxious'] as const,
  behaviorNotes: 'Fica mais tranquila com brinquedos.',
  additionalNotes: 'Nao oferecer petiscos.',
  photos: emptyPhotoCollection(),
};

describe('pet form domain', () => {
  test('requires medication details when the tag is selected', () => {
    expect(
      validatePetForm({
        ...validDraft,
        careTags: ['medication'],
        behaviorTraits: ['anxious'],
        medicationDetails: '',
      }),
    ).toMatchObject({ medicationDetails: expect.any(String) });
  });

  test('maps a valid draft without losing care and behavior information', () => {
    const input = petDraftToInput('demo-user-01', {
      ...validDraft,
      careTags: [...validDraft.careTags],
      behaviorTraits: [...validDraft.behaviorTraits],
    });

    expect(input.ownerUserId).toBe('demo-user-01');
    expect(input.behavior.traits).toEqual(['anxious']);
    expect(input.medicationDetails).toBe('1 comprimido as 20h');
    expect(input.additionalNotes).toBe('Nao oferecer petiscos.');

    const restoredDraft = createPetFormDraft({
      ...input,
      id: 'pet-round-trip',
      createdAt: '2026-08-15T18:00:00.000Z',
      updatedAt: '2026-08-15T18:00:00.000Z',
    });
    expect(restoredDraft.medicationDetails).toBe('1 comprimido as 20h');
    expect(restoredDraft.additionalNotes).toBe('Nao oferecer petiscos.');
  });
});
