import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, View, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function SectionCard({
  title,
  description,
  action,
  style,
  testID,
  children,
}: SectionCardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {title || description || action ? (
        <View style={styles.header}>
          <View style={styles.headingCopy}>
            {title ? (
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  header: {
    width: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  description: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    width: '100%',
    minWidth: 0,
    gap: spacing.md,
  },
});
