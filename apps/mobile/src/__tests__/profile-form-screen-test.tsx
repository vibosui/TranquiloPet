import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import CaregiverEditScreen from '@/app/(app)/caregiver/edit';
import TutorEditScreen from '@/app/(app)/tutor/edit';
import { useAppData } from '@/core/state/app-data-context';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/core/state/app-data-context', () => ({ useAppData: jest.fn() }));
jest.mock('@/features/analytics/usage-tracker', () => ({
  trackUsageInBackground: jest.fn(),
}));

const currentUser = {
  id: 'demo-user-01',
  fullName: 'Ana Souza',
  email: 'demo01@tranquilopet.local',
  phone: '11900000001',
  photos: { profileUri: null, galleryUris: [] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('resumo de erros nos formulários de perfil', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue({ back: jest.fn(), replace: jest.fn() } as never);
  });

  test('mostra o resumo junto ao CTA do tutor após uma submissão inválida', async () => {
    const upsertTutorProfile = jest.fn();
    jest.mocked(useAppData).mockReturnValue({
      clearError: jest.fn(),
      currentUser,
      error: null,
      getTutorProfileByUserId: jest.fn(() => null),
      upsertTutorProfile,
    } as never);
    const screen = await render(<TutorEditScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar tutor' }));

    expect(
      await screen.findByText(
        'Revise os campos destacados acima antes de salvar o perfil de tutor.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Selecione uma UF válida na lista.')).toBeTruthy();
    expect(upsertTutorProfile).not.toHaveBeenCalled();
  });

  test('mostra o resumo junto ao CTA do cuidador após uma submissão inválida', async () => {
    const upsertCaregiverProfile = jest.fn();
    jest.mocked(useAppData).mockReturnValue({
      clearError: jest.fn(),
      currentUser,
      error: null,
      getCaregiverPrivateDataByUserId: jest.fn(() => null),
      getCaregiverProfileByUserId: jest.fn(() => null),
      upsertCaregiverProfile,
    } as never);
    const screen = await render(<CaregiverEditScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cadastrar cuidador' }));

    expect(
      await screen.findByText(
        'Revise os campos destacados acima antes de salvar o perfil de cuidador.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Selecione uma UF válida na lista.')).toBeTruthy();
    expect(upsertCaregiverProfile).not.toHaveBeenCalled();
  });
});
