import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    // Transactions on a fresh local validator take a few seconds to confirm.
    testTimeout: 60_000,
    // The tests share one config PDA, so they run in order in a single file.
    fileParallelism: false,
  },
});
