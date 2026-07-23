import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Firestore-rules tests under tests/rules/ need a running emulator
// (`npm run test:rules`), so they get their own config instead of sharing
// vitest.config.ts's src-only `include`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/rules/**/*.test.ts'],
    // All rules test files share ONE Firestore emulator project/instance and
    // each calls clearFirestore() in beforeEach — running files in parallel
    // lets one file's clear stomp another's in-flight seed data, causing
    // flaky "Null value error" rules failures that have nothing to do with
    // the rules themselves.
    fileParallelism: false,
  },
})
