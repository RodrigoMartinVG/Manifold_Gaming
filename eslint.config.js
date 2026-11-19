// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import { WORKSPACES, roleOf } from './layers.js';

/**
 * The linter. Besides the usual rules, it guards THE BOUNDARIES between layers (decision 0003).
 * The compiler already keeps the core from using `document` (it has no DOM library); this keeps
 * it from IMPORTING what it must not. If someone tries, `npm run lint` fails and says why.
 *
 * Since stage 5.5b the boundaries are made from one table, `layers.js`: every workspace, its layer, and
 * the files whose role is not their layer's default. A file not named there is its layer's default, so
 * a new file in the simulation, the library or a game's rules is guarded from its first line.
 */
const workspaces = Object.entries(WORKSPACES).filter(([, w]) => w.layer !== 'site');
const namesOf = (/** @type {(w: import('./layers.js').Workspace) => boolean} */ keep) =>
  workspaces.filter(([, w]) => keep(w)).map(([, w]) => w.name);
const withSubpaths = (/** @type {string[]} */ names) => names.flatMap((n) => [n, `${n}/*`]);
const games = {
  group: [...withSubpaths(namesOf((w) => w.layer === 'cartridge')), '**/games/**'],
  message: 'The engine does not know the games: it receives them as cartridges (decision 0003).',
};
/** The games' library (decision 0003, amended 2026-11-19): the games use it; the engine never does. */
const library = {
  group: withSubpaths(namesOf((w) => w.layer === 'library')),
  message: "The engine does not know the games' library: the library uses the engine (decision 0003).",
};
/** What a game may import: the engine (but the network) and the library; never another game. */
const forGames = namesOf((w) => ['foundation', 'simulation', 'view', 'library'].includes(w.layer) || w.forGames === true);
const notForGames = {
  group: ['@manifold/*', ...withSubpaths(forGames).map((n) => `!${n}`)],
  message: 'A game imports the engine and the library, never another game (decision 0003).',
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
 * The library's view entries (its models, its glb loader, the shell's page): what runs without a screen
 * must not import them. A view file named `index.ts` is the package itself (`@manifold/shell`).
 */
const libraryViews = {
  group: workspaces
    .filter(([, w]) => w.layer === 'library')
    .flatMap(([, w]) =>
      Object.entries(w.files ?? {})
        .filter(([, role]) => role === 'view')
        .map(([file]) => (file === 'index.ts' ? w.name : `${w.name}/${file.replace(/\.ts$/, '')}`)),
    ),
  message: headless,
};
/** The foundation imports nothing of the project. */
const anyProject = { group: ['@manifold/*'], message: 'The foundation depends on no other package (decision 0003).' };

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
    // (Stage 5.5b) No clock: the simulation's time is its step, the same on every copy.
    ...['Date', 'performance'].map((object) => ({
      object,
      property: 'now',
      message: "A clock gives each copy another time: the simulation's time is its step (`world.tick`), stage 5.5b.",
    })),
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
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: "`new Date()` is the clock: the simulation's time is its step (`world.tick`), stage 5.5b.",
    },
  ],
};

/** What runs without a screen does not reach for the page (stage 5.5b): no window, document or storage. */
const noPage = {
  'no-restricted-globals': [
    'error',
    ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'requestAnimationFrame'].map((name) => ({
      name,
      message: `\`${name}\` is the page's: this file runs without a screen (decision 0003).`,
    })),
  ],
};

/**
 * WHAT A FILE MAY NOT IMPORT, by its workspace's layer and its role (decision 0003, amended; layers.js).
 * Tests: in the library and the games, as the view (they may draw); elsewhere, without a screen.
 */
function forbidden(/** @type {import('./layers.js').Workspace} */ w, /** @type {string} */ role) {
  // Its own view files, by their relative path (`./game`): what runs without a screen does not import them.
  const views = Object.entries(w.files ?? {})
    .filter(([, r]) => r === 'view')
    .map(([file]) => `./${file.replace(/\.ts$/, '')}`);
  const ownViews = views.length ? [{ group: views, message: headless }] : [];
  if (role !== 'view' && role !== 'test') return [...forbiddenFor(w, role), ...ownViews];
  return forbiddenFor(w, role);
}
function forbiddenFor(/** @type {import('./layers.js').Workspace} */ w, /** @type {string} */ role) {
  if (w.layer === 'cartridge') {
    const headlessOnes = [
      { ...drawing, message: headless },
      { ...models, message: headless },
      { ...presentation, message: headless },
      libraryViews,
    ];
    return role === 'view' || role === 'test' ? [notForGames] : [notForGames, ...headlessOnes];
  }
  if (role === 'view' || (role === 'test' && (w.layer === 'library' || w.layer === 'view')))
    return w.layer === 'view' ? [games, library] : [games];
  const screen = [drawing, models, presentation, games];
  switch (w.layer) {
    case 'foundation':
      return [drawing, models, anyProject];
    case 'simulation':
      return [...screen, network, library];
    case 'service':
      return w.forGames ? [...screen, network, library] : [...screen, library];
    default:
      return [...screen, network, libraryViews];
  }
}

/** The configuration for a group of files: what they may import, and, for rules, the same bits and no page. */
function blocksFor(
  /** @type {import('./layers.js').Workspace} */ w,
  /** @type {string} */ role,
  /** @type {string[]} */ files,
  /** @type {string[]} */ ignores,
) {
  const headless = role === 'rules' || role === 'brain' || role === 'tool';
  return [
    {
      files,
      ignores,
      rules: {
        'no-restricted-imports': ['error', { patterns: forbidden(w, role) }],
        // (Each rule set or turned off here: what is not in the table keeps the strictest, below.)
        ...(role === 'rules' ? sameEverywhere : { 'no-restricted-properties': 'off', 'no-restricted-syntax': 'off' }),
        ...(headless ? noPage : { 'no-restricted-globals': 'off' }),
      },
    },
  ];
}

/** Every workspace's files, by role: its default for what is not named, each named file, its tests. */
const boundaries = workspaces.flatMap(([dir, w]) => {
  const src = `${dir}/src`;
  const named = Object.entries(w.files ?? {});
  const tests = `${src}/**/*.test.ts`;
  return [
    ...blocksFor(w, roleOf(w), [`${src}/**`], [...named.map(([file]) => `${src}/${file}`), tests]),
    ...named.flatMap(([file, role]) => blocksFor(w, role, [`${src}/${file}`], [])),
    ...blocksFor(w, 'test', [tests], []),
  ];
});

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      'playwright-report/**',
      'test-results/**',
      'site/public/vendor/**',
      // (Stage 5.5b) Not the project's: earlier sessions' worktrees, the books, the drafts, an old site's caches.
      '.claude/**',
      'books/**',
      'borradores_ideas/**',
      'sitio/**',
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
  // A package or a game not in the table yet (its test fails until it is): the strictest, as rules.
  {
    files: ['packages/*/src/**', 'games/*/src/**'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [drawing, models, presentation, games, network, library] }],
      ...sameEverywhere,
      ...noPage,
    },
  },
  // The boundaries, from the table of layers (stage 5.5b).
  ...boundaries,
);
