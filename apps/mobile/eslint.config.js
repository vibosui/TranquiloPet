// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // A tela de hospedagem usa arrays simples e uniões nullable; a notação escolhida não altera o tipo.
    files: ['src/app/**/hosting/[[]eventId[]].tsx'],
    rules: {
      '@typescript-eslint/array-type': 'off',
    },
  },
]);
