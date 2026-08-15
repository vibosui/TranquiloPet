import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type PetCardProps = {
  name: string;
  species: string;
  breed?: string;
  detail?: string;
  photoUri?: string | null;
  careTags?: readonly string[];
  onPress?: () => void;
};

export function PetCard({
  name,
  species,
  breed,
  detail,
  photoUri,
  careTags = [],
  onPress,
}: PetCardProps) {
  const description = [species, breed, detail].filter(Boolean).join(' · ');
  const accessibilityLabel = [name, description, ...careTags].filter(Boolean).join(', ');
  const content = (
    <>
      {photoUri ? (
        <Image accessibilityElementsHidden source={{ uri: photoUri }} style={styles.photo} />
      ) : (
        <View accessibilityElementsHidden style={styles.photoFallback}>
          <Text style={styles.photoFallbackText}>🐾</Text>
        </View>
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <Text numberOfLines={2} style={styles.description}>
          {description || 'Informações do pet'}
        </Text>
        {careTags.length > 0 ? (
          <View style={styles.tags}>
            {careTags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text numberOfLines={1} style={styles.tagText}>
                  {tag}
                </Text>
              </View>
            ))}
            {careTags.length > 2 ? (
              <Text style={styles.moreTags}>+{careTags.length - 2}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {onPress ? (
        <Text accessibilityElementsHidden style={styles.chevron}>
          ›
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.card}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint="Abre os detalhes e opções de edição do pet"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 112,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.995 }],
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  photoFallback: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    fontSize: 28,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  description: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  tags: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tag: {
    maxWidth: 116,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.round,
    backgroundColor: colors.warningSoft,
  },
  tagText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  moreTags: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 28,
  },
});
