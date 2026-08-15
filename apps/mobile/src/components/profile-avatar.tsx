import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/theme/tokens';

type ProfileAvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
};

export function ProfileAvatar({ name, uri, size = 88 }: ProfileAvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (uri) {
    return (
      <Image
        accessibilityLabel={`Foto de perfil de ${name}`}
        source={{ uri }}
        style={[styles.image, { width: size, height: size }]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`Perfil de ${name}, sem foto`}
      style={[styles.fallback, { width: size, height: size }]}>
      <Text style={[styles.initials, { fontSize: Math.max(18, size * 0.3) }]}>{initials || 'TP'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: radii.round,
    backgroundColor: colors.surfaceMuted,
  },
  fallback: {
    borderRadius: radii.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primary,
    fontWeight: '900',
  },
});

