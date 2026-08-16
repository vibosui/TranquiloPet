import type { PropsWithChildren, ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme/tokens';

type ScreenShellProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewRef?: Ref<ScrollView>;
  testID?: string;
}>;

export function ScreenShell({
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel = 'Voltar',
  headerRight,
  footer,
  contentContainerStyle,
  scrollViewRef,
  testID,
  children,
}: ScreenShellProps) {
  const hasHeader = Boolean(onBack || headerRight || title || eyebrow || subtitle);
  const hasHeaderActions = Boolean(onBack || headerRight);

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled">
          {hasHeader ? (
            <View style={styles.header}>
              {hasHeaderActions ? (
                <View style={styles.headerActions}>
                  {onBack ? (
                    <Pressable
                      accessibilityLabel={backLabel}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={onBack}
                      style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.backButtonPressed,
                      ]}>
                      <Text accessibilityElementsHidden style={styles.backIcon}>
                        ‹
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  {headerRight}
                </View>
              ) : null}

              {eyebrow || title || subtitle ? (
                <View style={styles.heading}>
                  {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                  {title ? (
                    <Text accessibilityRole="header" style={styles.title}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    minWidth: 0,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    width: '100%',
    minWidth: 0,
    paddingBottom: spacing.xl,
  },
  headerActions: {
    width: '100%',
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  backIcon: {
    marginTop: -3,
    color: colors.text,
    fontSize: 32,
    lineHeight: 34,
  },
  heading: {
    width: '100%',
    minWidth: 0,
    paddingTop: spacing.md,
  },
  eyebrow: {
    marginBottom: spacing.sm,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    gap: spacing.lg,
  },
  footer: {
    width: '100%',
    minWidth: 0,
    paddingTop: spacing.xl,
  },
});
