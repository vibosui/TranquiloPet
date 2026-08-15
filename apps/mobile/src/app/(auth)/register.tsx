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
import {
  formatBrazilianPhone,
  normalizeEmail,
  normalizeText,
  onlyDigits,
} from '@/features/shared/domain/brazilian-formatters';

type Draft = { fullName: string; email: string; phone: string; profileUri: string | null; galleryUris: string[] };
type Field = 'fullName' | 'email' | 'phone';
type Errors = Partial<Record<Field, string>>;

const emptyDraft: Draft = {
  fullName: '',
  email: '',
  phone: '',
  profileUri: null,
  galleryUris: [],
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountRegistrationScreen() {
  const router = useRouter();
  const { clearError, error, registerUser } = useAppData();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  function update(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  }

  async function handleSubmit() {
    if (submittingRef.current) return;
    const nextErrors: Errors = {};
    if (normalizeText(draft.fullName).length < 3) nextErrors.fullName = 'Informe o nome completo.';
    if (!emailPattern.test(normalizeEmail(draft.email))) nextErrors.email = 'Informe um e-mail válido.';
    if (![10, 11].includes(onlyDigits(draft.phone).length)) nextErrors.phone = 'Informe telefone com DDD.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await registerUser({
        fullName: draft.fullName,
        email: draft.email,
        phone: draft.phone,
        photos: { profileUri: draft.profileUri, galleryUris: draft.galleryUris },
      });
      trackUsageInBackground({
        eventName: 'demo_account_registered',
        screen: 'account_registration',
      });
    } catch {
      // O contexto apresenta uma mensagem sanitizada no banner.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="NOVA CONTA LOCAL"
      onBack={() => router.back()}
      title="Crie sua identidade"
      subtitle="Tutor e cuidador serão papéis da mesma conta. Neste laboratório não criamos senha.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="Dados básicos">
        <FormField
          required
          label="Nome completo"
          autoCapitalize="words"
          autoComplete="name"
          maxLength={100}
          returnKeyType="next"
          value={draft.fullName}
          error={errors.fullName}
          onChangeText={(value) => update('fullName', value)}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <FormField
          ref={emailRef}
          required
          label="E-mail"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          maxLength={254}
          returnKeyType="next"
          value={draft.email}
          error={errors.email}
          onChangeText={(value) => update('email', value)}
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <FormField
          ref={phoneRef}
          required
          label="Telefone com DDD"
          autoComplete="tel"
          keyboardType="phone-pad"
          returnKeyType="done"
          value={draft.phone}
          error={errors.phone}
          onChangeText={(value) => update('phone', formatBrazilianPhone(value))}
          onSubmitEditing={() => void handleSubmit()}
        />
      </SectionCard>

      <SectionCard title="Fotos" description="O envio para nuvem e a câmera permanecem desligados.">
        <PhotoPickerField
          value={{ primary: draft.profileUri, additional: draft.galleryUris }}
          onChange={(photos) =>
            setDraft((current) => ({
              ...current,
              profileUri: photos.primary,
              galleryUris: photos.additional,
            }))
          }
        />
      </SectionCard>

      {Object.values(errors).some(Boolean) ? (
        <ErrorBanner message="Revise os dados básicos destacados acima antes de criar a conta." />
      ) : null}

      <PrimaryButton label="Criar conta e entrar" loading={submitting} onPress={() => void handleSubmit()} />
    </ScreenShell>
  );
}
