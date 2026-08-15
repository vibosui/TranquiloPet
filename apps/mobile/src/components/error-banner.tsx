import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type ErrorBannerProps = {
  message: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ErrorBanner({
  message,
  title = 'Não foi possível concluir',
  actionLabel,
  onAction,
}: ErrorBannerProps) {
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.errorSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
  message: {
    marginTop: spacing.xs,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '900',
  },
});
