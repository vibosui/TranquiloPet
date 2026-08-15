import { useId, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme/tokens';

import { filterLocationOptions } from '../location-catalog';

export type SearchSelectOption = Readonly<{
  key: string;
  label: string;
  searchText?: string;
}>;

type SearchSelectFieldProps<T extends SearchSelectOption> = {
  label: string;
  options: readonly T[];
  selectedKey?: string;
  selectedLabel?: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  disabledHint?: string;
  error?: string;
  maxSearchResults?: number;
  testID?: string;
  onSelect: (option: T) => void;
};

export function SearchSelectField<T extends SearchSelectOption>({
  label,
  options,
  selectedKey,
  selectedLabel,
  placeholder,
  searchPlaceholder = 'Digite para buscar',
  emptyMessage = 'Nenhuma opção encontrada.',
  disabled = false,
  disabledHint,
  error,
  maxSearchResults = 80,
  testID,
  onSelect,
}: SearchSelectFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const generatedId = useId().replace(/:/g, '');
  const errorId = `select-error-${generatedId}`;

  const filteredOptions = useMemo(
    () =>
      filterLocationOptions(
        options,
        query,
        (option) => option.searchText ?? option.label,
        query.trim() ? maxSearchResults : options.length,
      ),
    [maxSearchResults, options, query],
  );

  function openSelector() {
    if (disabled) return;
    setQuery('');
    setIsOpen(true);
  }

  function closeSelector() {
    setIsOpen(false);
    setQuery('');
  }

  function selectOption(option: T) {
    onSelect(option);
    closeSelector();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: isOpen }}
        accessibilityValue={{ text: selectedLabel ?? placeholder }}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onPress={openSelector}
        testID={testID ? `${testID}-trigger` : undefined}
        style={({ pressed }) => [
          styles.trigger,
          error && styles.triggerError,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.triggerText, !selectedLabel && styles.placeholder, disabled && styles.muted]}>
          {selectedLabel ?? placeholder}
        </Text>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
          ▾
        </Text>
      </Pressable>

      {disabled && disabledHint ? <Text style={styles.hint}>{disabledHint}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" nativeID={errorId} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={closeSelector}
        presentationStyle="pageSheet"
        visible={isOpen}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalEyebrow}>SELECIONAR</Text>
              <Text style={styles.modalTitle}>{label}</Text>
            </View>
            <Pressable
              accessibilityLabel={`Fechar seleção de ${label}`}
              accessibilityRole="button"
              hitSlop={12}
              onPress={closeSelector}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              accessibilityLabel={`Buscar ${label}`}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              testID={testID ? `${testID}-search` : undefined}
              value={query}
              style={styles.searchInput}
            />
          </View>

          <FlatList
            contentContainerStyle={
              filteredOptions.length === 0 ? styles.emptyListContent : styles.listContent
            }
            data={filteredOptions}
            initialNumToRender={20}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.key}
            ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
            renderItem={({ item }) => {
              const selected = item.key === selectedKey;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => selectOption(item)}
                  testID={testID ? `${testID}-option-${item.key}` : undefined}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {item.label}
                  </Text>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
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
  trigger: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  triggerError: {
    borderColor: colors.error,
  },
  triggerDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.72,
  },
  triggerText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: colors.textMuted,
  },
  muted: {
    color: colors.textMuted,
  },
  chevron: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeading: {
    flex: 1,
    gap: spacing.xs,
  },
  modalEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 30,
  },
  searchContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchInput: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionPressed: {
    opacity: 0.76,
  },
  optionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  checkmark: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
});
