import { StyleSheet, Text, Pressable, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

export type TagOption = {
  value: string;
  label: string;
  description?: string;
};

type TagSelectorProps = {
  label: string;
  options: readonly TagOption[];
  selectedValues: readonly string[];
  onChange: (values: string[]) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  maxSelected?: number;
};

export function TagSelector({
  label,
  options,
  selectedValues,
  onChange,
  hint,
  error,
  disabled = false,
  maxSelected,
}: TagSelectorProps) {
  const selected = new Set(selectedValues);
  const isSingleChoice = maxSelected === 1;

  function toggleTag(value: string) {
    if (disabled) return;
    if (isSingleChoice) {
      if (!selected.has(value)) onChange([value]);
      return;
    }
    if (selected.has(value)) {
      onChange(selectedValues.filter((selectedValue) => selectedValue !== value));
      return;
    }
    if (maxSelected !== undefined && selectedValues.length >= maxSelected) return;
    onChange([...selectedValues, value]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View
        accessibilityLabel={label}
        accessibilityRole={isSingleChoice ? 'radiogroup' : 'list'}
        style={styles.tags}>
        {options.map((option) => {
          const isSelected = selected.has(option.value);
          const reachedLimit =
            !isSingleChoice &&
            maxSelected !== undefined &&
            selectedValues.length >= maxSelected &&
            !isSelected;
          const isDisabled = disabled || reachedLimit;

          return (
            <Pressable
              accessibilityHint={option.description}
              accessibilityLabel={option.label}
              accessibilityRole={isSingleChoice ? 'radio' : 'checkbox'}
              accessibilityState={
                isSingleChoice
                  ? { checked: isSelected, disabled: isDisabled, selected: isSelected }
                  : { checked: isSelected, disabled: isDisabled }
              }
              disabled={isDisabled}
              key={option.value}
              onPress={() => toggleTag(option.value)}
              style={({ pressed }) => [
                styles.tag,
                isSelected && styles.tagSelected,
                pressed && !isDisabled && styles.tagPressed,
                isDisabled && styles.tagDisabled,
              ]}>
              <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                {isSelected ? '✓ ' : ''}
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  copy: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  tagPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  tagDisabled: {
    opacity: 0.45,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tagTextSelected: {
    color: colors.primary,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
});
