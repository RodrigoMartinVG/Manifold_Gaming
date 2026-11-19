# The code before the forest: technical debt, read layer by layer

On 2026-11-19, before the forest ([decision 0032](../decisions/0032-the-forest.md)), the author asked for a deeper
look: "un análisis más profundo sobre refactors y deuda técnica, y tener una hoja de ruta para mejorar varios aspectos
[...] y pensar la solución más óptima de todas, en la que todas las piezas encajan a la perfección". This is the
reading; [decision 0033](../decisions/0033-the-shape-before-the-forest.md) is the plan built on it.

**How it was read.** Four readings, one per layer (the simulation; the view; the games and the library they share; the
environment: tests, tools, continuous integration, documents), each reporting its findings with the file and line
they stand on, plus measures taken for this audit (the type check, the tests and each test file timed, continuous
integration's last runs read). Every finding marked **(checked)** was read again in the code by the author of this
document before it was written here; the others come from one reading and were not contradicted by anything checked.
Where a reading was unsure, it says so.

**What counts as debt here.** Three kinds, in this order: what is **wrong today** (a bug, or a rule the project wrote
and does not keep); what makes **pieces not fit** (two ways to do one thing, a concept with no owner, a mechanism in a
game or a policy in the engine, a patch where a rule should be); and what **the forest will run into** (four more
games, new ways of moving, bodies of other sizes, a valley of 500 × 500 m loaded by zones).

## The measures

| What                                   | Today                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run check` (types, every package) | 77 s, one package after another; core is checked about 14 times, as each package re-checks it        |
| `npm test` (headless)                  | 118 s: 98 files, 868 tests, all passing                                                              |
| Its slowest file                       | `games/wall/src/levels.test.ts`, 109 s: four levels played one after another in one file             |
| The next ones                          | the fortress's levels 59 s, the citadel 28 s, the wall's rules 27 s, the Dojo's references 26 s      |
| The ten slowest files                  | 73% of the 442 s the files add up to                                                                 |
| Continuous integration, one push       | 15 to 46 min in one job (the last: installing the browsers 30 min, the browser tests 13 min)         |
| The simulation's version               | 49, one for the engine and every game; 21 reference replays re-written at each                       |
| The largest source files               | `core/world.ts` 1,346 lines, `core/character.ts` 1,303, `core/level.ts` 1,265, `core/physics.ts` 877 |
| Suppressions (`any`, `@ts-ignore`…)    | 6 in the whole code; no `TODO` or `FIXME`                                                            |

The code is young (eight days) and disciplined: almost no suppressions, every package tested, determinism guarded,
every level of every game played to its end by a test that records a reference replay. The debt is where the stages
met: each stage put its piece where it fit at the time, and the seams are where the next one had to copy, wrap or
special-case it.

## 1. Wrong today

| #   | What                                                                                                                                                                                                                                                                                                                                                                                     | Evidence                                                                                                                                            | Fix                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| W1  | **A restored world loses its game's kit (checked).** The session gives a new world the cartridge's `filterDamage` and `kit`; `load()` gives back only `filterDamage`. After joining a match or loading a snapshot, that copy refuses `add kit …` while the host accepts it.                                                                                                              | `core/session.ts:198-199` against `:331-332`; `World.kit` defaults to `{}` (`world.ts:294`)                                                         | One `attach(world)` in the session that sets every hook the cartridge gives, used when a world is born, loaded and compared   |
| W2  | **`level.diff` builds its comparison without the kit (checked):** for every level with kit lines (the fortress's, the wall's, the tower's floors 4 and 5, the citadel, the gym) the game's `onStart` throws, and the world is not disposed.                                                                                                                                              | `core/building.ts:240-243`                                                                                                                          | The same `attach`                                                                                                             |
| W3  | **What glows writes into materials other entities share (checked).** A lamp's glass and a character's joints and visor are one material for every copy of the model; the glow sets it per entity, so every lamp shows the state of the last one processed, and a guard who sees someone turns every character's visor red.                                                               | `presentation/lights.ts:153-163`; copies share all but `body` (`bodies.ts:210-227`)                                                                 | The glowing material owned per instance, as `body` is (or an instance attribute once batched)                                 |
| W4  | **The six-light rule is not kept (checked).** The pool adds and removes lights as the number of lamps changes (a flare thrown, one burnt out: every lit material recompiled), and the muzzle flash is a seventh light outside the count.                                                                                                                                                 | `presentation/lights.ts:174`; `fire.ts:116-118`                                                                                                     | One pool of fixed slots for the whole level, flashes included, with priority and hysteresis                                   |
| W5  | **The games are drawn without anti-aliasing (checked).** With the atmosphere on (every game since 5j) the scene goes through three's composer, whose render target has no multisampling; the canvas still pays for `antialias: true`.                                                                                                                                                    | `presentation/stage.ts:168`, `:286-303`; three's `EffectComposer.js` (a `HalfFloatType` target, no `samples`)                                       | The chain built from the quality tier: samples on its target, or a cheap edge pass at its end; no composer when no pass is on |
| W6  | **Sent to a checkpoint, a character keeps part of what it was doing (checked):** `place()` resets five fields of its motion, not the roll, the pending jump, `nearWall`, `hung` or the steps in the air: one sent back mid-roll keeps rolling, and within the coyote time of a wall it can leap off that wall from the checkpoint.                                                       | `core/world.ts:1246-1254`                                                                                                                           | One reset of motion, owned by the ways of moving (S1)                                                                         |
| W7  | **The determinism check across browsers plays only the Dojo's replays (checked).** The tower's, the fortress's and the wall's fourteen are played only in Node: their rules (the arms, the stealth, the platformer's forgiveness, the pellets on the world's dice) are never compared in Firefox or WebKit, which is the project's first promise.                                        | `e2e/determinism.e2e.ts:12`; `games/dojo/src/check.ts:2-3`                                                                                          | The check made generic (a cartridge and its replays), every game's references in the four                                     |
| W8  | **Some commits on `main` are never verified (checked):** a push cancels the run of the previous one, so stage 5k's commit was never checked on its own.                                                                                                                                                                                                                                  | `.github/workflows/ci.yml:20`                                                                                                                       | Cancel only a pull request's runs                                                                                             |
| W9  | **Five places say where the project is, and they disagree (checked):** the README says phase 3 is done; the roadmap's table shows phase 5 to do, its heading in progress, its "Now" done; the site's home marks phase 2 current (`site/src/stages.ts`); the project page points at phase 4. And `arms` ran in the step without the guards its neighbours have, from 5e until this audit. | `README.md:7`; `ROADMAP.md:18`, `:239`, `:7`; `site/src/stages.ts:19`; `site/src/content/docs/proyecto.md:57`; `eslint.config.js` before 2026-11-19 | One status, written once and read by the rest (D1); `arms` guarded (done on 2026-11-19)                                       |

## 2. The shape: layers and their guards

- **L1. Four layers, and decision 0003 names three (checked).** Between the engine and the games the code grew **the
  games' library**: `character` (4a), `kit` (4.5e), `shell` (5b), `arms` (5e), shared by games and imported by them.
  Its guards came one package at a time, by hand: `character` and `kit` have their rules part guarded (no screen, the
  same bits in every browser), `arms` had neither until this audit (its weapons and stealth run in the step), `shell`
  could import a game, and a game's rules could import the kit's and the weapons' models. All guarded on 2026-11-19.
- **L2. The guards list files by hand, and anything new starts unguarded (checked).** The determinism rules apply to
  a list of paths (`eslint.config.js`, the `sameEverywhere` block); the `games` pattern names only the Dojo and
  `**/games/**`, so a library package importing `@manifold/tower` passes the linter (tried). `Date.now` and
  `performance.now` are not restricted in the simulation. Every forest package (the valley, the creatures, the
  water) would start unguarded, as `arms` did. **Fix:** one table of layers, read by the linter's configuration, with
  a test that every workspace is in it; deny by default (every `packages/*/src` file headless and deterministic unless
  it is a view file or a brain), opt out by name.
- **L3. The compiler, 0003's strongest guard, does not reach the library (checked).** `arms`, `character` and `kit`
  compile with the DOM library and `vite/client`, only because their `models.ts` imports a `.glb?url`: their rules can
  write `window` or `performance` and still compile. **Fix:** each library package with two configurations, its rules
  without the DOM and its view with it; a three-line declaration for `*.glb?url` instead of `vite/client`.
- **L4. Three games build their cartridge in a view file, so they have no entry without a screen (checked).**
  `tower/src/game.ts` imports the presentation and the finale's camera, and builds the levels and the cartridge in the
  same file; `play.ts`, the headless harness, imports it, and pulls three.js into every test. The linter's headless
  rule covers `cartridge.ts`, `rules.ts` and `levels.ts`, which the tower, the fortress and the wall do not have. The
  Dojo does it right. **Fix:** `levels.ts` and `cartridge.ts` in each game, its `game.ts` only the page's.

## 3. The proofs, and the versions they hang on

- **P1. One version for the engine and every game (checked).** Versions 41 to 49 are each one game's or the library's
  change, each saying the rest plays "as before, to the bit"; still every replay of every game is refused by the new
  number (`core/replay.ts:122-127`), and the 21 reference replays are re-written at every bump (stage 5p re-wrote
  fifteen replays of other games with the same hashes; the empty Dojo's has eight commits from 5g to 5p, all other
  games' features). A player's replay link of one game stops working when another game changes. The arms library has
  no version of its own. **Fix:** the version as parts, the engine's and each game's rules' (built from the versions
  of the library packages it uses); a replay names both, and is refused only when one of its parts changed.
- **P2. "Absent means the old behaviour" is a growing pile, and the hash under it is fragile (checked).** Optional
  fields added so other games keep their hashes (`Movement.arc?`, `arc.hang?`, `wall.reach?`, `Character.nearWall?`,
  `hung?`, `Lamp.out?`, `Origin.sky?`, `LevelBox.affords?`, `WorldSnapshot.seed?`), and state `delete`d to become
  absent again (`core/character.ts:888`, `:1103`, `:1143`, `:1230-1231`). The hash walks every key and hashes an
  `undefined` value (`core/hash.ts:50-62`): `{hung: undefined}` and `{}` hash differently, and a JSON round trip
  (phase 6's wire) drops the first. **Fix:** a schema per component with its defaults; the hash and the snapshot leave
  out what equals its default (from the fields added after version 42, so today's hashes stay) and skip `undefined`.
- **P3. The reference replays' workflow is a hand-written list and four copies (checked).** `npm run references` names
  five test files under four names (`package.json:25`); nothing checks that every `games/*/replays` has a recorder;
  `referenceText`, `replays.ts`, the "one per level, of this version" block and a level driver are copied per game.
  **Fix:** a convention (`*.reference.test.ts`), a shared test kit (the text of a reference, replays from a folder,
  the version and playback checks, a level driver), a test that every replays folder has its recorder.
- **P4. The re-simulation that decision 0016 promises is untested (checked).** No code re-simulates one character
  (`net/src/client.ts:32` says it "will be predicted"); 0032's revision asked for a test from F2. It belongs with the
  other proofs, its first cases today's character and its platforms, and the terrain's added in F2.

## 4. The simulation

- **S1. The ways of moving are three hooks and about fifteen special cases.** The `Mode` interface has `steer`, `holds`
  and `fall` (`core/character.ts:206-216`); `modeFor` is a priority chain over eight booleans (`:370-391`);
  `moveCharacter` is one function of about 500 lines (`:795-1303`) that branches on the mode for the roll, the ledge,
  the wall slide, the low pose, the slope rule, the climb's hop, the air jumps, the hang's own displacement
  (`hangMove`), the jump, gravity, facing and sounds; outside it, `poseOf`, the light's visibility (crouch only,
  `world.ts:1170`), the input's actions and the types list every mode by hand. The only contribution besides gravity
  and platforms is `carry`, a velocity for one step: no acceleration (buoyancy, drag towards a current or the wind,
  which a material's density has waited for since 3b), no constraint (a rope). Swimming, a rope, flight and riding
  would each touch about twelve places. **Fix:** each mode a record (when it applies, by a declared priority; entering
  and leaving it; its velocity in 3D; optionally its jump, its facing, its own displacement; its posture: how low, how
  seen, how heard), one context of what the character senses per step, and contributions as an ordered list
  (gravity and the arc, buoyancy, drag, the game's carry, the platform). Two passes: the extraction keeping every
  operation's order (no new version), then the state grouped by mode (one version).
  - **Checked, and it corrects decision 0032:** the `face` input is not "already a direction in 3D". Every
    `direction` input is normalized onto the ground (`core/input.ts:121-124`, `:183-200`); an aim in 3D is `face` plus
    `pitch` today.
- **S2. A body's size is not data: the 1.6 m capsule is written into the core.** The feet at `-0.5` and `-0.8`, the
  eyes, the crouched height `0.625`, the hands' fallbacks, `HOLD`, `PUSH` (`core/character.ts:163-170`, `:313`,
  `:624-719`, `:840`, `:1272`), the mass every blast pushes (`CHARACTER_MASS`, `world.ts:124`), one controller set up
  for every character (`physics.ts:199-208`, "the same for all, for now", `:266`). Worse: `standingOn` returns nothing
  for a body that is not a capsule (`character.ts:584`), so such a character never stands on anything (traction 1, no
  slope rule, the stall 3b measured back). This is the audit decision 0032 moved to F1, found already. **Fix:** a frame
  derived once from the body (half height, radius, where the feet, the hands and the eyes are, its mass); the
  controller's settings per character (step, snap, slopes, push, hold), the mannequin's as defaults; standing found
  with the body's own shape. No new version if the mannequin's numbers come out to the bit.
- **S3. The world holds its state and about ten systems, and they scan everything.** The step's systems are private
  methods of `World` (moving, breaking, reading back the physics, the projectiles, the zones, the light, the signals,
  combat); a contact scans every entity (`world.ts:996`, `character.ts:727`); `named()` is a linear scan run for every
  zone, used and seen signal on every step (`world.ts:595`, `:1187`, `:1208`). Doc comments sit on the wrong
  functions (`world.ts:874-879`; `types.ts:86-92`, `:718`). **Fix:** each system its own module, listed in `PHASES`;
  the world keeps state, lifecycle, queries and indexes (by handle, by name, by component, iterated in id order).
- **S4. A component is described in five places.** Its type, the `Components` omit list that must match
  `createEntity`'s destructuring (`types.ts:676-679`, `world.ts:606`), its validation, its level line (reader, writer,
  builder), the fields `set` may change; games write `e.game = {…}` directly (`games/wall/src/rules.ts:221`). **Fix:**
  one table per component (create, defaults: P2, level line: S5, settable fields) and `setComponent` for games.
- **S5. The level format is one reader of 570 lines, and its piece kinds are told apart in six places.**
  `levelFromText` (`core/level.ts:328-900`) repeats the extras' loop per kind; the kinds are dispatched in
  `level.ts:1090-1253` and five places of `building.ts`. Adding the forest's `terrain` line is about thirteen edits.
  **Fix:** a registry of line kinds (its word, the version since which it exists, how it is read, written, built,
  moved and set), with one shared reader for the extras.
- **S6. The game's words are in the core's closed lists (checked).** The sound event's union holds the stealth's
  `shout`, `huh`, `calm`, `pebble`, the weapons' `ready`, `reload` and the wall's `horn` (`types.ts:742-756`);
  `AFFORDANCES` is closed; `CHARACTER_ACTIONS` gives every game block, lock, roll, crouch, grab and use; `Lamp.out` is
  the fortress's. Every forest sound (the owl, the wolves, the Rot) would be an edit to the core. **Fix:** sounds and
  affordances as namespaced words (`arms.ready`, `wall.horn`), the engine keeping its own (step, land, hit, door, lift,
  break, blast); a generic game event; posture a property of the mode (S1).
- **S7. The physics boundary assumes one collider per body, one controller, and keeps all static geometry in every
  snapshot.** `collider(0)` in six places (`physics.ts:432`, `:496`, `:523`, `:575`, `:776`, `:849`); the shape's
  mapping to Rapier written twice (`:101-108`, `:360-369`); the snapshot is Rapier's whole world, and the network's
  server keeps twenty (`net/src/server.ts:36-37`): a heightfield of 1 MB would be 20 MB. Before the first step every
  body is checked on its own by every query (`physics.ts:567-582`), the cliff behind the big level's slow first step
  phase 5 left open. **Fix:** a list of colliders per body, one shape adapter, the controller's settings per call;
  F0 measures the snapshot's weight with the valley before anything is decided about static geometry.
- **S8. Light: lamps shine every way, watchers have a cone and no light, and light is computed only at characters.**
  (`types.ts:77-84`, `:133-138`; `world.ts:1144-1153`.) **Fix:** one emitter (where, which way, its cone, its range,
  its intensity) for lamps and watchers; receiving light as a component any entity may have; a beam query. It is the
  ground the shield's beam, reflection and "lit" stand on.
- **S9. Smaller ones.** The jump's arc integrated twice (`metrics.ts:111-136` and `character.ts:1133-1148`, tied by a
  test); the signals' arity table and its message twice (`world.ts:61`, `level.ts:325`); a name's pattern about five
  times; `Vec3` redefined in `commands`. The world's edge a constant (`FARTHEST = 500` m from the origin,
  `world.ts:131`): a 500 × 500 m valley with its origin at a corner has corners at 707 m. The 4.5 audit of "up" is
  still accurate; it misses the corner correction's axes (`character.ts:345-354`) and the compound seams cut only
  along x and z (`physics.ts:42-64`).

## 5. The view

- **V1. Nothing owns the budget or the tiers.** The 300 draw calls and 50,000 triangles exist only in a test
  (`e2e/site.e2e.ts:1066-1067`); each knob is a constant in another file (anti-aliasing and pixel ratio
  `stage.ts:168-169`, the far plane `:177`, `MOST_LIGHTS` `lights.ts:47`, `ANISOTROPY` `models.ts:82`, the particles'
  capacities, the batch's cell `bodies.ts:316`). **Fix:** one module of quality tiers, the stage owning the active one
  and handing it to each piece, the tests reading its numbers; today one tier, the floor, with 0026's numbers.
- **V2. One object per entity, touched every frame (checked: a material per primitive).** Each primitive gets its own
  material (`bodies.ts:235`); every mesh is interpolated every frame with a new vector each (`:575-589`); every
  entity's transform is copied every step, fixed ones too (`:468-474`); batching covers only fixed bodies with a model
  and rebuilds every batch on any change, the originals left hidden in the scene and still updated (`:320-375`).
  **Fix:** what moves, interpolated, apart from a registry of what stands still (set once, drawn in batches by
  material and by cell, rebuilt by cell; an entity found from its instance); materials cached; previous poses only
  for what can move.
- **V3. Only entities can be drawn, and nothing loads by zone.** The one path from data to pixels is an entity's
  appearance; a game's alternative is a piece reaching into the raw scene (`page.ts:61-64`). Terrain patches, ground
  cover in cells, impostors and water would each reinvent cells and disposal. **Fix:** the forest's (F3), on V2's
  registry and V5's assets: a scenery service with providers (bounds, cell, bands of detail, hysteresis, the tier's
  budget).
- **V4. The look is a boolean and a block of constants.** `atmosphere?: boolean` (`client.ts:59`), linear fog fixed for
  day and night (`stage.ts:17-25`); the far plane (200), the sky dome (150) and the fog's end (180) agree because the
  numbers were picked so. **Fix:** a look as data (fog model and its parameters by the night's amount, exposure, tone
  mapping, a colour table, the fill, sun and moon), given by the game or the level and chosen per tier; the far plane
  derived from the fog.
- **V5. Post-processing is one fixed chain, safe from NaN by luck.** Beside W5: the vignette's darkness 1.1 makes
  colours negative, harmless only because ACES saturates; a colour table after it, or another tone mapping, would feed
  negatives to the sRGB step's `pow` and black out the screen as the demo's did. The first-person weapon is drawn
  after the chain with its own lights: no grading, noon at night, not counted. **Fix:** the chain built from the
  tier, a pass that clamps negatives and NaN before the glow, the colour table after tone mapping, darkness at most 1,
  the weapon drawn in the scene's pass on a layer of its own.
- **V6. Assets: a loader per mount, no cache, no unloading, and every model a full character rig.** (`models.ts:87`,
  `:143-190`; `bodies.ts:425-433`.) The 293 kit pieces of the citadel each clone a skeleton and build a mixer, limbs,
  gait and hands; KTX2 needs the renderer, which the loader is not given; nothing is ever disposed. **Fix:** one
  assets service (the loader set up once, KTX2 and meshopt ready), handles counted and released, a ready signal and
  progress, a plain shared copy for props and a rig only for characters.
- **V7. Linear scans of the whole world and scene, several times a frame.** The player found by copying every entity
  (`client.ts:191`), twice a frame and once per event; eight pieces loop over every entity each frame; three walk
  `scene.children`; one reads `clientWidth` after writing to the page, forcing a layout (`wariness.ts:135`).
  **Fix:** one index piece, first in order, kept from the world's events (entities by component, the hero cached).
- **V8. The camera is five modules in one closure, and its effects undo themselves each their own way.** Input,
  follow modes, avoiding walls, first person and the weapon's own scene in `camera.ts`; sway, kick and shake, and the
  tower's finale each move and restore the camera in their own way, in the order the pieces happen to be listed.
  **Fix:** split; one pipeline (a base pose, additive effects with weights, an override with a priority, applied once).
- **V9. Cleanup depends on each piece remembering.** `bodies.ts` has no `stop` (its ragdolls' Rapier world, its
  geometries and batches outlive the page); four pieces have none; one leaves a window listener behind
  (`story.ts:56`); models are never disposed. Streaming loads and unloads for a whole session. **Fix:** each piece
  given a scope by the page that releases what it added.
- **V10. The view knows weapons by name.** The feel of each weapon (`fire.ts:45-60`), how far each is heard
  (`audio.ts:24-33`), a switch of sound recipes by weapon (`synth.ts:282-406`), special cases for the flame and the
  rocket; while their looks already come from `arms` as data (`WEAPON_LOOKS`). A game configures the view through
  four channels (thirteen mixed mount options, view lines in level recipes, level data, the raw stage). **Fix:** a
  weapon's feel as data beside its looks, the view keeping generic recipes; the mount's options grouped; pieces given
  narrow handles (camera effects, scenery, particles, the light pool).
- **V11. The same services built two to four times.** Two cosmetic Rapier worlds with the level's boxes (ragdolls and
  debris, `bodies.ts:102-112`, `debris.ts:39-49`), each built at the first fall or blast (the hitch at the explosion),
  copying only boxes (debris would fall through a heightfield); four particle systems; the place's light computed
  twice; audio's looping voices and noise twice. **Fix:** page services, built once.
- **V12. Animation runs at full cost for every character and assumes two legs.** (`bodies.ts:617-635`, the mixer,
  inertia, feet and hands by rays, for every character every frame at any distance.) **Fix:** rig kinds and bands of
  detail by distance from the tier; the forest's four legs (F5) on that seam.
- **V13. Smaller ones.** No budget of sound voices (a blast is about 35 sources); 78 writes of test probes in the hot
  path, ten a frame; `castShadow` set while shadows are never enabled; one piece that throws skips the render on every
  frame.

## 6. The games and the library they share

- **G1. The level's run is copied into every cartridge (checked: the tower's runner is the Dojo's).** The run
  component (`tower/src/rules.ts:20` = `dojo/src/rules.ts:105`; the fortress's `Run` and the wall's `Hold` start the
  same), the zones' switch (a fall back to the checkpoint, a checkpoint taken, the goal) four times, "down three
  seconds, back at the checkpoint" three times, joined players beside player 1 three times (the wall has none), the
  notice helper five times, the level's startup variable four, the HUD's elapsed time four, `* 60` written for
  `1 / STEP` in five places. **Fix:** a headless run module in the library, each game keeping its own key and order.
- **G2. A game copies about nine files before it writes a rule.** `index.ts`, the levels' glob, `replays.ts`, the play
  harness (`go`, `walkTo`, `step`), the reference text, the reference blocks, `plans.test.ts`, `jumpOf`, the words'
  coverage. **Fix:** the shell's helpers (levels from a folder, replays from a folder, the page from a game and its
  libraries) and a headless driver and test kit.
- **G3. The shell's result is the tower's scoring (checked).** `LevelResult {steps, stars, falls}`
  (`shell/src/progress.ts:6-11`); the fortress makes "unseen" its stars and "caught" its falls, the wall likewise, and
  the shell's words say "on this floor" for every game. **Fix:** a game declares its scores (a key, which way is
  better, its words); the progress gets a version and its migration (decision 0020).
- **G4. The arms are policy in frozen global tables.** `WEAPONS`, `MAGAZINES`, the ammunition and the slots
  (`arms/src/weapons.ts:105-195`), `STEALTH` and `GUARD`, read inside the mechanism; the wall's own weapons (the orb,
  the flame lance) live in the library; the wall edits its guards after creating them, `guard()` having no options
  (`wall/src/rules.ts:219-225`); a guard is always the mannequin; damage filters are chained by hand. **Fix:** arms
  made from a table (today's as defaults), guards with options (body included), damage modifiers and a helper that
  chains them; the wall's weapons the wall's.
- **G5. The Dojo still owns mechanisms the games need.** Zones that carry what stands in them (`currents`,
  `dojo/src/rules.ts:245-264`: the forest's water and wind), the level loop, the joined players, the guards' signals;
  a barrel that re-exports `arms` and that Dojo tests import through (`:25-37`); the `weapon` zone read by `arms` and
  declared by each game. **Fix:** currents to the core's zones, the weapons' zones and the guards' signals to `arms`,
  the barrel removed.
- **G6. The arms' contracts are tested through a game.** The arsenal, the slots, reloads, automatic fire, the longshot
  and the fair gunner only in `wall/src/wall.test.ts:88-227`. **Fix:** in `arms`, on the shared harness.
- **G7. `games/adventure` is half alive.** Frozen at 3k, its page and tests kept, nothing imports it; it is the only
  user of the core's saved games (`Cartridge.progress`) and of dungeons from a seed, whose generator runs in the step
  outside the determinism guard. The forest's terrain generator is the same kind of thing. **Fix:** the generator to
  the library beside the kit's plans, guarded; the package kept as a demonstration, said so.
- **G8. Names with two meanings.** `FORTRESS` the tuning and `FORTRESS` the game (the wall's too); `Progress` the saved
  game and `Progress` the campaign; level ids that are not their files' names. **Fix:** renamed.
- **G9. Leaks between channels.** The camera given in level recipes (`view.camera steady` six times in the tower's)
  rather than by the game; `rest()` in three games' music; credits and models in two lists nothing compares; the
  buttons' keys repeated; one weapon with two names (the dart is "dardo" in the Dojo and "saeta" in the wall).
- **G10. Public surfaces wider than their use.** About 16 of 66 exports of `arms`, 51 of 81 of the presentation, 77 of
  197 of the core are used nowhere outside their package (by a search; approximate).
- **G11. Adding a game is edits outside its folder.** The references script, the site's dependencies, an almost
  identical page per game, the games' cards (whose prose is already stale: "cuatro pisos" for six, "oleadas" for
  levels), per-game browser tests that re-test the shell. **Fix:** one registry of games driving the pages, the cards
  and the references; the shell tested once with a fixture game.

## 7. The environment

- **E1. The tests' floor is one file (measured).** Vitest runs files in parallel and a file's tests in order: the
  wall's four levels in one file are 109 s of a 118 s suite. Each level is simulated twice (its scripted run, then its
  replay). **Fix:** one level per file; vitest projects (units, playthroughs, the site), `npm test` the fast ones and
  `test:all` for the full check.
- **E2. The engine's tests import the tutorial's code (checked).** `vitest.config.ts:4` imports `site/src/course`: a
  syntax error in the other session's file stops every engine test. **Fix:** the course's plugin only in the site's
  project.
- **E3. The type check re-checks everything for every package.** No project references and no incremental build; the
  packages' exports point at their sources, so each `tsc -p` checks its dependencies again (the wall alone: 806
  files, 7.5 s); the site's configuration extends Astro's, so engine files are checked again with other flags.
  **Fix:** incremental and in parallel first; project references (`tsc -b`) after.
- **E4. Continuous integration is one serial job of 15 to 46 minutes.** Installing the browsers took 30 minutes in the
  last run; documentation-only commits run the whole of it; there is no timeout. **Fix:** Playwright's container
  image (the drawing tests were already checked in it) or a cache, jobs in parallel (the static checks, the headless
  tests, the browser tests sharded), a timeout, documentation paths ignored.
- **E5. The browser tests are one file of 2,282 lines in one worker.** About 82 tests in order, timeouts up to 240 s;
  the console helper copied three times. **Fix:** split by area and by game, helpers shared, full parallelism tried.
- **E6. Two sessions in one folder, by the author's choice (no worktrees).** What goes wrong is known: scratch tests
  left in the shared tree (a failing `zz-limits.test.ts` once), a test server on 4321 reused silently by Playwright,
  three stale worktrees of 1.2 GB from earlier sessions in `.claude/worktrees/`. **Fix, keeping the choice:** a
  `scratch/` folder outside git and outside the tests' include; the browser tests' port from the environment and no
  silent reuse; the stale worktrees removed with the author's word.
- **E7. The art does not pin Blender, and nothing checks the bytes.** The path defaults to `/Applications` and
  `$BLENDER` is documented nowhere; the version is only in each GLB's generator string. **Fix:** each script asserts
  its Blender version; an `art:check` that renders to a temporary folder and compares; each output's hash in
  `assets.json`, checked by a test. Before the forest's textures: Git LFS or generation at build time.
- **E8. Hygiene.** A stray `sitio/` (an old site's caches); `eslint .` walks the stale worktrees, `books/` (353 MB) and
  the drafts; no `.gitattributes` marking replays and levels as generated; Rapier pinned in two places that must move
  together, and Dependabot would propose its bump as routine (it is a simulation version); three imported by
  `character`'s tests without being declared.
- **E9. Performance covers one scene.** Only the Dojo's stress room, its baselines in comments; nothing on the games'
  levels, the navigation's build, loading a level or memory, which the valley will stress. **Fix:** a file per
  scenario, still as ratios to Rapier's own step, each run's numbers kept as an artifact.

## 8. The documents

- **D1. One status, written once.** (W9.) **Fix:** the stages and the current one in `site/src/stages.ts`, read by the
  home page and the project page, and a test that the roadmap's table agrees.
- **D2. The roadmap is a 194 KB history.** Its "Now" is one line of 5,169 characters that retells phases 2 to 5; six
  lines pass 3,000 characters, which no diff can review and two sessions collide on; each stage is told three times
  (the roadmap in English, the Bitácora in Spanish, often a decision). **Fix:** the roadmap the plan only (the table,
  the open stages, what is next), its "Now" five short lines; the finished stages' paragraphs replaced by links to
  their reports.
- **D3. No "start here".** No `CLAUDE.md` or contributing guide: a fresh session reads tens of thousands of words to
  find the commands, the references' workflow, the language rule, the determinism guard and the two sessions' rules.
  **Fix:** a short one, with a map of the documents.
- **D4. The README's status and package tree are of phase 3.** **Fix:** pointers, no status.
- **D5. The tutorial's superseded documents and its section of the roadmap** (decision 0021 "still proposed", the
  old curriculum and lesson sheets) are the tutorial session's: forwarded to it, not touched here.

## 9. What is good, and stays

The determinism discipline (the linter against the browser's trigonometry, the engine's own sine and cosine, `-0`
handled, data copied instead of serialized); the physics boundary (Rapier imported in one file); the step's fixed
order with the game hooked only before and after it; every world with its own randomness and counter; inputs declared
and normalized, a press never lost; the cartridge contract, small and made of hooks, which took three genres without
growing; game components namespaced; brains outside the hash; saved games with migrations, never snapshots; ghosts
with a format of their own; levels as text with the version each line exists since and errors with line numbers;
the kit and plans drawn as text; words as keys; the view's pieces with an explicit frame, read-only on the world, its
pure modules tested offline (locomotion, effects, sound recipes); view values declared as data; the performance
budgets as ratios to Rapier's own step; the reference replays, whose final hash proves "to the bit", and every level
of every game played to its end by a test. **The pattern to keep and make mechanical** is the one stages 5i to 5p
followed by hand: a change to one game re-headers the rest and keeps every other game's hash. P1 and P2 make it
cheaper, not different.
