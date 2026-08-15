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
};

export const FormField = forwardRef<TextInput, FormFieldProps>(
  ({ label, error, style, ...inputProps }, ref) => {
    const generatedId = useId().replace(/:/g, '');
    const errorId = `field-error-${generatedId}`;

    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, error && styles.inputError, style]}
          {...inputProps}
        />
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
  error: {
    color: colors.error,
    fontSize: 13,
  },
});
