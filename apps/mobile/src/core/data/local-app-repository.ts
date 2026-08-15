import AsyncStorage from '@react-native-async-storage/async-storage';

import { featureFlags } from '@/config/feature-flags';
import { createDevelopmentSeed } from '@/core/data/dev-seed';
import {
  type AppDatabase,
  type CaregiverPrivateData,
  type CaregiverProfile,
  type DemoSession,
  type Location,
  type Pet,
  type PhotoCollection,
  type RegisterUserInput,
  type TutorProfile,
  type UpsertCaregiverPrivateDataInput,
  type UpsertCaregiverProfileInput,
  type UpsertPetInput,
  type UpsertTutorProfileInput,
  type User,
} from '@/core/domain/entities';

export const LOCAL_DATABASE_KEY = '@tranquilo-pet/dev/database/v1';
export const LOCAL_SESSION_KEY = '@tranquilo-pet/dev/session/v1';

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type LocalAppRepositoryOptions = {
  storage?: KeyValueStorage;
  now?: () => string;
  createId?: (prefix: 'user' | 'pet') => string;
};

export interface AppDataRepository {
  initialize(): Promise<AppDatabase>;
  getDatabase(): Promise<AppDatabase>;
  getSession(): Promise<DemoSession | null>;
  saveSession(session: DemoSession): Promise<DemoSession>;
  clearSession(): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  listUsers(): Promise<User[]>;
  registerUser(input: RegisterUserInput): Promise<User>;
  getTutorProfileByUserId(userId: string): Promise<TutorProfile | null>;
  listTutorProfiles(): Promise<TutorProfile[]>;
  upsertTutorProfile(input: UpsertTutorProfileInput): Promise<TutorProfile>;
  getCaregiverProfileByUserId(userId: string): Promise<CaregiverProfile | null>;
  getCaregiverPrivateDataByUserId(userId: string): Promise<CaregiverPrivateData | null>;
  listCaregiverProfiles(): Promise<CaregiverProfile[]>;
  upsertCaregiverProfile(
    input: UpsertCaregiverProfileInput,
    privateInput?: UpsertCaregiverPrivateDataInput,
  ): Promise<{ profile: CaregiverProfile; privateData: CaregiverPrivateData | null }>;
  getPetById(id: string): Promise<Pet | null>;
  listPetsByOwner(ownerUserId: string): Promise<Pet[]>;
  upsertPet(input: UpsertPetInput): Promise<Pet>;
}

export class LocalAppRepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'local_demo_disabled'
      | 'invalid_database'
      | 'invalid_session'
      | 'duplicate_email'
      | 'duplicate_id'
      | 'user_not_found'
      | 'owner_mismatch',
  ) {
    super(message);
    this.name = 'LocalAppRepositoryError';
  }
}

function assertLocalDemoDataEnabled() {
  if (!featureFlags.localDemoData) {
    throw new LocalAppRepositoryError(
      'Os dados locais de demonstração não estão habilitados neste build.',
      'local_demo_disabled',
    );
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeMultilineText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeText)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhotos(photos: PhotoCollection | undefined): PhotoCollection {
  const profileUri = photos?.profileUri?.trim() || null;
  const galleryUris = [...new Set((photos?.galleryUris ?? []).map((uri) => uri.trim()).filter(Boolean))];

  return {
    profileUri,
    galleryUris: galleryUris.filter((uri) => uri !== profileUri),
  };
}

function normalizeLocation(location: Location): Location {
  return {
    stateIbgeId: location.stateIbgeId.trim(),
    stateCode: location.stateCode.trim().toUpperCase(),
    stateName: normalizeText(location.stateName),
    cityIbgeId: location.cityIbgeId.trim(),
    cityName: normalizeText(location.cityName),
  };
}

const LEGACY_MEDICATION_PREFIX = 'Medicação:';

type PersistedPet = Omit<Pet, 'medicationDetails'> & {
  medicationDetails?: unknown;
};

function hydratePet(pet: Pet): Pet {
  const persistedPet = pet as PersistedPet;
  if (typeof persistedPet.medicationDetails === 'string') {
    return {
      ...pet,
      medicationDetails: persistedPet.medicationDetails,
    };
  }

  const legacyNotes =
    typeof persistedPet.additionalNotes === 'string' ? persistedPet.additionalNotes : '';
  const lines = legacyNotes.replace(/\r\n?/g, '\n').split('\n');
  const medicationLineIndex = lines.findIndex((line) =>
    line.trimStart().startsWith(LEGACY_MEDICATION_PREFIX),
  );

  if (medicationLineIndex < 0) {
    return {
      ...pet,
      medicationDetails: '',
      additionalNotes: legacyNotes,
    };
  }

  const medicationLine = lines[medicationLineIndex].trimStart();
  return {
    ...pet,
    medicationDetails: medicationLine.slice(LEGACY_MEDICATION_PREFIX.length).trim(),
    additionalNotes: lines
      .filter((_, index) => index !== medicationLineIndex)
      .join('\n')
      .trim(),
  };
}

function hydrateDatabase(database: AppDatabase): AppDatabase {
  return {
    ...database,
    pets: database.pets.map(hydratePet),
  };
}

function isDatabase(value: unknown): value is AppDatabase {
  if (!value || typeof value !== 'object') return false;
  const database = value as Partial<AppDatabase>;

  return (
    database.schemaVersion === 1 &&
    database.seedVersion === 1 &&
    Array.isArray(database.users) &&
    Array.isArray(database.tutorProfiles) &&
    Array.isArray(database.caregiverProfiles) &&
    Array.isArray(database.caregiverPrivateData) &&
    Array.isArray(database.pets)
  );
}

function parseDatabase(raw: string): AppDatabase {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isDatabase(parsed)) return hydrateDatabase(parsed);
  } catch {
    // A mensagem pública abaixo é propositalmente estável e não inclui o conteúdo persistido.
  }

  throw new LocalAppRepositoryError(
    'Os dados locais são incompatíveis ou estão corrompidos.',
    'invalid_database',
  );
}

function parseSession(raw: string): DemoSession {
  try {
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (
      parsed.mode === 'demo' &&
      typeof parsed.userId === 'string' &&
      parsed.userId.length > 0 &&
      typeof parsed.signedInAt === 'string' &&
      parsed.signedInAt.length > 0
    ) {
      return {
        mode: 'demo',
        userId: parsed.userId,
        signedInAt: parsed.signedInAt,
      };
    }
  } catch {
    // A mensagem pública abaixo é propositalmente estável e não inclui o conteúdo persistido.
  }

  throw new LocalAppRepositoryError('A sessão local é inválida.', 'invalid_session');
}

export class LocalAppRepository implements AppDataRepository {
  private readonly storage: KeyValueStorage;
  private readonly now: () => string;
  private readonly createId: (prefix: 'user' | 'pet') => string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: LocalAppRepositoryOptions = {}) {
    assertLocalDemoDataEnabled();
    this.storage = options.storage ?? AsyncStorage;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId =
      options.createId ??
      ((prefix) =>
        `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async loadOrCreateDatabase(): Promise<AppDatabase> {
    const raw = await this.storage.getItem(LOCAL_DATABASE_KEY);
    if (raw !== null) {
      const hydratedDatabase = parseDatabase(raw);
      const hydratedRaw = JSON.stringify(hydratedDatabase);
      if (hydratedRaw !== raw) {
        await this.storage.setItem(LOCAL_DATABASE_KEY, hydratedRaw);
      }
      return hydratedDatabase;
    }

    const seed = createDevelopmentSeed();
    await this.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(seed));
    return seed;
  }

  private mutateDatabase<T>(mutation: (database: AppDatabase) => T): Promise<T> {
    return this.enqueue(async () => {
      const database = clone(await this.loadOrCreateDatabase());
      const result = mutation(database);
      await this.storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(database));
      return clone(result);
    });
  }

  initialize(): Promise<AppDatabase> {
    return this.getDatabase();
  }

  getDatabase(): Promise<AppDatabase> {
    return this.enqueue(async () => clone(await this.loadOrCreateDatabase()));
  }

  getSession(): Promise<DemoSession | null> {
    return this.enqueue(async () => {
      const raw = await this.storage.getItem(LOCAL_SESSION_KEY);
      return raw === null ? null : parseSession(raw);
    });
  }

  saveSession(session: DemoSession): Promise<DemoSession> {
    return this.enqueue(async () => {
      const database = await this.loadOrCreateDatabase();
      if (!database.users.some((user) => user.id === session.userId)) {
        throw new LocalAppRepositoryError('Usuário de demonstração não encontrado.', 'user_not_found');
      }

      const safeSession: DemoSession = {
        mode: 'demo',
        userId: session.userId,
        signedInAt: session.signedInAt,
      };
      await this.storage.setItem(LOCAL_SESSION_KEY, JSON.stringify(safeSession));
      return clone(safeSession);
    });
  }

  clearSession(): Promise<void> {
    return this.enqueue(async () => {
      await this.storage.removeItem(LOCAL_SESSION_KEY);
    });
  }

  async getUserById(id: string): Promise<User | null> {
    const database = await this.getDatabase();
    return database.users.find((user) => user.id === id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    const database = await this.getDatabase();
    return database.users.find((user) => user.email === normalizedEmail) ?? null;
  }

  async listUsers(): Promise<User[]> {
    return (await this.getDatabase()).users;
  }

  registerUser(input: RegisterUserInput): Promise<User> {
    return this.mutateDatabase((database) => {
      const email = normalizeEmail(input.email);
      if (database.users.some((user) => user.email === email)) {
        throw new LocalAppRepositoryError('Já existe um usuário com este e-mail.', 'duplicate_email');
      }

      const id = input.id?.trim() || this.createId('user');
      if (database.users.some((user) => user.id === id)) {
        throw new LocalAppRepositoryError('Já existe um usuário com este identificador.', 'duplicate_id');
      }

      const timestamp = this.now();
      const user: User = {
        id,
        fullName: normalizeText(input.fullName),
        email,
        phone: input.phone.replace(/\D/g, ''),
        photos: normalizePhotos(input.photos),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.users.push(user);
      return user;
    });
  }

  async getTutorProfileByUserId(userId: string): Promise<TutorProfile | null> {
    const database = await this.getDatabase();
    return database.tutorProfiles.find((profile) => profile.userId === userId) ?? null;
  }

  async listTutorProfiles(): Promise<TutorProfile[]> {
    return (await this.getDatabase()).tutorProfiles;
  }

  upsertTutorProfile(input: UpsertTutorProfileInput): Promise<TutorProfile> {
    return this.mutateDatabase((database) => {
      this.assertUserExists(database, input.userId);
      const existingIndex = database.tutorProfiles.findIndex(
        (profile) => profile.userId === input.userId,
      );
      const timestamp = this.now();
      const profile: TutorProfile = {
        userId: input.userId,
        location: normalizeLocation(input.location),
        bio: normalizeMultilineText(input.bio),
        photos: normalizePhotos(input.photos),
        createdAt:
          existingIndex >= 0 ? database.tutorProfiles[existingIndex].createdAt : timestamp,
        updatedAt: timestamp,
      };

      if (existingIndex >= 0) database.tutorProfiles[existingIndex] = profile;
      else database.tutorProfiles.push(profile);
      return profile;
    });
  }

  async getCaregiverProfileByUserId(userId: string): Promise<CaregiverProfile | null> {
    const database = await this.getDatabase();
    return database.caregiverProfiles.find((profile) => profile.userId === userId) ?? null;
  }

  async getCaregiverPrivateDataByUserId(userId: string): Promise<CaregiverPrivateData | null> {
    const database = await this.getDatabase();
    return database.caregiverPrivateData.find((data) => data.userId === userId) ?? null;
  }

  async listCaregiverProfiles(): Promise<CaregiverProfile[]> {
    return (await this.getDatabase()).caregiverProfiles;
  }

  upsertCaregiverProfile(
    input: UpsertCaregiverProfileInput,
    privateInput?: UpsertCaregiverPrivateDataInput,
  ): Promise<{ profile: CaregiverProfile; privateData: CaregiverPrivateData | null }> {
    return this.mutateDatabase((database) => {
      this.assertUserExists(database, input.userId);
      const existingIndex = database.caregiverProfiles.findIndex(
        (profile) => profile.userId === input.userId,
      );
      const timestamp = this.now();
      const profile: CaregiverProfile = {
        ...input,
        location: normalizeLocation(input.location),
        bio: normalizeMultilineText(input.bio),
        acceptedSpecies: [...new Set(input.acceptedSpecies)],
        acceptedSizes: [...new Set(input.acceptedSizes)],
        offeredServices: [...new Set(input.offeredServices)],
        availability: [...new Set(input.availability.map(normalizeText).filter(Boolean))],
        photos: normalizePhotos(input.photos),
        createdAt:
          existingIndex >= 0 ? database.caregiverProfiles[existingIndex].createdAt : timestamp,
        updatedAt: timestamp,
      };

      if (existingIndex >= 0) database.caregiverProfiles[existingIndex] = profile;
      else database.caregiverProfiles.push(profile);

      let privateData =
        database.caregiverPrivateData.find((data) => data.userId === input.userId) ?? null;
      if (privateInput) {
        const privateIndex = database.caregiverPrivateData.findIndex(
          (data) => data.userId === input.userId,
        );
        privateData = {
          userId: input.userId,
          cpf: privateInput.cpf.replace(/\D/g, ''),
          createdAt:
            privateIndex >= 0
              ? database.caregiverPrivateData[privateIndex].createdAt
              : timestamp,
          updatedAt: timestamp,
        };
        if (privateIndex >= 0) database.caregiverPrivateData[privateIndex] = privateData;
        else database.caregiverPrivateData.push(privateData);
      }

      return { profile, privateData };
    });
  }

  async getPetById(id: string): Promise<Pet | null> {
    const database = await this.getDatabase();
    return database.pets.find((pet) => pet.id === id) ?? null;
  }

  async listPetsByOwner(ownerUserId: string): Promise<Pet[]> {
    const database = await this.getDatabase();
    return database.pets.filter((pet) => pet.ownerUserId === ownerUserId);
  }

  upsertPet(input: UpsertPetInput): Promise<Pet> {
    return this.mutateDatabase((database) => {
      this.assertUserExists(database, input.ownerUserId);
      const id = input.id?.trim() || this.createId('pet');
      const existingIndex = database.pets.findIndex((pet) => pet.id === id);
      const existing = existingIndex >= 0 ? database.pets[existingIndex] : null;
      if (!input.id && existing) {
        throw new LocalAppRepositoryError('Já existe um pet com este identificador.', 'duplicate_id');
      }
      if (existing && existing.ownerUserId !== input.ownerUserId) {
        throw new LocalAppRepositoryError(
          'Não é permitido alterar o tutor responsável pelo pet.',
          'owner_mismatch',
        );
      }

      const timestamp = this.now();
      const pet: Pet = {
        ...input,
        id,
        name: normalizeText(input.name),
        breed: normalizeText(input.breed),
        characteristics: normalizeMultilineText(input.characteristics),
        careTags: [...new Set(input.careTags)],
        behavior: {
          traits: [...new Set(input.behavior.traits)],
          notes: normalizeMultilineText(input.behavior.notes),
        },
        medicationDetails: input.careTags.includes('medication')
          ? normalizeMultilineText(input.medicationDetails)
          : '',
        additionalNotes: normalizeMultilineText(input.additionalNotes),
        photos: normalizePhotos(input.photos),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      if (existingIndex >= 0) database.pets[existingIndex] = pet;
      else database.pets.push(pet);
      return pet;
    });
  }

  private assertUserExists(database: AppDatabase, userId: string) {
    if (!database.users.some((user) => user.id === userId)) {
      throw new LocalAppRepositoryError('Usuário de demonstração não encontrado.', 'user_not_found');
    }
  }
}
