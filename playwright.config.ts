import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:4321/Manifold_Gaming/';

/** What Firefox and WebKit run: the determinism check always; the physics tests, which draw, locally. */
const alsoDrawing = process.env.CI ? ['determinism.e2e.ts'] : ['determinism.e2e.ts', 'physics.e2e.ts'];

/**
 * The tests IN A REAL BROWSER (decision 0001): the site built as it is published, every page opens
 * without errors and the Dojo draws. It is V1's lesson (step 14): a change in the start-up broke
 * every key, and no headless test saw it.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  // Each test's time: 90 s. Without a GPU (here and in continuous integration) WebGL draws on the CPU,
  // a page takes seconds to light up, and with another test running alongside, its frames come slower
  // still. The usual 30 s cut short waits the tests themselves allow (40 s for the home page's
  // showcase). The tests that play a match and replay it in Node ask for more.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  // In continuous integration a failed test runs once more, to tell a test that fails from one that
  // fails sometimes; but one that passes only the second time fails the run too: it is reported, not
  // hidden (behind each one there was a cause, as the review at the end of stage 2d found).
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Without a GPU (in continuous integration), WebGL runs on the CPU with SwiftShader.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    // Determinism across JavaScript engines (decision 0012): Firefox (SpiderMonkey) and WebKit
    // (JavaScriptCore, Safari's) run the determinism check, which needs no WebGL (the reference
    // replays played without drawing), also in continuous integration; and the physics tests, which
    // draw, only locally, before pushing, until these browsers' WebGL is checked on Linux.
    { name: 'firefox', testMatch: alsoDrawing, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: alsoDrawing, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // (Vite's server and not `astro preview`: outside a terminal, Astro 7 goes to the background
    // by itself, and Playwright thinks it exited.)
    command: 'npm run build && npm run serve:site',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
