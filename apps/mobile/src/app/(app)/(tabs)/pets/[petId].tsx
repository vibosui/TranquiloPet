import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type NullableBoolean = boolean | null;

type Medication = {
  name: string;
  dosage: string;
  schedule: string;
  administration: string;
  period: string;
};

type PetDossier = {
  behavior: {
    traits: string[];
    strangers_reaction: string;
    other_pets: string;
    fears_or_discomforts: string;
    forbidden_actions: string;
  };
  feeding: {
    types: string[];
    brand: string;
    amount: string;
    unit: string;
    morning: string;
    afternoon: string;
    evening: string;
    other_time: string;
    treats_allowed: NullableBoolean;
    treats_details: string;
    forbidden_foods: string;
  };
  water: {
    drinks_normally: NullableBoolean;
    special_instructions: string;
    change_frequency: string;
  };
  walks: {
    count_per_day: string;
    usual_times: string;
    average_duration: string;
    equipment: string[];
    behaviors: string[];
    instructions: string;
  };
  routine: {
    wake_time: string;
    sleep_time: string;
    sleeping_places: string[];
    stays_alone: NullableBoolean;
    alone_duration: string;
    habits: string;
  };
  hygiene: {
    toilet_training: string;
    urine_place: string;
    stool_place: string;
    signals_to_go_out: NullableBoolean;
    usual_frequency: string;
    instructions: string;
  };
  objects: {
    attachment_objects: string[];
    description: string;
    bringing_to_hosting: NullableBoolean;
  };
  health: {
    conditions: string;
    allergies: string;
    dietary_restrictions: string;
    surgery_or_other: string;
  };
  preventive_care: {
    vaccination_status: string;
    vaccines: string[];
    other_vaccine: string;
    last_vaccine_date?: string;
    next_vaccine_date?: string;
    deworming_status: string;
    deworming_details: string;
    flea_tick_status: string;
    flea_tick_details: string;
    vaccination_card_notes: string;
  };
  medications: Medication[];
  emergency: {
    tutor_name: string;
    tutor_phone: string;
    tutor_whatsapp: string;
    contact_name: string;
    contact_phone: string;
    vet_name: string;
    clinic: string;
    vet_phone: string;
    vet_address: string;
    authorization: string;
  };
  additional_notes: string;
  dossier_version: number;
};

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  approximate_weight_kg: number | null;
  size: string | null;
  identification_notes: string | null;
  dossier: Partial<PetDossier> | null;
};

const emptyDossier: PetDossier = {
  behavior: {
    traits: [],
    strangers_reaction: '',
    other_pets: '',
    fears_or_discomforts: '',
    forbidden_actions: '',
  },
  feeding: {
    types: [],
    brand: '',
    amount: '',
    unit: '',
    morning: '',
    afternoon: '',
    evening: '',
    other_time: '',
    treats_allowed: null,
    treats_details: '',
    forbidden_foods: '',
  },
  water: {
    drinks_normally: null,
    special_instructions: '',
    change_frequency: '',
  },
  walks: {
    count_per_day: '',
    usual_times: '',
    average_duration: '',
    equipment: [],
    behaviors: [],
    instructions: '',
  },
  routine: {
    wake_time: '',
    sleep_time: '',
    sleeping_places: [],
    stays_alone: null,
    alone_duration: '',
    habits: '',
  },
  hygiene: {
    toilet_training: '',
    urine_place: '',
    stool_place: '',
    signals_to_go_out: null,
    usual_frequency: '',
    instructions: '',
  },
  objects: {
    attachment_objects: [],
    description: '',
    bringing_to_hosting: null,
  },
  health: {
    conditions: '',
    allergies: '',
    dietary_restrictions: '',
    surgery_or_other: '',
  },
  preventive_care: {
    vaccination_status: '',
    vaccines: [],
    other_vaccine: '',
    deworming_status: '',
    deworming_details: '',
    flea_tick_status: '',
    flea_tick_details: '',
    vaccination_card_notes: '',
  },
  medications: [],
  emergency: {
    tutor_name: '',
    tutor_phone: '',
    tutor_whatsapp: '',
    contact_name: '',
    contact_phone: '',
    vet_name: '',
    clinic: '',
    vet_phone: '',
    vet_address: '',
    authorization: '',
  },
  additional_notes: '',
  dossier_version: 3,
};

const knownVaccineKeys = ['v3', 'v4', 'v5', 'v8', 'v10', 'rabies', 'kennel_cough', 'giardia', 'other'] as const;

function normalizeVaccines(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string' || !value.trim()) return [];

  const lower = value.toLowerCase();
  const selected: string[] = [];
  if (/\bv3\b/.test(lower)) selected.push('v3');
  if (/\bv4\b/.test(lower)) selected.push('v4');
  if (/\bv5\b/.test(lower)) selected.push('v5');
  if (/\bv8\b/.test(lower)) selected.push('v8');
  if (/\bv10\b/.test(lower)) selected.push('v10');
  if (/raiva|antirr[aá]b/.test(lower)) selected.push('rabies');
  if (/gripe|tosse/.test(lower)) selected.push('kennel_cough');
  if (/gi[aá]rd/.test(lower)) selected.push('giardia');
  return selected;
}

function normalizeDossier(input: Partial<PetDossier> | null | undefined): PetDossier {
  const rawPreventive = (input?.preventive_care ?? {}) as Record<string, unknown>;
  const normalizedVaccines = normalizeVaccines(rawPreventive.vaccines);
  let otherVaccine = typeof rawPreventive.other_vaccine === 'string' ? rawPreventive.other_vaccine : '';

  if (
    typeof rawPreventive.vaccines === 'string' &&
    rawPreventive.vaccines.trim() &&
    normalizedVaccines.length === 0
  ) {
    normalizedVaccines.push('other');
    otherVaccine = otherVaccine || rawPreventive.vaccines.trim();
  }

  const preventiveCare: PetDossier['preventive_care'] = {
    ...emptyDossier.preventive_care,
    ...(rawPreventive as Partial<PetDossier['preventive_care']>),
    vaccines: normalizedVaccines,
    other_vaccine: otherVaccine,
  };

  return {
    behavior: { ...emptyDossier.behavior, ...(input?.behavior ?? {}) },
    feeding: { ...emptyDossier.feeding, ...(input?.feeding ?? {}) },
    water: { ...emptyDossier.water, ...(input?.water ?? {}) },
    walks: { ...emptyDossier.walks, ...(input?.walks ?? {}) },
    routine: { ...emptyDossier.routine, ...(input?.routine ?? {}) },
    hygiene: { ...emptyDossier.hygiene, ...(input?.hygiene ?? {}) },
    objects: { ...emptyDossier.objects, ...(input?.objects ?? {}) },
    health: { ...emptyDossier.health, ...(input?.health ?? {}) },
    preventive_care: preventiveCare,
    medications: Array.isArray(input?.medications) ? input.medications : [],
    emergency: { ...emptyDossier.emergency, ...(input?.emergency ?? {}) },
    additional_notes: input?.additional_notes ?? '',
    dossier_version: 3,
  };
}

function vaccineOptionsForSpecies(species: string): readonly (readonly [string, string])[] {
  if (species === 'dog') {
    return [
      ['v8', 'V8'],
      ['v10', 'V10'],
      ['rabies', 'Antirrábica'],
      ['kennel_cough', 'Gripe / tosse dos canis'],
      ['giardia', 'Giárdia'],
      ['other', 'Outra'],
    ];
  }
  if (species === 'cat') {
    return [
      ['v3', 'V3'],
      ['v4', 'V4'],
      ['v5', 'V5'],
      ['rabies', 'Antirrábica'],
      ['other', 'Outra'],
    ];
  }
  return [
    ['rabies', 'Antirrábica'],
    ['other', 'Outra'],
  ];
}

export default function PetDetailsScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [pet, setPet] = useState<PetRow | null>(null);
  const [dossier, setDossier] = useState<PetDossier>(emptyDossier);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPet() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('pets')
        .select(
          'id, name, species, breed, sex, birth_date, approximate_weight_kg, size, identification_notes, dossier',
        )
        .eq('id', petId)
        .single();

      if (!active) return;
      if (queryError || !data) {
        setError('O pet não foi encontrado ou você não tem acesso a este dossiê.');
      } else {
        const row = data as PetRow;
        setPet(row);
        setDossier(normalizeDossier(row.dossier));
      }
      setLoading(false);
    }

    void loadPet();
    return () => {
      active = false;
    };
  }, [petId]);

  const completion = useMemo(() => {
    const groups = [
      dossier.behavior.traits.length > 0 || Boolean(dossier.behavior.strangers_reaction),
      dossier.feeding.types.length > 0 && Boolean(dossier.feeding.amount),
      dossier.water.drinks_normally !== null || Boolean(dossier.water.special_instructions),
      Boolean(dossier.walks.count_per_day),
      Boolean(dossier.routine.wake_time || dossier.routine.sleep_time || dossier.routine.habits),
      Boolean(
        dossier.hygiene.toilet_training ||
          dossier.hygiene.urine_place ||
          dossier.hygiene.stool_place ||
          dossier.hygiene.instructions,
      ),
      dossier.objects.attachment_objects.length > 0 || dossier.objects.bringing_to_hosting !== null,
      Boolean(
        dossier.health.conditions ||
          dossier.health.allergies ||
          dossier.health.dietary_restrictions ||
          dossier.health.surgery_or_other,
      ),
      Boolean(
        dossier.preventive_care.vaccination_status ||
          dossier.preventive_care.vaccines.length ||
          dossier.preventive_care.deworming_status ||
          dossier.preventive_care.flea_tick_status,
      ),
      dossier.medications.length > 0,
      Boolean(dossier.emergency.tutor_phone || dossier.emergency.contact_phone),
      Boolean(dossier.additional_notes),
    ];
    return Math.round((groups.filter(Boolean).length / groups.length) * 100);
  }, [dossier]);

  function patchSection<K extends keyof PetDossier>(section: K, value: PetDossier[K]) {
    setDossier((current) => ({ ...current, [section]: value }));
    setSaved(false);
  }

  async function saveDossier() {
    if (!pet || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from('pets')
      .update({ dossier: { ...dossier, dossier_version: 3 } })
      .eq('id', pet.id);

    if (updateError) {
      setError('Não foi possível salvar o dossiê agora.');
    } else {
      setSaved(true);
      Alert.alert('Dossiê salvo', 'As informações de cuidado foram atualizadas com sucesso.', [
        { text: 'Continuar editando', style: 'cancel' },
        { text: 'Voltar aos pets', onPress: () => router.back() },
      ]);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Conheça meu pet">
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenShell>
    );
  }

  if (!pet) {
    return (
      <ScreenShell onBack={() => router.back()} title="Pet não encontrado">
        <ErrorBanner message={error ?? 'Não foi possível abrir o dossiê.'} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="CONHEÇA MEU PET"
      onBack={() => router.back()}
      title={pet.name}
      subtitle="Conte tudo o que possa fazer diferença. Essas informações serão congeladas em um snapshot quando uma hospedagem for criada.">
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Dossiê de cuidado</Text>
          <Text style={styles.progressValue}>{completion}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completion}%` }]} />
        </View>
        <Text style={styles.progressText}>Não precisa preencher tudo de uma vez. Salve e continue depois.</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {saved ? (
        <View style={styles.savedBanner}>
          <Text style={styles.savedText}>✓ Dossiê salvo no Supabase.</Text>
        </View>
      ) : null}

      <SectionCard title="🐶 1. Identificação" description="Dados cadastrados na criação do pet.">
        <ReadOnlyRow label="Espécie" value={speciesLabel(pet.species)} />
        <ReadOnlyRow label="Raça" value={pet.breed || 'Não informada'} />
        <ReadOnlyRow label="Sexo" value={sexLabel(pet.sex)} />
        <ReadOnlyRow label="Nascimento" value={pet.birth_date || 'Não informado'} />
        <ReadOnlyRow
          label="Peso aproximado"
          value={pet.approximate_weight_kg ? `${pet.approximate_weight_kg} kg` : 'Não informado'}
        />
        <ReadOnlyRow label="Porte" value={sizeLabel(pet.size)} />
        <ReadOnlyRow label="Características" value={pet.identification_notes || 'Não informadas'} last />
      </SectionCard>

      <SectionCard title="❤️ 2. Sobre o jeito do meu pet">
        <MultiChoice
          label="Como você descreveria seu pet?"
          values={dossier.behavior.traits}
          options={[
            ['calm', 'Calmo'],
            ['playful', 'Brincalhão'],
            ['agitated', 'Agitado'],
            ['affectionate', 'Carinhoso'],
            ['independent', 'Independente'],
            ['fearful', 'Medroso'],
            ['anxious', 'Ansioso'],
            ['social', 'Sociável'],
            ['reserved', 'Reservado'],
            ['territorial', 'Territorial'],
          ]}
          onChange={(traits) => patchSection('behavior', { ...dossier.behavior, traits })}
        />
        <SingleChoice
          label="Como reage a pessoas que não conhece?"
          value={dossier.behavior.strangers_reaction}
          options={[
            ['approaches', 'Se aproxima facilmente'],
            ['suspicious', 'É desconfiado no início'],
            ['afraid', 'Tem medo'],
            ['aggressive_risk', 'Pode apresentar comportamento agressivo'],
          ]}
          onChange={(strangers_reaction) =>
            patchSection('behavior', { ...dossier.behavior, strangers_reaction })
          }
        />
        <SingleChoice
          label="Como se comporta com outros pets?"
          value={dossier.behavior.other_pets}
          options={[
            ['loves', 'Adora outros animais'],
            ['adaptation', 'Convive bem, mas precisa de adaptação'],
            ['alone', 'Prefere ficar sozinho'],
            ['poor', 'Não convive bem'],
            ['unknown', 'Não sei'],
          ]}
          onChange={(other_pets) => patchSection('behavior', { ...dossier.behavior, other_pets })}
        />
        <FormField
          label="O que assusta, irrita ou deixa seu pet desconfortável?"
          multiline
          textAlignVertical="top"
          value={dossier.behavior.fears_or_discomforts}
          onChangeText={(fears_or_discomforts) =>
            patchSection('behavior', { ...dossier.behavior, fears_or_discomforts })
          }
        />
        <FormField
          label="Existe alguma coisa que o cuidador NÃO deve fazer?"
          multiline
          textAlignVertical="top"
          value={dossier.behavior.forbidden_actions}
          onChangeText={(forbidden_actions) =>
            patchSection('behavior', { ...dossier.behavior, forbidden_actions })
          }
        />
      </SectionCard>

      <SectionCard title="🍖 3. Alimentação">
        <MultiChoice
          label="O que seu pet come?"
          values={dossier.feeding.types}
          options={[
            ['kibble', 'Ração'],
            ['natural', 'Alimentação natural'],
            ['mixed', 'Ração + natural'],
            ['other', 'Outro'],
          ]}
          onChange={(types) => patchSection('feeding', { ...dossier.feeding, types })}
        />
        <FormField
          label="Marca/tipo da alimentação"
          value={dossier.feeding.brand}
          onChangeText={(brand) => patchSection('feeding', { ...dossier.feeding, brand })}
        />
        <View style={styles.twoColumns}>
          <View style={styles.flexOne}>
            <FormField
              label="Quantidade/refeição"
              value={dossier.feeding.amount}
              onChangeText={(amount) => patchSection('feeding', { ...dossier.feeding, amount })}
            />
          </View>
          <View style={styles.flexOne}>
            <FormField
              label="Unidade"
              placeholder="g, xícara..."
              value={dossier.feeding.unit}
              onChangeText={(unit) => patchSection('feeding', { ...dossier.feeding, unit })}
            />
          </View>
        </View>
        <Text style={styles.subheading}>Horários habituais</Text>
        <View style={styles.twoColumns}>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Manhã"
              mode="time"
              placeholder="Selecionar"
              value={dossier.feeding.morning}
              onChange={(morning) => patchSection('feeding', { ...dossier.feeding, morning })}
            />
          </View>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Tarde"
              mode="time"
              placeholder="Selecionar"
              value={dossier.feeding.afternoon}
              onChange={(afternoon) => patchSection('feeding', { ...dossier.feeding, afternoon })}
            />
          </View>
        </View>
        <View style={styles.twoColumns}>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Noite"
              mode="time"
              placeholder="Selecionar"
              value={dossier.feeding.evening}
              onChange={(evening) => patchSection('feeding', { ...dossier.feeding, evening })}
            />
          </View>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Outro"
              mode="time"
              placeholder="Selecionar"
              value={dossier.feeding.other_time}
              onChange={(other_time) => patchSection('feeding', { ...dossier.feeding, other_time })}
            />
          </View>
        </View>
        <BooleanChoice
          label="Pode receber petiscos?"
          value={dossier.feeding.treats_allowed}
          onChange={(treats_allowed) => patchSection('feeding', { ...dossier.feeding, treats_allowed })}
        />
        {dossier.feeding.treats_allowed ? (
          <FormField
            label="Quais e em qual quantidade?"
            value={dossier.feeding.treats_details}
            onChangeText={(treats_details) => patchSection('feeding', { ...dossier.feeding, treats_details })}
          />
        ) : null}
        <FormField
          label="Alimentos que NÃO pode consumir"
          multiline
          textAlignVertical="top"
          value={dossier.feeding.forbidden_foods}
          onChangeText={(forbidden_foods) => patchSection('feeding', { ...dossier.feeding, forbidden_foods })}
        />
      </SectionCard>

      <SectionCard title="💧 4. Água">
        <BooleanChoice
          label="Ele bebe água normalmente?"
          value={dossier.water.drinks_normally}
          onChange={(drinks_normally) => patchSection('water', { ...dossier.water, drinks_normally })}
        />
        <FormField
          label="Orientação especial"
          multiline
          value={dossier.water.special_instructions}
          onChangeText={(special_instructions) =>
            patchSection('water', { ...dossier.water, special_instructions })
          }
        />
        <FormField
          label="Com que frequência costuma trocar a água?"
          value={dossier.water.change_frequency}
          onChangeText={(change_frequency) => patchSection('water', { ...dossier.water, change_frequency })}
        />
      </SectionCard>

      <SectionCard title="🦮 5. Passeios">
        <SingleChoice
          label="Quantos passeios costuma fazer por dia?"
          value={dossier.walks.count_per_day}
          options={[
            ['0', 'Nenhum'],
            ['1', '1'],
            ['2', '2'],
            ['3+', '3 ou mais'],
          ]}
          onChange={(count_per_day) => patchSection('walks', { ...dossier.walks, count_per_day })}
        />
        <FormField
          label="Horários habituais"
          hint="Pode informar mais de um horário, por exemplo: 08:00 e 18:30."
          value={dossier.walks.usual_times}
          onChangeText={(usual_times) => patchSection('walks', { ...dossier.walks, usual_times })}
        />
        <FormField
          label="Duração média"
          placeholder="Ex.: 30 minutos"
          value={dossier.walks.average_duration}
          onChangeText={(average_duration) => patchSection('walks', { ...dossier.walks, average_duration })}
        />
        <MultiChoice
          label="Utiliza"
          values={dossier.walks.equipment}
          options={[
            ['collar', 'Coleira'],
            ['harness', 'Peitoral'],
            ['leash', 'Guia'],
            ['retractable', 'Guia retrátil'],
            ['other', 'Outro'],
          ]}
          onChange={(equipment) => patchSection('walks', { ...dossier.walks, equipment })}
        />
        <MultiChoice
          label="Durante o passeio"
          values={dossier.walks.behaviors}
          options={[
            ['pulls', 'Puxa a guia'],
            ['escapes', 'Tenta fugir'],
            ['barks_dogs', 'Late para outros cães'],
            ['reactive_animals', 'Reage a outros animais'],
            ['afraid_cars', 'Tem medo de carros'],
            ['afraid_people', 'Tem medo de pessoas'],
            ['calm', 'É tranquilo'],
          ]}
          onChange={(behaviors) => patchSection('walks', { ...dossier.walks, behaviors })}
        />
        <FormField
          label="Orientação específica para os passeios"
          multiline
          value={dossier.walks.instructions}
          onChangeText={(instructions) => patchSection('walks', { ...dossier.walks, instructions })}
        />
      </SectionCard>

      <SectionCard title="💤 6. Rotina">
        <View style={styles.twoColumns}>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Acorda"
              mode="time"
              placeholder="Selecionar"
              value={dossier.routine.wake_time}
              onChange={(wake_time) => patchSection('routine', { ...dossier.routine, wake_time })}
            />
          </View>
          <View style={styles.flexOne}>
            <DateTimeField
              label="Dorme"
              mode="time"
              placeholder="Selecionar"
              value={dossier.routine.sleep_time}
              onChange={(sleep_time) => patchSection('routine', { ...dossier.routine, sleep_time })}
            />
          </View>
        </View>
        <MultiChoice
          label="Onde costuma dormir?"
          values={dossier.routine.sleeping_places}
          options={[
            ['bed', 'Cama'],
            ['crate', 'Caixa de transporte'],
            ['room', 'Quarto'],
            ['outside', 'Área externa'],
            ['sofa', 'Sofá'],
            ['with_tutor', 'Com o tutor'],
            ['other', 'Outro'],
          ]}
          onChange={(sleeping_places) => patchSection('routine', { ...dossier.routine, sleeping_places })}
        />
        <BooleanChoice
          label="Ele costuma ficar sozinho?"
          value={dossier.routine.stays_alone}
          onChange={(stays_alone) => patchSection('routine', { ...dossier.routine, stays_alone })}
        />
        {dossier.routine.stays_alone ? (
          <FormField
            label="Por quanto tempo normalmente?"
            value={dossier.routine.alone_duration}
            onChangeText={(alone_duration) => patchSection('routine', { ...dossier.routine, alone_duration })}
          />
        ) : null}
        <FormField
          label="Hábitos ou rotinas que o cuidador deve manter"
          hint="Ex.: dorme depois do almoço, brinca antes de dormir..."
          multiline
          value={dossier.routine.habits}
          onChangeText={(habits) => patchSection('routine', { ...dossier.routine, habits })}
        />
      </SectionCard>

      <SectionCard
        title="🚽 6.1 Higiene e necessidades"
        description="Ajuda o cuidador a preservar os hábitos do pet e interpretar acidentes durante a hospedagem.">
        <SingleChoice
          label="Como é o hábito de fazer as necessidades no local correto?"
          value={dossier.hygiene.toilet_training}
          options={[
            ['reliable', 'Faz no local correto quase sempre'],
            ['occasional', 'Tem acidentes ocasionais'],
            ['frequent', 'Costuma fazer fora do local'],
            ['training', 'Ainda está aprendendo'],
            ['unknown', 'Não sei informar'],
          ]}
          onChange={(toilet_training) =>
            patchSection('hygiene', { ...dossier.hygiene, toilet_training })
          }
        />
        <FormField
          label="Onde costuma fazer xixi?"
          hint="Ex.: tapete higiênico, caixa de areia, quintal, durante os passeios..."
          value={dossier.hygiene.urine_place}
          onChangeText={(urine_place) => patchSection('hygiene', { ...dossier.hygiene, urine_place })}
        />
        <FormField
          label="Onde costuma fazer cocô?"
          hint="Ex.: quintal, caixa de areia, passeio, tapete..."
          value={dossier.hygiene.stool_place}
          onChangeText={(stool_place) => patchSection('hygiene', { ...dossier.hygiene, stool_place })}
        />
        <BooleanChoice
          label="Ele costuma sinalizar quando precisa sair ou usar o local de necessidades?"
          value={dossier.hygiene.signals_to_go_out}
          onChange={(signals_to_go_out) =>
            patchSection('hygiene', { ...dossier.hygiene, signals_to_go_out })
          }
        />
        <FormField
          label="Frequência habitual"
          hint="Ex.: xixi 4 a 5 vezes ao dia; cocô 2 vezes ao dia."
          value={dossier.hygiene.usual_frequency}
          onChangeText={(usual_frequency) =>
            patchSection('hygiene', { ...dossier.hygiene, usual_frequency })
          }
        />
        <FormField
          label="Orientações sobre higiene e necessidades"
          multiline
          textAlignVertical="top"
          hint="Informe sinais, horários, comandos, rotina de limpeza ou qualquer detalhe importante."
          value={dossier.hygiene.instructions}
          onChangeText={(instructions) => patchSection('hygiene', { ...dossier.hygiene, instructions })}
        />
      </SectionCard>

      <SectionCard title="🧸 7. Brinquedos e objetos">
        <MultiChoice
          label="Objetos importantes ou de apego"
          values={dossier.objects.attachment_objects}
          options={[
            ['toy', 'Brinquedo'],
            ['blanket', 'Cobertor'],
            ['bed', 'Cama'],
            ['cloth', 'Paninho'],
            ['other', 'Outro'],
            ['none', 'Não possui'],
          ]}
          onChange={(attachment_objects) =>
            patchSection('objects', { ...dossier.objects, attachment_objects })
          }
        />
        <FormField
          label="Qual?"
          value={dossier.objects.description}
          onChangeText={(description) => patchSection('objects', { ...dossier.objects, description })}
        />
        <BooleanChoice
          label="Normalmente vai para hospedagem com esses itens?"
          value={dossier.objects.bringing_to_hosting}
          onChange={(bringing_to_hosting) =>
            patchSection('objects', { ...dossier.objects, bringing_to_hosting })
          }
        />
      </SectionCard>

      <SectionCard title="🩺 8. Saúde">
        <FormField
          label="Condições de saúde"
          placeholder="Se não possui, deixe em branco."
          multiline
          value={dossier.health.conditions}
          onChangeText={(conditions) => patchSection('health', { ...dossier.health, conditions })}
        />
        <FormField
          label="Alergias"
          multiline
          value={dossier.health.allergies}
          onChangeText={(allergies) => patchSection('health', { ...dossier.health, allergies })}
        />
        <FormField
          label="Restrições alimentares"
          multiline
          value={dossier.health.dietary_restrictions}
          onChangeText={(dietary_restrictions) =>
            patchSection('health', { ...dossier.health, dietary_restrictions })
          }
        />
        <FormField
          label="Cirurgias ou outras condições importantes"
          multiline
          value={dossier.health.surgery_or_other}
          onChangeText={(surgery_or_other) =>
            patchSection('health', { ...dossier.health, surgery_or_other })
          }
        />
      </SectionCard>

      <SectionCard
        title="💉 8.1 Vacinação e prevenção"
        description="Selecione as vacinas que constam na carteirinha. Para o MVP não exigimos data de dose; o objetivo é dar ao cuidador uma visão rápida do histórico preventivo.">
        <SingleChoice
          label="Como está a vacinação?"
          value={dossier.preventive_care.vaccination_status}
          options={[
            ['up_to_date', 'Vacinas em dia'],
            ['partial', 'Parcialmente em dia'],
            ['overdue', 'Há vacinas atrasadas'],
            ['not_vaccinated', 'Não vacinado'],
            ['unknown', 'Não sei informar'],
          ]}
          onChange={(vaccination_status) =>
            patchSection('preventive_care', { ...dossier.preventive_care, vaccination_status })
          }
        />
        <MultiChoice
          label="Vacinas registradas"
          values={dossier.preventive_care.vaccines.filter((value) => knownVaccineKeys.includes(value as (typeof knownVaccineKeys)[number]))}
          options={vaccineOptionsForSpecies(pet.species)}
          onChange={(vaccines) =>
            patchSection('preventive_care', {
              ...dossier.preventive_care,
              vaccines,
              other_vaccine: vaccines.includes('other') ? dossier.preventive_care.other_vaccine : '',
            })
          }
        />
        {dossier.preventive_care.vaccines.includes('other') ? (
          <FormField
            label="Qual outra vacina?"
            hint="Digite o nome exatamente como aparece na carteirinha."
            value={dossier.preventive_care.other_vaccine}
            onChangeText={(other_vaccine) =>
              patchSection('preventive_care', { ...dossier.preventive_care, other_vaccine })
            }
          />
        ) : null}
        <SingleChoice
          label="Vermífugo"
          value={dossier.preventive_care.deworming_status}
          options={[
            ['up_to_date', 'Em dia'],
            ['overdue', 'Atrasado'],
            ['not_used', 'Não utiliza'],
            ['unknown', 'Não sei informar'],
          ]}
          onChange={(deworming_status) =>
            patchSection('preventive_care', { ...dossier.preventive_care, deworming_status })
          }
        />
        <FormField
          label="Detalhes do vermífugo"
          hint="Produto e observações, se souber."
          value={dossier.preventive_care.deworming_details}
          onChangeText={(deworming_details) =>
            patchSection('preventive_care', { ...dossier.preventive_care, deworming_details })
          }
        />
        <SingleChoice
          label="Antipulgas / carrapatos"
          value={dossier.preventive_care.flea_tick_status}
          options={[
            ['up_to_date', 'Proteção em dia'],
            ['overdue', 'Proteção vencida/atrasada'],
            ['not_used', 'Não utiliza'],
            ['unknown', 'Não sei informar'],
          ]}
          onChange={(flea_tick_status) =>
            patchSection('preventive_care', { ...dossier.preventive_care, flea_tick_status })
          }
        />
        <FormField
          label="Detalhes do antipulgas / carrapatos"
          hint="Produto e duração esperada, se souber."
          value={dossier.preventive_care.flea_tick_details}
          onChangeText={(flea_tick_details) =>
            patchSection('preventive_care', { ...dossier.preventive_care, flea_tick_details })
          }
        />
        <FormField
          label="Carteirinha de vacinação / observações adicionais"
          hint="Anote qualquer informação importante que o cuidador deva saber."
          multiline
          value={dossier.preventive_care.vaccination_card_notes}
          onChangeText={(vaccination_card_notes) =>
            patchSection('preventive_care', { ...dossier.preventive_care, vaccination_card_notes })
          }
        />
      </SectionCard>

      <SectionCard
        title="💊 9. Medicamentos"
        description="Cadastre um ou mais medicamentos. A hospedagem poderá transformar os horários em tarefas obrigatórias.">
        {dossier.medications.map((medication, index) => (
          <View key={`${index}-${medication.name}`} style={styles.medicationCard}>
            <View style={styles.medicationHeader}>
              <Text style={styles.medicationTitle}>Medicamento {index + 1}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  patchSection(
                    'medications',
                    dossier.medications.filter((_, itemIndex) => itemIndex !== index),
                  )
                }>
                <Text style={styles.removeText}>Remover</Text>
              </Pressable>
            </View>
            <FormField
              label="Nome"
              value={medication.name}
              onChangeText={(name) =>
                patchMedication(index, { ...medication, name }, dossier, patchSection)
              }
            />
            <FormField
              label="Dosagem"
              value={medication.dosage}
              onChangeText={(dosage) =>
                patchMedication(index, { ...medication, dosage }, dossier, patchSection)
              }
            />
            <FormField
              label="Horário(s)"
              hint="Pode informar mais de um horário, por exemplo: 08:00 e 20:00."
              value={medication.schedule}
              onChangeText={(schedule) =>
                patchMedication(index, { ...medication, schedule }, dossier, patchSection)
              }
            />
            <FormField
              label="Como administrar"
              multiline
              value={medication.administration}
              onChangeText={(administration) =>
                patchMedication(index, { ...medication, administration }, dossier, patchSection)
              }
            />
            <FormField
              label="Período do tratamento"
              value={medication.period}
              onChangeText={(period) =>
                patchMedication(index, { ...medication, period }, dossier, patchSection)
              }
            />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            patchSection('medications', [
              ...dossier.medications,
              { name: '', dosage: '', schedule: '', administration: '', period: '' },
            ])
          }
          style={({ pressed }) => [styles.addMedication, pressed && styles.choicePressed]}>
          <Text style={styles.addMedicationText}>+ Adicionar medicamento</Text>
        </Pressable>
        <Text style={styles.helper}>
          A foto da embalagem/orientação veterinária será adicionada quando ligarmos a mídia permanente do dossiê.
        </Text>
      </SectionCard>

      <SectionCard title="🚨 10. Em caso de emergência">
        <FormField
          label="Nome do tutor"
          value={dossier.emergency.tutor_name}
          onChangeText={(tutor_name) => patchSection('emergency', { ...dossier.emergency, tutor_name })}
        />
        <View style={styles.twoColumns}>
          <View style={styles.flexOne}>
            <FormField
              label="Telefone"
              keyboardType="phone-pad"
              value={dossier.emergency.tutor_phone}
              onChangeText={(tutor_phone) =>
                patchSection('emergency', { ...dossier.emergency, tutor_phone })
              }
            />
          </View>
          <View style={styles.flexOne}>
            <FormField
              label="WhatsApp"
              keyboardType="phone-pad"
              value={dossier.emergency.tutor_whatsapp}
              onChangeText={(tutor_whatsapp) =>
                patchSection('emergency', { ...dossier.emergency, tutor_whatsapp })
              }
            />
          </View>
        </View>
        <FormField
          label="Contato de emergência"
          value={dossier.emergency.contact_name}
          onChangeText={(contact_name) =>
            patchSection('emergency', { ...dossier.emergency, contact_name })
          }
        />
        <FormField
          label="Telefone do contato"
          keyboardType="phone-pad"
          value={dossier.emergency.contact_phone}
          onChangeText={(contact_phone) =>
            patchSection('emergency', { ...dossier.emergency, contact_phone })
          }
        />
        <Text style={styles.subheading}>Veterinário de confiança</Text>
        <FormField
          label="Nome"
          value={dossier.emergency.vet_name}
          onChangeText={(vet_name) => patchSection('emergency', { ...dossier.emergency, vet_name })}
        />
        <FormField
          label="Clínica"
          value={dossier.emergency.clinic}
          onChangeText={(clinic) => patchSection('emergency', { ...dossier.emergency, clinic })}
        />
        <FormField
          label="Telefone"
          keyboardType="phone-pad"
          value={dossier.emergency.vet_phone}
          onChangeText={(vet_phone) => patchSection('emergency', { ...dossier.emergency, vet_phone })}
        />
        <FormField
          label="Endereço"
          multiline
          value={dossier.emergency.vet_address}
          onChangeText={(vet_address) => patchSection('emergency', { ...dossier.emergency, vet_address })}
        />
        <SingleChoice
          label="Em uma emergência, o cuidador poderá levar o pet para atendimento?"
          value={dossier.emergency.authorization}
          options={[
            ['immediately', 'Sim, imediatamente'],
            ['try_contact', 'Sim, mas tente falar comigo antes'],
            ['only_authorized', 'Somente com minha autorização'],
          ]}
          onChange={(authorization) =>
            patchSection('emergency', { ...dossier.emergency, authorization })
          }
        />
      </SectionCard>

      <SectionCard
        title="🎒 11. Itens enviados e 📸 12. Registro de entrega"
        description="Essas informações NÃO ficam neste dossiê. Elas são preenchidas ao criar cada hospedagem, porque representam o que foi entregue e o estado do pet naquele evento específico." />

      <SectionCard title="13. O que mais o cuidador precisa saber?">
        <FormField
          label="Observações adicionais"
          multiline
          textAlignVertical="top"
          value={dossier.additional_notes}
          onChangeText={(additional_notes) => patchSection('additional_notes', additional_notes)}
        />
      </SectionCard>

      <PrimaryButton label="Salvar dossiê" loading={saving} onPress={() => void saveDossier()} />
    </ScreenShell>
  );
}

function patchMedication(
  index: number,
  medication: Medication,
  dossier: PetDossier,
  patchSection: <K extends keyof PetDossier>(section: K, value: PetDossier[K]) => void,
) {
  const medications = [...dossier.medications];
  medications[index] = medication;
  patchSection('medications', medications);
}

function speciesLabel(value: string) {
  if (value === 'dog') return 'Cachorro';
  if (value === 'cat') return 'Gato';
  return 'Outro';
}

function sexLabel(value: string | null) {
  if (value === 'male') return 'Macho';
  if (value === 'female') return 'Fêmea';
  return 'Não informado';
}

function sizeLabel(value: string | null) {
  if (value === 'small') return 'Pequeno';
  if (value === 'medium') return 'Médio';
  if (value === 'large') return 'Grande';
  return 'Não informado';
}

function ReadOnlyRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.readOnlyRow, last && styles.readOnlyRowLast]}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value}</Text>
    </View>
  );
}

function BooleanChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: NullableBoolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.booleanRow}>
      <Text style={styles.booleanLabel}>{label}</Text>
      <View style={styles.booleanControls}>
        <Text style={styles.booleanValue}>{value === null ? 'Não informado' : value ? 'Sim' : 'Não'}</Text>
        <Switch
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={value ? colors.primary : colors.surface}
          value={value ?? false}
          onValueChange={onChange}
        />
      </View>
    </View>
  );
}

function SingleChoice({
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
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{optionLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChoice({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: readonly (readonly [string, string])[];
  onChange: (values: string[]) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choices}>
        {options.map(([key, optionLabel]) => {
          const selected = values.includes(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() =>
                onChange(selected ? values.filter((item) => item !== key) : [...values, key])
              }
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}>
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{optionLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  progressValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  savedBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
  },
  savedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  readOnlyRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  readOnlyRowLast: {
    borderBottomWidth: 0,
  },
  readOnlyLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  readOnlyValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
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
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
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
    fontSize: 12,
    fontWeight: '800',
  },
  choiceTextSelected: {
    color: colors.surface,
  },
  booleanRow: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  booleanLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  booleanControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  booleanValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexOne: {
    flex: 1,
  },
  subheading: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  medicationCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.md,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medicationTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  removeText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '900',
  },
  addMedication: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMedicationText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
