import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:4321/Manifold_Gaming/';

/** Chromium, as every test but Firefox's and WebKit's runs in. */
const CHROMIUM = {
  ...devices['Desktop Chrome'],
  // Without a GPU (in continuous integration), WebGL runs on the CPU with SwiftShader.
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
};

/**
 * What Firefox and WebKit run, everywhere: the determinism check, and the physics tests, which draw. On
 * Linux without a GPU both draw on the CPU (Mesa's llvmpipe), Firefox only with a display: continuous
 * integration gives it a virtual one (Xvfb, see the workflow). Without one its pages never stepped.
 */
const drawing = ['determinism.e2e.ts', 'physics.e2e.ts'];

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
  // And each wait inside a test (`expect`, `expect.poll`): 15 s, not the usual 5. The page writes some of
  // what the tests read every 10 frames (the meshes, the frames drawn), and 10 frames without a GPU,
  // with another test drawing alongside, can take more than 5 s.
  expect: { timeout: 15_000 },
  // Three at a time on the author's machine (stage 4.5's close): every test draws on the CPU, and with
  // four (Playwright's half of its eight cores) pages went so slowly at a run's start that a different
  // pair of tests ran out of time each run; with three, none did. In continuous integration, Playwright's.
  workers: process.env.CI ? undefined : 3,
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
      // (What must draw at speed runs after, alone: the next project.)
      grepInvert: /@quiet/,
      use: CHROMIUM,
    },
    // WHAT MUST DRAW AT SPEED (stage 4.5's close): two tabs in one match, a measure taken frame by frame.
    // With every test drawing on the CPU at once, a page went at 3 steps a second, not 60 (measured: six
    // workers, two pages each), and these failed at a full run's start, passing alone. Tagged `@quiet`,
    // they run after the rest, when the machine is quiet.
    { name: 'chromium-quiet', grep: /@quiet/, dependencies: ['chromium'], use: CHROMIUM },
    // Determinism across JavaScript engines (decision 0012): Firefox (SpiderMonkey) and WebKit
    // (JavaScriptCore, Safari's) run the determinism check, which needs no WebGL (the reference
    // replays played without drawing), and the physics tests, which draw (see `drawing`). Firefox needs
    // no pref to draw on the CPU: with a display, it gives WebGL 2 on Mesa's llvmpipe as it is.
    { name: 'firefox', testMatch: drawing, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: drawing, use: { ...devices['Desktop Safari'] } },
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
