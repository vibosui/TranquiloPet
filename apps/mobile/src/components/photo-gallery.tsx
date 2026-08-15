import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

type PhotoGalleryProps = {
  uris: readonly string[];
  emptyText?: string;
};

export function PhotoGallery({
  uris,
  emptyText = 'Nenhuma foto adicional cadastrada.',
}: PhotoGalleryProps) {
  if (!uris.length) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <View style={styles.grid}>
      {uris.map((uri, index) => (
        <Image
          accessibilityLabel={`Foto adicional ${index + 1}`}
          key={`${uri}-${index}`}
          source={{ uri }}
          style={styles.image}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
});

