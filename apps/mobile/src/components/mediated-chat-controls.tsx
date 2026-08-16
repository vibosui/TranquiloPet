import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type ParticipantRole = 'tutor' | 'caregiver';

type QuestionPreset = {
  key: string;
  sender_role: ParticipantRole | 'both';
  category: string;
  body: string;
  sort_order: number;
};

type AnswerPreset = {
  key: string;
  question_key: string;
  sender_role: ParticipantRole | 'both';
  body: string;
  sort_order: number;
};

export type MediatedChatMessage = {
  id: string;
  sender_id: string | null;
  message_type: string;
  body: string | null;
  task_id: string | null;
  preset_key: string | null;
  reply_to_message_id: string | null;
};

export type MediatedChatTask = {
  id: string;
  completed_at: string | null;
};

export type MediatedChatPet = {
  pet_id: string;
  pet_snapshot: unknown;
};

type MediatedChatControlsProps = {
  eventId: string;
  eventStatus: string;
  userId: string | null;
  isTutor: boolean;
  isCaregiver: boolean;
  messages: MediatedChatMessage[];
  tasks: MediatedChatTask[];
  pets: MediatedChatPet[];
  busy?: boolean;
  onChanged: () => Promise<void> | void;
  onCapturePhotoTask: (taskId: string) => Promise<void> | void;
};

const categoryIcon: Record<string, string> = {
  status: '💛',
  feeding: '🍖',
  water: '💧',
  hygiene: '🐾',
  walk: '🦮',
  routine: '💤',
  behavior: '🧠',
  medication: '💊',
};

function petName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 'pet';
  const value = (snapshot as Record<string, unknown>).name;
  return typeof value === 'string' && value.trim() ? value.trim() : 'pet';
}

export function MediatedChatControls({
  eventId,
  eventStatus,
  userId,
  isTutor,
  isCaregiver,
  messages,
  tasks,
  pets,
  busy = false,
  onChanged,
  onCapturePhotoTask,
}: MediatedChatControlsProps) {
  const role: ParticipantRole | null = isTutor ? 'tutor' : isCaregiver ? 'caregiver' : null;
  const [questions, setQuestions] = useState<QuestionPreset[]>([]);
  const [answers, setAnswers] = useState<AnswerPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPresets() {
      if (!role) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const [questionResult, answerResult] = await Promise.all([
        supabase
          .from('chat_question_presets')
          .select('key, sender_role, category, body, sort_order')
          .in('sender_role', [role, 'both'])
          .order('sort_order', { ascending: true }),
        supabase
          .from('chat_answer_presets')
          .select('key, question_key, sender_role, body, sort_order')
          .in('sender_role', [role, 'both'])
          .order('sort_order', { ascending: true }),
      ]);

      if (!active) return;
      if (questionResult.error || answerResult.error) {
        setError('Não foi possível carregar as mensagens rápidas.');
      } else {
        setQuestions((questionResult.data ?? []) as QuestionPreset[]);
        setAnswers((answerResult.data ?? []) as AnswerPreset[]);
      }
      setLoading(false);
    }

    void loadPresets();
    return () => {
      active = false;
    };
  }, [role]);

  const answeredQuestionIds = useMemo(
    () =>
      new Set(
        messages
          .filter((message) => message.message_type === 'preset_answer' && message.reply_to_message_id)
          .map((message) => message.reply_to_message_id as string),
      ),
    [messages],
  );

  const unansweredQuestions = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.message_type === 'preset_question' &&
          message.sender_id !== userId &&
          Boolean(message.preset_key) &&
          !answeredQuestionIds.has(message.id),
      ),
    [answeredQuestionIds, messages, userId],
  );

  const pendingPhotoRequests = useMemo(() => {
    if (!isCaregiver) return [];
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return messages.filter((message) => {
      if (message.message_type !== 'photo_request' || !message.task_id || message.sender_id === userId) {
        return false;
      }
      return !taskById.get(message.task_id)?.completed_at;
    });
  }, [isCaregiver, messages, tasks, userId]);

  const canInteract = ['sent', 'accepted', 'in_progress'].includes(eventStatus);
  const disabled = busy || Boolean(actionKey);

  async function runAction(key: string, action: () => Promise<{ error: { message: string } | null }>) {
    if (disabled) return;
    setActionKey(key);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        const normalized = result.error.message.toLowerCase();
        if (normalized.includes('already answered')) {
          setError('Essa pergunta já foi respondida.');
        } else if (normalized.includes('pending photo request')) {
          setError('Já existe uma solicitação de foto pendente para este pet.');
        } else {
          setError('Não foi possível registrar essa interação agora.');
        }
        return;
      }
      await onChanged();
    } finally {
      setActionKey(null);
    }
  }

  async function sendQuestion(questionKey: string) {
    await runAction(`question:${questionKey}`, async () =>
      supabase.rpc('send_chat_question', {
        p_event_id: eventId,
        p_question_key: questionKey,
      }),
    );
  }

  async function sendAnswer(questionMessageId: string, answerKey: string) {
    await runAction(`answer:${questionMessageId}:${answerKey}`, async () =>
      supabase.rpc('send_chat_answer', {
        p_question_message_id: questionMessageId,
        p_answer_key: answerKey,
      }),
    );
  }

  async function requestPhoto(petId: string) {
    await runAction(`photo:${petId}`, async () =>
      supabase.rpc('request_pet_photo', {
        p_event_id: eventId,
        p_pet_id: petId,
      }),
    );
  }

  if (!role) return null;

  return (
    <View style={styles.container}>
      <View style={styles.mediatedNotice}>
        <Text style={styles.noticeTitle}>🔒 Comunicação mediada pelo Hospeda Patas</Text>
        <Text style={styles.noticeText}>
          Não há envio de texto livre. Perguntas, respostas e solicitações ficam padronizadas e registradas no evento.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.muted}>Carregando mensagens rápidas...</Text>
        </View>
      ) : null}

      {canInteract && unansweredQuestions.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Responder</Text>
          {unansweredQuestions.map((question) => {
            const availableAnswers = answers.filter(
              (answer) => answer.question_key === question.preset_key,
            );
            return (
              <View key={question.id} style={styles.replyCard}>
                <Text style={styles.replyQuestion}>{question.body}</Text>
                <View style={styles.optionList}>
                  {availableAnswers.map((answer) => (
                    <ActionOption
                      key={answer.key}
                      disabled={disabled}
                      label={answer.body}
                      loading={actionKey === `answer:${question.id}:${answer.key}`}
                      onPress={() => void sendAnswer(question.id, answer.key)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {canInteract && questions.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Perguntas rápidas</Text>
          <Text style={styles.blockHint}>Escolha uma pergunta pronta para enviar ao outro participante.</Text>
          <View style={styles.questionGrid}>
            {questions.map((question) => (
              <Pressable
                key={question.key}
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => void sendQuestion(question.key)}
                style={({ pressed }) => [
                  styles.questionChip,
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <Text style={styles.questionText}>
                  {categoryIcon[question.category] ?? '💬'} {question.body}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {isTutor && eventStatus === 'in_progress' && pets.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Solicitar foto</Text>
          <Text style={styles.blockHint}>
            O cuidador só poderá responder a esta solicitação com uma foto capturada pela câmera.
          </Text>
          <View style={styles.optionList}>
            {pets.map((pet) => (
              <ActionOption
                key={pet.pet_id}
                disabled={disabled}
                label={`📸 Solicitar foto de ${petName(pet.pet_snapshot)}`}
                loading={actionKey === `photo:${pet.pet_id}`}
                onPress={() => void requestPhoto(pet.pet_id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {isCaregiver && eventStatus === 'in_progress' && pendingPhotoRequests.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Foto solicitada pelo tutor</Text>
          {pendingPhotoRequests.map((request) => (
            <View key={request.id} style={styles.photoRequestCard}>
              <Text style={styles.replyQuestion}>{request.body ?? 'O tutor solicitou uma foto atual do pet.'}</Text>
              <Text style={styles.cameraOnly}>Somente câmera • sem galeria • sem mensagem de texto</Text>
              <ActionOption
                disabled={disabled}
                label="📷 Responder com foto da câmera"
                loading={busy}
                onPress={() => request.task_id && void onCapturePhotoTask(request.task_id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {!canInteract ? (
        <Text style={styles.closedText}>As mensagens rápidas ficam disponíveis apenas durante uma hospedagem ativa ou em preparação.</Text>
      ) : null}
    </View>
  );
}

function ActionOption({
  label,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  disabled: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionOption,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      <Text style={styles.actionOptionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  mediatedNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    gap: spacing.xs,
  },
  noticeTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 11,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
  },
  block: {
    gap: spacing.sm,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  blockHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  questionGrid: {
    gap: spacing.sm,
  },
  questionChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  questionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  replyCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm,
  },
  replyQuestion: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  optionList: {
    gap: spacing.sm,
  },
  actionOption: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionOptionText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 17,
  },
  photoRequestCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    gap: spacing.sm,
  },
  cameraOnly: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  closedText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
