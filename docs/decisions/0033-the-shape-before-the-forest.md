# 0033. The shape before the forest: stage 5.5

- **Status:** proposed (2026-11-19), from the author's request after the forest's revision: "hagamos los arreglos,
  pero incluso te diría de hacer un análisis más profundo sobre refactors y deuda técnica, y tener una hoja de ruta para
  mejorar varios aspectos [...] para así tener incluso un mucho mejor código, un mucho mejor ambiente en general, y
  pensar la solución más óptima de todas, en la que todas las piezas encajan a la perfección".
- **Date:** 2026-11-19

## Context

Phase 5 is done, its stages 5i to 5p included, and the forest (decision 0032) comes next: four more games on one valley,
new ways of moving (swimming, a rope, flight, riding), bodies of other sizes, a beam of light, a world of 500 × 500 m
drawn by zones. Before it, the author asked for the code read as a whole.

The reading is [the audit of 2026-11-19](../audits/the-code-before-the-forest.md): four readings, one per layer, and
measures taken for it, every important finding read again in the code. In short:

- **What is wrong today** (W1 to W9): a restored world loses its game's kit; `level.diff` throws on every level with
  kit pieces; what glows writes into materials every copy shares; a seventh light, and lights added and removed while
  playing; the games drawn without anti-aliasing; a checkpoint that leaves part of a roll behind; the determinism
  check across browsers playing only the Dojo's replays; commits on `main` never verified; five places saying five
  different things about where the project is.
- **What makes pieces not fit:** a fourth layer nobody named, guarded by hand and not all of it (L1 to L4); one
  simulation version for every game (P1); optional fields piling up as the way to keep old hashes (P2); the ways of
  moving as three hooks and fifteen special cases (S1); the mannequin's size written into the core (S2); a component
  described in five places, a level line in six (S4, S5); the game's words in the core's closed lists (S6); nothing
  owning the view's budget, its lights or its assets (V1, W4, V6); the level's run copied into every game (G1); a game
  that copies nine files before its first rule (G2).
- **What the forest would run into:** each of those, four times.
- **The environment:** the type check 77 s, the tests 118 s (one file, the wall's levels, is 109 s of it), continuous
  integration 15 to 46 minutes, the roadmap a history of 194 KB, no "start here".

The code is young and disciplined (six suppressions in all, every package tested, every level of every game played
to its end by a test that records a reference replay). The debt is where stages met: each put its piece where it fit
then, and the next copied, wrapped or special-cased it.

## Decision

### A consolidation stage, 5.5, before the forest

As 2.5 before 2e and 4.5 before the games: **stage 5.5**, between phase 5 and the forest, with no new mechanic. Its
work is to give every piece one place, guard the places, and make the proofs scale; the forest starts at its close.

### The shape where every piece fits

| Layer               | Packages                                              | It imports                                     | Its parts                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Its guards                                      |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Foundation**      | `common`, `commands`                                  | nothing of the project                         | the math that gives the same bits everywhere; the registry of values and commands                                                                                                                                                                                                                                                                                                                                                                                   | compiled without the DOM; determinism           |
| **Simulation**      | `core`                                                | the foundation                                 | the world (state, lifecycle, queries, indexes); the systems, one module each, listed in `PHASES`; components, a table each (shape, defaults, hash, level line, settable fields); the character (ways of moving as records, contributions, a body's frame); the physics boundary (shapes, colliders, a controller's settings); the level (a registry of line kinds); the session (attaching a cartridge, replays, versions as parts); light (emitters and receivers) | compiled without the DOM; determinism; headless |
| **Engine services** | `bots`, `net`                                         | the simulation                                 | navigation and steering; the network                                                                                                                                                                                                                                                                                                                                                                                                                                | headless (a brain may use any arithmetic: 0023) |
| **View**            | `presentation`                                        | the simulation                                 | the stage (renderer, quality tier, look, post-processing chain); the scene (what moves; the registry of what stands still; scenery from F3); the light pool; assets; the camera (one pipeline); audio (voices with a budget); the interface (console, HUD, page); page services (cosmetic physics, particles)                                                                                                                                                       | never a game                                    |
| **Games' library**  | `character`, `kit`, `arms`, `shell`, and the forest's | the engine                                     | each a rules entry (headless, deterministic, compiled without the DOM) and a view entry; its tables with defaults a game may replace; `shell`: the level's run, the page, a driver and a test kit                                                                                                                                                                                                                                                                   | as the simulation for its rules; never a game   |
| **Cartridges**      | `games/*`                                             | the engine and the library, never another game | `cartridge.ts` and `levels.ts` (headless), `game.ts` (the page), its levels, replays, words and music; its rules' version                                                                                                                                                                                                                                                                                                                                           | determinism and headless for its rules          |
| **The lab**         | `games/dojo`                                          | as a cartridge                                 | rooms: recipes the tests run without a screen (0032: a room for each mechanism)                                                                                                                                                                                                                                                                                                                                                                                     | as a cartridge                                  |

Seven principles hold it together:

1. **One owner per concept.** The budget is the tier's; the light slots, the pool's; a level's run, the run module's;
   a version, its part's; a component, its table's; a level line, its kind's; a way of moving, its record's.
2. **The engine gives the measure, the game its meaning** (the light a body receives, and what it does: cleans,
   feeds, betrays).
3. **Parameters are data:** a game sets them, never forks the mechanism (the arms' tables, a guard's options, a
   character's controller).
4. **Deny by default:** a new file is guarded unless it is named out; nothing starts unguarded again, as `arms` did.
5. **State has a schema and defaults:** absent means the default, never "the old behaviour".
6. **A refactor keeps every hash**, proved by the reference replays; what changes a hash goes in a stage of its own,
   in one version (as 4.5b).
7. **Built once, released once:** services are the page's, and a piece's scope releases what it added.

### The stages

Each closes with its report in the Bitácora, the four browsers agreeing and its "done when" measured.

| Stage                                                           | What (the audit's findings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Done when                                                                                                                                                                                            | Touches the simulation                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **5.5.0**                                                       | This decision and the audit; `arms` guarded like its neighbours (done 2026-11-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Accepted                                                                                                                                                                                             | No                                         |
| **5.5a — What is wrong today**                                  | One `attach` for a cartridge's hooks, at birth, at a load and in `level.diff` (W1, W2); the glowing material owned per instance (W3); the light pool, its slots fixed for the level, the flash among them, with priority and hysteresis (W4); the post-processing chain with anti-aliasing, negatives and NaN clamped, the vignette at most 1 (W5, V5's safety); a piece that throws no longer stops the frame (V13); every commit on `main` verified, and a timeout (W8)                                                                                                                                                                                                                                   | Each has a test that failed before it; every reference keeps its hash                                                                                                                                | No                                         |
| **5.5b — The guards, deny by default**                          | One table of layers read by the linter, a test that every workspace is in it; determinism and headless by default for `packages/*/src` and a game's rules, the view files and brains named out; `Date` and `performance` out of the simulation; the library's rules compiled without the DOM; each game's `levels.ts` and `cartridge.ts`; the adventure's generator guarded; the linter's ignores (L1 to L4, E8)                                                                                                                                                                                                                                                                                            | A file added anywhere is guarded (a test adds one and sees it refused); no game's headless tests import three                                                                                        | No                                         |
| **5.5c — The proofs that scale**                                | Versions as parts, the engine's and each game's rules', built from the library's (P1); references by convention, a test kit, every replays folder with its recorder (P3); every game's references in the four browsers (W7); one level per test file, vitest projects (units, playthroughs, the site), the engine's tests no longer importing the tutorial's code (E1, E2); the re-simulation test of 0016, its first cases today's character and its platforms (P4)                                                                                                                                                                                                                                        | A change to one game re-writes only its replays; all 21 agree in the four browsers; the suite's floor is no longer one file                                                                          | No (a replay's header changes once)        |
| **5.5d — The environment, fast and clear**                      | The type check incremental and in parallel, then project references (E3); continuous integration in Playwright's image, in parallel jobs, browser tests sharded, documentation paths ignored (E4); the browser tests split by area and game (E5); the test port from the environment, a `scratch/` folder, the stale worktrees removed with the author's word (E6); Blender's version asserted, an `art:check`, each asset's hash (E7); Rapier pinned once and out of Dependabot, `.gitattributes`, `sitio/` removed (E8); a performance file per scenario (E9); one status read by the site and checked against the roadmap (D1), the README as pointers (D4), a `CLAUDE.md` to start from (D3)            | The targets below, measured                                                                                                                                                                          | No                                         |
| **5.5e — The simulation's shape, to the bit**                   | The ways of moving as records, a sensing context, contributions as a list, first pass keeping every operation's order (S1); a body's frame and its controller's settings, standing found with any shape (S2); the systems as modules with indexes (S3); a table per component and `setComponent` (S4); a registry of level line kinds (S5); the game's words namespaced, a generic game event (S6); colliders per body, one shape adapter, the controller per call (S7); one emitter of light and receivers (S8); the duplicates, the world's edge as data (S9)                                                                                                                                             | Every reference keeps its hash, the version parts unchanged                                                                                                                                          | No (the same bits)                         |
| **5.5f — The debts that change the simulation, in one version** | The state grouped by way of moving (S1, second pass); schemas with defaults, the hash leaving out defaults and `undefined` (P2); motion reset by leaving a way of moving, so a checkpoint ends a roll (W6); posture a property of the way of moving (S6)                                                                                                                                                                                                                                                                                                                                                                                                                                                    | One engine version; every reference recorded again once, its new hash explained                                                                                                                      | Yes (one version)                          |
| **5.5g — The view's shape**                                     | The quality tier's module, today one tier, the floor, with 0026's numbers (V1); an index of entities by component (V7); what moves apart from what stands still, batched by material and by cell, materials cached (V2); one assets service with KTX2 and meshopt ready, handles released, props without rigs (V6); the look as data, the far plane from the fog (V4); the camera's pipeline (V8); scopes (V9); a weapon's feel as data beside its looks, the mount's options grouped, narrow handles (V10); page services built once (V11); bands of animation detail (V12); a budget of voices, probes written on change, shadows' flags (V13). It may run beside 5.5e and 5.5f: it touches only the view | The citadel and every game's levels measured before and after (draw calls, frame time on the Iris Plus); a page mounted and stopped a hundred times leaks nothing; the budget asserted from the tier | No                                         |
| **5.5h — The games on one library**                             | The level's run in the library (G1); the shell's helpers, a headless driver and the test kit (G2); a game's scores and the progress's migration (G3); the arms from tables with options, the wall's weapons the wall's (G4); the Dojo's mechanisms out, currents to the core's zones (G5); the arms' contracts tested in `arms` (G6); the adventure's generator in the library (G7); the names (G8); the camera, music, credits, keys and words each given once (G9); public surfaces trimmed (G10); one registry of games for the site's pages, cards and references, the shell tested once (G11)                                                                                                          | A fixture game in a test is its rules, levels, words and music, with no file copied; the four games' references keep their hashes                                                                    | No, if each game's keys and order are kept |
| **5.5 — Its close**                                             | The targets measured; the roadmap the plan only, its finished stages linked to their reports (D2); what changes in decision 0032 applied (below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The forest starts                                                                                                                                                                                    | No                                         |

The order: what is wrong first, then the guards and the proofs (every later refactor leans on them to show it changed
nothing), the environment (every later stage runs faster in it), the simulation to the bit, then its one version, the
view beside them, and the games last, on the library the rest left.

**Targets** (hypotheses the close confirms or corrects):

|                                         | Today                                | Target                                                                            |
| --------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| The type check                          | 77 s                                 | at most 30 s from nothing, 10 s after a change                                    |
| The headless tests                      | 118 s                                | at most 45 s for all of them; at most 20 s for `npm test`, the playthroughs apart |
| Continuous integration, one push        | 15 to 46 min                         | at most 12 min                                                                    |
| Files a new game copies                 | about 9                              | none                                                                              |
| Replays re-written by one game's change | 21                                   | that game's                                                                       |
| Every game's references, checked in     | Node (the Dojo's: the four browsers) | the four browsers                                                                 |
| A new file, guarded                     | if someone lists it                  | always                                                                            |

### What it changes in decision 0032 (applied when this is accepted)

- The forest starts when 5.5 closes, not when phase 5's stages do.
- F1's audit of what assumes the mannequin is this audit's S2, and its fix is 5.5e's: F1 confirms it.
- F2's `terrain` line is a kind in S5's registry, the height field a collider through S7's adapter, the water a zone
  in the core (G5), and the re-simulation test exists (P4): F2 adds the terrain's case.
- F3 builds the scenery service (V3) on 5.5g's registry of what stands still and its assets service, and adds the high
  tier to V1's module; the light pool exists.
- F4 to F7's ways of moving (the rope, swimming, diving, riding, and the fairy's flight) are new records of S1; F5's
  beam, reflection and "lit" extend S8's emitter; the creatures' sounds and affordances are namespaced words (S6).

## Alternatives considered

- **Refactoring inside the forest's stages, as each needs it.** Each forest stage would change hashes for its refactor
  and its new behaviour at once, and the references could no longer prove which was which; and four games would copy
  the level's run and nine files meanwhile.
- **A rewrite.** The 21 reference replays are the proof that a refactor changed nothing; a rewrite throws the proof
  away. Everything here is moved under them.
- **Only what is wrong and the environment.** Cheaper, but S1, S2, S5, S7 and S8 are the forest's preconditions (the
  new ways of moving, bodies of other sizes, the terrain's line, the height field, the beam): done inside F2 to F7,
  they would change hashes beside new behaviour.
- **A worktree per session** (one reading's advice). The author works with two sessions in one folder, by choice; E6
  keeps that and removes what made it fragile.
- **A package per system.** The layers stay few: inside the core, modules, not packages. A package costs a
  configuration, a lint block and a version, and the core's systems share its state.
- **The scenery service and the quality tiers' numbers now.** They are the forest's, after F0 measures the valley;
  5.5 leaves their seams (the registry of what stands still, the assets service, the tier's module with one tier).

## Consequences

- Every piece has one place, the places are guarded by default, and a change to one game touches only its own replays.
- The forest's stages build on seams instead of moving pieces first: a new way of moving is a record, a new line a
  kind, a new body a frame, a new light an emitter, a new game its rules, levels, words and music.
- The two sessions share one folder with less to trip on: a scratch folder, no silent test server, the engine's tests
  independent of the tutorial's code, every commit verified, and a `CLAUDE.md` both read first.
- **The risk:** a consolidation that does not end. Each stage is a closed list with its "done when"; a finding not on
  this list goes to the forest's stages or the idea bank, not here; and the stages that make the rest cheaper (the
  guards, the proofs, the environment) come first.
- **The cost:** of the size of 4.5 (six stages and its close there; eight here, two of them large: 5.5e and 5.5g).
- **For the tutorial session:** E2 removes a coupling it suffers; its superseded documents and its section of the
  roadmap (D5) are forwarded to it; the site's status (D1) touches two of the site's pages, done with it told.

## Sources

- [The audit of 2026-11-19](../audits/the-code-before-the-forest.md), with every finding's evidence.
- The measures: `npm run check` and `npm test` timed, each test file timed (vitest's JSON report), continuous
  integration's last runs (`gh run list`), all on 2026-11-19.
- Decisions [0003](0003-boundaries.md) (amended the same day: the four layers), [0016](0016-the-networking-model.md),
  [0020](0020-saved-games.md), [0025](0025-replays-ghosts-and-baselines.md), [0026](0026-a-levels-look.md),
  [0032](0032-the-forest.md).
