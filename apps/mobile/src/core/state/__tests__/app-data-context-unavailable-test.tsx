import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';

import {
  AppDataProvider,
  type AppDataContextValue,
  LOCAL_DEMO_UNAVAILABLE_MESSAGE,
  useAppData,
} from '@/core/state/app-data-context';

jest.mock('@/config/feature-flags', () => ({
  featureFlags: { localDemoData: false },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('<AppDataProvider /> without local demo opt-in', () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fails closed without constructing storage-backed data', async () => {
    let context!: AppDataContextValue;

    function Probe() {
      context = useAppData();
      return null;
    }

    await act(async () => {
      render(
        <AppDataProvider>
          <Probe />
        </AppDataProvider>,
      );
    });

    expect(context.loading).toBe(false);
    expect(context.demoDataAvailable).toBe(false);
    expect(context.error).toBe(LOCAL_DEMO_UNAVAILABLE_MESSAGE);
    expect(context.database).toBeNull();
    expect(context.session).toBeNull();
    expect(context.currentUser).toBeNull();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    let rejected: unknown;
    await act(async () => {
      try {
        await context.signInByEmail('demo01@tranquilopet.local');
      } catch (error) {
        rejected = error;
      }
    });

    expect(rejected).toEqual(
      expect.objectContaining({
        code: 'local_demo_disabled',
        message: LOCAL_DEMO_UNAVAILABLE_MESSAGE,
      }),
    );
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});
