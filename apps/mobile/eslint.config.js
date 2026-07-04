// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    settings: {
      react: {
        // eslint-plugin-react's "detect" mode calls context.getFilename(),
        // which was removed in ESLint 10 — pin the version explicitly.
        version: '19.2',
      },
    },
  },
]);
