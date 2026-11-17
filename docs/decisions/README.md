# Architecture decisions

Every important decision is written down here, with its why, in a short, numbered document (an _Architecture Decision Record_, ADR). They keep us from discussing again what was already decided without knowing why it was decided, and they let the tutorial cite them.

Each one has: **context** (what problem there was), **decision**, **consequences** (the good and what it costs) and discarded **alternatives**. A decision is not deleted: if it changes, a new one is written that replaces it, and the old one is marked as _replaced_.

| No.                                           | Decision                                                                                  | Status                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [0000](0000-why-a-v2.md)                      | Why a V2, and what we take from the drafts and from V1                                    | Accepted                                                                     |
| [0001](0001-monorepo-and-tools.md)            | A monorepo, and its tools                                                                 | Accepted                                                                     |
| [0002](0002-the-site.md)                      | The site: Astro with Starlight, on GitHub Pages                                           | Accepted                                                                     |
| [0003](0003-boundaries.md)                    | The boundaries between layers, guarded by compiler and linter                             | Accepted                                                                     |
| [0004](0004-state-as-data.md)                 | The world's state as plain data                                                           | Accepted (completed in phase 1)                                              |
| [0005](0005-way-of-working.md)                | How we work: branches, PRs, commits, tags, language                                       | Accepted (branches and PRs: 0009; language: 0011; pace of the lessons: 0013) |
| [0006](0006-the-name.md)                      | The name: Manifold Gaming                                                                 | Accepted                                                                     |
| [0007](0007-executable-tutorial.md)           | The executable tutorial and the Bitácora                                                  | Accepted (refined by 0013)                                                   |
| [0008](0008-the-workshop-look.md)             | The site's look: the workshop                                                             | Accepted                                                                     |
| [0009](0009-straight-to-main.md)              | Straight to main, without pull requests                                                   | Accepted                                                                     |
| [0010](0010-the-console-and-recipes.md)       | The console and the recipes                                                               | Accepted (language: 0011)                                                    |
| [0011](0011-languages.md)                     | Languages: the site in Spanish, everything else in English                                | Accepted                                                                     |
| [0012](0012-the-games.md)                     | The games: the classics first, the strange ones after                                     | Accepted                                                                     |
| [0013](0013-a-deeper-tutorial.md)             | One tutorial, deeper: the short path stays                                                | Accepted                                                                     |
| [0014](0014-the-execution-profile.md)         | The execution profile: the physics, and who verifies it                                   | Accepted                                                                     |
| [0015](0015-art-and-sound.md)                 | Where the art and the sound come from: code, scripts, free packs                          | Accepted (refined in 2e)                                                     |
| [0016](0016-the-networking-model.md)          | The networking model: each predicts only its own character                                | Accepted                                                                     |
| [0017](0017-phase-5-scope.md)                 | Phase 5's scope: three compact games, of 10 to 15 minutes                                 | Accepted                                                                     |
| [0018](0018-signals.md)                       | Signals: named values, once per step, in the order written                                | Accepted                                                                     |
| [0019](0019-the-games-words.md)               | The games' words: keys in the world, the player's language                                | Accepted                                                                     |
| [0020](0020-saved-games.md)                   | Saved games: the progress, as versioned data                                              | Accepted                                                                     |
| [0021](0021-a-new-tutorial.md)                | A new tutorial: one project that grows, the math when the game asks for it                | Proposed (accepted with its pilot; replaces 0013's structure)                |
| [0022](0022-hits-and-the-history-of-poses.md) | Hits and the history of poses: a shot looks back as far as its shooter saw                | Accepted                                                                     |
| [0023](0023-where-a-bot-thinks.md)            | Where a bot thinks: a bot is a player, its brain runs where the match is hosted           | Accepted                                                                     |
| [0024](0024-navigation.md)                    | Navigation: a grid of where a body fits, with edges that ask for a capability or a signal | Accepted                                                                     |
