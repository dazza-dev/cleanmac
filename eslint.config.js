import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

/**
 * The rule that matters here is `no-restricted-imports`. Everything else is
 * ordinary hygiene.
 */
const noHardDeletes = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'fs',
          importNames: ['rm', 'rmSync', 'unlink', 'unlinkSync', 'rmdir', 'rmdirSync'],
          message: 'Use shell.trashItem — deletions in this app must be recoverable.'
        },
        {
          name: 'node:fs',
          importNames: ['rm', 'rmSync', 'unlink', 'unlinkSync', 'rmdir', 'rmdirSync'],
          message: 'Use shell.trashItem — deletions in this app must be recoverable.'
        },
        {
          name: 'fs/promises',
          importNames: ['rm', 'unlink', 'rmdir'],
          message: 'Use shell.trashItem — deletions in this app must be recoverable.'
        },
        {
          name: 'node:fs/promises',
          importNames: ['rm', 'unlink', 'rmdir'],
          message: 'Use shell.trashItem — deletions in this app must be recoverable.'
        }
      ]
    }
  ],
  'no-restricted-properties': [
    'error',
    { object: 'fs', property: 'rm', message: 'Use shell.trashItem.' },
    { object: 'fs', property: 'rmSync', message: 'Use shell.trashItem.' },
    { object: 'fs', property: 'unlink', message: 'Use shell.trashItem.' },
    { object: 'fs', property: 'unlinkSync', message: 'Use shell.trashItem.' }
  ]
}

export default [
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'build/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      ...noHardDeletes,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },

  {
    // Main, preload and tests run in Node.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } }
  },

  {
    // The renderer runs in a browser context. The preload bridge also touches
    // both, which is why `window` shows up on each side.
    files: ['src/renderer/**/*.{ts,vue}', 'src/preload/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } }
  },

  {
    // Tests build and tear down real directory fixtures, so they legitimately
    // need `rm`. They never ship, and the ban exists to protect the user's
    // filesystem — not a temp directory the suite created itself.
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off'
    }
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2023,
        sourceType: 'module'
      }
    },
    rules: {
      // Single-word component names are fine for views in a small app.
      'vue/multi-word-component-names': 'off'
    }
  }
]
