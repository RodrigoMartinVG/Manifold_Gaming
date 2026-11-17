# 0025. Replays across versions, ghosts as strips of poses, and the baselines before the games

- **Status:** accepted
- **Date:** 2026-11-17 (accepted under the author's instruction to go through stage 4.5 following these recommendations)

## Context

A replay is the inputs of a match and the world it was born in (1c): played again on the same simulation, it gives the same world, and its last line's hash says so. That is what makes it worth having: it is checked. It is also why a replay plays only on the simulation that recorded it: the version is in its first line (`# Manifold replay 37`), and stage 4.5b changed the simulation once more. The site keeps only its latest engine.

Ghosts used the same thing. A ghost was a second world, born like the replay and fed its inputs, run beside the live one and drawn translucent (1c). So a ghost cost as much as the live world, two ghosts as much as three worlds, and every new version of the simulation broke every ghost link already shared. Phase 5's platformer races ghosts, several at once.

The open question (written in 2026-11-15's review): keep each published version of the engine, or ghosts as recorded positions, which survive the engine's changes but are checked by nothing, with replays by inputs for what must be exact. Its proposal: strips of quantized poses, `x y z yaw mode` every 3 or 4 steps, under 2 KB a minute.

And stage 4.5 owes the baselines: what the engine costs before the games are built on it, measured, so that phase 5 knows where it starts and later work knows when it made things worse.

## Decision

### Replays stay by inputs: exact, and of their version

- A replay is still its inputs, its world's changes and its birth, and still plays exactly only on the simulation that recorded it (its version in its first line). Nothing in it is approximate; that is its use: a bug reproduced, a match checked, the reference replays that guard the simulation (2.5a).
- The site keeps only its latest engine. A replay link recorded on an older version says so and cannot be checked; keeping every published version of the engine (and its levels, and its game) on the site would cost more than what it saves.
- The reference replays are recorded again whenever the simulation changes on purpose (since 2.5a), once per version (4.5b: one version for all its debts).

### Ghosts are strips of poses: drawn, not simulated

- **What a ghost is:** where the player was, where it looked and how it moved, every 6 steps (ten a second), recorded by the page as the player plays, from its world's birth. Positions to the centimeter, where it looks to a tenth of a degree, its way of moving by name (`walk`, `air`, …). Not its inputs: a strip is drawn on any version of the engine, checked against nothing.
- **Drawn between its poses:** along the straight line between two, looking by the shorter way round; its animations read a character made of its poses (its way of moving, where it looks, how fast it went). Its feet and hands meet the live world's floor and walls (the same level). No second world: a ghost costs a little drawing, so several at once cost little.
- **As text** (`# Manifold ghost 1`, a format of its own, not the simulation's version): its game, its birth (the room it was recorded in), its spacing, its first pose, then for each next pose how much what changed changed (the second difference, in whole centimeters and tenths of a degree) and its way of moving when it changes. Walking straight, or falling, that is the same line again and again, which a link's deflate makes little of.
- **Older ghost links** (a replay, before 4.5c) are still raced: the page plays the replay once, without a screen, for the strip of its player. On a newer engine that is near what was done, not exactly it, as a ghost is anyway.

Why every 6 steps: measured on a minute of running about (walking and running, turning all the time, jumping), in a link's deflate: every 4 steps (the open question's proposal) 2.7 KB, every 6 2.3 KB, every 8 2.0 KB. Between two poses six steps apart a straight line strays from a jump's arc by at most g t²/8, 1.2 cm, and cuts a sharp dodge's corner by at most v t/2, 22 cm; eight steps apart, 30 cm. The open question's 2 KB was an estimate: ten poses a second at 2.3 KB a minute is the better ghost.

### The baselines, measured before the games

Measured on 2026-11-17, in Node on the author's laptop, the code warm, 30 seconds of each scene after two of warming (the step with its bots' thinking; a snapshot as the server counts it, the physics' bytes and the entities as text; a link as a replay or a ghost is written in one, deflated and in base64):

| Scene                              | Bodies, bots | Step (mean, 99th, most) | Hash   | Snapshot       | Replay link, 32 s | Ghost link, 32 s |
| ---------------------------------- | ------------ | ----------------------- | ------ | -------------- | ----------------- | ---------------- |
| The course, walking and turning    | 20, 0        | 0.15, 0.56, 1.8 ms      | 0.7 ms | 43 KB, 0.4 ms  | 6.0 KB            | 1.5 KB           |
| The course, aiming in first person | 20, 0        | 0.20, 0.59, 1.4 ms      | 0.5 ms | 44 KB, 0.2 ms  | 17.9 KB           | 0.7 KB           |
| The arena, aiming, three guards    | 14, 3        | 0.32, 0.89, 1.2 ms      | 0.8 ms | 47 KB, 0.3 ms  | 23.4 KB           | 0.7 KB           |
| The stress room, 200 cubes         | 207, 0       | 0.35, 0.96, 1.6 ms      | 2.4 ms | 547 KB, 0.9 ms | 6.0 KB            | 1.5 KB           |
| The citadel, played (4.5f)         | 325, 2       | 1.2, 4.7, 23 ms         | 5.7 ms | 734 KB, 1.9 ms | 4.6 KB (61 s)     | —                |

And from stage 4.5a, a room's start: the navigation built a little each step, its slowest step 32 ms at the arena's start (874 ms built in one go).

Added in stage 4.5f, the heaviest: the citadel (a level of the kit's 293 pieces on three floors, two guards), its reference replay played from start to goal with the guards thinking (3,632 steps; three runs). The snapshot: 475 KB of physics, 259 KB of entities as text (22 KB deflated). Its navigation: 4,370 cells and 32,428 edges, 0.57 s built in one go, built a little each step in 277 steps with none over 20 ms. Its first step, once: 0.14 to 0.3 s (before the physics' first step none of its bodies is in Rapier's queries yet, and each query asks every one on its own). In the browser, on the author's Iris Plus at 1280 × 720, unthrottled: 4.2 to 7.2 ms a frame (the course, 2.9), 97 to 277 draw calls. The same hash in Chromium, Firefox and WebKit (its replay is a reference). Before 4.5f mended what it found, its step was 3.6 ms on average, 75 at the 99th and 200 at most.

These are milliseconds on one machine; the budgets that guard them in continuous integration stay measured against Rapier's own step (`perf/`, 2.5a), which does not depend on the machine. The table is where phase 5 starts.

## Consequences

- Phase 5's platformer races ghosts that a new version does not break, several at once, each costing a little drawing.
- A ghost is not proof of anything: a leaderboard that must be trusted needs the replay, on its version.
- Aiming makes replays bigger: where to look travels to a tenth of a degree since 4.5a (in whole degrees, a first person's aim went in jumps), so a mouse that never rests gives a new input every step: 18 to 23 KB for 32 s of aiming, against 4.8 KB for 30 s in 2.5c's whole degrees. Writing where to look as what changed would save 20 to 40% (measured); left for when links of long matches matter (phase 6).
- The baselines are written once here; a later decision updates them when something worth measuring changes (phase 5's levels, phase 6's networking).

## Alternatives considered

- **Every published version kept on the site,** so that an old replay plays on its own engine: every bundle, every level, every game's words, kept and served; and the reference replays could not guard the simulation any more (an old one would always pass on its old engine).
- **Positions alone,** without the way of moving: the animations would guess it from the speed, and a glide, a climb or a roll would be drawn as walking.
- **Ghosts as replays, with the engine kept compatible:** the simulation could never change a hash again; every debt of 4.5b would have been left unpaid.
