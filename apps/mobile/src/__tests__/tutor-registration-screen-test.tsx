import { act, fireEvent, render } from '@testing-library/react-native';

import TutorRegistrationScreen from '@/app/tutor/register';
import { createTutorProfile } from '@/features/tutors/api/tutor-profile-api';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/features/analytics/usage-tracker', () => ({
  trackUsageInBackground: jest.fn(),
}));

jest.mock('@/features/tutors/api/tutor-profile-api', () => ({
  createTutorProfile: jest.fn(),
  TutorProfileApiError: class TutorProfileApiError extends Error {},
}));

describe('<TutorRegistrationScreen />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows field errors and does not submit an empty form', async () => {
    const screen = await render(<TutorRegistrationScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(screen.getByText('Informe um nome com 3 a 100 caracteres.')).toBeTruthy();
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(screen.getByText('Informe um telefone com DDD.')).toBeTruthy();
    expect(screen.getByText('Informe uma cidade com 2 a 80 caracteres.')).toBeTruthy();
    expect(screen.getByText('Use uma UF válida.')).toBeTruthy();
    expect(createTutorProfile).not.toHaveBeenCalled();
  });

  test('blocks a second submission while the first request is pending', async () => {
    let resolveCreation: (profile: { id: string; created_at: string }) => void = () => undefined;
    jest.mocked(createTutorProfile).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreation = resolve;
        }),
    );
    const screen = await render(<TutorRegistrationScreen />);

    await fireEvent.changeText(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@email.com');
    await fireEvent.changeText(screen.getByLabelText('Telefone com DDD'), '47999991234');
    await fireEvent.changeText(screen.getByLabelText('Cidade'), 'Rio do Sul');
    await fireEvent.changeText(screen.getByLabelText('UF'), 'SC');
    const submitButton = screen.getByRole('button', { name: 'Salvar perfil' });

    await fireEvent.press(submitButton);
    await fireEvent.press(submitButton);

    expect(createTutorProfile).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreation({ id: 'profile-1', created_at: '2026-08-15T15:00:00Z' });
    });
    expect(await screen.findByText('Cadastro concluído!')).toBeTruthy();
  });
});
