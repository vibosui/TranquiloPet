import { LocalMediaRepository } from '@/features/media/local-media-repository';

function createFileSystem() {
  const files = new Set<string>();
  return {
    files,
    api: {
      documentDirectoryUri: jest.fn(() => 'file:///documents/'),
      ensureDirectory: jest.fn(),
      copy: jest.fn((_source: string, destination: string) => files.add(destination)),
      exists: jest.fn((uri: string) => files.has(uri)),
      delete: jest.fn((uri: string) => files.delete(uri)),
    },
  };
}

describe('LocalMediaRepository', () => {
  test('copies a selected image to the persistent document directory', async () => {
    const fileSystem = createFileSystem();
    const repository = new LocalMediaRepository({
      fileSystem: fileSystem.api,
      platform: 'android',
      createId: () => 'photo-1',
    });

    const uri = await repository.persist({
      uri: 'file:///cache/source.tmp',
      fileName: 'pet.PNG',
      mimeType: 'image/png',
    });

    expect(uri).toBe('file:///documents/tranquilo-pet-media/photo-1.png');
    expect(fileSystem.api.ensureDirectory).toHaveBeenCalledWith(
      'file:///documents/tranquilo-pet-media',
    );
    expect(fileSystem.api.copy).toHaveBeenCalledWith('file:///cache/source.tmp', uri);
    expect(repository.isManaged(uri)).toBe(true);
  });

  test('deletes only files managed by the app', async () => {
    const fileSystem = createFileSystem();
    const managedUri = 'file:///documents/tranquilo-pet-media/photo-1.jpg';
    fileSystem.files.add(managedUri);
    const repository = new LocalMediaRepository({
      fileSystem: fileSystem.api,
      platform: 'ios',
    });

    await repository.remove('file:///cache/not-managed.jpg');
    await repository.remove(managedUri);

    expect(fileSystem.api.delete).toHaveBeenCalledTimes(1);
    expect(fileSystem.api.delete).toHaveBeenCalledWith(managedUri);
  });

  test('keeps browser URIs untouched', async () => {
    const fileSystem = createFileSystem();
    const repository = new LocalMediaRepository({
      fileSystem: fileSystem.api,
      platform: 'web',
    });

    await expect(repository.persist({ uri: 'blob:preview' })).resolves.toBe('blob:preview');
    expect(fileSystem.api.copy).not.toHaveBeenCalled();
  });
});
