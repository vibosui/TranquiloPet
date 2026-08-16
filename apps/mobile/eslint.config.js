// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Nullable schedule entries are clearer as Array<Date | null> than (Date | null)[].
    files: ['src/app/(app)/hosting/[eventId].tsx'],
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    },
  },
]);
