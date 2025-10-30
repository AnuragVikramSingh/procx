module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
  },
  overrides: [
    {
      files: ['src/cli/**/*.ts'],
      rules: {
        'no-console': 'off', // Allow console statements in CLI files
      },
    },
    {
      files: ['src/utils/logger.ts'],
      rules: {
        'no-console': 'off', // Allow console statements in logger utility
      },
    },
  ],
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
};