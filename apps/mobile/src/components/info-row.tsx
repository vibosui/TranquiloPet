import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

type InfoRowProps = {
  label: string;
  value?: ReactNode;
  emptyValue?: string;
  last?: boolean;
};

export function InfoRow({ label, value, emptyValue = 'Não informado', last = false }: InfoRowProps) {
  const renderedValue = value ?? emptyValue;

  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      {typeof renderedValue === 'string' || typeof renderedValue === 'number' ? (
        <Text style={[styles.value, value == null && styles.emptyValue]}>{renderedValue}</Text>
      ) : (
        <View style={styles.customValue}>{renderedValue}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  label: {
    flex: 0.42,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    flex: 0.58,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  emptyValue: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  customValue: {
    flex: 0.58,
    alignItems: 'flex-end',
  },
});
