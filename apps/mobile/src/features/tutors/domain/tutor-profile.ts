export type TutorProfileDraft = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
};

export type TutorProfileField = keyof TutorProfileDraft;
export type TutorProfileErrors = Partial<Record<TutorProfileField, string>>;

export const emptyTutorProfile: TutorProfileDraft = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const brazilianStates = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatBrazilianPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function validateTutorProfile(draft: TutorProfileDraft): TutorProfileErrors {
  const errors: TutorProfileErrors = {};
  const fullName = draft.fullName.trim();
  const email = draft.email.trim();
  const phone = onlyDigits(draft.phone);
  const city = draft.city.trim();
  const state = draft.state.trim().toUpperCase();

  if (fullName.length < 3 || fullName.length > 100) {
    errors.fullName = 'Informe um nome com 3 a 100 caracteres.';
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (phone.length < 10 || phone.length > 11) errors.phone = 'Informe um telefone com DDD.';
  if (city.length < 2 || city.length > 80) {
    errors.city = 'Informe uma cidade com 2 a 80 caracteres.';
  }
  if (!brazilianStates.has(state)) errors.state = 'Use uma UF válida.';

  return errors;
}

export function normalizeTutorProfile(draft: TutorProfileDraft) {
  return {
    full_name: draft.fullName.trim().replace(/\s+/g, ' '),
    email: draft.email.trim().toLowerCase(),
    phone: onlyDigits(draft.phone),
    city: draft.city.trim().replace(/\s+/g, ' '),
    state: draft.state.trim().toUpperCase(),
  };
}
