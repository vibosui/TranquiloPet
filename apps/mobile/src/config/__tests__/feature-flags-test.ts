import { isLocalDemoDataEnabled } from '@/config/feature-flags';

describe('isLocalDemoDataEnabled', () => {
  test('keeps the Expo development workflow enabled without an opt-in', () => {
    expect(isLocalDemoDataEnabled(true, undefined)).toBe(true);
  });

  test.each([undefined, '', '0', 'true', 'TRUE', 'yes', ' 1 '])(
    'fails closed in non-development builds for public value %p',
    (publicValue) => {
      expect(isLocalDemoDataEnabled(false, publicValue)).toBe(false);
    },
  );

  test('accepts only the literal public opt-in value 1 outside development', () => {
    expect(isLocalDemoDataEnabled(false, '1')).toBe(true);
  });
});
