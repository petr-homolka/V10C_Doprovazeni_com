import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Pure unit tests (src/**/*.test.ts) run with plain `npm run test` — no
// emulator needed. Firestore-rules tests live under tests/rules/ and need a
// running emulator, so they're excluded here and run via `npm run test:rules`
// (which wraps them in `firebase emulators:exec`) instead.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
