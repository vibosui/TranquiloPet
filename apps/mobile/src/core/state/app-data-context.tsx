import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { featureFlags } from '@/config/feature-flags';
import {
  type AppDataRepository,
  LocalAppRepository,
  LocalAppRepositoryError,
} from '@/core/data/local-app-repository';
import {
  type AppDatabase,
  type CaregiverPrivateData,
  type CaregiverProfile,
  type DemoSession,
  type Pet,
  type RegisterUserInput,
  type TutorProfile,
  type UpsertCaregiverPrivateDataInput,
  type UpsertCaregiverProfileInput,
  type UpsertPetInput,
  type UpsertTutorProfileInput,
  type User,
} from '@/core/domain/entities';

export type AppDataContextValue = {
  loading: boolean;
  demoDataAvailable: boolean;
  error: string | null;
  database: AppDatabase | null;
  session: DemoSession | null;
  currentUser: User | null;
  clearError(): void;
  signInByEmail(email: string): Promise<User>;
  signOut(): Promise<void>;
  registerUser(input: RegisterUserInput): Promise<User>;
  upsertTutorProfile(input: UpsertTutorProfileInput): Promise<TutorProfile>;
  upsertCaregiverProfile(
    input: UpsertCaregiverProfileInput,
    privateInput?: UpsertCaregiverPrivateDataInput,
  ): Promise<{ profile: CaregiverProfile; privateData: CaregiverPrivateData | null }>;
  upsertPet(input: UpsertPetInput): Promise<Pet>;
  getUserById(id: string): User | null;
  getTutorProfileByUserId(userId: string): TutorProfile | null;
  getCaregiverProfileByUserId(userId: string): CaregiverProfile | null;
  getCaregiverPrivateDataByUserId(userId: string): CaregiverPrivateData | null;
  getPetById(id: string): Pet | null;
  listUsers(): User[];
  listTutorProfiles(): TutorProfile[];
  listCaregiverProfiles(): CaregiverProfile[];
  listPetsByOwner(ownerUserId: string): Pet[];
};

type AppDataProviderProps = PropsWithChildren<{
  repository?: AppDataRepository;
}>;

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const LOCAL_DEMO_UNAVAILABLE_MESSAGE =
  'Dados de demonstração indisponíveis neste build.';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Não foi possível acessar os dados locais.';
}

type RepositoryResolution = {
  repository: AppDataRepository | null;
  unavailableMessage: string | null;
};

function resolveRepository(providedRepository?: AppDataRepository): RepositoryResolution {
  if (providedRepository) {
    return { repository: providedRepository, unavailableMessage: null };
  }
  if (!featureFlags.localDemoData) {
    return { repository: null, unavailableMessage: LOCAL_DEMO_UNAVAILABLE_MESSAGE };
  }

  try {
    return { repository: new LocalAppRepository(), unavailableMessage: null };
  } catch {
    return { repository: null, unavailableMessage: LOCAL_DEMO_UNAVAILABLE_MESSAGE };
  }
}

function requireRepository(repository: AppDataRepository | null): AppDataRepository {
  if (repository) return repository;
  throw new LocalAppRepositoryError(
    LOCAL_DEMO_UNAVAILABLE_MESSAGE,
    'local_demo_disabled',
  );
}

export function AppDataProvider({ children, repository: providedRepository }: AppDataProviderProps) {
  const [{ repository, unavailableMessage }] = useState(() =>
    resolveRepository(providedRepository),
  );
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(repository !== null);
  const [error, setError] = useState<string | null>(unavailableMessage);

  useEffect(() => {
    if (!repository) return;
    const activeRepository = repository;

    let active = true;

    async function restore() {
      try {
        const restoredDatabase = await activeRepository.initialize();
        if (!active) return;

        setDatabase(restoredDatabase);
        let restoredSession: DemoSession | null = null;
        try {
          restoredSession = await activeRepository.getSession();
        } catch (sessionError) {
          if (
            sessionError instanceof LocalAppRepositoryError &&
            sessionError.code === 'invalid_session'
          ) {
            await activeRepository.clearSession().catch(() => undefined);
          } else {
            throw sessionError;
          }
        }
        if (!active) return;

        if (
          restoredSession &&
          restoredDatabase.users.some((user) => user.id === restoredSession.userId)
        ) {
          setSession(restoredSession);
        } else if (restoredSession) {
          await activeRepository.clearSession();
        }
      } catch (restoreError) {
        if (active) setError(errorMessage(restoreError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, [repository]);

  const refreshDatabase = useCallback(async () => {
    const updatedDatabase = await requireRepository(repository).getDatabase();
    setDatabase(updatedDatabase);
    return updatedDatabase;
  }, [repository]);

  const executeMutation = useCallback(async <T,>(operation: () => Promise<T>) => {
    setError(null);
    try {
      return await operation();
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      throw mutationError;
    }
  }, []);

  const currentUser = useMemo(
    () => database?.users.find((user) => user.id === session?.userId) ?? null,
    [database, session],
  );

  const requireCurrentUser = useCallback(
    (userId: string) => {
      if (!currentUser || currentUser.id !== userId) {
        throw new LocalAppRepositoryError(
          'Entre com o usuário correspondente antes de alterar estes dados.',
          'owner_mismatch',
        );
      }
    },
    [currentUser],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      loading,
      demoDataAvailable: repository !== null,
      error,
      database,
      session,
      currentUser,
      clearError: () => setError(unavailableMessage),
      signInByEmail: (email) =>
        executeMutation(async () => {
          const activeRepository = requireRepository(repository);
          const user = await activeRepository.getUserByEmail(email);
          if (!user) {
            throw new LocalAppRepositoryError(
              'Usuário de demonstração não encontrado.',
              'user_not_found',
            );
          }
          const nextSession: DemoSession = {
            mode: 'demo',
            userId: user.id,
            signedInAt: new Date().toISOString(),
          };
          const persistedSession = await activeRepository.saveSession(nextSession);
          setSession(persistedSession);
          return user;
        }),
      signOut: () =>
        executeMutation(async () => {
          await requireRepository(repository).clearSession();
          setSession(null);
        }),
      registerUser: (input) =>
        executeMutation(async () => {
          const activeRepository = requireRepository(repository);
          const user = await activeRepository.registerUser(input);
          const nextSession: DemoSession = {
            mode: 'demo',
            userId: user.id,
            signedInAt: new Date().toISOString(),
          };
          const persistedSession = await activeRepository.saveSession(nextSession);
          await refreshDatabase();
          setSession(persistedSession);
          return user;
        }),
      upsertTutorProfile: (input) =>
        executeMutation(async () => {
          requireCurrentUser(input.userId);
          const profile = await requireRepository(repository).upsertTutorProfile(input);
          await refreshDatabase();
          return profile;
        }),
      upsertCaregiverProfile: (input, privateInput) =>
        executeMutation(async () => {
          requireCurrentUser(input.userId);
          const result = await requireRepository(repository).upsertCaregiverProfile(
            input,
            privateInput,
          );
          await refreshDatabase();
          return result;
        }),
      upsertPet: (input) =>
        executeMutation(async () => {
          requireCurrentUser(input.ownerUserId);
          const pet = await requireRepository(repository).upsertPet(input);
          await refreshDatabase();
          return pet;
        }),
      getUserById: (id) => database?.users.find((user) => user.id === id) ?? null,
      getTutorProfileByUserId: (userId) =>
        database?.tutorProfiles.find((profile) => profile.userId === userId) ?? null,
      getCaregiverProfileByUserId: (userId) =>
        database?.caregiverProfiles.find((profile) => profile.userId === userId) ?? null,
      getCaregiverPrivateDataByUserId: (userId) =>
        database?.caregiverPrivateData.find((data) => data.userId === userId) ?? null,
      getPetById: (id) => database?.pets.find((pet) => pet.id === id) ?? null,
      listUsers: () => database?.users ?? [],
      listTutorProfiles: () => database?.tutorProfiles ?? [],
      listCaregiverProfiles: () => database?.caregiverProfiles ?? [],
      listPetsByOwner: (ownerUserId) =>
        database?.pets.filter((pet) => pet.ownerUserId === ownerUserId) ?? [],
    }),
    [
      currentUser,
      database,
      error,
      executeMutation,
      loading,
      refreshDatabase,
      repository,
      requireCurrentUser,
      session,
      unavailableMessage,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData deve ser usado dentro de AppDataProvider.');
  return context;
}
