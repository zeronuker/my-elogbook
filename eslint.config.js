import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // __COMMIT_SHA__ is injected at build time by `define` in vite.config.js
      globals: { ...globals.browser, __COMMIT_SHA__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Vite provides __dirname when it loads its own config file
    files: ['vite.config.js'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
])
