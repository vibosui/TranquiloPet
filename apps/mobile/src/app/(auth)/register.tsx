import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import {
  formatBrazilianPhone,
  normalizeEmail,
  normalizeText,
  onlyDigits,
} from '@/features/shared/domain/brazilian-formatters';

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
};
type Field = keyof Draft;
type Errors = Partial<Record<Field, string>>;

const emptyDraft: Draft = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirmation: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountRegistrationScreen() {
  const router = useRouter();
  const { clearError, error, signUp } = useAuth();
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmationRef = useRef<TextInput>(null);

  function update(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  }

  async function handleSubmit() {
    if (submittingRef.current) return;

    const nextErrors: Errors = {};
    if (normalizeText(draft.fullName).length < 3) nextErrors.fullName = 'Informe seu nome completo.';
    if (!emailPattern.test(normalizeEmail(draft.email))) nextErrors.email = 'Informe um e-mail válido.';
    if (![10, 11].includes(onlyDigits(draft.phone).length)) nextErrors.phone = 'Informe telefone com DDD.';
    if (draft.password.length < 8) nextErrors.password = 'Use pelo menos 8 caracteres.';
    if (draft.passwordConfirmation !== draft.password) {
      nextErrors.passwordConfirmation = 'As senhas precisam ser iguais.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    clearError();
    try {
      const result = await signUp({
        fullName: draft.fullName,
        email: draft.email,
        phone: draft.phone,
        password: draft.password,
      });

      if (result.requiresEmailConfirmation) {
        Alert.alert(
          'Confirme seu e-mail',
          'Sua conta foi criada. Abra o e-mail enviado pelo Hospeda Patas para confirmar o acesso.',
          [{ text: 'Ir para login', onPress: () => router.replace('/login') }],
        );
      }
    } catch {
      // A mensagem sanitizada é exibida pelo contexto.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="NOVA CONTA"
      onBack={() => router.back()}
      title="Crie sua identidade no Hospeda Patas"
      subtitle="Sua conta recebe automaticamente um código permanente para conectar tutor e cuidador com segurança.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard
        title="Dados de acesso"
        description="Tutor e cuidador são papéis da mesma identidade. Você poderá ativar os dois no perfil.">
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
          returnKeyType="next"
          value={draft.phone}
          error={errors.phone}
          onChangeText={(value) => update('phone', formatBrazilianPhone(value))}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FormField
          ref={passwordRef}
          required
          label="Senha"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          returnKeyType="next"
          value={draft.password}
          error={errors.password}
          onChangeText={(value) => update('password', value)}
          onSubmitEditing={() => passwordConfirmationRef.current?.focus()}
        />
        <FormField
          ref={passwordConfirmationRef}
          required
          label="Confirmar senha"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          returnKeyType="done"
          value={draft.passwordConfirmation}
          error={errors.passwordConfirmation}
          onChangeText={(value) => update('passwordConfirmation', value)}
          onSubmitEditing={() => void handleSubmit()}
        />
      </SectionCard>

      <SectionCard
        title="Seu código Hospeda Patas"
        description="Depois do cadastro, o perfil mostrará um código no formato HP-XXXXXX. Ele é permanente e servirá para criar contatos e hospedagens." />

      {Object.values(errors).some(Boolean) ? (
        <ErrorBanner message="Revise os campos destacados antes de criar a conta." />
      ) : null}

      <PrimaryButton
        label="Criar minha conta"
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </ScreenShell>
  );
}
