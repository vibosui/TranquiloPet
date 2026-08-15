import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PhotoPickerField } from '@/components/photo-picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { TagSelector } from '@/components/tag-selector';
import { useAppData } from '@/core/state/app-data-context';
import type { CareService, PetSize, PetSpecies } from '@/core/domain/entities';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import {
  acceptedSizeOptions,
  acceptedSpeciesOptions,
  availabilityOptions,
  careServiceOptions,
} from '@/features/caregivers/domain/caregiver-options';
import {
  caregiverDraftToInput,
  type CaregiverFormDraft,
  validateCaregiverForm,
} from '@/features/caregivers/domain/caregiver-form';
import { emptyLocationDraft, LocationFields } from '@/features/locations';
import { formatCpf } from '@/features/shared/domain/brazilian-formatters';
import { locationToDraft } from '@/features/tutors/domain/tutor-form';

export default function CaregiverEditScreen() {
  const router = useRouter();
  const {
    clearError,
    currentUser,
    error,
    getCaregiverPrivateDataByUserId,
    getCaregiverProfileByUserId,
    upsertCaregiverProfile,
  } = useAppData();
  const existing = currentUser ? getCaregiverProfileByUserId(currentUser.id) : null;
  const privateData = currentUser ? getCaregiverPrivateDataByUserId(currentUser.id) : null;
  const [draft, setDraft] = useState<CaregiverFormDraft>(() => ({
    location: existing ? locationToDraft(existing.location) : emptyLocationDraft,
    cpf: privateData ? formatCpf(privateData.cpf) : '',
    bio: existing?.bio ?? '',
    experienceYears: existing ? String(existing.experienceYears) : '',
    acceptedSpecies: existing?.acceptedSpecies ?? [],
    acceptedSizes: existing?.acceptedSizes ?? [],
    offeredServices: existing?.offeredServices ?? [],
    availability: existing?.availability ?? [],
    photos: existing?.photos ?? currentUser?.photos ?? { profileUri: null, galleryUris: [] },
  }));
  const [errors, setErrors] = useState<ReturnType<typeof validateCaregiverForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!currentUser) return null;

  function clearFieldError(field: keyof ReturnType<typeof validateCaregiverForm>) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  }

  async function handleSubmit() {
    if (submittingRef.current || !currentUser) return;
    const nextErrors = validateCaregiverForm(draft);
    setErrors(nextErrors);
    clearError();
    if (Object.keys(nextErrors).length) return;

    const input = caregiverDraftToInput(currentUser.id, draft);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await upsertCaregiverProfile(input.profile, { cpf: input.cpf });
      trackUsageInBackground({
        eventName: 'caregiver_profile_saved',
        screen: 'caregiver_profile',
        metadata: { action: existing ? 'update' : 'create' },
      });
      router.replace('/profile/caregiver');
    } catch {
      // O contexto apresenta uma mensagem sanitizada no banner.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="PERFIL DE CUIDADOR"
      onBack={() => router.back()}
      title={existing ? 'Atualizar perfil' : 'Quero cuidar de pets'}
      subtitle="Cadastre somente dados fictícios. Informações privadas ficam separadas do perfil público.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Localização aproximada">
        <LocationFields
          value={draft.location}
          onChange={(location) => {
            setDraft((current) => ({ ...current, location }));
            clearFieldError('location');
          }}
          errors={errors.location}
        />
      </SectionCard>

      <SectionCard
        title="Dados privados"
        description="CPF é armazenado separadamente e nunca aparece na visualização pública.">
        <FormField
          required
          label="CPF fictício"
          hint="Use apenas CPF de teste."
          keyboardType="number-pad"
          maxLength={14}
          value={draft.cpf}
          error={errors.cpf}
          onChangeText={(cpf) => {
            setDraft((current) => ({ ...current, cpf: formatCpf(cpf) }));
            clearFieldError('cpf');
          }}
        />
      </SectionCard>

      <SectionCard title="Experiência">
        <FormField
          required
          label="Anos de experiência"
          keyboardType="number-pad"
          maxLength={2}
          value={draft.experienceYears}
          error={errors.experienceYears}
          onChangeText={(experienceYears) => {
            setDraft((current) => ({ ...current, experienceYears: experienceYears.replace(/\D/g, '') }));
            clearFieldError('experienceYears');
          }}
        />
        <FormField
          required
          label="Conte sua experiência"
          hint={`${draft.bio.length}/700 caracteres`}
          maxLength={700}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={draft.bio}
          error={errors.bio}
          onChangeText={(bio) => {
            setDraft((current) => ({ ...current, bio }));
            clearFieldError('bio');
          }}
        />
      </SectionCard>

      <SectionCard title="Atuação">
        <TagSelector
          label="Espécies aceitas"
          options={acceptedSpeciesOptions}
          selectedValues={draft.acceptedSpecies}
          error={errors.acceptedSpecies}
          onChange={(values) => {
            setDraft((current) => ({ ...current, acceptedSpecies: values as PetSpecies[] }));
            clearFieldError('acceptedSpecies');
          }}
        />
        <TagSelector
          label="Portes aceitos"
          options={acceptedSizeOptions}
          selectedValues={draft.acceptedSizes}
          error={errors.acceptedSizes}
          onChange={(values) => {
            setDraft((current) => ({ ...current, acceptedSizes: values as PetSize[] }));
            clearFieldError('acceptedSizes');
          }}
        />
        <TagSelector
          label="Serviços oferecidos"
          options={careServiceOptions}
          selectedValues={draft.offeredServices}
          error={errors.offeredServices}
          onChange={(values) => {
            setDraft((current) => ({ ...current, offeredServices: values as CareService[] }));
            clearFieldError('offeredServices');
          }}
        />
        <TagSelector
          label="Disponibilidade"
          options={availabilityOptions}
          selectedValues={draft.availability}
          error={errors.availability}
          onChange={(availability) => {
            setDraft((current) => ({ ...current, availability }));
            clearFieldError('availability');
          }}
        />
      </SectionCard>

      <SectionCard title="Fotos do cuidador">
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
        <ErrorBanner message="Revise os campos destacados acima antes de salvar o perfil de cuidador." />
      ) : null}

      <PrimaryButton
        label={existing ? 'Salvar alterações' : 'Cadastrar cuidador'}
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </ScreenShell>
  );
}
