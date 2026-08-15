import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  localMediaRepository,
  type MediaRepository,
} from '@/features/media/local-media-repository';
import { colors, radii, spacing } from '@/theme/tokens';

export type PhotoSelection = {
  primary: string | null;
  additional: string[];
};

type PhotoPickerFieldProps = {
  label?: string;
  value: PhotoSelection;
  onChange: (value: PhotoSelection) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  maxAdditional?: number;
  mediaRepository?: MediaRepository;
};

type PickerTarget = 'primary' | 'additional';

const MAX_ADDITIONAL_PHOTOS = 5;

export function PhotoPickerField({
  label = 'Fotos',
  value,
  onChange,
  hint = 'Escolha imagens da galeria. A câmera e o envio para a nuvem estão desativados.',
  error,
  disabled = false,
  maxAdditional = MAX_ADDITIONAL_PHOTOS,
  mediaRepository = localMediaRepository,
}: PhotoPickerFieldProps) {
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<PickerTarget | null>(null);
  const pickerInFlightRef = useRef(false);
  const initialUrisRef = useRef<ReadonlySet<string> | null>(null);
  const initialUris =
    initialUrisRef.current ??
    new Set([value.primary, ...value.additional].filter(Boolean) as string[]);
  initialUrisRef.current = initialUris;
  const additionalLimit = Math.min(Math.max(maxAdditional, 0), MAX_ADDITIONAL_PHOTOS);
  const additionalPhotos = value.additional.slice(0, additionalLimit);
  const remainingSlots = additionalLimit - additionalPhotos.length;

  async function requestPhotos(target: PickerTarget) {
    if (disabled || pickerInFlightRef.current) return;
    if (target === 'additional' && remainingSlots <= 0) return;

    pickerInFlightRef.current = true;
    setBusyTarget(target);
    setPickerError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: target === 'additional',
        selectionLimit: target === 'additional' ? remainingSlots : 1,
        orderedSelection: target === 'additional',
        quality: 0.85,
      });

      if (result.canceled) return;

      if (target === 'primary') {
        const selectedAsset = result.assets[0];
        if (!selectedAsset?.uri) return;

        const primary = await mediaRepository.persist({
          uri: selectedAsset.uri,
          fileName: selectedAsset.fileName,
          mimeType: selectedAsset.mimeType,
        });
        const nextAdditional = additionalPhotos.filter((uri) => uri !== primary);
        const previousPrimary = value.primary;
        if (
          previousPrimary &&
          previousPrimary !== primary &&
          !nextAdditional.includes(previousPrimary) &&
          !initialUris.has(previousPrimary)
        ) {
          try {
            await mediaRepository.remove(previousPrimary);
          } catch (removalError) {
            await mediaRepository.remove(primary).catch(() => undefined);
            throw removalError;
          }
        }
        onChange({ primary, additional: nextAdditional });
        return;
      }

      const existingUris = new Set([value.primary, ...additionalPhotos].filter(Boolean));
      const selectedSourceUris = new Set(existingUris);
      const selectedAssets = result.assets
        .filter((asset) => {
          if (!asset.uri || selectedSourceUris.has(asset.uri)) return false;
          selectedSourceUris.add(asset.uri);
          return true;
        })
        .slice(0, remainingSlots);
      const persistedUris: string[] = [];
      try {
        for (const asset of selectedAssets) {
          persistedUris.push(
            await mediaRepository.persist({
              uri: asset.uri,
              fileName: asset.fileName,
              mimeType: asset.mimeType,
            }),
          );
        }
      } catch (persistenceError) {
        await Promise.allSettled(persistedUris.map((uri) => mediaRepository.remove(uri)));
        throw persistenceError;
      }

      const nextUris = persistedUris.filter((uri) => {
        if (existingUris.has(uri)) return false;
        existingUris.add(uri);
        return true;
      });
      onChange({
        primary: value.primary,
        additional: [...additionalPhotos, ...nextUris].slice(0, additionalLimit),
      });
    } catch {
      setPickerError('Não foi possível abrir a galeria. Tente novamente.');
    } finally {
      pickerInFlightRef.current = false;
      setBusyTarget(null);
    }
  }

  async function removePhoto(uri: string, target: PickerTarget, nextValue: PhotoSelection) {
    if (disabled || pickerInFlightRef.current) return;

    pickerInFlightRef.current = true;
    setBusyTarget(target);
    setPickerError(null);
    try {
      // Uma URI que já existia ao abrir o formulário pode continuar referenciada
      // no banco caso o usuário descarte o rascunho. Ela só deixa de aparecer no
      // draft; não apagamos o arquivo antecipadamente.
      if (!initialUris.has(uri)) await mediaRepository.remove(uri);
      onChange(nextValue);
    } catch {
      setPickerError('Não foi possível remover a foto. Tente novamente.');
    } finally {
      pickerInFlightRef.current = false;
      setBusyTarget(null);
    }
  }

  function removePrimary() {
    if (!value.primary) return;
    void removePhoto(value.primary, 'primary', {
      primary: null,
      additional: additionalPhotos,
    });
  }

  function removeAdditional(uriToRemove: string) {
    void removePhoto(uriToRemove, 'additional', {
      primary: value.primary,
      additional: additionalPhotos.filter((uri) => uri !== uriToRemove),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.label}>
          {label}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View style={styles.primarySection}>
        <Text style={styles.subheading}>Foto principal</Text>
        {value.primary ? (
          <View style={styles.primaryPreview}>
            <Image
              accessibilityLabel="Prévia da foto principal"
              source={{ uri: value.primary }}
              style={styles.primaryImage}
            />
            <View style={styles.photoActions}>
              <PhotoAction
                disabled={disabled || busyTarget !== null}
                label="Trocar foto principal"
                onPress={() => void requestPhotos('primary')}
              />
              <PhotoAction
                destructive
                disabled={disabled || busyTarget !== null}
                label="Remover foto principal"
                onPress={removePrimary}
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityHint="Abre a galeria do aparelho"
            accessibilityLabel="Escolher foto principal"
            accessibilityRole="button"
            accessibilityState={{ busy: busyTarget === 'primary', disabled }}
            disabled={disabled || busyTarget !== null}
            onPress={() => void requestPhotos('primary')}
            style={({ pressed }) => [
              styles.emptyPrimary,
              pressed && styles.pickerPressed,
              disabled && styles.disabled,
            ]}>
            {busyTarget === 'primary' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text accessibilityElementsHidden style={styles.photoGlyph}>
                  +
                </Text>
                <Text style={styles.emptyPrimaryLabel}>Escolher foto principal</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.additionalSection}>
        <View style={styles.additionalHeading}>
          <Text style={styles.subheading}>Fotos adicionais</Text>
          <Text style={styles.counter}>
            {additionalPhotos.length}/{additionalLimit}
          </Text>
        </View>

        {additionalPhotos.length > 0 ? (
          <View style={styles.photoGrid}>
            {additionalPhotos.map((uri, index) => (
              <View key={uri} style={styles.additionalPhoto}>
                <Image
                  accessibilityLabel={`Prévia da foto adicional ${index + 1}`}
                  source={{ uri }}
                  style={styles.additionalImage}
                />
                <Pressable
                  accessibilityLabel={`Remover foto adicional ${index + 1}`}
                  accessibilityRole="button"
                  disabled={disabled || busyTarget !== null}
                  hitSlop={6}
                  onPress={() => removeAdditional(uri)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.removeButtonPressed,
                  ]}>
                  <Text accessibilityElementsHidden style={styles.removeButtonText}>
                    ×
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyAdditional}>Nenhuma foto adicional selecionada.</Text>
        )}

        <Pressable
          accessibilityHint="Permite escolher uma ou mais imagens da galeria"
          accessibilityLabel="Adicionar fotos da galeria"
          accessibilityRole="button"
          accessibilityState={{
            busy: busyTarget === 'additional',
            disabled: disabled || remainingSlots <= 0,
          }}
          disabled={disabled || remainingSlots <= 0 || busyTarget !== null}
          onPress={() => void requestPhotos('additional')}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pickerPressed,
            (disabled || remainingSlots <= 0) && styles.disabled,
          ]}>
          {busyTarget === 'additional' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.addButtonLabel}>
              {remainingSlots > 0 ? 'Adicionar da galeria' : 'Limite de fotos atingido'}
            </Text>
          )}
        </Pressable>
      </View>

      {pickerError || error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {pickerError ?? error}
        </Text>
      ) : null}
    </View>
  );
}

type PhotoActionProps = {
  label: string;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
};

function PhotoAction({ label, onPress, disabled, destructive = false }: PhotoActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.photoAction, pressed && styles.pickerPressed]}>
      <Text style={[styles.photoActionLabel, destructive && styles.destructiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  primarySection: {
    gap: spacing.sm,
  },
  subheading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryPreview: {
    gap: spacing.sm,
  },
  primaryImage: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoAction: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  photoActionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  destructiveLabel: {
    color: colors.error,
  },
  emptyPrimary: {
    minHeight: 112,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoGlyph: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 32,
  },
  emptyPrimaryLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  additionalSection: {
    gap: spacing.md,
  },
  additionalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  additionalPhoto: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  additionalImage: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: radii.round,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    opacity: 0.8,
  },
  removeButtonText: {
    marginTop: -2,
    color: colors.surface,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  emptyAdditional: {
    color: colors.textMuted,
    fontSize: 13,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  pickerPressed: {
    backgroundColor: colors.primarySoft,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
  },
});
