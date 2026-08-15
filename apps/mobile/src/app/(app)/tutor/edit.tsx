import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PhotoPickerField } from '@/components/photo-picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAppData } from '@/core/state/app-data-context';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import { LocationFields } from '@/features/locations';
import {
  createEmptyTutorForm,
  locationToDraft,
  tutorDraftToInput,
  validateTutorForm,
} from '@/features/tutors/domain/tutor-form';

export default function TutorEditScreen() {
  const router = useRouter();
  const { clearError, currentUser, error, getTutorProfileByUserId, upsertTutorProfile } = useAppData();
  const existing = currentUser ? getTutorProfileByUserId(currentUser.id) : null;
  const [draft, setDraft] = useState(() =>
    existing
      ? { location: locationToDraft(existing.location), bio: existing.bio, photos: existing.photos }
      : createEmptyTutorForm(currentUser?.photos ?? { profileUri: null, galleryUris: [] }),
  );
  const [errors, setErrors] = useState<ReturnType<typeof validateTutorForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const bioRef = useRef<TextInput>(null);

  if (!currentUser) return null;

  async function handleSubmit() {
    if (submittingRef.current || !currentUser) return;
    const nextErrors = validateTutorForm(draft);
    setErrors(nextErrors);
    clearError();
    if (Object.keys(nextErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await upsertTutorProfile(tutorDraftToInput(currentUser.id, draft));
      trackUsageInBackground({
        eventName: 'tutor_profile_saved',
        screen: 'tutor_profile',
        metadata: { action: existing ? 'update' : 'create' },
      });
      router.replace('/profile/tutor');
    } catch {
      // O contexto apresenta uma mensagem sanitizada no banner.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DE TUTOR"
      onBack={() => router.back()}
      title={existing ? 'Atualizar perfil' : 'Cadastrar perfil'}
      subtitle="Primeiro escolha a UF; depois selecione uma cidade pertencente a ela.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Localização aproximada" description="Não solicitamos endereço exato nesta etapa.">
        <LocationFields
          value={draft.location}
          onChange={(location) => {
            setDraft((current) => ({ ...current, location }));
            setErrors((current) => ({ ...current, location: undefined }));
          }}
          errors={errors.location}
        />
      </SectionCard>

      <SectionCard title="Sobre você" description="Opcional, mas ajuda o cuidador a conhecer o tutor.">
        <FormField
          ref={bioRef}
          label="Apresentação"
          hint={`${draft.bio.length}/500 caracteres`}
          maxLength={500}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={draft.bio}
          error={errors.bio}
          onChangeText={(bio) => {
            setDraft((current) => ({ ...current, bio }));
            setErrors((current) => ({ ...current, bio: undefined }));
          }}
        />
      </SectionCard>

      <SectionCard title="Fotos do tutor">
        <PhotoPickerField
          value={{ primary: draft.photos.profileUri, additional: draft.photos.galleryUris }}
          onChange={(photos) =>
            setDraft((current) => ({
              ...current,
              photos: { profileUri: photos.primary, galleryUris: photos.additional },
            }))
          }
        />
      </SectionCard>

      {Object.values(errors).some(Boolean) ? (
        <ErrorBanner message="Revise os campos destacados acima antes de salvar o perfil de tutor." />
      ) : null}

      <PrimaryButton
        label={existing ? 'Salvar alterações' : 'Cadastrar tutor'}
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </ScreenShell>
  );
}
