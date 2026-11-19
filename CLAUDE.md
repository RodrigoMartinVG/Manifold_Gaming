# Starting here

What anyone working on this repository (a person, a session) needs first. The rest is linked, not repeated.

## Where things are

- **The plan and where it is:** [ROADMAP.md](ROADMAP.md), its table and its "Now". The one machine-readable status is
  `site/src/stages.ts`; `status.test.ts` checks the roadmap's table and the project's page against it.
- **Why:** [docs/decisions](docs/decisions/README.md). A decision comes before code where the tail is long.
- **What each stage did and measured:** the Bitácora, `site/src/content/docs/bitacora/` (Spanish), one report per stage.
- **The layers:** [layers.js](layers.js): every workspace, its layer, and the files whose role is not its default
  (`rules`, `brain`, `view`, `tool`). The linter's boundaries are made from it; a new workspace goes in it, or
  `layers.test.ts` fails. Decision [0003](docs/decisions/0003-boundaries.md) (amended): four layers, and where a
  piece goes (would another world's game use it as it is: the engine; in the hash or only drawn: simulation or
  view; shared by several games: the library; one game's level, number or word: its cartridge).
- **The code before the forest:** [docs/audits/the-code-before-the-forest.md](docs/audits/the-code-before-the-forest.md)
  and decision [0033](docs/decisions/0033-the-shape-before-the-forest.md) (stage 5.5).
- **The tutorial (the book):** its own plan, [docs/tutorial-roadmap.md](docs/tutorial-roadmap.md).

## Commands

| Command                                    | What it does                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm run check`                            | Every type check, in parallel and incremental (`scripts/check.mjs`)                                 |
| `npm run lint` · `npm run format:check`    | The linter (with the layers' boundaries) · the format                                               |
| `npm test`                                 | The fast headless tests: units and the site's                                                       |
| `npm run test:all`                         | All of them, every level of every game played to its end included (what CI and `verify` run)        |
| `npm run references`                       | Records every game's reference replays again (`games/*/src/references/`, one level a file)          |
| `npm run perf`                             | The performance budgets, alone, one file per scenario (`perf/`; numbers in `perf/results/`)         |
| `npm run art` · `art:check` · `art:hashes` | Makes the assets with Blender (headless) · makes them again and compares the bytes · records hashes |
| `npm run e2e`                              | The browser tests (builds the site first)                                                           |
| `npm run verify`                           | check, lint, format, `test:all`, perf                                                               |

**Browser tests on a port and a build of your own** (two sessions share this folder; never the author's dev server
on 4321): build to a folder of yours (`npx astro build --outDir <dir>` in `site/`), then
`E2E_PORT=<port> E2E_DIST=<dir> E2E_OUTPUT=<dir> npx playwright test --project chromium …`. A server already on
the port is used only with `E2E_REUSE=1`.

## Rules that hold everywhere

- **Determinism.** What runs in the step (a `rules` file) gives the same bits in every browser: no `Math.sin`,
  `cos`, `atan2`, `pow`, `**`, `Math.random`, no clock (`Date.now`, `performance.now`), no page (`window`,
  `document`). The linter refuses them; `common` has the engine's own `sinCosDegrees`, `quat.look`… A brain (bots,
  decision 0023) may use any arithmetic.
- **A refactor keeps every hash.** The reference replays (`games/*/replays/`) prove it; they also play in every
  browser ("La misma huella"). What changes a hash goes up a version on purpose: the engine's
  (`SIMULATION_VERSION`, `packages/core/src/version.ts`) for the core, a game's or a library package's own
  (`Cartridge.versions`, `*_VERSION`) for its rules; then `npm run references`, and only those replays change.
- **Mechanism and policy.** The engine gives the measure, the game its meaning; a game sets a mechanism's
  parameters, it never forks the mechanism.
- **Robust, not patched.** A cause is fixed in the layer it lives in; if only a patch fits now, say so.
- **Languages.** Code, console, tests, decisions and commits in English; the site, the tutorial and the Bitácora in
  Spanish (decision 0011).
- **Art by scripts only** (decision 0015): `art/*.py`, Blender headless; each asset's hash in its `assets.json`.

## Two sessions, one folder

The author works with two sessions in this one folder, both on `main`: the tutorial's (the book, `site/`'s tutorial)
and the engine and games'. No worktrees, no branches.

- Commit only your own paths, by name (`git add <paths>`, never `-A`, stash, reset or a branch switch): the other
  session's work may be uncommitted beside yours.
- Throwaway work goes in `scratch/` (never committed, linted or tested), not in the source folders.
- Browser tests on your own port and build (above): the tutorial's session uses 4410, the engine's 4420.
- Each stage: its tests (a test that failed before each fix), its Bitácora report, its line in the roadmap.
