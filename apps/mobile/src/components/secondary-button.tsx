import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
};

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  destructive = false,
  accessibilityHint,
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructiveButton,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={destructive ? colors.error : colors.primary} />
      ) : (
        <Text style={[styles.label, destructive && styles.destructiveLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButton: {
    borderColor: colors.error,
  },
  buttonPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  destructiveLabel: {
    color: colors.error,
  },
});
