import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignored paths
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'node_modules/**',
      'android/**',
      'ios/**',
      'release/**',
      'packages/**',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript source files
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript already reports undefined identifiers and unused code.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',

      // React
      'react/prop-types': 'off', // using TypeScript
      'react/react-in-jsx-scope': 'off', // React 18+
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Test files — relaxed rules
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Electron main process files
  {
    files: ['src/main/**/*.ts', 'src/backend/**/*.ts', 'src/database/**/*.ts'],
    rules: {
      'no-console': 'off', // backend logging ok
    },
  },
]
