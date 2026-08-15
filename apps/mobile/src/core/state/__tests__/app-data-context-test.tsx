import { act, render } from '@testing-library/react-native';

import {
  LOCAL_SESSION_KEY,
  LocalAppRepository,
  type KeyValueStorage,
} from '@/core/data/local-app-repository';
import {
  AppDataProvider,
  type AppDataContextValue,
  useAppData,
} from '@/core/state/app-data-context';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

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

describe('<AppDataProvider />', () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  test('restores seeds, signs in by e-mail and signs out', async () => {
    const repository = new LocalAppRepository({ storage: new MemoryStorage() });
    let context!: AppDataContextValue;

    function Probe() {
      context = useAppData();
      return null;
    }

    await act(async () => {
      render(
        <AppDataProvider repository={repository}>
          <Probe />
        </AppDataProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(context.loading).toBe(false);
    expect(context.database?.users).toHaveLength(10);
    expect(context.currentUser).toBeNull();

    await act(async () => {
      await context.signInByEmail(' DEMO05@TRANQUILOPET.LOCAL ');
    });
    expect(context.currentUser?.id).toBe('demo-user-05');
    expect(context.getTutorProfileByUserId('demo-user-05')).not.toBeNull();
    expect(context.getCaregiverProfileByUserId('demo-user-05')).not.toBeNull();
    expect(context.listPetsByOwner('demo-user-05')).toHaveLength(2);

    await act(async () => {
      await context.signOut();
    });
    expect(context.currentUser).toBeNull();
  });

  test('does not allow the active demo user to update another owner pet', async () => {
    const repository = new LocalAppRepository({ storage: new MemoryStorage() });
    let context!: AppDataContextValue;

    function Probe() {
      context = useAppData();
      return null;
    }

    await act(async () => {
      render(
        <AppDataProvider repository={repository}>
          <Probe />
        </AppDataProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(context.loading).toBe(false);
    await act(async () => {
      await context.signInByEmail('demo01@tranquilopet.local');
    });

    const otherOwnerPet = context.listPetsByOwner('demo-user-02')[0];
    let rejected: unknown;
    await act(async () => {
      try {
        await context.upsertPet({ ...otherOwnerPet, name: 'Não autorizado' });
      } catch (error) {
        rejected = error;
      }
    });
    expect(rejected).toEqual(expect.objectContaining({ code: 'owner_mismatch' }));
  });

  test('loads a valid database and clears only a corrupted session', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalAppRepository({ storage });
    await repository.initialize();
    await storage.setItem(LOCAL_SESSION_KEY, '{invalid-json');
    let context!: AppDataContextValue;

    function Probe() {
      context = useAppData();
      return null;
    }

    await act(async () => {
      render(
        <AppDataProvider repository={repository}>
          <Probe />
        </AppDataProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(context.loading).toBe(false);
    expect(context.error).toBeNull();
    expect(context.database?.users).toHaveLength(10);
    expect(context.currentUser).toBeNull();
    expect(await storage.getItem(LOCAL_SESSION_KEY)).toBeNull();
  });
});
