// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

/**
 * The linter. Besides the usual rules, it guards THE BOUNDARIES between layers (decision 0003).
 * The compiler already keeps the core from using `document` (it has no DOM library); this keeps
 * it from IMPORTING what it must not. If someone tries, `npm run lint` fails and says why.
 */
const games = {
  group: ['@manifold/dojo', '@manifold/dojo/*', '**/games/**'],
  message: 'The engine does not know the games: it receives them as cartridges (decision 0003).',
};
const drawing = {
  group: ['three', 'three/*'],
  message: 'This layer does not draw: Three.js belongs to the presentation only (decision 0003).',
};
const models = {
  group: ['**/*.glb', '**/*.glb?*', '**/*.gltf', '**/*.gltf?*'],
  message: "A model is the presentation's: the simulation names one (`appearance.model`) and never loads it (stage 2e).",
};
const presentation = {
  group: ['@manifold/presentation', '@manifold/presentation/*'],
  message: 'The simulation does not know the presentation (decision 0003).',
};
const network = {
  group: ['@manifold/net', '@manifold/net/*'],
  message: 'The simulation does not know the network: the network uses the simulation (decision 0003).',
};
const headless = "A game's rules run without a screen (also on a server and in tests): decision 0003.";

/**
 * WHAT EACH JAVASCRIPT ENGINE COMPUTES ITS OWN WAY (stage 1f). The standard requires Math.sqrt,
 * the arithmetic, Math.round, floor, abs, min, max… to give the exact same bits everywhere; but
 * it lets Math.sin, cos, atan2, hypot, exp, pow (and `**`) be "approximated by the implementation".
 * Two browsers can differ in the last bit, and a replay, a ghost or a networked match would end
 * somewhere else. So the simulation (and a game's rules) does not use them; and not Math.random
 * either: the world has its own randomness, with its seed. Tests can: they compare, they do not
 * simulate.
 */
const approximated = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];
const sameEverywhere = {
  'no-restricted-properties': [
    'error',
    ...approximated.map((property) => ({
      object: 'Math',
      property,
      message: `Math.${property} may give other bits in another browser: the simulation uses additions, multiplications and square roots (stage 1f).`,
    })),
    {
      object: 'Math',
      property: 'random',
      message: "A different sequence on every run: the simulation uses the world's randomness (world.random).",
    },
    {
      object: 'approx',
      message:
        "It uses the browser's trigonometry (sine, cosine, acos): for tests and views, never in the simulation (stage 2.5b; in the simulation, a literal quaternion, quat.look or quat.fromDegrees).",
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "BinaryExpression[operator='**']",
      message: '`**` is Math.pow: it may give other bits in another browser (stage 1f).',
    },
    {
      selector: "AssignmentExpression[operator='**=']",
      message: '`**=` is Math.pow: it may give other bits in another browser (stage 1f).',
    },
  ],
};

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      'playwright-report/**',
      'test-results/**',
      'site/public/vendor/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  // A name that starts with "_" is unused on purpose (a parameter that the signature needs but this
  // version does not, like the position in a uniform gravity field).
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { languageOptions: { globals: { ...globals.node } } },
  // The site and its lessons run in the browser.
  { files: ['site/src/**/*.ts'], languageOptions: { globals: { ...globals.browser } } },
  {
    files: ['packages/common/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [drawing, models, { group: ['@manifold/*'], message: 'common depends on no other package.' }] },
      ],
    },
  },
  {
    // Variables, commands and recipes (decision 0010): no screen, and no dependencies.
    files: ['packages/commands/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [drawing, models, { group: ['@manifold/*'], message: 'commands depends on no other package.' }] },
      ],
    },
  },
  {
    files: ['packages/core/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [drawing, models, presentation, games, network] }] },
  },
  {
    // What bots plan with (stage 4d, decision 0023): it runs where the match is hosted, a page or a
    // server, without a screen; it uses the simulation, which does not know it.
    files: ['packages/bots/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [drawing, models, presentation, games, network] }] },
  },
  {
    // The simulation, the network and a game's rules give the same bits in every browser (stage 1f).
    // (And the math they all use, `common`, except approx.ts: stage 2.5b.)
    files: [
      'packages/common/src/**',
      'packages/core/src/**',
      'packages/net/src/**',
      'packages/character/src/index.ts',
      'games/*/src/cartridge.ts',
      'games/*/src/rules.ts',
      'games/*/src/levels.ts',
    ],
    ignores: ['**/*.test.ts', 'packages/common/src/approx.ts'],
    rules: sameEverywhere,
  },
  {
    // The networking skeleton (stage 1e): no screen, no games; it runs in a page, in a tab, in Node.
    files: ['packages/net/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [drawing, models, presentation, games] }] },
  },
  {
    files: ['packages/presentation/src/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [games] }] },
  },
  {
    // The games' character (stage 4a): its rules part runs without a screen, like a game's rules; its
    // model (models.ts) is the presentation's.
    files: ['packages/character/src/index.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [drawing, models, presentation, games, network] }] },
  },
  {
    files: ['packages/character/src/**'],
    ignores: ['packages/character/src/index.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [games] }] },
  },
  {
    // A game uses the engine, never another game.
    files: ['games/*/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@manifold/*',
                '!@manifold/common',
                '!@manifold/commands',
                '!@manifold/core',
                '!@manifold/presentation',
                '!@manifold/character',
                '!@manifold/character/*',
                '!@manifold/bots',
              ],
              message: 'A game imports the engine, never another game (decision 0003).',
            },
          ],
        },
      ],
    },
  },
  {
    // A game's RULES (its cartridge) run without a screen: also on a server and in tests.
    files: ['games/*/src/cartridge*.ts', 'games/*/src/rules.ts', 'games/*/src/levels.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { ...drawing, message: headless },
            { ...models, message: headless },
            { ...presentation, message: headless },
            { group: ['@manifold/character/models'], message: headless },
          ],
        },
      ],
    },
  },
);
