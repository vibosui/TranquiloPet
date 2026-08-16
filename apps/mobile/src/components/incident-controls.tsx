import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/core/supabase/client';
import { colors, radii, spacing } from '@/theme/tokens';

type ParticipantRole = 'tutor' | 'caregiver';
type IncidentSeverity = 'attention' | 'urgent';
type IncidentCategory = 'digestive' | 'behavior' | 'health' | 'safety' | 'medication';

type IncidentPreset = {
  key: string;
  category: IncidentCategory;
  label: string;
  severity: IncidentSeverity;
  sort_order: number;
};

type IncidentResponsePreset = {
  key: string;
  sender_role: ParticipantRole | 'both';
  body: string;
  closes_incident: boolean;
  sort_order: number;
};

export type IncidentTimelineMessage = {
  id: string;
  sender_id: string | null;
  message_type: string;
  body: string | null;
  preset_key: string | null;
  reply_to_message_id: string | null;
  pet_id: string | null;
};

export type IncidentPet = {
  pet_id: string;
  pet_snapshot: unknown;
};

type IncidentControlsProps = {
  eventId: string;
  eventStatus: string;
  userId: string | null;
  isTutor: boolean;
  isCaregiver: boolean;
  messages: IncidentTimelineMessage[];
  pets: IncidentPet[];
  busy?: boolean;
  onChanged: () => Promise<void> | void;
};

const categoryLabels: Record<IncidentCategory, string> = {
  digestive: '🍖 Digestão',
  behavior: '🧠 Comportamento',
  health: '🩺 Saúde',
  safety: '🛡️ Segurança',
  medication: '💊 Medicação',
};

function petName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 'Pet';
  const value = (snapshot as Record<string, unknown>).name;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Pet';
}

export function IncidentControls({
  eventId,
  eventStatus,
  userId,
  isTutor,
  isCaregiver,
  messages,
  pets,
  busy = false,
  onChanged,
}: IncidentControlsProps) {
  const role: ParticipantRole | null = isTutor ? 'tutor' : isCaregiver ? 'caregiver' : null;
  const [presets, setPresets] = useState<IncidentPreset[]>([]);
  const [responses, setResponses] = useState<IncidentResponsePreset[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(pets[0]?.pet_id ?? null);
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory>('digestive');
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPetId && pets[0]?.pet_id) setSelectedPetId(pets[0].pet_id);
    if (selectedPetId && !pets.some((pet) => pet.pet_id === selectedPetId)) {
      setSelectedPetId(pets[0]?.pet_id ?? null);
    }
  }, [pets, selectedPetId]);

  useEffect(() => {
    let active = true;

    async function loadCatalogs() {
      setLoading(true);
      setError(null);
      const [presetResult, responseResult] = await Promise.all([
        supabase
          .from('incident_presets')
          .select('key, category, label, severity, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('incident_response_presets')
          .select('key, sender_role, body, closes_incident, sort_order')
          .order('sort_order', { ascending: true }),
      ]);

      if (!active) return;
      if (presetResult.error || responseResult.error) {
        setError('Não foi possível carregar o catálogo de ocorrências.');
      } else {
        setPresets((presetResult.data ?? []) as IncidentPreset[]);
        setResponses((responseResult.data ?? []) as IncidentResponsePreset[]);
      }
      setLoading(false);
    }

    void loadCatalogs();
    return () => {
      active = false;
    };
  }, []);

  const incidentReports = useMemo(
    () => messages.filter((message) => message.message_type === 'incident_reported'),
    [messages],
  );

  const closedIncidentIds = useMemo(() => {
    const closingKeys = new Set(responses.filter((response) => response.closes_incident).map((response) => response.key));
    return new Set(
      messages
        .filter(
          (message) =>
            message.message_type === 'incident_update' &&
            Boolean(message.reply_to_message_id) &&
            Boolean(message.preset_key) &&
            closingKeys.has(message.preset_key as string),
        )
        .map((message) => message.reply_to_message_id as string),
    );
  }, [messages, responses]);

  const activeIncidents = useMemo(
    () => incidentReports.filter((incident) => !closedIncidentIds.has(incident.id)),
    [closedIncidentIds, incidentReports],
  );

  const visiblePresets = useMemo(
    () => presets.filter((preset) => preset.category === selectedCategory),
    [presets, selectedCategory],
  );

  const availableResponses = useMemo(
    () => responses.filter((response) => role && [role, 'both'].includes(response.sender_role)),
    [responses, role],
  );

  const disabled = busy || Boolean(actionKey);
  const canReport = isCaregiver && eventStatus === 'in_progress';
  const canRespond = Boolean(role) && eventStatus === 'in_progress';

  async function runAction(
    key: string,
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    if (disabled) return;
    setActionKey(key);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        const normalized = result.error.message.toLowerCase();
        if (normalized.includes('already closed')) setError('Esta ocorrência já foi encerrada.');
        else setError('Não foi possível registrar esta atualização agora.');
        return;
      }
      await onChanged();
    } finally {
      setActionKey(null);
    }
  }

  function confirmIncident(preset: IncidentPreset) {
    if (!selectedPetId) {
      setError('Selecione o pet relacionado à ocorrência.');
      return;
    }
    const pet = pets.find((candidate) => candidate.pet_id === selectedPetId);
    const severityCopy = preset.severity === 'urgent'
      ? 'Esta ocorrência será destacada como URGENTE para o tutor.'
      : 'Esta ocorrência será registrada para acompanhamento do tutor.';

    Alert.alert(
      'Registrar ocorrência?',
      `${petName(pet?.pet_snapshot)} — ${preset.label}\n\n${severityCopy}`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Registrar',
          style: preset.severity === 'urgent' ? 'destructive' : 'default',
          onPress: () =>
            void runAction(`report:${preset.key}`, async () =>
              supabase.rpc('report_hosting_incident', {
                p_event_id: eventId,
                p_pet_id: selectedPetId,
                p_incident_key: preset.key,
              }),
            ),
        },
      ],
    );
  }

  async function respond(incidentId: string, responseKey: string) {
    await runAction(`response:${incidentId}:${responseKey}`, async () =>
      supabase.rpc('respond_to_hosting_incident', {
        p_incident_message_id: incidentId,
        p_response_key: responseKey,
      }),
    );
  }

  if (!role) return null;

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.muted}>Carregando ocorrências...</Text>
        </View>
      ) : null}

      {activeIncidents.length ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Ocorrências em acompanhamento</Text>
          {activeIncidents.map((incident) => {
            const preset = presets.find((candidate) => candidate.key === incident.preset_key);
            return (
              <View
                key={incident.id}
                style={[
                  styles.incidentCard,
                  preset?.severity === 'urgent' && styles.incidentCardUrgent,
                ]}>
                <View style={styles.incidentHeader}>
                  <Text style={styles.incidentBody}>{incident.body ?? 'Ocorrência registrada'}</Text>
                  <Text
                    style={[
                      styles.severityBadge,
                      preset?.severity === 'urgent' && styles.severityBadgeUrgent,
                    ]}>
                    {preset?.severity === 'urgent' ? 'URGENTE' : 'ATENÇÃO'}
                  </Text>
                </View>
                {canRespond ? (
                  <View style={styles.responseList}>
                    {availableResponses.map((response) => (
                      <Pressable
                        key={response.key}
                        accessibilityRole="button"
                        disabled={disabled}
                        onPress={() => void respond(incident.id, response.key)}
                        style={({ pressed }) => [
                          styles.responseButton,
                          pressed && !disabled && styles.pressed,
                          disabled && styles.disabled,
                        ]}>
                        {actionKey === `response:${incident.id}:${response.key}` ? (
                          <ActivityIndicator color={colors.primary} size="small" />
                        ) : null}
                        <Text style={styles.responseText}>{response.body}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.okBanner}>
          <Text style={styles.okText}>✓ Nenhuma ocorrência em acompanhamento.</Text>
        </View>
      )}

      {canReport && !loading ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Registrar nova ocorrência</Text>
          <Text style={styles.blockHint}>
            Use opções estruturadas. O registro entra imediatamente na linha do tempo e não abre mensagem livre.
          </Text>

          {pets.length > 1 ? (
            <View style={styles.chips}>
              {pets.map((pet) => {
                const selected = selectedPetId === pet.pet_id;
                return (
                  <Pressable
                    key={pet.pet_id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedPetId(pet.pet_id)}
                    style={[styles.chip, selected && styles.chipSelected]}>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      🐾 {petName(pet.pet_snapshot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.chips}>
            {(Object.keys(categoryLabels) as IncidentCategory[]).map((category) => {
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedCategory(category)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {categoryLabels[category]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.incidentOptions}>
            {visiblePresets.map((preset) => (
              <Pressable
                key={preset.key}
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => confirmIncident(preset)}
                style={({ pressed }) => [
                  styles.incidentOption,
                  preset.severity === 'urgent' && styles.incidentOptionUrgent,
                  pressed && !disabled && styles.pressed,
                  disabled && styles.disabled,
                ]}>
                <Text style={styles.incidentOptionIcon}>{preset.severity === 'urgent' ? '🚨' : '⚠️'}</Text>
                <Text style={styles.incidentOptionText}>{preset.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {eventStatus !== 'in_progress' ? (
        <Text style={styles.closedText}>Ocorrências podem ser registradas e atualizadas apenas durante a hospedagem em andamento.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  block: { gap: spacing.sm },
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  blockHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 11 },
  error: { color: colors.error, fontSize: 12, fontWeight: '800' },
  okBanner: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
  },
  okText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  incidentCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    gap: spacing.sm,
  },
  incidentCardUrgent: { borderColor: colors.error, backgroundColor: colors.errorSoft },
  incidentHeader: { gap: spacing.sm },
  incidentBody: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.warning,
    color: colors.surface,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  severityBadgeUrgent: { backgroundColor: colors.error },
  responseList: { gap: spacing.sm },
  responseButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  responseText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  chipTextSelected: { color: colors.surface },
  incidentOptions: { gap: spacing.sm },
  incidentOption: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  incidentOptionUrgent: { borderColor: colors.error },
  incidentOptionIcon: { fontSize: 17 },
  incidentOptionText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  closedText: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
