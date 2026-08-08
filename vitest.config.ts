import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The safety suite creates and walks real directory trees.
    testTimeout: 60_000
  }
})
