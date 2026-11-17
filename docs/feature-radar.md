# The feature radar: what the games may pull in, when they need it

Phase 5 builds three compact games on the engine as it is after stage 4.5. This page lists features that could enrich them, read from a catalog of ideas (kept outside the repository, like the drafts) and checked against the code on 2026-11-17. **Nothing here is built ahead.** A game pulls a feature in when its own design asks for it, and then the feature goes through the four questions every feature does:

1. **The same bits everywhere:** in Chromium, Firefox, WebKit and Node, with our own trigonometry, never the browser's.
2. **Composed, not special-cased:** a way of moving, a contribution, a signal's operator, a game's damage filter, a query, rather than an exception inside the step.
3. **Re-simulable (decision 0016):** whatever moves can say where it was at a past step, as a function of the step or from state already kept, so a client can re-simulate its own character.
4. **Checked in a recipe:** built from a level line or the console, and checked without a screen (`wait`, `assert`).

**Effort**, as the catalog scales it, corrected where the code says otherwise:

- **P1:** the game's or the level's own (a cartridge rule, a brain, level data), no change to the engine's simulation.
- **P2:** a seam of the engine (a way of moving, a signal's operator, a level keyword, a brain's capability); usually a new `SIMULATION_VERSION`.
- **P3:** a new seam, or phase 7 or 8.

## What the catalog got wrong (checked in the code)

- **`affords` is data no brain reads yet.** The level format keeps `affords cover | throw | kick | weak` since 4d, and no brain uses it. Teaching the guards to (taking cover, throwing, kicking, aiming at a weak point) is a brain's work: no change to the simulation, P1.
- **Signals have no time.** The operators are `input`, `zone`, `used`, `seen`, `any`, `all`, `not`, `toggle` and `latch`; `timer`, `delay` and `clock` are new operators with state in the world: P2.
- **A box moves one way.** The format refuses `move` with `spin` (or a door, or a lift) on one box, so a saw blade travelling on a rail is a format change: P2, not P1.
- **A current carries only who stands in it.** An updraft for gliding needs currents to carry a character in the air: P2.
- **A spinning platform's turn is Rapier's,** not a function of the step (the roadmap notes it for phase 6). A pendulum written as a closed function of the step is the right shape: P2 (a keyword).
- The catalog's sample recipe uses a syntax that is not the console's (`add box name … size …`).

## The platformer

| Feature                                                                                                                 | Effort | What it stands on                                       | Pulled in if                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- | ----------------------------------------------- |
| Corner correction, a stronger gravity when the button is released, a top falling speed, ledges grabbed and climbed onto | P2     | Already planned for the platformer (the roadmap)        | Planned                                         |
| Wall slide and wall jump; between two walls (a chimney)                                                                 | P1–P2  | The climb's wall ray (2c); a jump off a wall's normal   | The levels go up by walls                       |
| Long jump and backflip (crouch with jump, moving or still)                                                              | P1     | The jump, the crouch, the somersault gesture (2e2)      | A level asks for distance or height in one move |
| Crouch slide down slopes and under gaps                                                                                 | P1–P2  | The crouch's low body (4b), the slope's friction (4.5b) | Gaps a run must slide under                     |
| A dash in the air, once a landing                                                                                       | P1–P2  | The roll (4b), the air jumps' counter (2c)              | Gaps wider than a jump                          |
| Ground pound (and through a floor that breaks)                                                                          | P1     | What breaks (3e)                                        | Floors and switches from above                  |
| Updrafts while gliding                                                                                                  | P2     | Glide (2c); currents (3b) carry only who stands         | A vertical level with glide                     |
| Swimming, on the surface and under                                                                                      | P2     | Dense zones (3b), opacity under water (3d)              | Water that is not a death                       |
| Ziplines and rails along a route                                                                                        | P2     | Routes (4d)                                             | Long traversals                                 |
| Wall run                                                                                                                | P2     | A timed way of moving off a wall                        | Speed and walls together                        |

## The action adventure

| Feature                                                                            | Effort | What it stands on                                                                                                                  | Pulled in if                                               |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Parry (a block in its first few steps), stagger                                    | P1–P2  | Blocking (4f), the damage filter; the block's start kept in state                                                                  | The stick's even trade needs breaking (4.5f found it even) |
| Kick (breaks a block, throws)                                                      | P1     | `thrown` (4f), a swept ball; `affords kick`                                                                                        | Ledges, spikes, fires to kick guards into                  |
| Backstab, crouched or unseen                                                       | P1     | Sight (3d), crouch (4b), the damage filter                                                                                         | Stealth is part of it                                      |
| Directional and charged strikes                                                    | P1     | The stick's sweep (4c), the charge (4b)                                                                                            | Combat wants depth                                         |
| A held thing thrown with a charge                                                  | P1     | Holding (3g), the charge (4b), hits by energy (4c)                                                                                 | Crates and barrels are weapons                             |
| Systemic arrows (water puts a lamp out, noise draws guards, fire, a rope to climb) | P1–P2  | Lamps (3d), sounds (3f), climbing (2c), what breaks (3e)                                                                           | A bow                                                      |
| Smoke (a zone that blinds) and a flare (a thrown lamp)                             | P1     | Opacity and light (3d): guards stop or start seeing by themselves                                                                  | Stealth with tools                                         |
| Traps: spikes, crushers, collapsing floors, boulders, turrets                      | P1–P2  | Lifts and doors (3c), the carry's sweep (3a), what breaks (3e), projectiles (4c); a crush when the room left is less than a crouch | Dungeons with danger                                       |
| Pendulums as a function of the step                                                | P2     | A `swing` keyword, our own sine                                                                                                    | Swinging blades                                            |
| Timers, delays, clocks in signals                                                  | P2     | Signals (3c, decision 0018), with state in the world                                                                               | Timed doors, sequences, alarms                             |
| Jamming a mechanism with something heavy                                           | P2     | Doors and lifts (3c), a short sweep                                                                                                | Physical puzzles                                           |
| Cranks (a signal that grows while `use` is held), counterweights                   | P1–P2  | `used` (3c), mass (3g)                                                                                                             | Slower, riskier puzzles                                    |
| Lasers, mirrors, receivers                                                         | P2     | Rays (2.5b), the light phase (3d)                                                                                                  | Light puzzles                                              |
| Rising water, gas or lava                                                          | P2     | Zones that move (they do not, today)                                                                                               | A room that floods                                         |
| Chemistry: oil burns, water conducts, cold freezes                                 | P1–P2  | Materials (3b), what breaks (3e), lamps (3d)                                                                                       | Systemic play                                              |
| What holds what up (`supported_by`), a chandelier on a chain                       | P2     | What breaks (3e), names (3b)                                                                                                       | Collapses with consequences                                |
| A thrown spy camera                                                                | P1     | The view only (like `possess`, 4e)                                                                                                 | Scouting                                                   |

## The shooter

| Feature                                                                               | Effort | What it stands on                                                                | Pulled in if                 |
| ------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- | ---------------------------- |
| Rocket and grenade jumps, air strafing                                                | P1–P2  | The blast (4f), `thrown`; already the shooter's candidate mechanic (the roadmap) | Planned as a candidate       |
| A shotgun's pellets                                                                   | P1     | A shot's own dice by index (`shotDice`, 4c)                                      | A close-range weapon         |
| Ricochets and bouncing grenades                                                       | P1–P2  | Projectiles (4c), a material's bounce (3b)                                       | Corners matter               |
| A railgun through bodies and thin walls; a shot that sets off a projectile in the air | P1–P2  | `castHit` (4c), a projectile with a body to hit                                  | Weapons with a skill ceiling |
| Jump pads                                                                             | P1     | `thrown`, a push (3g); a bot's parabolic edge                                    | An arena with height         |

## The bots, in any game

Their brains run outside the simulation (decision 0023): a better brain costs no snapshot, no hash and no replay format.

| Feature                                                                         | Effort | What it stands on                                                      |
| ------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `affords` read: cover when hurt, a thing thrown, a kick, a shot at a weak point | P1     | The format's `affords` (4d), unread today                              |
| A change noticed: a lamp out, a door open, a guard down                         | P1     | Sight (3d), a brain's memory                                           |
| The last place seen, and leading a slow shot                                    | P1     | `lost` (3d), the bolt's speed (4c)                                     |
| A trap or a door used against the player                                        | P1     | The planner knows which button changes a signal (4d)                   |
| Squads sharing a board: one flanks, one holds                                   | P2     | One host runs every brain (4e)                                         |
| Kinds of enemy by what they can do (climb, block from the front)                | P1     | Capabilities (2c), the navigation's edges by capability (0024)         |
| Tracks left on wet floors                                                       | P2     | Materials (3b)                                                         |
| The navigation mended where something broke                                     | P3     | The build a little each step (4.5a); a broken bridge today stays in it |

## Destruction, and further off

- **Walls that break in parts** (high cover to low cover to rubble): P2, boxes that break stacked; what is left collides as a fixed box.
- **Persistent debris** that stops shots and piles up: phase 8, the local profile.
- **Strange worlds** (small planets, ceilings walked on, glued and mirrored spaces): phase 7; what assumes "up" is +Y today, [the audit](audits/up-is-y.md).

## If a game asks, the first picks

The most return for the least change, in the order a game would likely ask:

1. **Signals with time** (`timer`, `delay`, `clock`): every game's puzzles and traps.
2. **The guards reading `affords`**: the data is there; the arena and the citadel come alive.
3. **Traps as functions of the step** (spikes, crushers with a crush, pendulums): danger that replays and re-simulates.
4. **Parry, kick, backstab**: the adventure's combat out of its even trade.
5. **Wall jump and ground pound**: the platformer's verbs beyond the jump.
6. **Pellets and ricochets**: the shooter's weapons.
7. **Smoke and a flare**: stealth with tools, with no change to the guards (they read the light).
8. **What holds what up**: collapses in a fixed order, the same everywhere.
