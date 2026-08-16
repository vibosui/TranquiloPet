import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  size: string | null;
  approximate_weight_kg: number | null;
  identification_notes: string | null;
};

const speciesLabel: Record<string, string> = {
  dog: 'Cachorro',
  cat: 'Gato',
  other: 'Outro',
};

const sizeLabel: Record<string, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
};

export default function MyPetsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [pets, setPets] = useState<PetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPets = useCallback(async () => {
    if (!user) {
      setPets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('pets')
      .select('id, name, species, breed, size, approximate_weight_kg, identification_notes')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (queryError) {
      setError('Não foi possível carregar os dossiês dos seus pets.');
    } else {
      setPets((data ?? []) as PetRow[]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadPets();
    }, [loadPets]),
  );

  return (
    <ScreenShell
      eyebrow="MEUS PETS"
      title="Conheça meu pet"
      subtitle="Aqui ficam somente os pets que pertencem à sua conta. Pets recebidos para hospedagem aparecem em um painel separado do cuidador.">
      {profile?.caregiver_enabled ? (
        <SectionCard
          title="🐾 Pets sob meus cuidados"
          description="Consulte, em modo somente leitura, os snapshots dos pets vinculados às hospedagens aceitas ou em andamento.">
          <PrimaryButton label="Abrir painel do cuidador" onPress={() => router.push('/pets/care')} />
        </SectionCard>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <SectionCard title="Algo deu errado" description={error}>
          <PrimaryButton label="Tentar novamente" onPress={() => void loadPets()} />
        </SectionCard>
      ) : pets.length === 0 ? (
        <SectionCard
          title="Nenhum pet seu cadastrado"
          description="Esta área mostra apenas pets cadastrados por você. Se você está cuidando do pet de outra pessoa, use o painel Pets sob meus cuidados acima.">
          <PrimaryButton label="Cadastrar meu pet" onPress={() => router.push('/pets/new')} />
        </SectionCard>
      ) : (
        <View style={styles.list}>
          {pets.map((pet) => (
            <Pressable
              key={pet.id}
              accessibilityLabel={`Abrir dossiê de ${pet.name}`}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/pets/[petId]', params: { petId: pet.id } })
              }
              style={({ pressed }) => [styles.petCard, pressed && styles.petCardPressed]}>
              <View style={styles.petIcon}>
                <Text style={styles.petEmoji}>
                  {pet.species === 'cat' ? '🐱' : pet.species === 'dog' ? '🐶' : '🐾'}
                </Text>
              </View>
              <View style={styles.petCopy}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petDetail}>
                  {[
                    speciesLabel[pet.species] ?? pet.species,
                    pet.breed,
                    pet.size ? sizeLabel[pet.size] : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
                {pet.identification_notes ? (
                  <Text numberOfLines={2} style={styles.petNotes}>
                    {pet.identification_notes}
                  </Text>
                ) : null}
                <Text style={styles.openHint}>Abrir e editar meu dossiê →</Text>
              </View>
            </Pressable>
          ))}
          <PrimaryButton label="Cadastrar outro pet" onPress={() => router.push('/pets/new')} />
        </View>
      )}

      <SectionCard
        title="Como o dossiê será usado"
        description="Ao criar uma hospedagem, o Hospeda Patas salva uma cópia das informações daquele momento. O cuidador consulta essa cópia, sem poder alterar o cadastro original do pet." />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
  },
  petCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.md,
  },
  petCardPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.995 }],
  },
  petIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petEmoji: {
    fontSize: 25,
  },
  petCopy: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  petDetail: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  petNotes: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  openHint: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
});
