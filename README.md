# Manifold Gaming

**A lab of 3D physical worlds for the web.** An engine of its own (TypeScript, [Three.js](https://threejs.org), [Rapier](https://rapier.rs)) where gravity is a field, things are made of capabilities and what happens can be replayed; a **Dojo** to experiment with it; **games** on top; and a **tutorial** written as the engine grows.

🌐 **Site:** https://rodrigomartinvg.github.io/Manifold_Gaming/ (in Spanish for now)

**Where it is:** the site's home page and the [roadmap](ROADMAP.md) (its table and its "Now"), checked against each other by a test (`status.test.ts`). This README keeps no status of its own: it went stale.

## Where things are

| What                                      | Where                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The plan, and how far it got              | [ROADMAP.md](ROADMAP.md)                                                                                                 |
| Why each piece is as it is                | [docs/decisions](docs/decisions/README.md)                                                                               |
| What each stage found and measured        | [the Bitácora](https://rodrigomartinvg.github.io/Manifold_Gaming/bitacora/) (Spanish), `site/src/content/docs/bitacora/` |
| Audits of the code                        | [docs/audits](docs/audits)                                                                                               |
| The layers, and the role of each file     | [layers.js](layers.js) (the linter's boundaries are made from it, [decision 0003](docs/decisions/0003-boundaries.md))    |
| The engine                                | `packages/common`, `commands`, `core` (the simulation, no screen), `bots`, `net`, `presentation` (what is seen)          |
| The games' library                        | `packages/character`, `kit`, `arms`, `shell`                                                                             |
| The games                                 | `games/dojo` (the lab), `tower`, `fortress`, `wall`, `adventure`                                                         |
| The site and the tutorial                 | `site/` (Astro and Starlight); the tutorial's plan in [docs/tutorial-roadmap.md](docs/tutorial-roadmap.md)               |
| Starting to work on it (people, sessions) | [CLAUDE.md](CLAUDE.md): the commands, the rules, the map                                                                 |

**Languages:** the site (the tutorial, the Bitácora, its pages) is in Spanish; everything else, the code, the console, the tests, the decisions and the commits, is in English ([decision 0011](docs/decisions/0011-languages.md)).

## Working on it

You need [mise](https://mise.jdx.dev) (or Node 26).

```bash
mise install          # Node 26, this project's
npm install
npm run dev           # the site and the Dojo, with hot reload, at http://localhost:4321/Manifold_Gaming/
npm run verify        # types, linter, formatting, every headless test and the performance budgets
```

The rest of the commands, and how to run the browser tests on a port of your own: [CLAUDE.md](CLAUDE.md).

How we work: straight on `main`, checking on the machine first ([decision 0009](docs/decisions/0009-straight-to-main.md)); the way of working in [decision 0005](docs/decisions/0005-way-of-working.md).

## Where it comes from

It is the second version of an engine that grew step by step as a shooter. No code is copied from that version: lessons are brought over, written down with their numbers in [decision 0000](docs/decisions/0000-why-a-v2.md).
