import { act, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { useAppData } from '@/core/state/app-data-context';
import { PetFormScreen } from '@/features/pets/components/pet-form-screen';

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

describe('<PetFormScreen />', () => {
  const replace = jest.fn();
  const upsertPet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue({ back: jest.fn(), replace } as never);
    jest.mocked(useAppData).mockReturnValue({
      clearError: jest.fn(),
      currentUser,
      error: null,
      getPetById: jest.fn(() => null),
      upsertPet,
    } as never);
  });

  test('shows medication details only when the care tag is selected', async () => {
    const screen = await render(<PetFormScreen />);

    expect(screen.queryByLabelText('Detalhes da medicação')).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Precisa de medicação' }));
    expect(screen.getByLabelText('Detalhes da medicação, obrigatório')).toBeTruthy();
  });

  test('validates and saves care and behavior information', async () => {
    upsertPet.mockResolvedValue({ id: 'pet-created' });
    const screen = await render(<PetFormScreen />);

    await fireEvent.changeText(screen.getByLabelText('Nome do pet, obrigatório'), 'Luna');
    await fireEvent.press(screen.getByRole('radio', { name: 'Cachorro' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Médio' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Precisa de medicação' }));
    await fireEvent.changeText(
      screen.getByLabelText('Detalhes da medicação, obrigatório'),
      '1 comprimido às 20h',
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Ansioso' }));
    await fireEvent.changeText(
      screen.getByLabelText('Contexto do comportamento'),
      'Fica tranquilo com o brinquedo favorito.',
    );

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Cadastrar pet' }));
    });

    expect(upsertPet).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: currentUser.id,
        name: 'Luna',
        careTags: ['medication'],
        behavior: expect.objectContaining({ traits: ['anxious'] }),
      }),
    );
    expect(replace).toHaveBeenCalledWith({
      pathname: '/pets/[petId]',
      params: { petId: 'pet-created' },
    });
  });
});
