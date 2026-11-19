# 0032. The forest: one valley, three games that push the engine

- **Status:** accepted (2026-11-18), from the author's answers to eight questions, each asked with a recommendation
  and its alternatives (at the end): seven took the recommendation, and the valley is large from the start. Proposed
  the same day: a second world before networking, three games, terrain with relief, and a second version where the
  hero is a fairy who flies. **Revised (2026-11-19)** after a review of the route, the author's "sí, reescribilo": the
  route stays, and five things change (each game designed as a game from its first day, a playable prologue when F3
  closes, the audit of what assumes the mannequin moved to F1, the shooter as levels to advance, the look designed for
  the floor first), with a test for the reconciliation table and a rule for what is tried in the Dojo and what in the
  games. The review, aspect by aspect, is at the end.
- **Date:** 2026-11-18 (revised 2026-11-19; stage 5.5 put before it by decision 0033 the same day)

## Context

Phase 5 is done: three games in one world (decision 0029), now being played into games by decision 0031's stages,
5l to 5o. The roadmap's next phase is networking (phase 6).

Before networking, the author proposes a second world, from the drafts kept outside the repository: a demo made in an
afternoon ("El Bosque de los Espíritus", three.js 0.170 without physics), a concept image (a small knight with a horned
helm and a glowing shield on a stone bridge, two giant stags of moss and light, glowing mushrooms, a golden backlit
haze), and a design document that grows the demo into one action adventure of about two hours. The author's words:

> la idea es que sea desafiante para el motor y tengamos que agregarle cosas al motor que no hace, como los terrenos
> con relieve, eso sí lo quiero... el tema de la jugabilidad y la historia y demás cuestiones podemos acomodarlas de
> la mejor manera que queramos

and, on the hero, that it is the small knight, not the giant stag, and that being small is relative; and, as a second
version, that the hero becomes a fairy, "así puede volar con todo lo que eso implica".

**What the demo is.** As code it cannot enter the engine: its movement follows the frame's time (`dt` variable), uses
`Math.hypot`, `sin`, `atan2` and `exp` (decision 0000, stage 1f's lint), and its collision is circles in a plane plus a
height function (`surfaceY`: the highest of the terrain, the bridge, the log, a step of 0.5 m). What it gives: a
layout (a bridge at the center, a creek from a spring to the north, the stags beside it, roots that arch, ruins,
standing stones, a fallen log, about 110 m of radius), its light and colour (fog `#c98d4b` exp² 0.021, a sun
`#ffc27a` from behind the first view, ACES at 1.05), and its terrain function, which is nearly the generator's
specification: low-frequency noise of ±1.7 m, places flattened, a creek's bed carved by the distance to a curve, hills
rising 14 to 16 m at the edge. Counted with `renderer.info` (without a GPU, so counts, not times): about 700 draw calls
and 1.1 million triangles a frame (670,000 without the shadow pass), against decision 0026's 300 and 50,000: 2.4 times
the calls, 13 to 22 times the triangles. Most of it is repetition (106 trees, 9,500 leaves, 170 bushes) and the shadow
pass, which instancing, levels of detail and a shorter shadow radius attack.

**What the engine does not do today** (read from the code on 2026-11-18):

- No ground with relief: levels are boxes, maps and kit pieces, and Rapier's height field is not behind the physics
  boundary. Rapier's deterministic build, 0.21.0, has it (`ColliderDesc.heightfield`, with the flag
  `FIX_INTERNAL_EDGES` for the bumps at the triangles' shared edges), but no way to remove cells.
- No instancing of the kit, no levels of detail, no impostors, no compressed textures (KTX2) or geometry (meshopt);
  `view.quality` is announced for phase 5 and not built. Post-processing exists since 5j (glow).
- Joints only in the presentation's cosmetic world (a ragdoll's ball joints); no ropes in the simulation.
- No swimming and no buoyancy (a material's density has waited for it since 3b).
- One body: the mannequin, a capsule 1.6 m tall (`CHARACTER_SHAPE`), its hit parts and clips tuned to it. No creature
  of four legs.
- Navigation (0024) is a grid of the tops of what never moves, sampled every 0.5 m along −Y, for a body of one size;
  nothing flies or swims through it. The 4.5 audit counts the navigation among what structurally assumes "up" is +Y.
- The logical light (3d) falls by radius; the guards' cones are vision, not light; nothing reflects it.

## Decision

### A world of its own, before networking

**The forest** is a phase of its own between phase 5 and phase 6, named, not numbered: "phase 6" names networking in
fourteen lines of the roadmap and in nine decisions, and renumbering would make the written ones wrong. Its stages are
**F0 to F8** (below), and a second version, the fairy's, comes after them (F9 on). It starts when stage 5.5 closes
(decision 0033), not beside it: it would touch the same packages (`arms`, `presentation`, `shell`, `core`).

It is chosen for what it makes the engine do. **The games are the vehicle:** each mechanic is kept for the engine
capability it forces, and the story bends to them. A capability that is costly is measured first, not cut.

**But a vehicle that does not drive tests nothing.** Phase 5's first pass was built the same way, pieces first, and
the author's verdict on it was "le falta más flow de ser un juego" (0031): eight stages, 5i to 5p, went into making
the three play as games. So each forest game is designed as a game from its first day, with 0031's recipe (below), and
has **one new verb at its heart**; the engine capabilities it forces are built for that verb and its levels, not as a
list of pieces to show.

### One valley, one day, three games

As 0029 put one world under one night, the forest is **one valley under one day**: the same terrain file, the same
trees, the same creatures, crossed three ways. The terrain is tested from three sides: moving through it and seeing it
from above (the platformer), exploring it (the adventure), fighting across it in the dark (the shooter). The far view's
hardest case is the canopy's, and the fairy's after: at night the dark and the fog hide the far valley, which makes it
cheaper to draw (the argument that kept the shooter out of the caves), so the shooter's challenges are the swarms, the
lights and purifying, not the distance.

| Game                                  | Where, in the valley                                                                                 | When             | Its heart (one new verb)                                         | What it makes the engine build                                                                                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The platformer:** the canopy        | The old forest on the valley's slope, crown to crown; a fall lands on the real ground, not in a void | Morning          | Swinging: crown to crown on lianas, the release timed            | Lianas as a pendulum the simulation computes; climbing by material; branches as paths, their collision from the same script as their mesh; gliding on wind that comes from the relief; the view from above (levels of detail and impostors at their hardest) |
| **The adventure:** the spring         | The valley's floor: the bridge, the lake, the ruins, the caves below                                 | Dusk (the image) | The shield's light: a beam that reveals, freezes, lights, cleans | Creatures of four legs (the guardians, legs that collide, feet set on the slope); light as a system (a cone, reflection, a signal for "lit"); purifying; caves joined to the terrain; a companion that obeys; swimming and diving with buoyancy; a mount     |
| **The shooter:** the night of the Rot | The whole valley in the dark, taken back region by region from the shadow rising out of the caves    | Night            | Light as a weapon against what flies: aiming up, in 3D           | Swarms that fly (tens of agents, steering in 3D without a grid, deterministic); packs that circle; cover found in the relief; purifying as damage; many lights at night with six real ones                                                                   |

The order is the story's and the dependencies': the canopy's trees give the floor its roots; the adventure's
creatures give the shooter its wolves; the adventure's purifying is the shooter's damage.

**Scope:** each game at 0017's and 0031's scale, three to five levels or regions of 2 to 5 minutes, about 15 to 25
minutes in all; done as 0017 says (playable to its end without the console, its reference replay plays it to its end).

**Shape, from the first day and not in a reopening** (0031's recipe, which phase 5 learned after its games were
"done"):

- **Levels with an arc:** a goal in sight, a rule learned, a twist, a finale that lands (introduce, develop, twist,
  conclude), with breathers between the tense parts.
- **Checkpoints between encounters, and back in play in under a second.**
- **Feel and atmosphere in the first grey pass,** not after it: contact, forgiveness, feedback (what 5k and 5p added to
  the tower), the night that reads, sound.
- **Each game's design written when its stage starts,** from how games of its kind are made (their designers' talks,
  postmortems and source, as 0031 read them), and played in grey before its art.

What that already says of each game, before its stage:

- **The canopy:** a fall lands on the real ground, 30 to 40 m below, so its design says how one is back in play: the
  glide as the save, a checkpoint at each crown, a fall that is a shortcut down and never a long climb back.
- **The spring:** the light is life, weapon and key, so how much of it there is, and how lit or loud the knight is,
  is always on screen (the fortress had neither, 0031).
- **The night:** levels to advance through, as the wall became (0031), never waves in an open field: the valley taken
  back region by region, a beacon lit at each one as its checkpoint and its key, the Rot's nests as the objectives.

### The story, in a few lines

It serves the mechanics, and each game's thread is written when its stage starts. The premise kept from the drafts:
the forest lives on a spring of light that rises through the roots of the old trees; below the spring something
woke, the Rot, a shadow that is not evil by will but by hunger, and feeds on light. A traveller crosses the bridge
following a light, with an old shield that has an empty notch in its center. In the morning the guardian owl is caged
at the top of the oldest tree, and from the top the shadow is seen spreading; at dusk the guardian stags watch the
spring go dark, and the shards of light are across the valley, the lake, the ruins and the caves; at night the Rot
comes up out of the caves, and the valley is taken back with the shield's light until the spring lights again.
**Nothing is killed:** what the light reaches is cleaned, the shadow leaves it, and the animal is an animal again.

### The hero: the engine's character, the world built big

The hero is the small knight of the image and the demo (a horned helm, a sword, the shield that glows), and **small is
relative:** the forest is built big around the character the engine has (trees of 30 to 40 m, roots arching at 3 to 4
m, mushrooms to the waist, guardian stags of about 4.5 m at the withers whose bellies one walks under). Its capsule,
the metrics gym's numbers, its hit parts and its clips stay; its look is a new model on the mannequin's skeleton,
made by a Blender script. Different sizes still come, where they belong: the creatures (a fox, wolves, a younger stag
to ride, the guardians), each a body of its own size.

### A second version: the fairy who flies

After the three games, the hero becomes a fairy, and flies. It is the forest's hardest test, because flight undoes
what the first version leans on: height and gaps stop being obstacles, the fog no longer hides the far valley, and a
grid on the ground no longer says where a body can go. It gets a decision of its own when F8 closes (F9 on); it is
written down now so the first version leaves its seams where they are cheap.

- **Flight as a mode of the simulation** (`fly`, chosen where the modes are chosen, 2b), with weight, not a free
  camera. Its state is the position p, the velocity v and the fairy's light e. Each step,
  v ← v + Δt·(g + F/m + L) − Δt·k·|v − w|·(v − w), where w is the air's velocity at p (the wind from the relief and the
  thermals): drag acts on her speed through the air, so the wind carries her and an updraft lifts her with no rule of
  its own. A wing beat is a push F, up and along the input, and it spends light. Gliding lifts by her speed through
  the air, L = min(|g|, c·|v_h − w_h|²) upward: fast, she glides level; slow, she sinks. Vectors and one square root,
  no trigonometry; the bank of a turn is the view's.
- **Light is her fuel.** e fills where the light the simulation computes at a character (`character.light`, 3d) is
  high, and drains in the dark: at night and in the caves she flies from light to light, and the moths that hunt light
  are a reason to fly dark. Flight spends what the first version made a system.
- **The input gains height:** her game declares an axis to rise and sink (1d: a game declares its actions, with no new
  replay version). Where she looks in 3D is `face` and `pitch` together: every `direction` input is normalized onto
  the ground (`core/input.ts`), as the audit of 2026-11-19 found against what the first version of this decision said
  (that `face` was already a direction in 3D); a flyer reads the two as one direction.
- **A second playable body,** not the mannequin: her own size, small in the knight's valley (the one reason to shrink
  a body is a world shared at another scale), her hit parts by mode, clips for hovering and gliding, wings drawn
  procedurally in the view. A character's size becomes data across the engine: the controller's step and skin, the
  metrics gym, the camera's distances, the hit parts, the navigation's grid by size (F2's). The audit of what assumes
  the mannequin is F1's, not hers (below): by her stage the creatures (F5) and the mount (F6) have made a body's size
  data in most of those places, and she finishes it for a body the player plays.
- **The camera in the air:** a chase camera with no ground under it, swept against the canopy (3h), leading her turns.
- **The view from above, with nothing to hide it:** over the canopy the whole valley is in sight (the terrain's
  levels of detail out to the rim, the far forest as one impostor surface, a horizon), the budget's hardest case on
  both tiers; near the ground, the opposite, ground cover seen from a hand's height.
- **What chases her flies:** the swarms' steering in 3D (F7) is her enemies' and her companions'.
- **Levels flight does not undo:** made of what she cannot simply cross: the dark (no fuel), wind against her, a
  closed canopy, water, light that has to be carried.

**The knight and the fairy together,** one on the ground and one in the air, is the forest's natural two-player mode
(0012 allows one). It needs networking, so it is noted for after phase 6, not built here.

### The valley: terrain with relief, which is eleven pieces

**Its size: about 500 × 500 m from the start** (the author's answer; the recommendation was 240 × 240 m first). The
demo's clearing, about 110 m in radius, is the valley's heart; around it the old forest's slope, the lake, the ruins,
and a rim of hills whose cliffs hold the caves. The size moves three costs into F2: the navigation by regions, the view
loaded by zones, and the weight of a snapshot (pieces 3, 5 and 11).

1. **The shape.** A height field h(i, j) over a grid, a fixed body of Rapier's behind the physics boundary (the core
   does not know Rapier), with `FIX_INTERNAL_EDGES` if F0 shows it changes nothing the four browsers disagree on.
2. **The generator.** From a seed and a declared layout (the places flattened, the creek's curve, the rim of hills),
   run outside the game to a file, or inside it as 3k's dungeons are, in which case with the engine's deterministic
   arithmetic (noise from an integer hash, no `sin`). The creek's curve is written as data too, for the water and the
   navigation.
3. **The format.** A `terrain` line in the level (the file, its size, its origin, its cell); `level.export` writes the
   line back, never the heights. A snapshot keeps a reference to the file and its hash, not its 251,001 heights (501 ×
   501, about 1 MB as floats), so joining a started match does not carry them. The trees' collision goes as one
   compound body per tree, and F0 measures what Rapier's own snapshot weighs with the whole valley's static collision
   in it (the citadel's physics was 475 KB, 4.5f).
4. **The controller on slopes,** with 5a's three measures: the speed asked for against the speed got, uphill,
   downhill and across, at 5°, 10°, 20° and 28°; no lift-off running down a hill; no contact let go of for nothing at
   the cells' edges.
5. **The navigation.** Walkable where tan θ = |∇h| ≤ tan θ_max: the gym measured walking up 45° and standing still
   only to 30° (μ = 0.6), and F1 chooses which the grid uses. At 0.5 m, 500 × 500 m are a million cells, and 4.5a
   builds 200 queries a step: over a minute at one query a cell. So the terrain answers for its own cells (it knows h
   without asking the physics: computed, not sampled), the rest (the bridge, the rocks, the ruins) is sampled as
   today, the cells are kept compactly, and **the grid is built by regions joined by portals, from F2 on:** a path
   across the valley is planned between regions first, then inside the few it crosses (a hierarchy phase 7's worlds
   will want too). **One grid per size of body:** a fox's is finer than a stag's.
6. **The camera** against a slope that rises behind the character (3h's sweep, 4.5d's camera).
7. **The drawing:** patches of terrain with levels of detail whose edges do not crack (skirts or a morph between
   levels), textures blended by slope and height, shadows over a large area (one map that follows the character,
   snapped to its texels so it does not shimmer; cascades in the high tier).
8. **What grows on it:** trees planted with their roots sunk 0.5 to 0.8 m, so one variant stands on gentle slopes;
   ground cover in cells by slope; the heroes of the scene on flattened places.
9. **Caves.** A height field has no ceilings, and Rapier 0.21 cannot hole one: a cave's mouth is a rock piece over a
   steep cut (its collision from its script, as the kit's), or a load between levels. F1 chooses by F0's measures.
10. **Wind from the relief.** Air that follows the ground rises where the wind climbs the slope: at the surface,
    w_y = w · ∇h (the kinematic boundary condition), fading with the height above the ground. The gliding currents of
    the canopy come from the terrain itself, not from boxes set by hand; with ∇h stored per cell at load, they are
    dot products, deterministic and without trigonometry. Thermals stay as 3b's current zones.
11. **What loads by zones is the view's.** The simulation keeps the whole valley, at every step and on every copy: in
    a networked match two players stand in different places, and the world cannot depend on where anyone stands. What
    is drawn loads and unloads by distance (terrain patches, ground cover, the trees' detail, sounds); what is far
    from every character may sleep by a rule of the step (a creature farther than a distance from all of them does
    not think: deterministic, so replays agree), never by what a camera sees.

### The base under the three games (view only: no hash, nothing for networking)

- **Quality tiers** (`view.quality`): a **floor**, the author's Iris Plus, which the tests guard, and a **high** tier
  measured on a reference machine chosen in F0 (a dedicated mid-range GPU at hand then). Each tier declares its draw
  calls, triangles, lights, shadow size and radius, ground cover density, levels of detail, post-processing, texture
  size and resolution scale; the six lights stay in both (what is decorative glows by emission and halos, never by a
  light). This refines 0026: its budget becomes the floor's, with numbers measured in F0.
- **The look is designed for the floor first.** The author plays on the Iris Plus, so the floor is a look of its own,
  not the high tier with things taken out: fog as an ally that ends the view, light and ambient occlusion baked,
  emission and halos where a light would be, shapes and a palette that read at its resolution. The high tier adds to it
  (cascades, screen-space occlusion, scattering, density, distance). The likeness to the concept image stays the high
  tier's (answer 1); the reference picture is kept in both tiers, and the floor's is judged on its own.
- **Drawing many things:** `BatchedMesh` for the tree variants and the kit (moved here from phase 8, as the view's),
  `InstancedMesh` for ground cover in cells of 16 m drawn within a radius, levels of detail with hysteresis,
  impostors far away, the camera's far plane where the fog has hidden everything.
- **The art pipeline,** by scripts only (0015, unchanged): trees by Geometry Nodes built in Python, their collision
  exported from the same graph (the trunk a capsule; along each root, capsules only where it is low enough to block,
  so an arching root is walked under); a high version baked into the low one's normals and ambient occlusion in
  Cycles with fixed samples; `gltf-transform` to meshopt and KTX2; the same bytes on two runs; download and GPU memory
  per level measured and budgeted (proposed: 15 MB and 64 MB of textures on the floor).
- **Atmosphere:** fog that is denser low, ambient occlusion (baked on the floor, screen-space on high), a colour
  grade from a lookup table, a warm rim light on characters, shafts of light (cheap planes on the floor, scattering on
  high), water drawn with its depth and its reflection. Every shader clamps what can go negative before a `pow`: the
  demo's NaNs, spread by the glow, blacked out the screen; a test reads that the picture's center is not black.
- **The reference picture:** a recipe that loads the valley, puts the hero at the bridge's center looking north and
  fixes the camera; a browser test keeps its capture at every stage, and each report sets it beside the concept image.

### Every new piece of the simulation says how it reconciles

Decision 0016 reconciles online by re-simulating only one's own character, and asks that whatever carries it or stops
it be a function of the step or kept in a history. The forest comes before networking, so every piece it adds to the
simulation carries one line on how it reconciles, and phase 6 finds no surprises:

| Piece                              | In the hash                                                 | How it reconciles                                                 |
| ---------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| The terrain                        | A reference to its file and hash                            | Static, like the level                                            |
| Wind from the relief               | Nothing (a function of the place)                           | A function: re-simulated for free                                 |
| A liana                            | The character's hold: which liana, its length               | Part of one's own character: re-simulated with it                 |
| Climbing by material               | The material's parameter                                    | Static                                                            |
| Swimming, diving, air              | The character's mode and its air                            | One's own character; the water's zones are static                 |
| What floats                        | Bodies with a buoyancy contribution                         | As the cubes a character pushes (0016's open case)                |
| A creature's legs                  | Its pose phase; the legs kinematic, from its state          | Others are seen at the last confirmed step                        |
| A mount                            | The rider inside the mount; the rider's inputs routed to it | While mounted, the predicted character is the mount               |
| Swarms, packs                      | Their bodies                                                | Bots: their brains run where the match is hosted (0023)           |
| A cone of light, reflection, "lit" | The lamps' parameters; signals                              | Signals are values in the hash (0018); rays are deterministic     |
| Purifying                          | A component, like health                                    | As health                                                         |
| Flight (the second version)        | The fairy's mode, velocity and light                        | One's own character: re-simulated with it; the wind is a function |

**The table is tested, not only written.** Nothing in the engine re-simulates one character today (1e's client says
its own character "will be predicted"; no code does it yet), so the right-hand column is a claim. From F2 a test in
the Dojo does what 0016's reconciliation will: it restores one's own character k steps back, runs its recorded inputs
again with the rest of the world where the recording had it, and asks for the same state. Its first case is the
character on the terrain; each piece of the table adds its case when it is built (the liana in F4, the water and the
mount in F6, the creatures' legs in F5). It is the first piece of phase 6's reconciliation, built early because the
forest adds the cases most likely to break it, and it costs work the first version did not count: F2 measures whether
it can be done without stepping the whole world, and says so in its report.

**The liana is a pendulum the simulation computes,** not a chain of Rapier joints: the hold is a constraint on the
character, |p − a| ≤ L for its anchor a. Each step the character moves (gravity, and the input as a push along the
swing); if it ends past L, it is put back on the sphere, p ← a + L·n with n = (p − a)/|p − a|, and its velocity loses
its outward part, v ← v − max(0, v·n)·n; let go, it leaves with v. The controller still carries it, so a swing stops
against a trunk. It needs a square root (exact in IEEE arithmetic, outside 1f's list) and no trigonometry; it is the
character's own state, so prediction re-simulates it; and it does not ask Rapier's multibody joints to be
deterministic across browsers, which nobody has measured. What hangs and is drawn (the liana's curve) is the view's.

### The Dojo and the games: where each thing is tried

The Dojo is the first game, the one where every piece of the engine is tried (0010), and the phases before 5 built
their pieces there (0012, amended). What the last two phases did with it, read from the history:

- **Phase 4 built its pieces in the Dojo,** the weapons, the guards and the arena as rooms, but inside the Dojo's own
  rules (`games/dojo/src/rules.ts`). When the adventure and the shooter both needed them, 5e had to take them out into
  `@manifold/arms` (0003: a game imports the engine, never another game): a simulation version, and every reference
  recorded again.
- **Phase 5 built straight in the games.** The Dojo gained one room, the metrics gym (5a), and otherwise only had its
  reference replays recorded again. The gym paid for itself: the platformer's controller was measured in it (5c), the
  jump calibrated against it (5k, 5p), and this decision's slopes come from its numbers. And nothing 0031 found (levels
  of seconds, the tower's camera, guards with no suspicion, a hall of waves, no atmosphere) would a room have shown:
  those are found by playing the game.

So the forest's rule:

- **Every piece lives in a package from its first line,** never in the Dojo's rules: the valley and what the forest's
  games share in a package of their own (as the kit is), the engine's mechanisms in the packages where their kind
  already lives (the terrain at the physics boundary, the creatures beside the character, the steering beside the
  bots). The Dojo imports them like any game (0010: no back doors), so nothing has to be moved out later.
- **A room in the Dojo for each mechanism,** before a game leans on it, when it is any of: measured (F0's, a slope, a
  surface, a budget, a swarm's step); something the four browsers must agree on; shared by more than one game (the
  valley, the creatures, purifying, the steering in 3D); or a failure best seen alone (a quadruped's legs trapping the
  character, a swimmer bouncing at the surface, a liana through a trunk). The room is a recipe the tests run without a
  screen, with its overlay (`show.*`) and its values in the console to try it live, and its measure opens it. The gym
  is the model.
- **A valley room:** the whole valley in the Dojo with the console's full reach (the navigation's regions and portals,
  the terrain's cells, the wind, the zones loaded, the budget against the frame), where a mechanism is tried on the
  real ground and not on a flat floor. The drive from the south entrance to the spring, the reference picture and the
  re-simulation test are its recipes.
- **Straight in the game,** what is judged by playing: its levels and their rhythm, the tuning of a mechanic's numbers
  for that game (a mechanism's parameters are data: the game sets them, it never forks the mechanism), its camera, its
  story, its sound, its atmosphere and its art.
- **So each game's stage has three parts, in order:** its design (what the game asks, by 0031's recipe); the
  mechanisms that design asks for, each in its room; the game, built in grey straight in its own package as soon as a
  mechanism's contract is fixed, and tuned there. The rooms close when their tests, recipes and the four browsers
  agree; the game closes when it is played to its end (0017).

### Engine, library, cartridge: where each piece goes

Decision 0003's four questions (amended 2026-11-19): would a game of another world use it as it is (the engine); is it
in the hash or only drawn (the simulation or the view); is it shared by the forest's games and meaningless outside
them (**the forest's library**, a package of its own, as the kit is); is it one game's level, number, word or rhythm
(its cartridge). Inside each piece, the engine gives the measure and the game its meaning.

| Piece       | The engine (mechanism)                                                                                       | The forest's library                                                | A cartridge (policy)            |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------- |
| Terrain     | The height field at the physics boundary, the `terrain` line, h and ∇h; a generator from a seed and a layout | The valley's file, its layout, the creek's curve                    | Which region it uses, its zones |
| Wind        | w(p) from ∇h, as a contribution                                                                              | The valley's prevailing wind                                        | Where one glides, how strongly  |
| A liana     | A hold any game may use, \|p − a\| ≤ L (chains, a grappling hook); its curve, the view's                     | The liana as a kind of thing hanging from the trees                 | Where, how long, its timing     |
| Climbing    | A material's "climbable"                                                                                     | Which barks are                                                     | —                               |
| Trees       | Batches, levels of detail, impostors (the view)                                                              | The variants and their collision, from Blender's script             | —                               |
| Creatures   | A body of its own size, its legs kinematic from its state                                                    | The fox, the wolves, the stags: sizes, brains                       | Which, where                    |
| Navigation  | Terrain cells, regions and portals, a grid per body size, steering in 3D (`bots`)                            | —                                                                   | —                               |
| Light       | A cone, reflection, the signal "lit", the light a body receives                                              | The shield; purifying as a component (the spring's and the night's) | Its numbers, its puzzles        |
| A companion | A bot that takes a player's orders                                                                           | The fox's brain                                                     | What it is asked in each level  |
| Water       | Zones of a medium, swimming and diving, air, buoyancy                                                        | —                                                                   | The lake, its numbers           |
| A mount     | A character that rides another: the inputs routed, the prediction moved to the mount (a horse, a car)        | The young stag                                                      | Where one rides                 |
| Swarms      | A body's flight, flocking brains (`bots`)                                                                    | The Rot's moths                                                     | The nests, the levels           |
| Drawing     | Quality tiers, loading by zones, KTX2 and meshopt, the atmosphere                                            | The valley's palette, fog and colour table                          | The hour                        |
| The fairy   | The `fly` mode, its drag against w                                                                           | —                                                                   | Light as her fuel               |

The same light, three meanings: the simulation computes the light L a body receives; the spring cleans with it
(c ← c − k·L·Δt), the fairy flies on it (e ← e + (αL − β)·Δt), and the fortress's guards see by it (L·t·p ≥ 0.3). Each
stage's report says where each of its pieces landed.

### Measure before deciding, and the order

| Stage     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Touches the simulation     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **F0**    | **Measures, no game code.** A budget sweep on the Iris Plus (draw calls and instanced triangles against the frame's time, with six lights; the budget where the curve crosses about 12 ms); the height field in Chromium, Firefox, WebKit and Node (the same hash, its step's cost, contacts with and without `FIX_INTERNAL_EDGES`); 5a's three measures on slopes; the navigation's build over 500 × 500 m, by regions; Rapier's snapshot with the valley's static collision; the pendulum beside a joint chain; a swarm of 50 flyers' step | No (rooms in the Dojo)     |
| **F1**    | The decisions F0's numbers fill: the terrain (format, generator, navigation, caves), the quality tiers (refines 0026). **And the audit of what assumes the mannequin** (as 4.5's of "up", in `docs/audits/`), so that F2's grids by body size, F5's creatures and F6's mount follow it                                                                                                                                                                                                                                                       | No                         |
| **F2**    | The valley in grey: the height field, the generator, the `terrain` line, water as zones, the last safe place, navigation over terrain by regions and portals and by size of body, the view loaded by zones, the camera on slopes; driven from the south entrance to the spring without teleporting. The valley room in the Dojo; the re-simulation test, its first case the character on the terrain                                                                                                                                         | Yes (a version)            |
| **F3**    | Drawing at scale: the tiers, the floor's look first, instancing, ground cover, terrain levels of detail, trees by Geometry Nodes with their collision, KTX2 and meshopt, the atmosphere; the reference picture's series begins. **It closes with the prologue:** 3 to 5 minutes at the bridge, the knight following a light across it to the spring and the stags (the concept image, walked into), designed and played to its end as a game: the first thing the author plays in the forest, and afterwards the door to the three games     | No (trees' collision: yes) |
| **F4**    | The platformer, the canopy: its design; its rooms (the liana as a pendulum, climbing by material, the branches' collision from their script, the wind from the relief, each opened by its measure); the game; the liana's re-simulation case                                                                                                                                                                                                                                                                                                 | Yes                        |
| **F5**    | The adventure, I, the spring: its design; its rooms (a creature of four legs, its legs against the character measured first; the light's cone, reflection and "lit", the rays a step measured first; purifying; a companion's orders); the caves; the game's first half; the creatures' re-simulation case                                                                                                                                                                                                                                   | Yes                        |
| **F6**    | The adventure, II: its rooms (swimming, diving and buoyancy, the swimmer at the surface measured first; the mount, the first body the player drives that is not the mannequin, on F1's audit); the game's second half; the water's and the mount's re-simulation cases                                                                                                                                                                                                                                                                       | Yes                        |
| **F7**    | The shooter, the night of the Rot: its design (levels to advance: the valley taken back region by region, beacons as checkpoints and keys, the nests as objectives); its rooms (swarms in 3D, packs, cover found in the relief, purifying as damage); the night's lights; the game                                                                                                                                                                                                                                                           | Yes                        |
| **F8**    | The close: frame times on both tiers in five places, bytes and GPU memory, the reference picture's series, the roadmap's table, the book's chapters that now have something to point at                                                                                                                                                                                                                                                                                                                                                      | No                         |
| **F9 on** | The second version, the fairy: its decision first (flight, the view from the air, a character's size as data finished on F1's audit), then her game, in the same three parts                                                                                                                                                                                                                                                                                                                                                                 | Yes                        |

**What stage 5.5 leaves these stages** (decision 0033, accepted 2026-11-19, which comes first): F1's audit of what
assumes the mannequin is that audit's S2, fixed in 5.5e, so F1 confirms it; F2's `terrain` line is a kind in S5's
registry, the height field a collider through S7's shape adapter, the water a zone in the core (G5), and the
re-simulation test exists (P4), F2 adding the terrain's case; F3 builds the scenery service on 5.5g's registry of what
stands still and its assets service, and adds the high tier to its quality tier's module, the light pool already
there; F4 to F7's ways of moving (the rope, swimming, diving, riding, and the fairy's flight) are new records of S1,
F5's beam, reflection and "lit" extend S8's emitter, and the creatures' sounds and affordances are namespaced words
(S6).

Each stage keeps the project's rules: a decision before code where the tail is long, grey before beautiful, its
mechanisms shown in the Dojo's rooms and its game played to its end, checked by tests, the same hash in the four, its
report in the Bitácora.

**Targets** (hypotheses F0 confirms or corrects):

|                  | Floor (Iris Plus)                                                  | High                            |
| ---------------- | ------------------------------------------------------------------ | ------------------------------- |
| Draw calls       | ≤ 300                                                              | ≤ 700                           |
| Triangles        | 150,000 to 250,000 if the sweep allows; else 50,000 and less cover | ≤ 1,000,000                     |
| Lights per pixel | 6                                                                  | 6                               |
| Shadows          | 2048, ± 30 m                                                       | 4096 or cascades, ± 60 m        |
| Frame            | ≤ 16 ms                                                            | ≤ 8 ms on the reference machine |
| The step         | ≤ 1.5 ms average, ≤ 5 ms at the 99th percentile                    | the same                        |

## Alternatives considered

- **The drafts' one adventure of two hours.** One genre tests fewer of the engine's pieces, and two hours is eight to
  twelve times 0017's scale. Its material is spread over the three games instead.
- **The shooter in the caves.** Closed levels, no sky, no ground cover: the cheapest place to draw, the opposite of
  what the forest is for. The caves stay, in the adventure.
- **A valley of 240 × 240 m first** (the recommendation; 150 × 150 m was offered too). Cheaper to reach a playable
  valley, growing only if F0's navigation allowed it. The author chose the large valley: the mount and the fairy's view
  from above both want room, and the hierarchy and the loading by zones are pieces the forest is for. Their cost moves
  into F2.
- **Networking first.** The forest's largest additions are the view's, which networking does not see; its simulation
  pieces each say how they reconcile. Networking first would test it only on levels of boxes.
- **A smaller knight.** A capsule under 1.6 m would change, before anything else, every place F1's audit finds (hit
  parts, clip strides, the gym's numbers), and gives nothing the world's scale does not. The fairy is small for another reason:
  she shares the knight's valley, so the valley cannot grow for her.
- **The fairy first.** Flight would make the canopy, the gaps and the fog's cover mean nothing before the engine has
  the terrain, the far drawing and the steering in 3D that flight needs; the knight's three games build them.
- **Terrain as a triangle mesh, boxes or voxels.** A mesh could have overhangs, but it has no grid that the
  navigation and the wind can read, and it is searched through a tree where a height field finds its cell at once;
  boxes leave seams where a rolling body catches, and make thousands of entities; voxels are steps.
- **Lianas as Rapier joints.** Multibody or impulse joints are the world's state, which 0016 does not re-simulate, and
  their determinism across browsers is unmeasured. F0 measures a chain beside the pendulum, for the record.
- **Sculpting by hand.** 0015 stays: scripts only, a hand-made source is not taken.
- **Renumbering the phases.** Networking is "phase 6" in decisions that stay as written.
- **Every piece built in the Dojo first, as phase 4 did.** It gives a bench for each piece, but a room tells nothing
  of what 0031 found, and pieces written inside the Dojo's rules had to be moved out when two games needed them (5e).
  The rooms are kept, the pieces live in packages.
- **Everything built straight in the games, as phase 5 did.** It is faster to a game, but a piece shared by three
  games and the four browsers is then tested inside one game's level, its failures mixed with the level's, and its
  measures (the gym's kind) are not taken before the design leans on them.
- **The audit of what assumes the mannequin with the fairy** (the first version's place for it). The creatures and the
  mount come first and are bodies of other sizes, the mount one the player drives: they would make the assumptions
  deeper before the audit read them.
- **No playable forest until F4.** F2 ends with a test that drives the valley and F3 with a picture; the first thing
  the author could play would be a whole game built on a valley nobody had played. The prologue costs a short level
  and gives the first judgment of scale, feel and atmosphere where it is cheap to act on.

## Consequences

- **What it leaves:** terrain with its format, generator and navigation (any outdoor level; phase 7's worlds); organic
  pieces whose collision comes from their script; instancing, levels of detail and quality tiers for every game
  (`view.quality`, promised in phase 5); KTX2 and meshopt for any asset; creatures of four legs (mounts, animals);
  navigation by size of body, and steering in 3D without a grid (the first navigation that does not assume "up" is
  +Y, which phase 7 needs); light as a system (puzzles in any game); purifying as a kind of damage; ropes as
  constraints (chains, a grappling hook from the idea bank); swimming and buoyancy (the idea bank's water, built);
  and, with the fairy, flight with weight and wind, a second playable body and a character's size as data (phase 7's
  characters, the editor's). And for phase 6: the first test of re-simulating one's own character, with the cases
  most likely to break it already in it.
- **What changes elsewhere:** 0026's budget becomes the floor tier's; instancing moves from phase 8 here, as the
  view's; 0024 gains terrain cells and grids by body size; the idea bank loses water, buoyancy and ropes; the Dojo gets
  a rule for what is tried in it and what in the games, and a valley room. Touch controls stay off (0028) and
  networking waits; the shooter online stays the wall's (phase 6).
- **The risk:** a phase that does not end, and games that are tours of the engine's new pieces. Each challenge is
  measured before it is built, each game is designed before its rooms and closes with its demonstration, each stage
  is played in grey before it gets art, and the prologue is played before any game is built on the valley.

## The author's answers

Asked one by one on 2026-11-18, each with a recommendation and its alternatives:

1. **The floor:** the Iris Plus, plus a high tier (recommended); the likeness to the concept image is the high
   tier's. Not taken: only the Iris Plus; a dedicated GPU as the floor, leaving the Iris Plus out.
2. **The high tier's machine:** chosen in F0, a dedicated mid-range GPU at hand then (recommended); until then its
   numbers say "measured in F0". Not taken: a machine named now; a multiple of the floor's budget, with no machine.
3. **Where it goes:** a named phase between 5 and 6, stages F0 to F8, after 0031's stages (recommended). Not taken:
   renumbering the phases; after networking.
4. **The valley's size: large from the start, about 500 × 500 m.** The recommendation was 240 × 240 m first, growing
   after F0; 150 × 150 m, the demo's, was offered too.
5. **The hero:** the engine's character with a new look, small by the world's scale (recommended). Not taken: a
   smaller knight; another hero with a body of its own from the start.
6. **The mount:** a younger stag sized to the hero; the giant guardians are not ridden (recommended). Not taken: the
   giant guardian; no mount.
7. **Water and the mount:** both, in the adventure's second part, F6 (recommended). Not taken: the mount earlier, with
   the creatures (F5); water only; both later.
8. **The fairy:** a fourth game after F8, with its own decision then; one game in flight on the same valley, single
   player, the fairy small in the knight's valley, light as her fuel (recommended). Not taken: the fairy replacing the
   knight in the three games; a second player beside the knight (after phase 6); a companion first, playable later.
   The knight and the fairy together stays noted for after phase 6.

## The revision of 2026-11-19

A review of the route the day after, read against what phase 5 learned (0031) and against the history of how the Dojo
was used. The author's words, accepting it: "sí, reescribilo, pero también consideremos de usar el Dojo para hacer
pruebas que en la fase 5 parece que no lo usamos... quizás para algunas cosas sí, y para otras se puede trabajar
directamente sobre los nuevos juegos". Each aspect, and whether it stays:

| Aspect                                            | Stays or changes                                                                    | Why                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| The forest before networking                      | Stays                                                                               | Its largest additions are the view's; the reconciliation table, now tested, keeps phase 6 from surprises                                            |
| The order: measure, decide, grey, draw, the games | Stays                                                                               | The GPU is the forest's largest risk (2.4 times 0026's draw calls, 13 to 22 times its triangles): nothing is decided before the sweep               |
| The games' order: canopy, spring, night, fairy    | Stays                                                                               | Each one's pieces are the next one's (the trees, the creatures, purifying, the steering in 3D)                                                      |
| The height field, the liana as a pendulum         | Stay                                                                                | A grid the navigation and the wind read; the hold as one's own character's state, re-simulated with it                                              |
| What the simulation keeps, what loads by zones    | Stays                                                                               | The world cannot depend on where anyone stands                                                                                                      |
| How a game is designed                            | Changes: designed as a game from its first day, one new verb at its heart           | Phase 5 was built pieces first and needed eight stages to play as games (0031)                                                                      |
| A playable forest                                 | Changes: the prologue closes F3                                                     | Until F4 nothing could be played; the first judgment of scale, feel and atmosphere comes where it is cheap                                          |
| The audit of what assumes the mannequin           | Changes: from F9 to F1                                                              | The creatures (F5) and the mount (F6), a body the player drives, come before the fairy; 27 files name the mannequin or its shape today              |
| The shooter                                       | Changes: levels to advance; its far-view test given to the canopy                   | The author's own words on the wall (0031); the night hides the far valley, which makes it cheaper to draw                                           |
| The look                                          | Changes: designed for the floor first                                               | The author plays on the Iris Plus; the likeness stays the high tier's (answer 1), the floor is a look of its own                                    |
| The reconciliation table                          | Changes: a test from F2, a case per piece                                           | No code re-simulates one character yet; the forest adds the liana, the water and the mount, the cases most likely to break it                       |
| The Dojo                                          | Changes: a rule (rooms for mechanisms, the games for what is played), a valley room | Phase 4's pieces inside the Dojo had to be moved out (5e); phase 5 used it for the gym only, which paid for itself; 0031's findings were the games' |
| The adventure's riskiest measures                 | Changes: each opens its room (rays a step, legs, the swimmer's surface)             | The drafts rated them high; F0 measures what F1 decides, each room measures before its game leans on it                                             |
| The valley's size, the hero, the mount, the fairy | Stay                                                                                | The author's answers of 2026-11-18                                                                                                                  |

## Sources

- The drafts, kept outside the repository (like decision 0012's idea bank): the demo "El Bosque de los Espíritus"
  (one HTML file, three.js 0.170), its concept image, and the design document "El bosque de los espíritus en
  Manifold — diseño, análisis y hoja de ruta" (Part I the game, Part II the engine).
- Rapier's deterministic build, 0.21.0 (`@dimforge/rapier3d-deterministic-compat`): `ColliderDesc.heightfield`,
  `HeightFieldFlags.FIX_INTERNAL_EDGES`, `World.createMultibodyJoint`, read from its type declarations.
- The 4.5 audit of what assumes "up" is +Y ([docs/audits/up-is-y.md](../audits/up-is-y.md)).
