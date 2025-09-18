// eslint.config.mjs
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import vitest from 'eslint-plugin-vitest'

export default [
  {
    ignores: ['node_modules', 'dist', 'wasms', '.papi'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
      vitest,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // test-specific overrides if needed
    },
  },
]
