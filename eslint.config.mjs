import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettierPlugin from 'eslint-plugin-prettier';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    'prettier',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'next/core-web-vitals',
    'next/typescript',
  ),
  {
    plugins: {
      prettier: fixupPluginRules(prettierPlugin),
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'import/order': [
        'error',
        {
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
          // Enforce a specific import order
          groups: ['external', 'builtin', 'parent', 'sibling', 'index', 'object', 'type', 'unknown'],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'next',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'next/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '~/assets/**',
              group: 'unknown',
              position: 'after',
            },
            {
              pattern: '~/**',
              group: 'parent',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],
      // Prettier plugin to apply formatting rules
      'prettier/prettier': 'error', // This tells ESLint to show Prettier errors as ESLint errors
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
    },
    settings: {
      // Spread Prettier config to disable conflicting ESLint rules
      ...prettierConfig,
      'import/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        }),
      ],
    },
  },
];

export default eslintConfig;
