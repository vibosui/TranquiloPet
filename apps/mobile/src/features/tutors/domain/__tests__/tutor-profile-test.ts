import {
  formatBrazilianPhone,
  normalizeTutorProfile,
  validateTutorProfile,
} from '@/features/tutors/domain/tutor-profile';

describe('tutor profile domain', () => {
  test('accepts and normalizes a valid Brazilian tutor profile', () => {
    const draft = {
      fullName: '  Ana   Souza ',
      email: ' ANA@EMAIL.COM ',
      phone: '(47) 99999-1234',
      city: '  Rio   do Sul ',
      state: 'sc',
    };

    expect(validateTutorProfile(draft)).toEqual({});
    expect(normalizeTutorProfile(draft)).toEqual({
      full_name: 'Ana Souza',
      email: 'ana@email.com',
      phone: '47999991234',
      city: 'Rio do Sul',
      state: 'SC',
    });
  });

  test('reports every invalid field without throwing', () => {
    expect(
      validateTutorProfile({
        fullName: 'A',
        email: 'email-invalido',
        phone: '123',
        city: '',
        state: 'XX',
      }),
    ).toEqual({
      fullName: 'Informe um nome com 3 a 100 caracteres.',
      email: 'Informe um e-mail válido.',
      phone: 'Informe um telefone com DDD.',
      city: 'Informe uma cidade com 2 a 80 caracteres.',
      state: 'Use uma UF válida.',
    });
  });

  test('formats phone progressively and limits it to eleven digits', () => {
    expect(formatBrazilianPhone('479999912345')).toBe('(47) 99999-1234');
    expect(formatBrazilianPhone('479999')).toBe('(47) 9999');
  });
});
