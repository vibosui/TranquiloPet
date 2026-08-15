import { environment } from '@/config/environment';
import { getSessionId } from '@/features/analytics/usage-tracker';
import {
  normalizeTutorProfile,
  type TutorProfileDraft,
} from '@/features/tutors/domain/tutor-profile';

type TutorProfileCreated = {
  id: string;
  created_at: string;
};

export class TutorProfileApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TutorProfileApiError';
  }
}

export async function createTutorProfile(
  draft: TutorProfileDraft,
  submissionId: string,
): Promise<TutorProfileCreated> {
  if (!environment.monitorApiUrl) {
    throw new TutorProfileApiError(
      'Configure EXPO_PUBLIC_MONITOR_API_URL para salvar o perfil neste ambiente de teste.',
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${environment.monitorApiUrl}/api/tutors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        session_id: getSessionId(),
        submission_id: submissionId,
        ...normalizeTutorProfile(draft),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      throw new TutorProfileApiError(
        typeof payload?.detail === 'string'
          ? payload.detail
          : 'Não foi possível salvar o perfil. Revise os dados e tente novamente.',
        response.status,
      );
    }

    return (await response.json()) as TutorProfileCreated;
  } catch (error) {
    if (error instanceof TutorProfileApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TutorProfileApiError('O monitor demorou demais para responder.');
    }
    throw new TutorProfileApiError('Sem conexão com o monitor local. Verifique o Wi-Fi e a API.');
  } finally {
    clearTimeout(timeoutId);
  }
}
