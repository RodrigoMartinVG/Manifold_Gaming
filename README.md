# Manifold Gaming

**A lab of 3D physical worlds for the web.** An engine of its own (TypeScript, [Three.js](https://threejs.org), [Rapier](https://rapier.rs)) where gravity is a field, things are made of capabilities and what happens can be replayed; a **Dojo** to experiment with it; **games** on top; and a **tutorial** written as the engine grows.

🌐 **Site:** https://rodrigomartinvg.github.io/Manifold_Gaming/ (in Spanish for now)

> Status: **phase 3 is under way** (a world that responds): 3a made what the program moves solid, 3b gave levels names, materials (a character slides on ice) and zones with data, 3c brought signals (a button opens a door, plates call a lift), 3d made the light the simulation's (a watcher sees you in the light and loses you in the dark), 3e brought what breaks (a ball breaks the lamp, and the watcher loses you), and 3f the sound, made in the browser from what the simulation says happened. In the Dojo, a character runs, jumps, climbs, glides and double-jumps (each capability turned on and off live) in levels written as text, and rides platforms that move and turn; its replay gives the same hash in Chromium, Firefox, WebKit and Node. Stage 2.5 laid the seams the next phases lean on (reference replays, the same hash checked in every browser, performance budgets, the presentation in pieces, the core's seams, the execution profile); in 2e and 2e2 the character became a mannequin made and animated by a script, whose animations follow where it really goes. The phase closed with the circuit, a longer level in the Dojo played from start to goal by a test, and the tutorial's five lessons of stage 2.

## How it is organized

```
packages/common         seeded randomness and math on plain data
packages/commands       the registry and interpreter behind the console (no screen)
packages/core           the simulation: the world, its fixed step, its events (no screen)
packages/net            the match: the server that orders the inputs, and the clients that check their copy (no screen, no transport)
packages/presentation   what is seen: Three.js, and the console
games/dojo              the first game (the lab), with its saved rooms in recipes/
site                    the website: home, the project, play, the tutorial and the Bitácora (Astro + Starlight)
site/src/lessons        the lessons' code (edited and run in the page)
docs/decisions          the architecture decisions, with their why
e2e                     tests in a real browser (Playwright)
```

The layers only depend inward: the core knows neither the presentation nor the games. The compiler and the linter guard it ([decision 0003](docs/decisions/0003-boundaries.md)).

**Languages:** the site (the tutorial, the Bitácora, its pages) is in Spanish; everything else, the code, the console, the tests, the decisions and the commits, is in English ([decision 0011](docs/decisions/0011-languages.md)).

## Working on it

You need [mise](https://mise.jdx.dev) (or Node 26).

```bash
mise install          # Node 26, this project's
npm install
npm run dev           # the site and the Dojo, with hot reload
```

| Command                | What it does                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | The site at http://localhost:4321/Manifold_Gaming/                                                                                                      |
| `npm run verify`       | Types, linter, formatting and headless tests                                                                                                            |
| `npm run test:watch`   | The tests, run again on every save                                                                                                                      |
| `npm run e2e`          | Builds the site and tests it in Chromium, and the physics also in Firefox and WebKit (the first time: `npx playwright install chromium firefox webkit`) |
| `npm run build`        | The site ready to publish, in `site/dist`                                                                                                               |
| `npm run draw -w site` | Generates the site's drawings again (background, logo, gears) from their geometry                                                                       |

Where it is going and how far it got: [ROADMAP.md](ROADMAP.md).

How we work: straight on `main`, checking on the machine first ([decision 0009](docs/decisions/0009-straight-to-main.md)); commits and tags per stage in [decision 0005](docs/decisions/0005-way-of-working.md). All the decisions: [docs/decisions](docs/decisions/README.md).

## Where it comes from

It is the second version of an engine that grew step by step as a shooter. No code is copied from that version: lessons are brought over, written down with their numbers in [decision 0000](docs/decisions/0000-why-a-v2.md).
