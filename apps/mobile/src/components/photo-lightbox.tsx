import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme/tokens';

type PhotoLightboxProps = {
  uri: string | null;
  caption?: string | null;
  onClose: () => void;
};

export function PhotoLightbox({ uri, caption, onClose }: PhotoLightboxProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={Boolean(uri)}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <Text numberOfLines={2} style={styles.caption}>
            {caption || 'Foto da hospedagem'}
          </Text>
          <Pressable
            accessibilityLabel="Fechar foto"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Fechar ×</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.imageArea}>
          {uri ? <Image resizeMode="contain" source={{ uri }} style={styles.image} /> : null}
        </Pressable>

        <Text style={styles.hint}>Toque fora da imagem para fechar.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.92)',
    gap: spacing.md,
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  caption: {
    flex: 1,
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  closeButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.round,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hint: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
