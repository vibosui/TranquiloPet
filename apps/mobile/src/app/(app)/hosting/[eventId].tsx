import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { DateTimeField, parsePickerValue } from '@/components/date-time-field';
import { ErrorBanner } from '@/components/error-banner';
import { FormField } from '@/components/form-field';
import { PetSnapshotModal } from '@/components/pet-snapshot-modal';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { SecondaryButton } from '@/components/secondary-button';
import { SectionCard } from '@/components/section-card';
import { useAuth, type HospedaProfile } from '@/core/auth/auth-context';
import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type HostingStatus = 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
type TaskCategory = 'meal' | 'water' | 'walk' | 'medication' | 'photo' | 'routine' | 'custom';
type ScheduleMode = 'event' | 'single' | 'interval' | 'specific';

type HostingEvent = {
  id: string;
  connection_id: string;
  tutor_id: string;
  caregiver_id: string;
  title: string | null;
  status: HostingStatus;
  starts_at: string | null;
  ends_at: string | null;
  tutor_instructions: string | null;
};

type EventPet = {
  event_id: string;
  pet_id: string;
  pet_snapshot: unknown;
  handoff_snapshot: unknown;
};

type EventTask = {
  id: string;
  event_id: string;
  pet_id: string | null;
  category: TaskCategory;
  title: string;
  instructions: string | null;
  due_at: string | null;
  requires_photo: boolean;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
};

type ChatMessage = {
  id: string;
  event_id: string;
  sender_id: string | null;
  message_type: 'text' | 'system' | 'task_completed' | 'photo_evidence' | 'event_status';
  body: string | null;
  task_id: string | null;
  evidence_id: string | null;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  storage_path: string;
};

type TaskDraft = {
  category: TaskCategory;
  title: string;
  instructions: string;
  petId: string | null;
  requiresPhoto: boolean;
  scheduleMode: ScheduleMode;
  singleAt: string;
  intervalStart: string;
  intervalEnd: string;
  intervalMinutes: string;
  specificTimes: string[];
  specificCandidate: string;
};

type TaskFieldErrors = {
  title?: string;
  schedule?: string;
  specificCandidate?: string;
};

type ExpandedPhoto = {
  uri: string;
  caption: string | null;
};

const emptyTaskDraft: TaskDraft = {
  category: 'custom',
  title: '',
  instructions: '',
  petId: null,
  requiresPhoto: false,
  scheduleMode: 'event',
  singleAt: '',
  intervalStart: '',
  intervalEnd: '',
  intervalMinutes: '30',
  specificTimes: [],
  specificCandidate: '',
};

const statusLabels: Record<HostingStatus, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando cuidador',
  accepted: 'Aceita',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const statusCopy: Record<HostingStatus, string> = {
  draft: 'O tutor ainda pode montar checklist e preparar as regras de evidência.',
  sent: 'O evento foi enviado e aguarda aceite do cuidador.',
  accepted: 'O cuidador aceitou. O checklist ficará operacional quando a hospedagem iniciar.',
  in_progress: 'Checklist ativo. Evidências e conclusões alimentam o registro do evento.',
  completed: 'Hospedagem encerrada com histórico preservado.',
  cancelled: 'Este evento foi cancelado.',
};

function formatDateTime(value: string | null) {
  if (!value) return 'Quando for realizado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function petNameFromSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 'Pet';
  const value = (snapshot as Record<string, unknown>).name;
  return typeof value === 'string' && value.trim() ? value : 'Pet';
}

function extensionForAsset(asset: ImagePicker.ImagePickerAsset) {
  const nameExtension = asset.fileName?.split('.').pop()?.toLowerCase();
  if (nameExtension && /^[a-z0-9]{2,5}$/.test(nameExtension)) return nameExtension;
  if (asset.mimeType === 'image/png') return 'png';
  if (asset.mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export default function HostingEventScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<HostingEvent | null>(null);
  const [profiles, setProfiles] = useState<Map<string, HospedaProfile>>(new Map());
  const [eventPets, setEventPets] = useState<EventPet[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Map<string, string>>(new Map());
  const [selectedSnapshot, setSelectedSnapshot] = useState<EventPet | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTaskDraft);
  const [taskFieldErrors, setTaskFieldErrors] = useState<TaskFieldErrors>({});
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async (showLoading = true) => {
    if (!eventId) return;
    if (showLoading) setLoading(true);
    setError(null);

    const [eventResult, petsResult, tasksResult, messagesResult] = await Promise.all([
      supabase
        .from('hosting_events')
        .select('id, connection_id, tutor_id, caregiver_id, title, status, starts_at, ends_at, tutor_instructions')
        .eq('id', eventId)
        .single(),
      supabase
        .from('hosting_event_pets')
        .select('event_id, pet_id, pet_snapshot, handoff_snapshot')
        .eq('event_id', eventId),
      supabase
        .from('event_tasks')
        .select('id, event_id, pet_id, category, title, instructions, due_at, requires_photo, sort_order, completed_at, completed_by')
        .eq('event_id', eventId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true }),
      supabase
        .from('chat_messages')
        .select('id, event_id, sender_id, message_type, body, task_id, evidence_id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(100),
    ]);

    if (eventResult.error || !eventResult.data) {
      setError('A hospedagem não foi encontrada ou você não possui acesso.');
      setEvent(null);
      setLoading(false);
      return;
    }

    const nextEvent = eventResult.data as HostingEvent;
    const nextMessages = (messagesResult.data ?? []) as ChatMessage[];
    const profileResult = await supabase
      .from('profiles')
      .select('id, public_code, full_name, phone, avatar_path, tutor_enabled, caregiver_enabled, created_at, updated_at')
      .in('id', [nextEvent.tutor_id, nextEvent.caregiver_id]);

    const evidenceIds = Array.from(
      new Set(
        nextMessages
          .map((message) => message.evidence_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let evidenceError = false;
    const nextEvidenceUrls = new Map<string, string>();
    if (evidenceIds.length) {
      const evidenceResult = await supabase
        .from('task_evidence')
        .select('id, storage_path')
        .in('id', evidenceIds);

      if (evidenceResult.error) {
        evidenceError = true;
      } else {
        const entries = await Promise.all(
          ((evidenceResult.data ?? []) as EvidenceRow[]).map(async (evidence) => {
            const { data } = await supabase.storage
              .from('event-evidence')
              .createSignedUrl(evidence.storage_path, 60 * 60);
            return [evidence.id, data?.signedUrl ?? ''] as const;
          }),
        );
        entries.forEach(([id, url]) => {
          if (url) nextEvidenceUrls.set(id, url);
        });
      }
    }

    setEvent(nextEvent);
    setEventPets((petsResult.data ?? []) as EventPet[]);
    setTasks((tasksResult.data ?? []) as EventTask[]);
    setMessages(nextMessages);
    setEvidenceUrls(nextEvidenceUrls);
    setProfiles(
      new Map(((profileResult.data ?? []) as HospedaProfile[]).map((profile) => [profile.id, profile])),
    );

    if (
      petsResult.error ||
      tasksResult.error ||
      messagesResult.error ||
      profileResult.error ||
      evidenceError
    ) {
      setError('Algumas informações do evento não puderam ser carregadas.');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!eventId) return;

    const refresh = () => void loadEvent(false);
    const channel = supabase
      .channel(`hosting-event:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hosting_events', filter: `id=eq.${eventId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hosting_event_pets', filter: `event_id=eq.${eventId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${eventId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
        refresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, loadEvent]);

  const isTutor = Boolean(user && event && user.id === event.tutor_id);
  const isCaregiver = Boolean(user && event && user.id === event.caregiver_id);
  const tutor = event ? profiles.get(event.tutor_id) : null;
  const caregiver = event ? profiles.get(event.caregiver_id) : null;
  const incompleteTasks = useMemo(() => tasks.filter((task) => !task.completed_at), [tasks]);
  const completedTasks = tasks.length - incompleteTasks.length;
  const eventMinimumDate = event?.starts_at ? new Date(event.starts_at) : undefined;
  const eventMaximumDate = event?.ends_at ? new Date(event.ends_at) : undefined;

  function applyPreset(preset: 'arrival' | 'meal' | 'walk' | 'medication' | 'water' | 'custom') {
    const presets: Record<typeof preset, Partial<TaskDraft>> = {
      arrival: {
        category: 'photo',
        title: 'Recebimento do pet',
        instructions: 'Registrar como o pet chegou e confirmar o recebimento.',
        requiresPhoto: true,
        scheduleMode: 'event',
      },
      meal: {
        category: 'meal',
        title: 'Refeição',
        instructions: 'Seguir quantidade e alimentação descritas no dossiê.',
        requiresPhoto: true,
      },
      walk: {
        category: 'walk',
        title: 'Passeio',
        instructions: 'Seguir as orientações de passeio do dossiê.',
        requiresPhoto: true,
      },
      medication: {
        category: 'medication',
        title: 'Administrar medicamento',
        requiresPhoto: true,
      },
      water: {
        category: 'water',
        title: 'Trocar água',
        requiresPhoto: false,
      },
      custom: {
        category: 'custom',
        title: '',
        instructions: '',
        requiresPhoto: false,
      },
    };
    setTaskDraft((current) => ({ ...current, ...presets[preset] }));
    setTaskFieldErrors({});
  }

  function scheduledDatesForDraft(): (Date | null)[] {
    if (taskDraft.scheduleMode === 'event') return [null];

    if (taskDraft.scheduleMode === 'single') {
      const parsed = parsePickerValue(taskDraft.singleAt, 'datetime');
      return parsed ? [parsed] : [];
    }

    if (taskDraft.scheduleMode === 'specific') {
      const parsed = taskDraft.specificTimes.map((value) => parsePickerValue(value, 'datetime'));
      if (!parsed.length || parsed.some((value) => value === null)) return [];
      return parsed as Date[];
    }

    const start = parsePickerValue(taskDraft.intervalStart, 'datetime');
    const end = parsePickerValue(taskDraft.intervalEnd, 'datetime');
    const intervalMinutes = Number(taskDraft.intervalMinutes);
    if (!start || !end || end < start || !Number.isInteger(intervalMinutes) || intervalMinutes < 5) {
      return [];
    }

    const dates: Date[] = [];
    let cursor = start.getTime();
    const endTime = end.getTime();
    const step = intervalMinutes * 60_000;
    while (cursor <= endTime && dates.length < 60) {
      dates.push(new Date(cursor));
      cursor += step;
    }
    return dates;
  }

  function addSpecificTime() {
    const parsed = parsePickerValue(taskDraft.specificCandidate, 'datetime');
    if (!parsed) {
      setTaskFieldErrors((current) => ({
        ...current,
        specificCandidate: 'Selecione uma data e um horário antes de adicionar.',
      }));
      return;
    }
    if (taskDraft.specificTimes.includes(taskDraft.specificCandidate)) {
      setTaskFieldErrors((current) => ({
        ...current,
        specificCandidate: 'Este horário já foi adicionado.',
      }));
      return;
    }

    setTaskDraft((current) => ({
      ...current,
      specificTimes: [...current.specificTimes, current.specificCandidate].sort(),
      specificCandidate: '',
    }));
    setTaskFieldErrors((current) => ({ ...current, specificCandidate: undefined, schedule: undefined }));
  }

  async function addTasks() {
    if (!event || !user || !isTutor || event.status !== 'draft' || busy) return;

    const nextErrors: TaskFieldErrors = {};
    if (taskDraft.title.trim().length < 2) nextErrors.title = 'Dê um nome para a tarefa.';

    const dates = scheduledDatesForDraft();
    if (!dates.length) {
      if (taskDraft.scheduleMode === 'specific') {
        nextErrors.schedule = 'Adicione pelo menos um horário específico.';
      } else if (taskDraft.scheduleMode === 'interval') {
        nextErrors.schedule = 'Revise o início, fim e intervalo da recorrência.';
      } else {
        nextErrors.schedule = 'Selecione o horário da tarefa.';
      }
    }

    setTaskFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstMessage = Object.values(nextErrors).find(Boolean) ?? 'Revise os campos do checklist.';
      setError('Existem campos pendentes na nova tarefa.');
      Alert.alert('Revise a tarefa', firstMessage);
      return;
    }

    setBusy(true);
    setError(null);
    const baseSortOrder = tasks.length;
    const rows = dates.map((date, index) => ({
      event_id: event.id,
      pet_id: taskDraft.petId,
      created_by: user.id,
      category: taskDraft.category,
      title: taskDraft.title.trim(),
      instructions: taskDraft.instructions.trim() || null,
      due_at: date ? date.toISOString() : null,
      requires_photo: taskDraft.requiresPhoto,
      sort_order: baseSortOrder + index,
    }));

    const { error: insertError } = await supabase.from('event_tasks').insert(rows);
    if (insertError) {
      setError('Não foi possível adicionar a tarefa ao checklist.');
    } else {
      setTaskDraft(emptyTaskDraft);
      setTaskFieldErrors({});
      await loadEvent(false);
    }
    setBusy(false);
  }

  async function deleteTask(taskId: string) {
    if (!event || !isTutor || event.status !== 'draft' || busy) return;
    setBusy(true);
    const { error: deleteError } = await supabase.from('event_tasks').delete().eq('id', taskId);
    if (deleteError) setError('Não foi possível remover a tarefa.');
    else await loadEvent(false);
    setBusy(false);
  }

  async function transition(target: HostingStatus) {
    if (!event || busy) return;
    setBusy(true);
    setError(null);
    const { error: transitionError } = await supabase.rpc('transition_hosting_event', {
      p_event_id: event.id,
      p_target_status: target,
    });
    if (transitionError) {
      const normalized = transitionError.message.toLowerCase();
      if (normalized.includes('unfinished')) {
        setError('Ainda existem tarefas pendentes no checklist.');
      } else {
        setError('Esta mudança de estado não é permitida agora.');
      }
    } else {
      await loadEvent(false);
    }
    setBusy(false);
  }

  async function completeTask(task: EventTask) {
    if (!event || !user || !isCaregiver || event.status !== 'in_progress' || busy) return;
    if (task.requires_photo) {
      await captureEvidenceAndComplete(task);
      return;
    }

    setBusy(true);
    setError(null);
    const { error: completionError } = await supabase.rpc('complete_event_task', {
      p_task_id: task.id,
    });
    if (completionError) setError('Não foi possível concluir esta tarefa.');
    else await loadEvent(false);
    setBusy(false);
  }

  async function captureEvidenceAndComplete(task: EventTask) {
    if (!event || !user || busy) return;
    setBusy(true);
    setError(null);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('A câmera precisa ser autorizada para registrar esta evidência.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.86,
        exif: false,
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const binary = await fetch(asset.uri).then((response) => response.arrayBuffer());
      const extension = extensionForAsset(asset);
      const storagePath = `${user.id}/${event.id}/${task.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('event-evidence')
        .upload(storagePath, binary, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: evidence, error: evidenceError } = await supabase
        .from('task_evidence')
        .insert({
          task_id: task.id,
          uploaded_by: user.id,
          storage_path: storagePath,
          caption: task.title,
        })
        .select('id')
        .single();
      if (evidenceError || !evidence) throw evidenceError ?? new Error('Evidence not created');

      const { error: messageError } = await supabase.from('chat_messages').insert({
        event_id: event.id,
        sender_id: user.id,
        message_type: 'photo_evidence',
        body: task.title,
        task_id: task.id,
        evidence_id: evidence.id,
      });
      if (messageError) throw messageError;

      const { error: completionError } = await supabase.rpc('complete_event_task', {
        p_task_id: task.id,
      });
      if (completionError) throw completionError;

      await loadEvent(false);
    } catch {
      setError('Não foi possível enviar a foto e concluir a tarefa. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!event || !user || busy || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    const { error: messageError } = await supabase.from('chat_messages').insert({
      event_id: event.id,
      sender_id: user.id,
      message_type: 'text',
      body: messageBody.trim(),
    });
    if (messageError) {
      setError('Não foi possível enviar a mensagem.');
    } else {
      setMessageBody('');
      await loadEvent(false);
    }
    setBusy(false);
  }

  function confirmCancel() {
    if (!event) return;
    Alert.alert('Cancelar hospedagem?', 'O histórico já registrado será preservado.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar hospedagem', style: 'destructive', onPress: () => void transition('cancelled') },
    ]);
  }

  if (loading) {
    return (
      <ScreenShell onBack={() => router.back()} title="Hospedagem">
        <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>
      </ScreenShell>
    );
  }

  if (!event) {
    return (
      <ScreenShell onBack={() => router.back()} title="Hospedagem não encontrada">
        <ErrorBanner message={error ?? 'Não foi possível abrir este evento.'} />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        eyebrow="HOSPEDAGEM"
        onBack={() => router.back()}
        title={event.title || 'Evento de hospedagem'}
        subtitle={`${formatDateTime(event.starts_at)} → ${formatDateTime(event.ends_at)}`}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLabel}>{statusLabels[event.status]}</Text>
            <Text style={styles.statusProgress}>{completedTasks}/{tasks.length} tarefas</Text>
          </View>
          <Text style={styles.statusDescription}>{statusCopy[event.status]}</Text>
          <View style={styles.peopleRow}>
            <PersonBadge label="Tutor" name={tutor?.full_name || 'Tutor'} />
            <PersonBadge label="Cuidador" name={caregiver?.full_name || 'Cuidador'} />
          </View>
        </View>

        <SectionCard
          title="Pets neste evento"
          description="Toque em um pet para abrir o dossiê completo que foi congelado quando esta hospedagem foi criada.">
          <View style={styles.petList}>
            {eventPets.map((eventPet) => (
              <Pressable
                key={eventPet.pet_id}
                accessibilityLabel={`Abrir dossiê congelado de ${petNameFromSnapshot(eventPet.pet_snapshot)}`}
                accessibilityRole="button"
                onPress={() => setSelectedSnapshot(eventPet)}
                style={({ pressed }) => [styles.snapshotPet, pressed && styles.pressed]}>
                <Text style={styles.snapshotEmoji}>🐾</Text>
                <View style={styles.snapshotCopy}>
                  <Text style={styles.snapshotName}>{petNameFromSnapshot(eventPet.pet_snapshot)}</Text>
                  <Text style={styles.snapshotHint}>Ver todas as informações do pet</Text>
                </View>
                <View style={styles.snapshotAction}>
                  <Text style={styles.snapshotBadge}>SNAPSHOT</Text>
                  <Text style={styles.snapshotArrow}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {event.tutor_instructions ? <Text style={styles.instructions}>{event.tutor_instructions}</Text> : null}
        </SectionCard>

        {isTutor && event.status === 'draft' ? (
          <SectionCard
            title="Montar checklist"
            description="Uma tarefa pode ter horário, ser recorrente ou ficar livre para ser concluída quando acontecer durante a hospedagem.">
            <View style={styles.presets}>
              <Preset label="📸 Recebimento" onPress={() => applyPreset('arrival')} />
              <Preset label="🍖 Refeição" onPress={() => applyPreset('meal')} />
              <Preset label="🦮 Passeio" onPress={() => applyPreset('walk')} />
              <Preset label="💊 Medicação" onPress={() => applyPreset('medication')} />
              <Preset label="💧 Água" onPress={() => applyPreset('water')} />
              <Preset label="＋ Personalizada" onPress={() => applyPreset('custom')} />
            </View>

            <FormField
              label="Tarefa"
              required
              value={taskDraft.title}
              error={taskFieldErrors.title}
              onChangeText={(title) => {
                setTaskDraft((current) => ({ ...current, title }));
                setTaskFieldErrors((current) => ({ ...current, title: undefined }));
                setError(null);
              }}
            />
            <FormField
              label="Orientações"
              multiline
              value={taskDraft.instructions}
              onChangeText={(instructions) => setTaskDraft((current) => ({ ...current, instructions }))}
            />

            <Text style={styles.fieldLabel}>Pet relacionado</Text>
            <View style={styles.choices}>
              <ChoiceChip
                selected={taskDraft.petId === null}
                label="Todos / geral"
                onPress={() => setTaskDraft((current) => ({ ...current, petId: null }))}
              />
              {eventPets.map((pet) => (
                <ChoiceChip
                  key={pet.pet_id}
                  selected={taskDraft.petId === pet.pet_id}
                  label={petNameFromSnapshot(pet.pet_snapshot)}
                  onPress={() => setTaskDraft((current) => ({ ...current, petId: pet.pet_id }))}
                />
              ))}
            </View>

            <View style={styles.photoRule}>
              <View style={styles.photoRuleCopy}>
                <Text style={styles.photoRuleTitle}>Exigir foto para concluir</Text>
                <Text style={styles.photoRuleText}>A evidência será registrada no chat do evento.</Text>
              </View>
              <Switch
                trackColor={{ false: colors.border, true: colors.primarySoft }}
                thumbColor={taskDraft.requiresPhoto ? colors.primary : colors.surface}
                value={taskDraft.requiresPhoto}
                onValueChange={(requiresPhoto) => setTaskDraft((current) => ({ ...current, requiresPhoto }))}
              />
            </View>

            <Text style={styles.fieldLabel}>Quando esta tarefa deve ser feita?</Text>
            <View style={styles.choices}>
              <ChoiceChip
                selected={taskDraft.scheduleMode === 'event'}
                label="Quando for realizado"
                onPress={() => {
                  setTaskDraft((current) => ({ ...current, scheduleMode: 'event' }));
                  setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                }}
              />
              <ChoiceChip
                selected={taskDraft.scheduleMode === 'single'}
                label="Um horário"
                onPress={() => {
                  setTaskDraft((current) => ({ ...current, scheduleMode: 'single' }));
                  setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                }}
              />
              <ChoiceChip
                selected={taskDraft.scheduleMode === 'interval'}
                label="Intervalo fixo"
                onPress={() => {
                  setTaskDraft((current) => ({ ...current, scheduleMode: 'interval' }));
                  setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                }}
              />
              <ChoiceChip
                selected={taskDraft.scheduleMode === 'specific'}
                label="Horários específicos"
                onPress={() => {
                  setTaskDraft((current) => ({ ...current, scheduleMode: 'specific' }));
                  setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                }}
              />
            </View>

            {taskDraft.scheduleMode === 'event' ? (
              <View style={styles.scheduleHint}>
                <Text style={styles.scheduleHintTitle}>Sem horário obrigatório</Text>
                <Text style={styles.scheduleHintText}>
                  O item ficará pendente durante a hospedagem e o cuidador marca quando realmente executar a ação.
                </Text>
              </View>
            ) : null}

            {taskDraft.scheduleMode === 'single' ? (
              <DateTimeField
                label="Data e horário"
                mode="datetime"
                minimumDate={eventMinimumDate}
                maximumDate={eventMaximumDate}
                placeholder="Selecionar horário"
                value={taskDraft.singleAt}
                error={taskFieldErrors.schedule}
                onChange={(singleAt) => {
                  setTaskDraft((current) => ({ ...current, singleAt }));
                  setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                }}
              />
            ) : null}

            {taskDraft.scheduleMode === 'interval' ? (
              <>
                <DateTimeField
                  label="Primeiro registro"
                  mode="datetime"
                  minimumDate={eventMinimumDate}
                  maximumDate={eventMaximumDate}
                  placeholder="Selecionar início"
                  value={taskDraft.intervalStart}
                  onChange={(intervalStart) => {
                    setTaskDraft((current) => ({ ...current, intervalStart }));
                    setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                  }}
                />
                <DateTimeField
                  label="Último registro"
                  mode="datetime"
                  minimumDate={parsePickerValue(taskDraft.intervalStart, 'datetime') ?? eventMinimumDate}
                  maximumDate={eventMaximumDate}
                  placeholder="Selecionar término"
                  value={taskDraft.intervalEnd}
                  error={taskFieldErrors.schedule}
                  onChange={(intervalEnd) => {
                    setTaskDraft((current) => ({ ...current, intervalEnd }));
                    setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                  }}
                />
                <FormField
                  label="Intervalo em minutos"
                  keyboardType="number-pad"
                  hint="Mínimo de 5 minutos. Cada ocorrência vira um item separado no checklist."
                  value={taskDraft.intervalMinutes}
                  error={taskFieldErrors.schedule}
                  onChangeText={(intervalMinutes) => {
                    setTaskDraft((current) => ({ ...current, intervalMinutes }));
                    setTaskFieldErrors((current) => ({ ...current, schedule: undefined }));
                  }}
                />
              </>
            ) : null}

            {taskDraft.scheduleMode === 'specific' ? (
              <View style={styles.specificBlock}>
                <DateTimeField
                  label="Adicionar data e horário"
                  mode="datetime"
                  minimumDate={eventMinimumDate}
                  maximumDate={eventMaximumDate}
                  placeholder="Selecionar horário"
                  value={taskDraft.specificCandidate}
                  error={taskFieldErrors.specificCandidate}
                  onChange={(specificCandidate) => {
                    setTaskDraft((current) => ({ ...current, specificCandidate }));
                    setTaskFieldErrors((current) => ({ ...current, specificCandidate: undefined }));
                  }}
                />
                <SecondaryButton label="Adicionar este horário" onPress={addSpecificTime} />
                {taskDraft.specificTimes.length ? (
                  <View style={styles.specificList}>
                    {taskDraft.specificTimes.map((time) => (
                      <View key={time} style={styles.specificItem}>
                        <Text style={styles.specificTime}>
                          {formatDateTime(parsePickerValue(time, 'datetime')?.toISOString() ?? null)}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setTaskDraft((current) => ({
                              ...current,
                              specificTimes: current.specificTimes.filter((candidate) => candidate !== time),
                            }))
                          }>
                          <Text style={styles.specificRemove}>Remover</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.scheduleValidation}>
                    {taskFieldErrors.schedule ?? 'Nenhum horário adicionado ainda.'}
                  </Text>
                )}
              </View>
            ) : null}

            {taskFieldErrors.schedule &&
            taskDraft.scheduleMode !== 'single' &&
            taskDraft.scheduleMode !== 'interval' &&
            taskDraft.scheduleMode !== 'specific' ? (
              <Text style={styles.scheduleValidation}>{taskFieldErrors.schedule}</Text>
            ) : null}

            <PrimaryButton label="Adicionar ao checklist" loading={busy} onPress={() => void addTasks()} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Checklist"
          description={tasks.length ? `${completedTasks} de ${tasks.length} concluída(s).` : 'Nenhuma tarefa foi adicionada.'}>
          <View style={styles.taskList}>
            {tasks.map((task) => (
              <View key={task.id} style={[styles.taskCard, task.completed_at && styles.taskCardDone]}>
                <View style={styles.taskTop}>
                  <View style={styles.taskCopy}>
                    <Text style={[styles.taskTitle, task.completed_at && styles.taskTitleDone]}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      {formatDateTime(task.due_at)}{task.requires_photo ? ' • 📸 foto obrigatória' : ''}
                    </Text>
                    {task.instructions ? <Text style={styles.taskInstructions}>{task.instructions}</Text> : null}
                  </View>
                  <Text style={styles.taskCheck}>{task.completed_at ? '✓' : '○'}</Text>
                </View>

                {isTutor && event.status === 'draft' ? (
                  <Pressable accessibilityRole="button" onPress={() => void deleteTask(task.id)}>
                    <Text style={styles.removeTask}>Remover tarefa</Text>
                  </Pressable>
                ) : null}

                {isCaregiver && event.status === 'in_progress' && !task.completed_at ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void completeTask(task)}
                    style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
                    <Text style={styles.completeButtonText}>
                      {task.requires_photo ? '📸 Fotografar, ajustar e concluir' : 'Marcar como concluída'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </SectionCard>

        <EventActions
          event={event}
          isTutor={isTutor}
          isCaregiver={isCaregiver}
          busy={busy}
          incompleteCount={incompleteTasks.length}
          onTransition={(target) => void transition(target)}
          onCancel={confirmCancel}
        />

        <SectionCard
          title="Chat e registro do evento"
          description="Mensagens, alterações de estado, fotos e conclusões ficam vinculadas somente a esta hospedagem.">
          <View style={styles.timeline}>
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma mensagem registrada ainda.</Text>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  mine={message.sender_id === user?.id}
                  senderName={message.sender_id ? profiles.get(message.sender_id)?.full_name : undefined}
                  evidenceUrl={message.evidence_id ? evidenceUrls.get(message.evidence_id) : undefined}
                  onOpenImage={(uri, caption) => setExpandedPhoto({ uri, caption })}
                />
              ))
            )}
          </View>

          {event.status !== 'cancelled' ? (
            <>
              <FormField
                label="Mensagem"
                multiline
                maxLength={1500}
                placeholder="Escreva para o outro participante..."
                value={messageBody}
                onChangeText={setMessageBody}
              />
              <PrimaryButton
                disabled={!messageBody.trim()}
                label="Enviar mensagem"
                loading={busy}
                onPress={() => void sendMessage()}
              />
            </>
          ) : null}
        </SectionCard>
      </ScreenShell>

      <PetSnapshotModal
        visible={Boolean(selectedSnapshot)}
        snapshot={selectedSnapshot?.pet_snapshot}
        handoffSnapshot={selectedSnapshot?.handoff_snapshot}
        onClose={() => setSelectedSnapshot(null)}
      />
      <PhotoLightbox
        uri={expandedPhoto?.uri ?? null}
        caption={expandedPhoto?.caption}
        onClose={() => setExpandedPhoto(null)}
      />
    </>
  );
}

function EventActions({
  event,
  isTutor,
  isCaregiver,
  busy,
  incompleteCount,
  onTransition,
  onCancel,
}: {
  event: HostingEvent;
  isTutor: boolean;
  isCaregiver: boolean;
  busy: boolean;
  incompleteCount: number;
  onTransition: (target: HostingStatus) => void;
  onCancel: () => void;
}) {
  return (
    <SectionCard title="Próxima etapa">
      {event.status === 'draft' && isTutor ? (
        <PrimaryButton label="Enviar ao cuidador" loading={busy} onPress={() => onTransition('sent')} />
      ) : null}
      {event.status === 'sent' && isCaregiver ? (
        <PrimaryButton label="Aceitar hospedagem" loading={busy} onPress={() => onTransition('accepted')} />
      ) : null}
      {event.status === 'accepted' && isCaregiver ? (
        <PrimaryButton label="Iniciar hospedagem" loading={busy} onPress={() => onTransition('in_progress')} />
      ) : null}
      {event.status === 'in_progress' && isCaregiver ? (
        <PrimaryButton
          disabled={incompleteCount > 0}
          label={incompleteCount ? `Ainda há ${incompleteCount} tarefa(s) pendente(s)` : 'Concluir hospedagem'}
          loading={busy}
          onPress={() => onTransition('completed')}
        />
      ) : null}
      {event.status === 'sent' && isTutor ? <Text style={styles.waitingText}>Aguardando o cuidador aceitar.</Text> : null}
      {event.status === 'accepted' && isTutor ? <Text style={styles.waitingText}>O cuidador já aceitou e poderá iniciar o evento.</Text> : null}
      {event.status === 'in_progress' && isTutor ? <Text style={styles.waitingText}>Acompanhe o checklist e as evidências abaixo.</Text> : null}
      {!['completed', 'cancelled'].includes(event.status) ? (
        <SecondaryButton destructive label="Cancelar hospedagem" onPress={onCancel} />
      ) : null}
    </SectionCard>
  );
}

function PersonBadge({ label, name }: { label: string; name: string }) {
  return (
    <View style={styles.personBadge}>
      <Text style={styles.personRole}>{label}</Text>
      <Text numberOfLines={1} style={styles.personName}>{name}</Text>
    </View>
  );
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.preset, pressed && styles.pressed]}>
      <Text style={styles.presetText}>{label}</Text>
    </Pressable>
  );
}

function ChoiceChip({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChatBubble({
  message,
  mine,
  senderName,
  evidenceUrl,
  onOpenImage,
}: {
  message: ChatMessage;
  mine: boolean;
  senderName?: string;
  evidenceUrl?: string;
  onOpenImage: (uri: string, caption: string | null) => void;
}) {
  if (message.message_type === 'photo_evidence') {
    return (
      <View style={styles.photoMessage}>
        <Text style={styles.systemText}>{systemMessageText(message)}</Text>
        {evidenceUrl ? (
          <Pressable
            accessibilityLabel={`Ampliar foto: ${message.body || 'evidência do cuidado'}`}
            accessibilityRole="button"
            onPress={() => onOpenImage(evidenceUrl, message.body)}
            style={({ pressed }) => [styles.evidencePressable, pressed && styles.pressed]}>
            <Image source={{ uri: evidenceUrl }} style={styles.evidenceThumbnail} />
            <Text style={styles.expandHint}>Toque na foto para ampliar</Text>
          </Pressable>
        ) : (
          <View style={styles.evidencePlaceholder}>
            <Text style={styles.evidencePlaceholderText}>Preparando miniatura...</Text>
          </View>
        )}
        <Text style={styles.messageTime}>{formatDateTime(message.created_at)}</Text>
      </View>
    );
  }

  if (message.message_type !== 'text') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemText}>{systemMessageText(message)}</Text>
        <Text style={styles.messageTime}>{formatDateTime(message.created_at)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
      {!mine && senderName ? <Text style={styles.senderName}>{senderName}</Text> : null}
      <Text style={styles.messageText}>{message.body}</Text>
      <Text style={styles.messageTime}>{formatDateTime(message.created_at)}</Text>
    </View>
  );
}

function systemMessageText(message: ChatMessage) {
  if (message.message_type === 'photo_evidence') return `📸 Evidência enviada: ${message.body || 'foto do cuidado'}`;
  if (message.message_type === 'task_completed') return `✓ Checklist concluído: ${message.body || 'tarefa'}`;
  if (message.message_type === 'event_status') {
    const value = message.body as HostingStatus | null;
    return value && statusLabels[value] ? `Hospedagem: ${statusLabels[value]}` : 'Estado da hospedagem atualizado';
  }
  return message.body || 'Registro do sistema';
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    gap: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusLabel: {
    color: colors.surface,
    fontSize: 19,
    fontWeight: '900',
  },
  statusProgress: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: '800',
  },
  statusDescription: {
    color: colors.primarySoft,
    fontSize: 13,
    lineHeight: 19,
  },
  peopleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  personBadge: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  personRole: {
    color: colors.primarySoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  personName: {
    marginTop: spacing.xs,
    color: colors.surface,
    fontSize: 12,
    fontWeight: '800',
  },
  petList: {
    gap: spacing.sm,
  },
  snapshotPet: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  snapshotEmoji: {
    fontSize: 22,
  },
  snapshotCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  snapshotName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  snapshotHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  snapshotAction: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  snapshotBadge: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  snapshotArrow: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  instructions: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preset: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  presetText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  fieldLabel: {
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
  photoRule: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoRuleCopy: {
    flex: 1,
  },
  photoRuleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  photoRuleText: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  scheduleHint: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
    gap: spacing.xs,
  },
  scheduleHintTitle: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  scheduleHintText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  scheduleValidation: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  specificBlock: {
    gap: spacing.md,
  },
  specificList: {
    gap: spacing.sm,
  },
  specificItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  specificTime: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  specificRemove: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
  },
  taskList: {
    gap: spacing.sm,
  },
  taskCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  taskCardDone: {
    backgroundColor: colors.successSoft,
  },
  taskTop: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  taskInstructions: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  taskCheck: {
    color: colors.primary,
    fontSize: 23,
    fontWeight: '900',
  },
  removeTask: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
  },
  completeButton: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  waitingText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  timeline: {
    gap: spacing.sm,
  },
  messageBubble: {
    maxWidth: '88%',
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.xs,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
  },
  senderName: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: 9,
  },
  systemMessage: {
    alignSelf: 'center',
    maxWidth: '94%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoMessage: {
    alignSelf: 'center',
    width: '94%',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    gap: spacing.sm,
  },
  systemText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  evidencePressable: {
    gap: spacing.xs,
  },
  evidenceThumbnail: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  expandHint: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  evidencePlaceholder: {
    minHeight: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidencePlaceholderText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
