import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { trackUsageInBackground } from '@/features/analytics/usage-tracker';
import {
  createTutorProfile,
  TutorProfileApiError,
} from '@/features/tutors/api/tutor-profile-api';
import {
  emptyTutorProfile,
  formatBrazilianPhone,
  type TutorProfileDraft,
  type TutorProfileErrors,
  type TutorProfileField,
  validateTutorProfile,
} from '@/features/tutors/domain/tutor-profile';
import { colors, radii, spacing } from '@/theme/tokens';

function createSubmissionId() {
  return `tutor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function TutorRegistrationScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<TutorProfileDraft>(emptyTutorProfile);
  const [errors, setErrors] = useState<TutorProfileErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(createSubmissionId);

  const submissionInFlightRef = useRef(false);
  const fullNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);

  useEffect(() => {
    trackUsageInBackground({
      eventName: 'tutor_registration_opened',
      screen: 'tutor_registration',
    });
  }, []);

  function updateField(field: TutorProfileField, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (submissionInFlightRef.current) return;

    const validationErrors = validateTutorProfile(draft);
    setErrors(validationErrors);
    setSubmitError(null);

    if (Object.keys(validationErrors).length > 0) {
      trackUsageInBackground({
        eventName: 'tutor_registration_validation_failed',
        screen: 'tutor_registration',
        metadata: { invalid_fields: Object.keys(validationErrors).join(',') },
      });
      const firstInvalidField = Object.keys(validationErrors)[0] as TutorProfileField;
      const fieldRefs = {
        fullName: fullNameRef,
        email: emailRef,
        phone: phoneRef,
        city: cityRef,
        state: stateRef,
      };
      fieldRefs[firstInvalidField].current?.focus();
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    trackUsageInBackground({
      eventName: 'tutor_registration_submit_started',
      screen: 'tutor_registration',
    });

    try {
      const createdProfile = await createTutorProfile(draft, submissionId);
      setCreatedProfileId(createdProfile.id);
      trackUsageInBackground({
        eventName: 'tutor_registration_succeeded',
        screen: 'tutor_registration',
        metadata: { profile_id: createdProfile.id },
      });
    } catch (error) {
      const message =
        error instanceof TutorProfileApiError
          ? error.message
          : 'Ocorreu um erro inesperado. Tente novamente.';
      setSubmitError(message);
      trackUsageInBackground({
        eventName: 'tutor_registration_submit_failed',
        screen: 'tutor_registration',
        metadata: { reason: error instanceof TutorProfileApiError ? 'api' : 'unexpected' },
      });
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setDraft(emptyTutorProfile);
    setErrors({});
    setSubmitError(null);
    setCreatedProfileId(null);
    setSubmissionId(createSubmissionId());
  }

  if (createdProfileId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successEyebrow}>PERFIL SALVO</Text>
          <Text style={styles.successTitle}>Cadastro concluído!</Text>
          <Text style={styles.successText}>
            O perfil foi persistido no monitor local e já deve aparecer no painel.
          </Text>
          <View style={styles.successActions}>
            <PrimaryButton label="Cadastrar outro perfil" onPress={resetForm} />
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')}>
              <Text style={styles.secondaryAction}>Voltar ao início</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <Text style={styles.backButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.headerBrand}>Tranquilo Pet</Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>PERFIL DE TUTOR</Text>
            <Text style={styles.title}>Conte um pouco sobre você</Text>
            <Text style={styles.subtitle}>
              Por enquanto pedimos apenas os dados essenciais para testar o cadastro.
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              ref={fullNameRef}
              label="Nome completo"
              placeholder="Ex.: Ana Souza"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              maxLength={100}
              value={draft.fullName}
              error={errors.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            <FormField
              ref={emailRef}
              label="E-mail"
              placeholder="ana@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              maxLength={254}
              value={draft.email}
              error={errors.email}
              onChangeText={(value) => updateField('email', value)}
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <FormField
              ref={phoneRef}
              label="Telefone com DDD"
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              keyboardType="phone-pad"
              returnKeyType="next"
              value={draft.phone}
              error={errors.phone}
              onChangeText={(value) => updateField('phone', formatBrazilianPhone(value))}
              onSubmitEditing={() => cityRef.current?.focus()}
            />
            <View style={styles.locationRow}>
              <View style={styles.cityField}>
                <FormField
                  ref={cityRef}
                  label="Cidade"
                  placeholder="Sua cidade"
                  autoCapitalize="words"
                  returnKeyType="next"
                  maxLength={80}
                  value={draft.city}
                  error={errors.city}
                  onChangeText={(value) => updateField('city', value)}
                  onSubmitEditing={() => stateRef.current?.focus()}
                />
              </View>
              <View style={styles.stateField}>
                <FormField
                  ref={stateRef}
                  label="UF"
                  placeholder="SC"
                  autoCapitalize="characters"
                  maxLength={2}
                  returnKeyType="done"
                  value={draft.state}
                  error={errors.state}
                  onChangeText={(value) => updateField('state', value.toUpperCase())}
                  onSubmitEditing={() => void handleSubmit()}
                />
              </View>
            </View>

            {submitError ? (
              <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
                <Text style={styles.errorBannerTitle}>Não foi possível concluir</Text>
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Salvar perfil"
              loading={isSubmitting}
              onPress={() => void handleSubmit()}
            />
            <Text style={styles.privacyNote}>
              Ambiente de desenvolvimento: use dados fictícios. CPF e endereço exato não são
              solicitados nesta etapa.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  backButtonText: {
    marginTop: -4,
    color: colors.text,
    fontSize: 34,
    lineHeight: 34,
  },
  headerBrand: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  intro: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    marginBottom: spacing.sm,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: spacing.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cityField: {
    flex: 1,
  },
  stateField: {
    width: 84,
  },
  errorBanner: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.errorSoft,
  },
  errorBannerTitle: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBannerText: {
    marginTop: spacing.xs,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  privacyNote: {
    paddingHorizontal: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 84,
    height: 84,
    marginBottom: spacing.xl,
    borderRadius: radii.round,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    color: colors.success,
    fontSize: 40,
    fontWeight: '900',
  },
  successEyebrow: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  successTitle: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  successText: {
    maxWidth: 360,
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  successActions: {
    width: '100%',
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  secondaryAction: {
    padding: spacing.sm,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
});
