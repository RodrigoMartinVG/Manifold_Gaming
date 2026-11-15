import { defineConfig } from 'vitest/config';

/** The headless tests: `*.test.ts` files next to the code they test (decision 0001). */
export default defineConfig({
  // Models (stage 2e): files to serve or read as they are, not modules.
  assetsInclude: ['**/*.glb'],
  test: {
    include: ['packages/*/src/**/*.test.ts', 'games/*/src/**/*.test.ts', 'site/src/**/*.test.ts'],
    environment: 'node',
    // Each test's time: 20 s, not the usual 5. The heavy ones take about a second alone (two worlds and
    // their hashes for 600 steps; a snapshot gone back to and played on); with every test file at once,
    // and other work on the machine, five times that or more.
    testTimeout: 20_000,
  },
});
