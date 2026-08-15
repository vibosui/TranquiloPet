import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type MediaAssetInput = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export interface MediaRepository {
  persist(asset: MediaAssetInput): Promise<string>;
  remove(uri: string): Promise<void>;
  isManaged(uri: string): boolean;
}

type MediaFileSystem = {
  documentDirectoryUri(): string;
  ensureDirectory(uri: string): void;
  copy(sourceUri: string, destinationUri: string): void;
  exists(uri: string): boolean;
  delete(uri: string): void;
};

type LocalMediaRepositoryOptions = {
  fileSystem?: MediaFileSystem;
  platform?: string;
  createId?: () => string;
};

const MEDIA_DIRECTORY_NAME = 'tranquilo-pet-media';
const allowedExtensions = new Set(['gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);

const expoFileSystem: MediaFileSystem = {
  documentDirectoryUri: () => Paths.document.uri,
  ensureDirectory: (uri) => new Directory(uri).create({ idempotent: true, intermediates: true }),
  copy: (sourceUri, destinationUri) => new File(sourceUri).copy(new File(destinationUri)),
  exists: (uri) => new File(uri).exists,
  delete: (uri) => new File(uri).delete(),
};

function joinUri(base: string, name: string) {
  return `${base.replace(/\/+$/, '')}/${name.replace(/^\/+/, '')}`;
}

function extensionFor(asset: MediaAssetInput) {
  const candidate = asset.fileName || asset.uri.split(/[?#]/, 1)[0];
  const match = candidate.match(/\.([a-zA-Z0-9]{2,5})$/);
  const extension = match?.[1].toLowerCase();
  if (extension && allowedExtensions.has(extension)) return extension;

  const mimeSubtype = asset.mimeType?.split('/')[1]?.toLowerCase();
  if (mimeSubtype && allowedExtensions.has(mimeSubtype)) return mimeSubtype;
  return 'jpg';
}

export class LocalMediaRepository implements MediaRepository {
  private readonly fileSystem: MediaFileSystem;
  private readonly platform: string;
  private readonly createId: () => string;

  constructor(options: LocalMediaRepositoryOptions = {}) {
    this.fileSystem = options.fileSystem ?? expoFileSystem;
    this.platform = options.platform ?? Platform.OS;
    this.createId =
      options.createId ??
      (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }

  async persist(asset: MediaAssetInput): Promise<string> {
    const uri = asset.uri.trim();
    if (!uri) throw new Error('A imagem selecionada não possui um endereço local válido.');

    // O navegador gerencia blobs/arquivos de outra forma. A cópia persistente deste
    // laboratório é aplicada somente nos dispositivos nativos usados com Expo Go.
    if (this.platform === 'web' || this.isManaged(uri)) return uri;

    const directoryUri = this.managedDirectoryUri();
    this.fileSystem.ensureDirectory(directoryUri);
    const destinationUri = joinUri(
      directoryUri,
      `${this.createId()}.${extensionFor(asset)}`,
    );
    this.fileSystem.copy(uri, destinationUri);
    return destinationUri;
  }

  async remove(uri: string): Promise<void> {
    if (this.platform === 'web' || !this.isManaged(uri)) return;
    if (this.fileSystem.exists(uri)) this.fileSystem.delete(uri);
  }

  isManaged(uri: string): boolean {
    if (!uri || this.platform === 'web') return false;
    const prefix = `${this.managedDirectoryUri().replace(/\/+$/, '')}/`;
    return uri.startsWith(prefix);
  }

  private managedDirectoryUri() {
    return joinUri(this.fileSystem.documentDirectoryUri(), MEDIA_DIRECTORY_NAME);
  }
}

export const localMediaRepository = new LocalMediaRepository();
