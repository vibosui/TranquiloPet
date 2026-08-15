import { forwardRef, useId } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(
  (
    {
      label,
      error,
      hint,
      required = false,
      style,
      accessibilityLabel,
      ...inputProps
    },
    ref,
  ) => {
    const generatedId = useId().replace(/:/g, '');
    const errorId = `field-error-${generatedId}`;

    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel ?? `${label}${required ? ', obrigatório' : ''}`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, inputProps.multiline && styles.inputMultiline, error && styles.inputError, style]}
          {...inputProps}
        />
        {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
        {error ? (
          <Text accessibilityLiveRegion="polite" nativeID={errorId} style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

FormField.displayName = 'FormField';

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
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
