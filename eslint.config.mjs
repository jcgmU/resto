import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/generated/**',
      '**/.turbo/**',
      '**/.agents/**',
      '**/.team/**',
      'brain/**',
      'design-system/**',
      'infra/**',
      'testsprite_tests/**',
      '*.js',
      '*.mjs',
      'scripts/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      '@next/next': {
        rules: {
          'no-img-element': {
            create() {
              return {};
            },
          },
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'no-unused-vars': 'warn',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  }
);
