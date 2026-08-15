import { createTutorProfile } from '@/features/tutors/api/tutor-profile-api';

jest.mock('@/config/environment', () => ({
  environment: { monitorApiUrl: 'http://192.168.1.6:8000' },
}));

jest.mock('@/features/analytics/usage-tracker', () => ({
  getSessionId: () => 'android-test-session',
}));

const validDraft = {
  fullName: 'Ana Souza',
  email: 'ana@email.com',
  phone: '(47) 99999-1234',
  city: 'Rio do Sul',
  state: 'SC',
};

describe('tutor profile API', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  test('sends a normalized profile without leaking it to usage events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'profile-1', created_at: '2026-08-15T15:00:00Z' }),
    });

    await expect(createTutorProfile(validDraft, 'tutor-submission-1')).resolves.toEqual({
      id: 'profile-1',
      created_at: '2026-08-15T15:00:00Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.6:8000/api/tutors',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'android-test-session',
          submission_id: 'tutor-submission-1',
          full_name: 'Ana Souza',
          email: 'ana@email.com',
          phone: '47999991234',
          city: 'Rio do Sul',
          state: 'SC',
        }),
      }),
    );
  });

  test('surfaces the safe detail returned by the API', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Já existe um perfil local com este e-mail.' }),
    });

    await expect(createTutorProfile(validDraft, 'tutor-submission-1')).rejects.toEqual(
      expect.objectContaining({
        name: 'TutorProfileApiError',
        message: 'Já existe um perfil local com este e-mail.',
        status: 409,
      }),
    );
  });

  test('does not expose FastAPI validation internals as an error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ loc: ['body', 'email'], msg: 'invalid' }] }),
    });

    await expect(createTutorProfile(validDraft, 'tutor-submission-1')).rejects.toEqual(
      expect.objectContaining({
        message: 'Não foi possível salvar o perfil. Revise os dados e tente novamente.',
        status: 422,
      }),
    );
  });
});
