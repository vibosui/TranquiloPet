import { emptyPhotoCollection } from '@/core/domain/entities';
import {
  caregiverDraftToInput,
  type CaregiverFormDraft,
  validateCaregiverForm,
} from '@/features/caregivers/domain/caregiver-form';
import {
  tutorDraftToInput,
  validateTutorForm,
} from '@/features/tutors/domain/tutor-form';

const stateOnlyLocation = {
  stateCode: 'SC',
  stateName: 'Santa Catarina',
  cityId: null,
  cityName: '',
};

const validLocation = {
  stateCode: 'SC',
  stateName: 'Santa Catarina',
  cityId: 4214805,
  cityName: 'Rio do Sul',
};

describe('erros de localização nos formulários de perfil', () => {
  test('o tutor recebe erro de UF sem marcar a cidade bloqueada', () => {
    expect(
      validateTutorForm({
        location: { stateCode: '', stateName: '', cityId: null, cityName: '' },
        bio: '',
        photos: emptyPhotoCollection(),
      }).location,
    ).toEqual({ state: 'Selecione uma UF válida na lista.' });
  });

  test('o tutor recebe somente erro de cidade depois de escolher uma UF válida', () => {
    expect(
      validateTutorForm({
        location: stateOnlyLocation,
        bio: '',
        photos: emptyPhotoCollection(),
      }).location,
    ).toEqual({ city: 'Selecione uma cidade válida para a UF escolhida.' });
  });

  test('o cuidador usa o mesmo contrato de erro por campo', () => {
    const draft: CaregiverFormDraft = {
      location: stateOnlyLocation,
      cpf: '529.982.247-25',
      bio: 'Tenho experiência com cuidados de cães e gatos.',
      experienceYears: '3',
      acceptedSpecies: ['dog'],
      acceptedSizes: ['medium'],
      offeredServices: ['boarding'],
      availability: ['weekdays'],
      photos: emptyPhotoCollection(),
    };

    expect(validateCaregiverForm(draft)).toEqual({
      location: { city: 'Selecione uma cidade válida para a UF escolhida.' },
    });
  });

  test('preserva parágrafos das apresentações ao converter os dois perfis', () => {
    const bio = '  Primeira linha.  \r\n\r\n  Segunda linha.  ';
    const tutorInput = tutorDraftToInput('demo-user-01', {
      location: validLocation,
      bio,
      photos: emptyPhotoCollection(),
    });
    const caregiverInput = caregiverDraftToInput('demo-user-01', {
      location: validLocation,
      cpf: '529.982.247-25',
      bio,
      experienceYears: '3',
      acceptedSpecies: ['dog'],
      acceptedSizes: ['medium'],
      offeredServices: ['boarding'],
      availability: ['weekdays'],
      photos: emptyPhotoCollection(),
    });

    expect(tutorInput.bio).toBe('Primeira linha.\n\nSegunda linha.');
    expect(caregiverInput.profile.bio).toBe('Primeira linha.\n\nSegunda linha.');
  });
});
