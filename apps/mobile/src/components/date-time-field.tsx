import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { colors, radii, spacing } from '@/theme/tokens';

type PickerMode = 'date' | 'time' | 'datetime';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: PickerMode;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

const pad = (value: number) => String(value).padStart(2, '0');

export function serializePickerValue(date: Date, mode: PickerMode) {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (mode === 'date') return datePart;
  if (mode === 'time') return timePart;
  return `${datePart} ${timePart}`;
}

export function parsePickerValue(value: string, mode: PickerMode) {
  const normalized = value.trim();
  if (!normalized) return null;

  if (mode === 'date') {
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    if (
      date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])
    ) {
      return null;
    }
    return date;
  }

  if (mode === 'time') {
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  );
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3]) ||
    date.getHours() !== Number(match[4]) ||
    date.getMinutes() !== Number(match[5])
  ) {
    return null;
  }
  return date;
}

function displayValue(value: string, mode: PickerMode) {
  const parsed = parsePickerValue(value, mode);
  if (!parsed) return value;

  if (mode === 'date') {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(parsed);
  }
  if (mode === 'time') {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsed);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  }).format(parsed);
}

function withTime(date: Date, timeSource: Date) {
  const next = new Date(date);
  next.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return next;
}

export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  required = false,
  error,
  hint,
  placeholder,
  minimumDate,
  maximumDate,
  disabled = false,
}: DateTimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosStep, setIosStep] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');
  const [iosDraft, setIosDraft] = useState<Date>(() => parsePickerValue(value, mode) ?? new Date());

  if (Platform.OS === 'web') {
    return (
      <FormField
        required={required}
        editable={!disabled}
        label={label}
        hint={hint}
        error={error}
        placeholder={
          placeholder ?? (mode === 'date' ? 'AAAA-MM-DD' : mode === 'time' ? 'HH:mm' : 'AAAA-MM-DD HH:mm')
        }
        value={value}
        onChangeText={onChange}
      />
    );
  }

  function initialDate() {
    return parsePickerValue(value, mode) ?? new Date();
  }

  function commit(date: Date) {
    onChange(serializePickerValue(date, mode));
  }

  function openAndroid() {
    const initial = initialDate();

    if (mode === 'date') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) commit(selected);
        },
      });
      return;
    }

    if (mode === 'time') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'time',
        is24Hour: true,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) commit(selected);
        },
      });
      return;
    }

    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type !== 'set' || !selectedDate) return;
        const dateWithExistingTime = withTime(selectedDate, initial);
        DateTimePickerAndroid.open({
          value: dateWithExistingTime,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== 'set' || !selectedTime) return;
            commit(withTime(dateWithExistingTime, selectedTime));
          },
        });
      },
    });
  }

  function openPicker() {
    if (disabled) return;
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }

    const nextDraft = initialDate();
    setIosDraft(nextDraft);
    setIosStep(mode === 'time' ? 'time' : 'date');
    setIosOpen(true);
  }

  function handleIosChange(_: DateTimePickerEvent, selected?: Date) {
    if (selected) setIosDraft(selected);
  }

  function confirmIos() {
    if (mode === 'datetime' && iosStep === 'date') {
      setIosStep('time');
      return;
    }
    commit(iosDraft);
    setIosOpen(false);
  }

  const display = value ? displayValue(value, mode) : placeholder ?? 'Selecionar';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityLabel={`${label}${required ? ', obrigatório' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.field,
          error && styles.fieldError,
          pressed && styles.fieldPressed,
          disabled && styles.disabled,
        ]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{display}</Text>
        <Text accessibilityElementsHidden style={styles.glyph}>
          {mode === 'time' ? '◷' : '▣'}
        </Text>
      </Pressable>

      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {Platform.OS === 'ios' && iosOpen ? (
        <View style={styles.iosPanel}>
          <Text style={styles.iosTitle}>
            {mode === 'datetime' && iosStep === 'date'
              ? 'Escolha a data'
              : mode === 'datetime'
                ? 'Agora escolha o horário'
                : mode === 'date'
                  ? 'Escolha a data'
                  : 'Escolha o horário'}
          </Text>
          <DateTimePicker
            display={iosStep === 'date' ? 'inline' : 'spinner'}
            maximumDate={iosStep === 'date' ? maximumDate : undefined}
            minimumDate={iosStep === 'date' ? minimumDate : undefined}
            mode={iosStep}
            value={iosDraft}
            onChange={handleIosChange}
          />
          <View style={styles.iosActions}>
            <Pressable onPress={() => setIosOpen(false)} style={styles.iosAction}>
              <Text style={styles.iosCancel}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirmIos} style={[styles.iosAction, styles.iosActionPrimary]}>
              <Text style={styles.iosConfirm}>
                {mode === 'datetime' && iosStep === 'date' ? 'Escolher horário' : 'Concluir'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  required: {
    color: colors.error,
  },
  field: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldError: {
    borderColor: colors.error,
  },
  fieldPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.55,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: colors.textMuted,
  },
  glyph: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  iosPanel: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  iosTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  iosActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  iosAction: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosActionPrimary: {
    backgroundColor: colors.primary,
  },
  iosCancel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  iosConfirm: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '900',
  },
});
