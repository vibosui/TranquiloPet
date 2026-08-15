import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SectionCard } from '@/components/section-card';
import { useAuth } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type HostingEvent = {
  id: string;
  tutor_id: string;
  caregiver_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
};

type EventPet = {
  event_id: string;
  pet_id: string;
  pet_snapshot: unknown;
  handoff_snapshot: unknown;
};

type PhotoKind = 'face' | 'full_body' | 'sides' | 'distinctive' | 'accessories';

type HandoffPhoto = {
  kind: PhotoKind;
  storage_path: string;
};

type HandoffSnapshot = {
  prepared: boolean;
  recorded_at: string;
  items: string[];
  item_quantities: string;
  pet_state: string;
  observation: string;
  photos: HandoffPhoto[];
};

type PetDraft = {
  petId: string;
  name: string;
  snapshot: HandoffSnapshot;
};

const emptyHandoff: HandoffSnapshot = {
  prepared: false,
  recorded_at: '',
  items: [],
  item_quantities: '',
  pet_state: '',
  observation: '',
  photos: [],
};

const itemOptions = [
  ['food', 'Ração'],
  ['treats', 'Petiscos'],
  ['medications', 'Medicamentos'],
  ['bed', 'Cama'],
  ['blanket', 'Cobertor'],
  ['toys', 'Brinquedos'],
  ['collar', 'Coleira'],
  ['harness', 'Peitoral'],
  ['leash', 'Guia'],
  ['bowls', 'Potes'],
  ['carrier', 'Caixa de transporte'],
  ['other', 'Outros'],
] as const;

const photoKinds: readonly [PhotoKind, string][] = [
  ['face', 'Rosto'],
  ['full_body', 'Corpo inteiro'],
  ['sides', 'Laterais'],
  ['distinctive', 'Característica específica'],
  ['accessories', 'Acessórios enviados'],
];

function petName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 'Pet';
  const name = (snapshot as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name : 'Pet';
}

function normalizeHandoff(input: unknown): HandoffSnapshot {
  if (!input || typeof input !== 'object') return emptyHandoff;
  const value = input as Record<string, unknown>;
  const photos = Array.isArray(value.photos)
    ? value.photos.filter((item): item is HandoffPhoto => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Record<string, unknown>;
        return typeof record.kind === 'string' && typeof record.storage_path === 'string';
      })
    : [];

  return {
    prepared: value.prepared === true,
    recorded_at: typeof value.recorded_at === 'string' ? value.recorded_at : '',
    items: Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === 'string') : [],
    item_quantities: typeof value.item_quantities === 'string' ? value.item_quantities : '',
    pet_state: typeof value.pet_state === 'string' ? value.pet_state : '',
    observation: typeof value.observation === 'string' ? value.observation : '',
    photos,
  };
}

function extensionForAsset(asset: ImagePicker.ImagePickerAsset) {
  const candidate = asset.fileName?.split('.').pop()?.toLowerCase();
  if (candidate && /^[a-z0-9]{2,5}$/.test(candidate)) return candidate;
  if (asset.mimeType === 'image/png') return 'png';
  if (asset.mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export default function HandoffPreparationScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<HostingEvent | null>(null);
  const [drafts, setDrafts] = useState<PetDraft[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    const [{ data: eventData, error: eventError }, { data: petData, error: petError }] = await Promise.all([
      supabase
        .from('hosting_events')
        .select('id, tutor_id, caregiver_id, status')
        .eq('id', eventId)
        .single(),
      supabase
        .from('hosting_event_pets')
        .select('event_id, pet_id, pet_snapshot, handoff_snapshot')
        .eq('event_id', eventId),
    ]);

    if (eventError || !eventData || petError) {
      setError('Não foi possível carregar a preparação da entrega.');
      setLoading(false);
      return;
    }

    const rows = (petData ?? []) as EventPet[];
    setEvent(eventData as HostingEvent);
    setDrafts(
      rows.map((row) => ({
        petId: row.pet_id,
        name: petName(row.pet_snapshot),
        snapshot: normalizeHandoff(row.handoff_snapshot),
      })),
    );
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const paths = drafts.flatMap((draft) => draft.snapshot.photos.map((photo) => photo.storage_path));
    if (!paths.length) {
      setSignedUrls(new Map());
      return;
    }

    let active = true;
    void Promise.all(
      paths.map(async (path) => {
        const { data } = await supabase.storage.from('event-media').createSignedUrl(path, 60 * 30);
        return [path, data?.signedUrl ?? ''] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      setSignedUrls(new Map(entries.filter(([, url]) => Boolean(url))));
    });

    return () => {
      active = false;
    };
  }, [drafts]);

  const canEdit = Boolean(
    user &&
      event &&
      user.id === event.tutor_id &&
      ['draft', 'sent', 'accepted'].includes(event.status),
  );

  const allPrepared = useMemo(
    () => drafts.length > 0 && drafts.every((draft) => draft.snapshot.prepared),
    [drafts],
  );

  function patchPet(petId: string, patch: Partial<HandoffSnapshot>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.petId === petId
          ? { draft, ...draft, snapshot: { ...draft.snapshot, ...patch } }
          : draft,
      ),
    );
  }

  function toggleItem(petId: string, item: string) {
    const draft = drafts.find((candidate) => candidate.petId === petId);
    if (!draft) return;
    const selected = draft.snapshot.items.includes(item);
    patchPet(petId, {
      items: selected
        ? draft.snapshot.items.filter((candidate) => candidate !== item)
        : [...draft.snapshot.items, item],
      prepared: false,
    });
  }

  async function addPhoto(petId: string, kind: PhotoKind) {
    if (!event || !user || !canEdit || busyKey) return;
    const key = `${petId}:${kind}`;
    setBusyKey(key);
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.84,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const binary = await fetch(asset.uri).then((response) => response.arrayBuffer());
      const extension = extensionForAsset(asset);
      const storagePath = `${user.id}/${event.id}/handoff/${petId}/${kind}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(storagePath, binary, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const draft = drafts.find((candidate) => candidate.petId === petId);
      if (!draft) return;
      const oldPhoto = draft.snapshot.photos.find((photo) => photo.kind === kind);
      const nextPhotos = [
        ...draft.snapshot.photos.filter((photo) => photo.kind !== kind),
        { kind, storage_path: storagePath },
      ];
      patchPet(petId, { photos: nextPhotos, prepared: false });

      if (oldPhoto) {
        await supabase.storage.from('event-media').remove([oldPhoto.storage_path]);
      }
    } catch {
      setError('Não foi possível enviar esta foto.');
    } finally {
      setBusyKey(null);
    }
  }

  async function removePhoto(petId: string, kind: PhotoKind) {
    if (!canEdit || busyKey) return;
    const draft = drafts.find((candidate) => candidate.petId === petId);
    const photo = draft?.snapshot.photos.find((candidate) => candidate.kind === kind);
    if (!draft || !photo) return;

    setBusyKey(`${petId}:${kind}`);
    const { error: removeError } = await supabase.storage.from('event-media').remove([photo.storage_path]);
    if (removeError) {
      setError('Não foi possível remover a foto.');
    } else {
      patchPet(petId, {
        photos: draft.snapshot.photos.filter((candidate) => candidate.kind !== kind),
        prepared: false,
      });
    }
    setBusyKey(null);
  }

  function validate(draft: PetDraft) {
    if (!draft.snapshot.recorded_at.trim()) return 'Informe data e horário do registro.';
    if (!draft.snapshot.pet_state) return 'Informe como o pet está no momento da entrega.';
    const requiredPhotoKinds: PhotoKind[] = ['face', 'full_body'];
    if (requiredPhotoKinds.some((kind) => !draft.snapshot.photos.some((photo) => photo.kind === kind))) {
      return 'Inclua pelo menos foto do rosto e do corpo inteiro.';
    }
    return null;
  }

  async function saveAll() {
    if (!event || !canEdit || saving) return;

    for (const draft of drafts) {
      const validationError = validate(draft);
      if (validationError) {
        setError(`${draft.name}: ${validationError}`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      for (const draft of drafts) {
        const payload: HandoffSnapshot = {
          ...draft.snapshot,
          prepared: true,
        };
        const { error: rpcError } = await supabase.rpc('update_handoff_snapshot', {
          p_event_id: event.id,
          p_pet_id: draft.petId,
          p_handoff_snapshot: payload,
        });
        if (rpcError) throw rpcError;
      }
      await loadData();
    } catch {
      setError('Não foi possível salvar a preparação da entrega.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Registro de entrega">
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenShell>
    );
  }

  if (!event) {
    return (
      <ScreenShell onBack={() => router.back()} title="Registro de entrega">
        <ErrorBanner message={error ?? 'Evento não encontrado.'} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="ANTES DA HOSPEDAGEM"
      onBack={() => router.back()}
      title="Registro de entrega"
      subtitle="Este registro pertence somente a esta hospedagem. Ele documenta itens enviados e o estado do pet antes do cuidador iniciar o evento.">
      {error ? <ErrorBanner message={error} /> : null}

      {!canEdit ? (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>Este registro está somente para consulta no estado atual da hospedagem.</Text>
        </View>
      ) : null}

      {drafts.map((draft) => (
        <SectionCard
          key={draft.petId}
          title={`🎒 ${draft.name}`}
          description={draft.snapshot.prepared ? 'Registro preparado.' : 'Complete os dados antes do início da hospedagem.'}>
          <Text style={styles.fieldLabel}>O que está sendo enviado?</Text>
          <View style={styles.choices}>
            {itemOptions.map(([key, label]) => (
              <ChoiceChip
                key={key}
                disabled={!canEdit}
                label={label}
                selected={draft.snapshot.items.includes(key)}
                onPress={() => toggleItem(draft.petId, key)}
              />
            ))}
          </View>

          <FormField
            editable={canEdit}
            label="Quantidade / detalhes dos itens"
            hint="Ex.: 2 kg de ração, 3 comprimidos, 1 cobertor azul."
            multiline
            value={draft.snapshot.item_quantities}
            onChangeText={(item_quantities) => patchPet(draft.petId, { item_quantities, prepared: false })}
          />

          <FormField
            editable={canEdit}
            label="Data e horário do registro"
            hint="Formato temporário: AAAA-MM-DD HH:mm"
            placeholder="2026-08-20 18:00"
            value={draft.snapshot.recorded_at}
            onChangeText={(recorded_at) => patchPet(draft.petId, { recorded_at, prepared: false })}
          />

          <Text style={styles.fieldLabel}>Como ele está hoje?</Text>
          <View style={styles.choices}>
            {[
              ['normal', 'Normal'],
              ['tired', 'Mais cansado'],
              ['agitated', 'Mais agitado'],
              ['anxious', 'Ansioso'],
              ['altered', 'Apresenta alteração'],
            ].map(([key, label]) => (
              <ChoiceChip
                key={key}
                disabled={!canEdit}
                label={label}
                selected={draft.snapshot.pet_state === key}
                onPress={() => patchPet(draft.petId, { pet_state: key, prepared: false })}
              />
            ))}
          </View>

          <FormField
            editable={canEdit}
            label="Observação"
            multiline
            value={draft.snapshot.observation}
            onChangeText={(observation) => patchPet(draft.petId, { observation, prepared: false })}
          />

          <Text style={styles.fieldLabel}>📸 Fotos antes da hospedagem</Text>
          <Text style={styles.helper}>Rosto e corpo inteiro são obrigatórios para marcar o registro como preparado.</Text>
          <View style={styles.photoGrid}>
            {photoKinds.map(([kind, label]) => {
              const photo = draft.snapshot.photos.find((candidate) => candidate.kind === kind);
              const url = photo ? signedUrls.get(photo.storage_path) : null;
              const busy = busyKey === `${draft.petId}:${kind}`;
              return (
                <View key={kind} style={styles.photoSlot}>
                  <Text style={styles.photoLabel}>{label}</Text>
                  {url ? <Image source={{ uri: url }} style={styles.photoPreview} /> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>{busy ? '...' : '＋'}</Text></View>}
                  {canEdit ? (
                    <View style={styles.photoActions}>
                      <Pressable disabled={Boolean(busyKey)} onPress={() => void addPhoto(draft.petId, kind)} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
                        <Text style={styles.photoActionText}>{photo ? 'Trocar' : 'Adicionar'}</Text>
                      </Pressable>
                      {photo ? (
                        <Pressable disabled={Boolean(busyKey)} onPress={() => void removePhoto(draft.petId, kind)} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
                          <Text style={styles.removeText}>Remover</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </SectionCard>
      ))}

      {canEdit ? (
        <PrimaryButton
          label={allPrepared ? 'Salvar registro novamente' : 'Salvar e marcar registro preparado'}
          loading={saving}
          onPress={() => void saveAll()}
        />
      ) : null}

      <PrimaryButton
        label="Voltar para a hospedagem"
        onPress={() => router.replace({ pathname: '/hosting/[eventId]', params: { eventId: event.id } })}
      />
    </ScreenShell>
  );
}

function ChoiceChip({
  selected,
  label,
  disabled,
  onPress,
}: {
  selected: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  choiceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  choiceTextSelected: {
    color: colors.surface,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  photoGrid: {
    gap: spacing.md,
  },
  photoSlot: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  photoLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  photoEmpty: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '600',
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  photoAction: {
    minHeight: 40,
    justifyContent: 'center',
  },
  photoActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  removeText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
