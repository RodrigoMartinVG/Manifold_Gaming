import { defineConfig } from 'vitest/config';

/**
 * The performance budgets (stage 2.5a): `perf/*.perf.ts`, apart from the other tests and one file at
 * a time. Measured with everything else running alongside, the times go up to five times.
 */
export default defineConfig({
  test: {
    include: ['perf/**/*.perf.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
