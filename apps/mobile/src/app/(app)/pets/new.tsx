import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, parsePickerValue } from '@/components/date-time-field';
import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type Species = 'dog' | 'cat' | 'other';
type Sex = 'male' | 'female' | 'unknown';
type Size = 'small' | 'medium' | 'large';

type Draft = {
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  birthDate: string;
  weight: string;
  size: Size;
  identificationNotes: string;
};

type FieldErrors = Partial<Record<'name' | 'birthDate' | 'weight', string>>;

const initialDraft: Draft = {
  name: '',
  species: 'dog',
  breed: '',
  sex: 'unknown',
  birthDate: '',
  weight: '',
  size: 'medium',
  identificationNotes: '',
};

export default function NewPetScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [draft, setDraft] = useState(initialDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedWeight = useMemo(() => {
    const parsed = Number(draft.weight.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [draft.weight]);

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === 'name' || field === 'birthDate' || field === 'weight') {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
    setError(null);
  }

  async function handleSubmit() {
    if (!user || submitting) return;

    const nextErrors: FieldErrors = {};
    if (draft.name.trim().length < 2) nextErrors.name = 'Informe o nome do pet.';
    if (draft.birthDate && !parsePickerValue(draft.birthDate, 'date')) {
      nextErrors.birthDate = 'Selecione uma data de nascimento válida.';
    }
    if (draft.weight.trim() && normalizedWeight === null) {
      nextErrors.weight = 'Informe um peso aproximado válido.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstMessage = Object.values(nextErrors).find(Boolean) ?? 'Revise os campos destacados.';
      setError('Existem informações obrigatórias ou inválidas no formulário.');
      Alert.alert('Revise o cadastro do pet', firstMessage);
      return;
    }

    setSubmitting(true);
    setError(null);

    const dossier = {
      behavior: {},
      feeding: {},
      water: {},
      walks: {},
      routine: {},
      hygiene: {},
      objects: {},
      health: {},
      preventive_care: {},
      medications: [],
      emergency: {},
      additional_notes: '',
      dossier_version: 3,
    };

    const { error: insertError } = await supabase.from('pets').insert({
      owner_id: user.id,
      name: draft.name.trim(),
      species: draft.species,
      breed: draft.breed.trim() || null,
      sex: draft.sex,
      birth_date: draft.birthDate || null,
      approximate_weight_kg: normalizedWeight,
      size: draft.size,
      identification_notes: draft.identificationNotes.trim() || null,
      dossier,
    });

    if (insertError) {
      setError('Não foi possível salvar o pet agora. Tente novamente.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    Alert.alert('Pet cadastrado', 'A identificação foi salva. Agora você pode completar o dossiê.', [
      { text: 'Continuar', onPress: () => router.replace('/pets') },
    ]);
  }

  return (
    <ScreenShell
      eyebrow="CONHEÇA MEU PET"
      onBack={() => router.back()}
      title="Comece pela identificação"
      subtitle="Esses dados formam a base do dossiê que será compartilhado com o cuidador em cada hospedagem.">
      {error ? <ErrorBanner message={error} /> : null}

      <SectionCard title="1. Identificação do pet">
        <FormField
          required
          label="Nome do pet"
          autoCapitalize="words"
          maxLength={80}
          value={draft.name}
          error={fieldErrors.name}
          onChangeText={(value) => update('name', value)}
        />

        <ChoiceGroup
          label="Espécie"
          value={draft.species}
          options={[
            ['dog', '🐶 Cachorro'],
            ['cat', '🐱 Gato'],
            ['other', '🐾 Outro'],
          ]}
          onChange={(value) => update('species', value as Species)}
        />

        <FormField
          label="Raça"
          autoCapitalize="words"
          maxLength={80}
          value={draft.breed}
          onChangeText={(value) => update('breed', value)}
        />

        <ChoiceGroup
          label="Sexo"
          value={draft.sex}
          options={[
            ['male', 'Macho'],
            ['female', 'Fêmea'],
            ['unknown', 'Não informar'],
          ]}
          onChange={(value) => update('sex', value as Sex)}
        />

        <DateTimeField
          label="Data de nascimento"
          mode="date"
          maximumDate={new Date()}
          hint="Opcional. Toque para escolher pelo calendário."
          placeholder="Selecionar data"
          value={draft.birthDate}
          error={fieldErrors.birthDate}
          onChange={(value) => update('birthDate', value)}
        />

        <FormField
          label="Peso aproximado (kg)"
          keyboardType="decimal-pad"
          placeholder="Ex.: 12,5"
          value={draft.weight}
          error={fieldErrors.weight}
          onChangeText={(value) => update('weight', value)}
        />

        <ChoiceGroup
          label="Porte"
          value={draft.size}
          options={[
            ['small', 'Pequeno'],
            ['medium', 'Médio'],
            ['large', 'Grande'],
          ]}
          onChange={(value) => update('size', value as Size)}
        />

        <FormField
          label="Como podemos identificá-lo facilmente?"
          hint="Ex.: mancha na pata, cor da coleira ou outra característica física."
          maxLength={400}
          multiline
          textAlignVertical="top"
          value={draft.identificationNotes}
          onChangeText={(value) => update('identificationNotes', value)}
        />
      </SectionCard>

      <SectionCard
        title="Próximas seções do dossiê"
        description="Depois da identificação, vamos completar comportamento, alimentação, água, passeios, rotina, higiene, objetos, saúde, prevenção, medicamentos e emergência." />

      <PrimaryButton
        label="Salvar identificação do pet"
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </ScreenShell>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choices}>
        {options.map(([key, optionLabel]) => {
          const selected = value === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(key)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}>
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choiceGroup: {
    gap: spacing.sm,
  },
  choiceLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  choicePressed: {
    opacity: 0.72,
  },
  choiceText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  choiceTextSelected: {
    color: colors.surface,
  },
});
