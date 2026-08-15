import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { PhotoPickerField } from '@/components/photo-picker-field';
import type {
  MediaAssetInput,
  MediaRepository,
} from '@/features/media/local-media-repository';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('<PhotoPickerField />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMediaRepository() {
    const persist = jest.fn(async (asset: MediaAssetInput) => `managed:${asset.uri}`);
    const remove = jest.fn(async () => undefined);
    const mediaRepository: MediaRepository = {
      persist,
      remove,
      isManaged: jest.fn(() => true),
    };
    return { mediaRepository, persist, remove };
  }

  test('opens the system gallery directly and persists the primary photo', async () => {
    const onChange = jest.fn();
    const media = createMediaRepository();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file://primary.jpg',
          fileName: 'primary.jpg',
          mimeType: 'image/jpeg',
          width: 100,
          height: 100,
        },
      ],
    });
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: null, additional: [] }}
        onChange={onChange}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto principal' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        primary: 'managed:file://primary.jpg',
        additional: [],
      });
    });
    expect(media.persist).toHaveBeenCalledWith({
      uri: 'file://primary.jpg',
      fileName: 'primary.jpg',
      mimeType: 'image/jpeg',
    });
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsMultipleSelection: false }),
    );
  });

  test('keeps the value unchanged when the system picker is canceled', async () => {
    const onChange = jest.fn();
    const media = createMediaRepository();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: null, additional: [] }}
        onChange={onChange}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto principal' }));

    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
    expect(media.persist).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows an accessible error when the gallery cannot be opened', async () => {
    const media = createMediaRepository();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValue(new Error('picker failed'));
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: null, additional: [] }}
        onChange={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto principal' }));

    expect(await screen.findByText('Não foi possível abrir a galeria. Tente novamente.')).toBeTruthy();
  });

  test('removes an additional photo from the draft without deleting a saved file', async () => {
    const onChange = jest.fn();
    const media = createMediaRepository();
    const additional = Array.from({ length: 5 }, (_, index) => `file://photo-${index}.jpg`);
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: 'file://primary.jpg', additional }}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Adicionar fotos da galeria' }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.press(screen.getByRole('button', { name: 'Remover foto adicional 1' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        primary: 'file://primary.jpg',
        additional: additional.slice(1),
      });
    });
    expect(media.remove).not.toHaveBeenCalled();
  });

  test('keeps the saved primary file when replacement still belongs to an unsaved draft', async () => {
    const onChange = jest.fn();
    const media = createMediaRepository();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://new.jpg', width: 100, height: 100 }],
    });
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: 'managed:file://old.jpg', additional: [] }}
        onChange={onChange}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Trocar foto principal' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        primary: 'managed:file://new.jpg',
        additional: [],
      });
    });
    expect(media.remove).not.toHaveBeenCalled();
  });

  test('cleans up a newly selected primary when it is replaced in the same draft', async () => {
    const onChange = jest.fn();
    const media = createMediaRepository();
    jest.mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://first.jpg', width: 100, height: 100 }],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://second.jpg', width: 100, height: 100 }],
      });
    const screen = await render(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: null, additional: [] }}
        onChange={onChange}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto principal' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    await screen.rerender(
      <PhotoPickerField
        mediaRepository={media.mediaRepository}
        value={{ primary: 'managed:file://first.jpg', additional: [] }}
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Trocar foto principal' }));

    await waitFor(() => {
      expect(media.remove).toHaveBeenCalledWith('managed:file://first.jpg');
      expect(onChange).toHaveBeenLastCalledWith({
        primary: 'managed:file://second.jpg',
        additional: [],
      });
    });
  });
});
