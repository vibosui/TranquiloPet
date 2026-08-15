import {
  LOCAL_DATABASE_KEY,
  LOCAL_SESSION_KEY,
  LocalAppRepository,
  type KeyValueStorage,
} from '@/core/data/local-app-repository';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }
}

function createRepository(storage = new MemoryStorage()) {
  let id = 0;
  return {
    storage,
    repository: new LocalAppRepository({
      storage,
      now: () => '2026-08-15T18:00:00.000Z',
      createId: (prefix) => `${prefix}-created-${++id}`,
    }),
  };
}

describe('LocalAppRepository', () => {
  test('initializes once and preserves edits across repository instances', async () => {
    const { repository, storage } = createRepository();
    expect((await repository.initialize()).users).toHaveLength(10);

    await repository.registerUser({
      fullName: '  Nova   Pessoa ',
      email: ' NOVA@EXAMPLE.COM ',
      phone: '(11) 98888-7777',
    });

    const secondRepository = new LocalAppRepository({ storage });
    const restored = await secondRepository.initialize();
    expect(restored.users).toHaveLength(11);
    expect(restored.users.at(-1)).toEqual(
      expect.objectContaining({
        fullName: 'Nova Pessoa',
        email: 'nova@example.com',
        phone: '11988887777',
      }),
    );
  });

  test('keeps the session separate and serializes only the safe demo fields', async () => {
    const { repository, storage } = createRepository();
    await repository.initialize();

    await repository.saveSession({
      mode: 'demo',
      userId: 'demo-user-01',
      signedInAt: '2026-08-15T18:00:00.000Z',
      password: 'must-not-be-saved',
      token: 'must-not-be-saved',
    } as never);

    const rawSession = storage.values.get(LOCAL_SESSION_KEY);
    const rawDatabase = storage.values.get(LOCAL_DATABASE_KEY);
    expect(rawSession).toBeDefined();
    expect(Object.keys(JSON.parse(rawSession!)).sort()).toEqual(['mode', 'signedInAt', 'userId']);
    expect(rawSession).not.toContain('password');
    expect(rawSession).not.toContain('token');
    expect(rawDatabase).not.toContain('signedInAt');
  });

  test('rejects duplicate normalized e-mails', async () => {
    const { repository } = createRepository();
    await repository.initialize();

    await expect(
      repository.registerUser({
        fullName: 'Outra Ana',
        email: ' DEMO01@TRANQUILOPET.LOCAL ',
        phone: '11999999999',
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'duplicate_email' }));
  });

  test('upserts public caregiver data and private CPF in separate collections', async () => {
    const { repository } = createRepository();
    const database = await repository.initialize();
    const current = database.caregiverProfiles[0];

    const result = await repository.upsertCaregiverProfile(
      {
        ...current,
        bio: '  Experiência   atualizada \r\n\r\n  Possui quintal seguro. ',
        availability: ['Segunda', 'Segunda', 'Sábado'],
      },
      { cpf: '123.456.789-00' },
    );

    expect(result.profile.bio).toBe('Experiência atualizada\n\nPossui quintal seguro.');
    expect(result.profile.availability).toEqual(['Segunda', 'Sábado']);
    expect(result.profile).not.toHaveProperty('cpf');
    expect(result.privateData?.cpf).toBe('12345678900');
    expect(await repository.getCaregiverPrivateDataByUserId(current.userId)).toEqual(
      expect.objectContaining({ cpf: '12345678900' }),
    );
  });

  test('creates a pet for an existing owner and refuses changing its owner', async () => {
    const { repository, storage } = createRepository();
    await repository.initialize();

    const created = await repository.upsertPet({
      ownerUserId: 'demo-user-01',
      name: '  Paçoca ',
      species: 'dog',
      breed: 'SRD',
      ageYears: 3,
      size: 'medium',
      characteristics: 'Dócil\r\n\r\n  Gosta de crianças. ',
      careTags: ['medication', 'medication'],
      behavior: {
        traits: ['anxious', 'anxious'],
        notes: 'Medo de trovões.\r\n\r\n  Acalma com música. ',
      },
      medicationDetails: '1 comprimido às 20h.\r\n\r\n  Administrar com alimento. ',
      additionalNotes: 'Não oferecer petiscos.\nDormir com a manta azul.',
      photos: { profileUri: null, galleryUris: [] },
    });

    expect(created.name).toBe('Paçoca');
    expect(created.careTags).toEqual(['medication']);
    expect(created.characteristics).toBe('Dócil\n\nGosta de crianças.');
    expect(created.behavior.notes).toBe('Medo de trovões.\n\nAcalma com música.');
    expect(created.medicationDetails).toBe(
      '1 comprimido às 20h.\n\nAdministrar com alimento.',
    );
    expect((await repository.listPetsByOwner('demo-user-01'))).toHaveLength(3);

    const restored = await new LocalAppRepository({ storage }).getPetById(created.id);
    expect(restored).toEqual(
      expect.objectContaining({
        medicationDetails: '1 comprimido às 20h.\n\nAdministrar com alimento.',
        additionalNotes: 'Não oferecer petiscos.\nDormir com a manta azul.',
      }),
    );

    await expect(
      repository.upsertPet({ ...created, ownerUserId: 'demo-user-02' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'owner_mismatch' }));
  });

  test('hydrates the legacy medication marker without discarding separate notes', async () => {
    const { repository, storage } = createRepository();
    const legacyDatabase = await repository.initialize();
    const legacyPet = legacyDatabase.pets.find((pet) => pet.careTags.includes('medication'))!;
    delete (legacyPet as { medicationDetails?: string }).medicationDetails;
    legacyPet.additionalNotes =
      'Medicação: meio comprimido às 8h\nNão oferecer alimento antes do passeio.';
    await storage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(legacyDatabase));

    const restoredRepository = new LocalAppRepository({ storage });
    const restored = await restoredRepository.getPetById(legacyPet.id);

    expect(restored?.medicationDetails).toBe('meio comprimido às 8h');
    expect(restored?.additionalNotes).toBe('Não oferecer alimento antes do passeio.');
    expect(JSON.parse(storage.values.get(LOCAL_DATABASE_KEY)!).pets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: legacyPet.id,
          medicationDetails: 'meio comprimido às 8h',
          additionalNotes: 'Não oferecer alimento antes do passeio.',
        }),
      ]),
    );
  });
});
