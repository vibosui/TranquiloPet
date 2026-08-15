import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PhotoPickerField } from '@/components/photo-picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { TagSelector } from '@/components/tag-selector';
import { useAppData } from '@/core/state/app-data-context';
import type { PetBehaviorTag, PetCareTag, PetSize, PetSpecies } from '@/core/domain/entities';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import {
  createPetFormDraft,
  petDraftToInput,
  validatePetForm,
} from '@/features/pets/domain/pet-form';
import {
  petBehaviorOptions,
  petCareOptions,
  petSizeOptions,
  petSpeciesOptions,
} from '@/features/pets/domain/pet-options';

type PetFormScreenProps = {
  petId?: string;
};

export function PetFormScreen({ petId }: PetFormScreenProps) {
  const router = useRouter();
  const { clearError, currentUser, error, getPetById, upsertPet } = useAppData();
  const existing = petId ? getPetById(petId) : null;
  const canEdit = !existing || existing.ownerUserId === currentUser?.id;
  const [draft, setDraft] = useState(() => createPetFormDraft(existing));
  const [errors, setErrors] = useState<ReturnType<typeof validatePetForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const breedRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  if (!currentUser) return null;

  function clearFieldError(field: keyof ReturnType<typeof validatePetForm>) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  }

  async function handleSubmit() {
    if (!canEdit || submittingRef.current || !currentUser) return;
    const nextErrors = validatePetForm(draft);
    setErrors(nextErrors);
    clearError();
    if (Object.keys(nextErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const pet = await upsertPet(petDraftToInput(currentUser.id, draft));
      trackUsageInBackground({
        eventName: 'pet_profile_saved',
        screen: 'pet_form',
        metadata: { action: existing ? 'update' : 'create' },
      });
      router.replace({ pathname: '/pets/[petId]', params: { petId: pet.id } });
    } catch {
      // O contexto apresenta uma mensagem sanitizada no banner.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (petId && !existing) {
    return (
      <ScreenShell onBack={() => router.back()} title="Pet não encontrado">
        <ErrorBanner message="O registro solicitado não existe neste aparelho." />
      </ScreenShell>
    );
  }

  if (!canEdit) {
    return (
      <ScreenShell onBack={() => router.back()} title="Acesso não permitido">
        <ErrorBanner message="Este pet pertence a outro usuário de demonstração." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="MEUS PETS"
      onBack={() => router.back()}
      title={existing ? `Atualizar ${existing.name}` : 'Cadastrar pet'}
      subtitle="Registre identidade, cuidados especiais e análise comportamental.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Identificação">
        <FormField
          required
          label="Nome do pet"
          autoCapitalize="words"
          maxLength={60}
          returnKeyType="next"
          value={draft.name}
          error={errors.name}
          onChangeText={(name) => {
            setDraft((current) => ({ ...current, name }));
            clearFieldError('name');
          }}
          onSubmitEditing={() => breedRef.current?.focus()}
        />
        <TagSelector
          label="Espécie"
          maxSelected={1}
          options={petSpeciesOptions}
          selectedValues={draft.species ? [draft.species] : []}
          error={errors.species}
          onChange={(values) => {
            setDraft((current) => ({ ...current, species: (values[0] as PetSpecies) ?? null }));
            clearFieldError('species');
          }}
        />
        <FormField
          ref={breedRef}
          label="Raça"
          hint="Pode deixar em branco se não souber."
          autoCapitalize="words"
          maxLength={80}
          returnKeyType="next"
          value={draft.breed}
          error={errors.breed}
          onChangeText={(breed) => {
            setDraft((current) => ({ ...current, breed }));
            clearFieldError('breed');
          }}
          onSubmitEditing={() => ageRef.current?.focus()}
        />
        <FormField
          ref={ageRef}
          label="Idade aproximada em anos"
          keyboardType="decimal-pad"
          maxLength={5}
          value={draft.ageYears}
          error={errors.ageYears}
          onChangeText={(ageYears) => {
            setDraft((current) => ({ ...current, ageYears: ageYears.replace(',', '.') }));
            clearFieldError('ageYears');
          }}
        />
        <TagSelector
          label="Porte"
          maxSelected={1}
          options={petSizeOptions}
          selectedValues={draft.size ? [draft.size] : []}
          error={errors.size}
          onChange={(values) => {
            setDraft((current) => ({ ...current, size: (values[0] as PetSize) ?? null }));
            clearFieldError('size');
          }}
        />
        <FormField
          label="Características"
          hint="Ex.: pelagem, rotina ou forma preferida de aproximação."
          maxLength={500}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={draft.characteristics}
          onChangeText={(characteristics) =>
            setDraft((current) => ({ ...current, characteristics }))
          }
        />
      </SectionCard>

      <SectionCard
        title="Cuidados especiais"
        description="Marque tudo que o cuidador precisa saber antes de aceitar o serviço.">
        <TagSelector
          label="Necessidades e rotina"
          options={petCareOptions}
          selectedValues={draft.careTags}
          onChange={(values) => {
            const careTags = values as PetCareTag[];
            setDraft((current) => ({
              ...current,
              careTags,
              medicationDetails: careTags.includes('medication')
                ? current.medicationDetails
                : '',
            }));
            clearFieldError('medicationDetails');
          }}
        />
        {draft.careTags.includes('medication') ? (
          <FormField
            required
            label="Detalhes da medicação"
            hint="Informe nome, dose e horário usando somente dados fictícios."
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={draft.medicationDetails}
            error={errors.medicationDetails}
            onChangeText={(medicationDetails) => {
              setDraft((current) => ({ ...current, medicationDetails }));
              clearFieldError('medicationDetails');
            }}
          />
        ) : null}
        <FormField
          label="Observações adicionais"
          maxLength={1000}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={draft.additionalNotes}
          onChangeText={(additionalNotes) =>
            setDraft((current) => ({ ...current, additionalNotes }))
          }
        />
      </SectionCard>

      <SectionCard
        title="Análise comportamental"
        description="Use características objetivas; prefira 'reativo' em vez de rótulos como 'briguento'.">
        <TagSelector
          label="Comportamentos observados"
          options={petBehaviorOptions}
          selectedValues={draft.behaviorTraits}
          onChange={(values) =>
            setDraft((current) => ({ ...current, behaviorTraits: values as PetBehaviorTag[] }))
          }
        />
        <FormField
          label="Contexto do comportamento"
          hint="Ex.: gatilhos, como acalmar e como reage a pessoas ou animais."
          maxLength={1000}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={draft.behaviorNotes}
          onChangeText={(behaviorNotes) =>
            setDraft((current) => ({ ...current, behaviorNotes }))
          }
        />
      </SectionCard>

      <SectionCard title="Fotos do pet">
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
        <ErrorBanner message="Revise os campos destacados acima antes de salvar o pet." />
      ) : null}

      <PrimaryButton
        label={existing ? 'Salvar alterações' : 'Cadastrar pet'}
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </ScreenShell>
  );
}
