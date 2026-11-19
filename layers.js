// @ts-check
/**
 * THE LAYERS, IN ONE TABLE (stage 5.5b, decision 0003 as amended on 2026-11-19, decision 0033): every
 * workspace of the repository, its layer, and the files that are not its layer's default. The linter's
 * boundaries are made from it (`eslint.config.js`), and a test checks that every workspace is in it
 * (`layers.test.ts`): a package or a game that is not here fails the tests, so none starts unguarded again,
 * as `arms` did from 5e to 5.5.
 *
 * **Guarded by default.** A file is its layer's default unless it is named here: in the foundation, the
 * simulation, the library and the cartridges that default is `rules` (no screen, the same bits in every
 * browser); a new file there is guarded from its first line.
 *
 * The roles a file can have:
 *   - `rules`: runs in the step, or decides what does: no screen, no network, never a game, and the same
 *     bits everywhere (no `Math.sin`, `**`, `Math.random`, no clock);
 *   - `brain`: thinks where the match is hosted (decision 0023): no screen, any arithmetic;
 *   - `view`: draws, sounds, the page: never a game (a cartridge's: never another game);
 *   - `tool`: a harness or a check (a game's play driver, the Dojo's check of its replays): no screen, any
 *     arithmetic;
 *   - `site`: the site, outside the layers.
 */

/** @typedef {'rules' | 'brain' | 'view' | 'tool' | 'site'} Role */
/**
 * @typedef {object} Workspace
 * @property {string} name its package's name
 * @property {'foundation' | 'simulation' | 'service' | 'view' | 'library' | 'cartridge' | 'site'} layer
 * @property {Role} [role] its files' role when they are not named below (the layer's, if not said)
 * @property {Record<string, Role>} [files] files of `src/` whose role is not the default
 * @property {boolean} [forGames] whether a game may import it (an engine service: `bots` yes, `net` no)
 */

/** @type {Record<string, Workspace>} */
export const WORKSPACES = {
  'packages/common': { name: '@manifold/common', layer: 'foundation', files: { 'approx.ts': 'tool' } },
  'packages/commands': { name: '@manifold/commands', layer: 'foundation' },
  'packages/core': { name: '@manifold/core', layer: 'simulation' },
  'packages/bots': { name: '@manifold/bots', layer: 'service', role: 'brain', forGames: true },
  'packages/net': { name: '@manifold/net', layer: 'service', forGames: false },
  'packages/presentation': { name: '@manifold/presentation', layer: 'view' },
  'packages/character': { name: '@manifold/character', layer: 'library', files: { 'models.ts': 'view', 'glb.ts': 'view' } },
  'packages/kit': { name: '@manifold/kit', layer: 'library', files: { 'models.ts': 'view' } },
  'packages/arms': { name: '@manifold/arms', layer: 'library', files: { 'models.ts': 'view', 'brain.ts': 'brain' } },
  'packages/shell': {
    name: '@manifold/shell',
    layer: 'library',
    // (`references.ts`: the reference replays' test kit, stage 5.5c; `drive.ts`, a level played without a
    // screen, stage 5.5h. `run.ts`, a level's run, is rules: headless, guarded.)
    files: { 'index.ts': 'view', 'words.ts': 'view', 'references.ts': 'tool', 'drive.ts': 'tool' },
  },
  'games/dojo': {
    name: '@manifold/dojo',
    layer: 'cartridge',
    // (`declarations.ts` reads the view's catalog, for the console's reference.)
    files: { 'index.ts': 'view', 'interface.ts': 'view', 'declarations.ts': 'view' },
  },
  'games/adventure': { name: '@manifold/adventure', layer: 'cartridge', files: { 'index.ts': 'view' } },
  'games/tower': {
    name: '@manifold/tower',
    layer: 'cartridge',
    files: { 'index.ts': 'view', 'game.ts': 'view', 'finale.ts': 'view', 'play.ts': 'tool' },
  },
  'games/fortress': {
    name: '@manifold/fortress',
    layer: 'cartridge',
    files: { 'index.ts': 'view', 'game.ts': 'view', 'play.ts': 'tool' },
  },
  'games/wall': {
    name: '@manifold/wall',
    layer: 'cartridge',
    files: { 'index.ts': 'view', 'game.ts': 'view', 'play.ts': 'tool' },
  },
  site: { name: 'site', layer: 'site', role: 'site' },
};

/** Each layer's default role. */
/** @type {Record<Workspace['layer'], Role>} */
export const DEFAULT_ROLE = {
  foundation: 'rules',
  simulation: 'rules',
  service: 'rules',
  view: 'view',
  library: 'rules',
  cartridge: 'rules',
  site: 'site',
};

/** A workspace's default role. */
export const roleOf = (/** @type {Workspace} */ w) => w.role ?? DEFAULT_ROLE[w.layer];
