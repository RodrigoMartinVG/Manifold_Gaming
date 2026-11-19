# 0003. The boundaries between layers, guarded by the compiler and the linter

- **Status:** accepted; amended 2026-11-19 (four layers, and where a piece goes: below)
- **Date:** 2026-11-11

## Context

The simulation has to run the same in the browser, on a server and in the tests. In V1 the boundary was guarded by a test that searched the code for words ("document", "THREE.Mesh"); before that test existed, the boundary was crossed (step 10c's "mesh debt").

## Decision

Three guards, from the strongest to the weakest:

1. **The compiler.** `packages/common`, `packages/commands` and `packages/core` compile **without the DOM library** (`"lib": ["ES2023"]`, `"types": []`). Writing `document`, `window` or `HTMLElement` in the simulation **does not compile**.
2. **The linter** (`eslint.config.js`, `no-restricted-imports`):
   - `common` and `commands` import nothing of the project, nor Three.js;
   - `core` does not import Three.js, nor the presentation, nor a game;
   - `presentation` does not import a game;
   - a game imports the engine (`common`, `commands`, `core`, `presentation`), never another game;
   - a game's **cartridge** (its rules) does not import Three.js nor the presentation: it runs without a screen.
3. **The declared dependencies:** each `package.json` says what it depends on; the core does not declare `three`.

## Amended (2026-11-19): four layers, and where a piece goes

The code grew a layer this decision did not name: **the games' library** (`character` in 4a, `kit` in 4.5e, `shell` in
5b, `arms` in 5e), what several games share, imported by them and never by the engine. Its guards came one package at a
time and by hand, and not to all of it: `arms`, whose weapons and stealth run in the step, had neither the headless rule
nor the one for the same bits in every browser; `shell` could import a game; a game's rules could import the kit's and
the weapons' models. On 2026-11-19 all three were guarded (`eslint.config.js`; `arms`'s brain is named out, as a brain
may use any arithmetic, decision 0023, and so are its models). The layers, from the engine out:

| Layer           | Packages                            | Its rules part                                                                                    |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| Foundation      | `common`, `commands`                | Imports nothing of the project; no screen, the same bits                                          |
| Simulation      | `core`                              | No screen, the same bits; never the view, the network or a game                                   |
| Engine services | `bots`, `net`                       | No screen; never a game                                                                           |
| View            | `presentation`                      | Never a game                                                                                      |
| Games' library  | `character`, `kit`, `arms`, `shell` | Its rules (all but its models and its brains): no screen, the same bits; never a game             |
| Cartridges      | `games/*`                           | Its rules (`cartridge.ts`, `rules.ts`, `levels.ts`): no screen, the same bits; never another game |

**Where a piece goes,** four questions in order: would a game of another world use it as it is (the engine); is it in
the hash or only drawn (the simulation or the view); is it shared by several games and meaningless outside them (the
library); is it one game's level, number, word or rhythm (its cartridge). Inside a piece, **the engine gives the
measure and the game its meaning**: the simulation computes the light a body receives, and one game cleans with it,
another feeds a flyer, a third lets a guard see. Two signs of a piece in the wrong layer: a game that has to copy a
mechanism to tune it (the engine lacks a parameter), and the core needing a game's word (it went too far down).

What is left of this amendment is stage 5.5b's ([decision 0033](0033-the-shape-before-the-forest.md), proposed): one
table of layers read by the linter, guards by default (a new file is guarded unless it is named out), the library's
rules compiled without the DOM so that the compiler, this decision's strongest guard, reaches them too, and each
game's rules in files of their own.

## Consequences

- A boundary error shows up when compiling or linting, with a message that says why.
- The simulation's tests use Vitest; those files can import `vitest`, which brings Node types: they compile with `skipLibCheck`.

## Alternatives discarded

- **A test that searches text** (V1's): it works, but it comes late (when running the tests) and comments fool it.
- **dependency-cruiser or a boundaries plugin:** more powerful; for four layers, `no-restricted-imports` is enough.
