# Parte 6. Un mundo que responde: the lesson sheets

Sheets for the sixteen lessons of part 6 of [the curriculum](../tutorial-curriculum.md), under
[decision 0021](../decisions/0021-a-new-tutorial.md). Book abbreviations as in the curriculum's §2. "From the archive"
says what a lesson keeps, changes and adds from the archived tutorial (`site/src/content/docs/tutorial/etapa-*`,
examples in `site/src/lessons/stage-*`). Lesson text never names an engine stage (0021).

## The part sheet

**At the end the reader can** describe a world as data (kinds with defaults, instances, handles), load each resource
once and free it on time, write levels as text read with errors by line, make places that notice who enters, post
events for later in an order that never depends on luck, wire mechanisms with signals, compute in physical units how
lit the player is and who sees them, place sounds in space and fire them from events, break things in layers, mark
world things on the screen in two languages, save progress with versions, generate a dungeon from a seed that is
always playable, and test a level by replaying its solution.

**The closing game, _la sala de sigilo_.** A room written as a level text. Two or three watchers (part 1's turrets, as
cameras on their yaw and pitch) see the player when the brightest of three body samples is lit above a threshold, inside
their cone and along a clear ray. A detection counter fills while seen and drains when not; full is the alarm.
Footsteps and impacts are noises with a hearing radius by surface: a watcher that hears one turns toward it (1.16's
aim) and its counter rises. Hearing is a straight line, so it passes through walls: the flaw is left visible on purpose,
as 7.10's hook. Lamps break when hit by a thrown object, which makes noise. The exit door opens when a crate is
pushed onto a plate (4.13) and a lever is pulled, and closes 5 s after the plate empties. Markers show the exit and
each watcher's state, in Spanish or English. Checkpoints save progress; an alarm sends the player back to the last
one. Win: reach the exit. Score: time, alarms, lamps broken. The level ships with a recorded solution that the test
suite replays in Node. Optional: a seeded variant of the room (6.14).

**How the code grows** (stable names in bold):

- **6.3** `level/`: **`readLevel`**, **`writeLevel`**, **`buildLevel`**, `kinds.ts` (**`Kind`**, **`resolveKind`**),
  `map.ts` (**`mergeRectangles`**); `handles.ts` (**`HandleTable`**, **`Handle`**); `resources.ts` (**`Resources`**,
  **`acquire`**, **`release`**, **`switchLevel`**).
- **6.7** `zones.ts` (**`Zone`**, **`senseZones`**), `events.ts` (**`EventQueue`**, **`post`**, **`postAt`**,
  **`deliver`**), `signals.ts` (**`Signal`**, **`computeSignals`**), `mechanisms.ts` (**`Door`**, **`Lift`**,
  **`progressOf`**); `input.ts` gains the action **`use`**.
- **6.10** `noise.ts` (**`Noise`**, **`hearingRadius`**); `audio/` (**`AudioService`**, `NullAudio`, `LoggingAudio`,
  `WebAudioService`; `cues.ts`; `mixer.ts`).
- **6.16** `light.ts` (**`illuminance`**, **`lightAt`**, **`visibility`**), `watchers.ts` (**`Watcher`**, **`sees`**),
  `breakables.ts` with `view/debris.ts`, `ui/markers.ts` (**`toScreen`**, **`edgeMarker`**), `ui/words.ts`
  (**`say`**), `ui/hud.ts`, `save.ts` (**`saveProgress`**, **`readSave`**, **`MIGRATIONS`**), `checks.ts` (`wait`,
  `assert`), `game.ts`'s flow of tasks.

The step's phases at the end of the part, in order: inputs → mechanisms (reading the last step's signals) → physics →
breaks → light → zones → signals → rules → events handed to the view.

**Lab-kit pieces:** an oriented box with inside highlighting; an event log with arguments; a ring-buffer widget (a
circle of slots, head and tail); a timeline of queued events; a wiring graph with live values; a floor heat map; body
sample points; gain meters in decibels and a speaker circle; a set diagram with a counts table; a handle table; a text
panel with errors by line and a diff; a grid view; the two-viewport figure; seed box and hash readout.

## The lessons

### 6.1 El mundo como datos (C)

- **Question:** ¿Cómo se describe un mundo entero sin escribir una clase por cosa?
- **Before:** 2.11 (many things in a step, adding and removing), 5.2 (Component), 5.7 (schemas with defaults), 1.3
  (state as data).
- **Leads:** **GPP** ch. 13, ch. 14, ch. 5; **G2** §16.1–16.3, §17.2, §17.3.3, §17.5.3. **Also:** G §7.2.2.9 (ids
  resolved in a second pass); MA §6.1.1 (level data carries annotations: waypoints, hiding spots); GPP ch. 3 (shared
  kinds are immutable).
- **Approach:** the hook: the stealth room needs crates, heavy crates, lamps, breakable lamps, plates, doors, watchers;
  a class per kind. G2's amphibious vehicle is the argument: a lamp that breaks and can be carried has no place in a
  tree. The ladder: classes → kinds as subsets of components → kinds as data with defaults and a parent → instances
  that override → ids and handles as references. G2 also separates static from dynamic: the game state is the dynamic
  part. Rejected: a deep hierarchy whose root collects every feature.
- **The mathematics:** (1) An object is an id; a component is a partial function from ids to values (a table keyed by
  id, G2's property-centric model); a kind is a subset of components (2^_k_ kinds from _k_). (2) Delegation:
  resolve(kind, field) is the kind's own value if present, else resolve(parent, field); it terminates because parents
  form a forest (a cycle is refused); dynamic lookup against copy-down at load. (3) A handle is (index, generation),
  live iff the slot's generation matches; reusing a slot increments it. Worked example: `crate` {mass 20, size 1},
  `heavy-crate` {parent crate, mass 80}: resolve(heavy-crate, size) = 1. Handle (3, 7); delete and reuse slot 3 (now
  generation 8): get((3, 7)) is stale.
- **The live figure:** (a) a class tree that breaks at the diamond, toggled against a table of components with
  checkmarks; (b) a kinds editor with parents: change a parent's default and the children follow (dynamic) or not until
  reload (copy-down); (c) a handle table: create, destroy, recreate, and the old handle flagged. Panel: kinds
  expressible against classes written, resolved values, stale detections.
- **Traps:** 0 or `null` as "not overridden" (GPP's sample) hides a real 0; JavaScript references in the state cannot
  be saved or hashed (6.13); a shared kind mutated at run time changes every instance; "everything dynamic" costs.
- **Exercises:** (1) A heavy crate by delegation. (2) Implement both lookups and measure a thousand reads. (3) Classify
  the stealth room's things into kinds, static and dynamic.
- **Our angle:** decision 0004: an entity is a number and its components are plain data, so the world is copied,
  hashed and snapshotted; the engine never reads a zone's kind (the game's word). MA's hiding spots enter the level data
  from the start.
- **From the archive (2-00, 3-00):** kept: "un nivel es datos, no código" and 3-00's entities found by name. Changes:
  a concept lesson behind both, before the format. New: Type Object with delegation, components as tables, handles
  with generations, static against dynamic.
- **Sources:** GPP ch. 13 ([Type Object](https://gameprogrammingpatterns.com/type-object.html)), ch. 14, ch. 5
  ([Prototype](https://gameprogrammingpatterns.com/prototype.html)); G2 §16.1–16.3, §17.2, §17.3.3, §17.5.3.
- **Open:** names in the text, handles at run time (G2): the sheet assumes both.

### 6.2 Recursos: cargar una vez, soltar a tiempo (C)

- **Question:** ¿Cómo se carga cada modelo una sola vez, y cuándo se suelta?
- **Before:** 6.1, 1.3 (start-up, shut-down, disposal), 5.15 (one model loaded).
- **Leads:** **G** ch. 7 (registry, lifetimes, Table 7.2's counts, composites, post-load initialization), §6.1–6.2,
  §3.2, §1.6; glTF; three.js's disposal.
- **Approach:** the hook: go from the maze to the stealth room and back three times; `renderer.info.memory` grows (no
  disposal) and every return reloads (a hitch). The ladder: load per instance → a registry by id → lifetimes (global,
  per level) → counts across a level change, in the right order → composites as a dependency graph → a visible
  placeholder for a missing asset (G §3.2: make errors obvious, keep working). Resources are view: the simulation never
  waits on them, and collision shapes come from the level, not the meshes.
- **The mathematics:** (1) Counts across a change: _X_ = {A, B, C}, _Y_ = {B, C, D, E}. Increment _Y_'s first, then
  decrement _X_'s: unloaded _X_ ∖ _Y_ = {A}, loaded _Y_ ∖ _X_ = {D, E}; for _r_ ∈ _X_ ∩ _Y_ the count never reaches 0
  (the increment comes first). The naive order drops B and C to 0 and reloads them. (2) A composite (a glTF: meshes,
  materials, textures, skeleton, clips) is a DAG: load in topological order, release in reverse, a count per node. (3)
  Memory: a 1024² RGBA8 texture is 4 MiB, 5,33 MiB with mipmaps (×4/3).
- **The live figure:** two levels' resource sets as overlapping sets and a counts table; switch levels. Toggles: naive
  order (reloads > 0) against the right one (0); disposal off (textures and geometries grow per switch); a missing file
  (a red box and a log line); pre-compiling against first-draw upload (the frame spike). Panel: loads, unloads,
  reloads, `renderer.info.memory`, worst frame time (ms).
- **Traps:** removing a mesh does not free GPU memory (dispose geometries, materials, textures); a shared resource
  disposed while used; an async load finishing after the level changed (check a generation, 6.1's handle). Capsules:
  performance (first-use upload hitch: `renderer.compile`); asset pipeline (compressed meshes and textures).
- **Exercises:** (1) Loads and unloads from _Y_ to {C, E, F} (load F; unload B, D). (2) Find a leak in the counts table
  (a count that never returns to 0). (3) Memory of a 2048² texture with mipmaps (21,3 MiB).
- **Our angle:** "measure first" (3.13): `renderer.info` is the measurement; resources are kept out of the
  deterministic state by construction.
- **From the archive:** nothing (G's resources had no lesson); 2-06's glTF section is recalled.
- **Sources:** G ch. 7, §3.2, §6.1; [three.js manual](https://threejs.org/manual/) (disposing);
  [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- **Open:** check what Manifold's presentation does with models (`models.ts`) to write "En Manifold".

### 6.3 Niveles como texto (P)

- **Question:** ¿Cómo se escribe un nivel en un archivo y se lo carga?
- **Before:** 6.1, 6.2, 3.17 (the maze from a seed), 5.11 (the moving level, in code).
- **Leads:** none listed. **Also:** GPP ch. 5 (data modelling); _Crafting Interpreters_ (scanning, panic-mode
  recovery); G2 §17.3.3 (spawners); G §7.2.2.9 (two-pass references).
- **Approach:** the levels so far are code. Four diffs: a line format with a version header and errors by line; kinds
  declared in the file with defaults; a map block drawn with characters and merged into rectangles; levels switched
  through the resource registry. The maze generator of 3.17 now writes text, so every level takes one path.
- **The mathematics:** (1) Scanning words with a cursor; recovery at the end of the line confines each error to its
  line. (2) Degrees to quaternions with `trig.ts`: (_x_, _y_, _z_) = axis sin(θ/2), _w_ = cos(θ/2); `rotate x 20` is
  (0,1736; 0; 0; 0,9848). (3) Greedy merge: from each uncovered cell extend along the row, then down while the whole
  width qualifies; not minimal, but the same drawing always gives the same boxes in the same order. A 3 × 2 room in its
  walls gives four walls and one floor. (4) Metres to cells with `Math.round`, not `floor`.
- **The project:** `level/read.ts`: `readLevel(text)` → level and errors (the project refuses a level with errors and
  reports the first with its line). `level/write.ts`: `writeLevel`. `level/kinds.ts`: `Kind`, `resolveKind`.
  `level/map.ts`: `mergeRectangles`. `level/build.ts`: `buildLevel(level, world, resources)` spawns each instance
  (entity, collider from data, mesh from the registry), resolving names to handles in a second pass. `handles.ts`,
  `resources.ts`. Format: `# level 1`; `kind`, `box`, instances (`<kind> <name> at x y z [rotate axis deg] [key value]`),
  `spawn`, `map`/`legend`/`end`. Playable: the maze and a first room loaded from files; switching frees resources.
  Console: `level.load room` (startup), `level.export`, `show.handles`. Recipe: `level.load room; step 300; hash`
  equals the same after loading the text that `level.export` printed.
- **Traps:** a colour is not a comment (`#` only at the start of a line); another version is refused, never guessed; a
  box turns about its centre; the parse must not use `Math.sin` for what the world builds.
- **Exercises:** (1) A box by hand, resting on the floor (half extents). (2) End-of-line comments that do not eat
  colours. (3) A `level 2` reader with a migration from `level 1` (a bridge to 6.13).
- **Our angle:** Manifold's `levelFromText`, `levelToText` and `mapParts`; its format is strict (an unknown word is an
  error, unlike UDMF), keeps every older reader, and is checked when the site builds.
- **From the archive (2-00, 3-09):** kept: the line format, the version header, errors by line, half extents and
  degrees, panic mode, the three ways with old files; 3-09's map and legend, greedy merge and its non-optimality, round
  trip, the `round` trap. Changes: a project lesson. New: kinds in the file, spawners, two-pass references, level
  switching with counts.
- **Sources:** [Crafting Interpreters, Scanning](https://craftinginterpreters.com/scanning.html); GPP ch. 5; G2
  §17.3.3.
- **Open:** the map block moves here from 6.15 (old 3-09) so 6.14 can emit maps; whether part 5's rails, joints and
  pickups enter the format.

### 6.4 Zonas que notan quién entra (C)

- **Question:** ¿Cómo sabe el mundo que alguien entró o salió de un lugar?
- **Before:** 6.3, 3.8 (boxes), 2.12 (Observer first met), 1.11 (testing in an object's space), 2.7 (edges).
- **Leads:** **GPP** ch. 4; G2 §14.3.7.3 (phantoms), §17.8.1–8 (events as a type with arguments; interest). **Also:**
  E §4.2.1, §7.7; MA §11.1–11.2 (polling against events, honestly; FIFO, where the book pops LIFO); L2 Ex. 9.8.
- **Approach:** a zone notices; its events are the difference between two steps (E: the edges of a Boolean, part 2's
  input edges again). Observer: the zone does not know its listeners; they register interest by event type. Zones are
  rooms and doorways are portals, so the level carries a room graph (7.10 walks it). Rejected: a virtual handler on
  every object for every event (G2); "any touch" as the meaning of entering (the center is).
- **The mathematics:** (1) Inside a rotated box: **d** = _P_ − _C_, local = **R**ᵀ**d** (dot products with the box's
  axes), |local_i| ≤ _h_i. (2) The cheap filter: the holding box reaches Σ_i _h_i|**a**_i·**x̂**| along _x_; by the
  triangle inequality it never rejects an inside point. (3) With _A_ inside before and _N_ now: entered _N_ ∖ _A_, left
  _A_ ∖ _N_, so entered − left counts who is inside (nobody leaves without entering). (4) A fixed order: zones in
  creation order, left before entered, bodies by id. (5) Polling costs a check per listener; an event costs one check
  plus the interested listeners (MA). Worked numbers: a 30 cm gate crossed at 4 m/s (6,7 cm per step): about 4–5 steps
  inside; a 2 cm gate is seen in about one crossing of three.
- **The live figure:** the archived bowl of balls with its zones (a rotated gate, a tiny spot, a drain), plus two rooms
  and a doorway with the room graph drawn. Toggles: center against any touch, the cheap filter, the gate's thickness.
  An event log with arguments. Panel: Σentered − Σleft = Σinside, exact tests over total tests, each ball's room.
- **Traps:** a body removed inside gives a removal event, not "left"; zones watch moving things only; tunnelling
  through thin zones; Observer is synchronous: a listener that removes the zone mid-notification (iterate a copy).
- **Exercises:** (1) Steps inside the gate at 30 cm and at 2 cm. (2) A star for the first who enters. (3) "Any touch"
  with the closest point on the box (3.7).
- **Our angle:** Manifold's zones belong to the world, not Rapier: the center counts, the bits are the same everywhere,
  and they are not a step late like Rapier's broad-phase boxes; the events sit in a fixed order. Part 5's sphere
  checkpoints become zones now.
- **From the archive (2-01):** kept almost whole: the bowl, `sense`, the holding box and its proof, the order, the
  three exercises. Changes: Observer with interest. New: rooms and portals, polling against events.
- **Sources:** GPP ch. 4 ([Observer](https://gameprogrammingpatterns.com/observer.html)); G2 §14.3.7.3, §17.8; E
  §4.2.1; [Rapier, advanced collision detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js).
- **Open:** 6.7 should use these world zones, not Rapier's sensors (4.11 met those).

### 6.5 La cola de eventos (C) ◇

- **Question:** ¿Cómo se avisa algo para después, en un orden que no dependa de la suerte?
- **Before:** 6.4, 2.11 (order within a step), 2.14 (what determinism needs).
- **Leads:** **GPP** ch. 15; **G2** §17.8.9. **Also:** MA §11.4.4 (notifications sorted by delivery time).
- **Approach:** GPP's line: Observer decouples _who_, a queue decouples _when_. The hooks: a door that closes 5 s after
  a plate empties, a lamp that blinks by posting itself again, two coins in one step doubling a sound. Immediate
  dispatch fails three ways (deep chains, re-entrant handlers, no merging). The ladder: a call → an array → a ring
  buffer → a delivery step and a priority (G2) → a key that is a total order → merging.
- **The mathematics:** (1) The ring buffer: _N_ slots, [head, tail) modulo _N_; empty ⇔ head = tail; full ⇔
  (tail + 1) mod _N_ = head; capacity _N_ − 1 (or keep a count). (2) Each event has the key (step, priority, seq), seq
  unique; lexicographic order is total, so a heap (not stable) pops exactly the sorted order whatever the insertion
  history: delivery is deterministic. (3) A delay is a post into a later step. Worked example: _N_ = 8, head 6, tail 2:
  size (2 − 6) mod 8 = 4. Posted (120, 1, 9), (120, 0, 10), (119, 2, 11): delivered seq 11, 10, 9.
- **The live figure:** GPP's circle of slots with head and tail; requests enter and leave; a capacity slider; a merge
  toggle (two coins in a step become one entry). Below, a timeline of future events sorted by key; a lamp re-posting
  itself every 120 steps; a "dispatch before the system that needs it" toggle (one step late). Panel: head, tail,
  size, capacity, delivery order, late deliveries (0).
- **Traps:** a queued event sees a changed world: capture data when posting, or a handle checked for staleness (6.1);
  a handler posting into the same step forever (post into the next one); a global queue is a global variable with a
  protocol.
- **Exercises:** (1) Prove the empty and full conditions. (2) Why not use all _N_ slots (head = tail would be
  ambiguous); fix it with a count. (3) A blink every 2 s.
- **Our angle:** the determinism thread's "queues with a tie-breaking rule"; Manifold keeps a step's events for the
  rules and a per-frame list for the presentation, so two steps in one frame lose nothing; the ring returns in part 9.
- **From the archive:** the "cola de eventos" boxes of 2-01 and 3-03; no lesson of its own. New.
- **Sources:** GPP ch. 15 ([online](https://gameprogrammingpatterns.com/event-queue.html)); G2 §17.8.9; MA §11.4.4.
- **Open:** fold target: the first section of 6.6.

### 6.6 Señales y mecanismos (C)

- **Question:** ¿Cómo se conecta una palanca con una puerta sin que se conozcan?
- **Before:** 6.5, 6.4, 2.11 (the double buffer).
- **Leads:** **G2** §17.8.10–11 (data pathways: ports, wires, nodes); GPP ch. 8 (the slapstick ring); MA §11.2.3.
  **Also:** decision 0018.
- **Approach:** a lever must open a door without knowing it. An event can be lost; a value is read when needed (a wire,
  not a message). GPP's ring shows why the order of evaluation matters: three actors each slap the one they face if
  slapped. Three rules: entity order (fragile), double buffer (one step per link), declared order (a one-pass DAG,
  0018). G2's pathways give the wiring as data; mechanisms are functions of the step.
- **The mathematics:** (1) The ring: in list order, a slap travels a whole lap in one step or one link per step,
  depending on the permutation; double-buffered, exactly one link per step (induction on the distance). (2) Reading
  only signals declared above makes the order of declaration a topological order: one pass computes all, and a cycle
  cannot be written. (3) Mechanisms read the last step's values: cause to effect is exactly one step for any chain
  (computed backwards: one per link). (4) `toggle` and `latch` keep memory in the state. (5) A door's opening
  _p_ = clamp(from + (_t_ − since)_h_/_T_, 0, 1); a change midway restarts from _p_ now. (6) `delay d` posts the change
  at step + _d_ (6.5). Worked example: a → both → open: 1 step in order, 3 backwards.
- **The live figure:** the archived two plates, two crates, button, door and lamp, with the signals' values per step;
  beside them the ring, a permutation selector and the rule switch; a fourth link closes a cycle (in order: endless
  within one step; double buffer: oscillation; declared: refused). Panel: cause-to-door steps (1; backwards 3), steps
  per lap for each order.
- **Traps:** `used` lasts one step; a toggle's memory must be state (a snapshot taken mid-press); a door following a
  plate closes as you step off (a latch); computed signals cannot be written; swap buffers after all writes.
- **Exercises:** (1) Steps per lap for each of the 3! orders. (2) A latched door. (3) Two crates on one plate (`zone`
  counts).
- **Our angle:** decision 0018: values, not events; written order, reading above; one step from cause to effect; in the
  hash. Factorio's combinators add a tick each; Manifold resolves a chain in one step. Manifold has no `delay` yet
  (a game rule until a level asks): ours, through the queue, is ahead.
- **From the archive (3-00):** kept: the example, the operations, the backwards toggle, the door as a function of the
  step, the latch, cycle and count exercises. Changes: framed by the ring and its three rules. New: delays through the
  queue, the induction proofs, G2's pathways.
- **Sources:** G2 §17.8.10–11; GPP ch. 8 ([Double Buffer](https://gameprogrammingpatterns.com/double-buffer.html));
  decision 0018.
- **Open:** none.

### 6.7 Puertas, palancas y placas (P)

- **Question:** ¿Cómo responde el nivel a lo que hace el jugador?
- **Before:** 6.6, 6.3, 4.13 (pushing a crate).
- **Leads:** none listed; it assembles 6.4–6.6.
- **Approach:** three playable diffs: zones with enter and exit events; the event queue; signals and mechanisms wired
  in the level text. Last, a door with a delay.
- **The mathematics:** recalled in a line each (the box test, entered and left, the key order, the one-step latency,
  the door's progress).
- **The project:** `zones.ts`: `Zone`, `senseZones(world, step)` → events in a fixed order. `events.ts`:
  `EventQueue`, `post`, `postAt(step, priority, event)`, `deliver(step)`. `signals.ts`: `Signal` (`zone`, `used`,
  `any`, `all`, `not`, `toggle`, `latch`, `delay`), `computeSignals`. `mechanisms.ts`: `Door`, `Lift`,
  `progressOf(m, step)`. `input.ts` gains `use` (nothing renamed). The step gains zones and signals; mechanisms read
  the last step's signals. Format `level 2`: `zone`, `signal`, `door`, `lift`; the `level 1` reader stays. Playable: a
  room of the maze whose door opens with a crate on a plate and a lever, closing 5 s after the plate empties. Console:
  `signals`, `signal lights 1` (an input signal: world), `show.zones`, `show.signals`. Recipe:
  `level.load machines; place crate plate_a; step 1; signals` prints `a 1`, and the door's progress grows from the next
  step.
- **Traps:** a lift passing through a plate must not press it (plates count characters and dynamic bodies); `use` is an
  edge; ties in delivery follow the key.
- **Exercises:** (1) Two plates in AND. (2) A lamp that blinks. (3) A door that would close on the player: a zone
  reopens it.
- **Our angle:** Manifold's `machines` room has these pieces; its signals are hashed.
- **From the archive:** 3-00's signals and 2-01's zones are its starting code.
- **Sources:** decision 0018; those of 6.4–6.6.
- **Open:** none beyond 6.4's.

### 6.8 La luz como lógica, y la vista (C)

- **Question:** ¿Cuánta luz le llega al jugador, y quién lo puede ver?
- **Before:** 6.4, 3.9 (rays), 1.5 (the cone test), 1.17 (the turret's cone).
- **Leads:** **L2** §8.1.1–8.1.3, §9.5; **RTR** 5.2. **Also:** G2 §12.2.4.3–5, §12.4.2; MA §6.1.3 (the brightest of
  several samples), §11.4.3–4 (contrast; signals proportional to light); Leonard on _Thief_.
- **Approach:** the hook: the turret's cone sees the player in a dark corner. Light becomes logic, physical (L2):
  intensity in candela, illuminance in lux, the inverse square with a window; RTR's spot cone with three.js's own
  formula, so the drawn light and the logic agree; MA's maximum over body samples. Rejected: the archive's linear
  falloff to a radius (it disagrees with the drawing), a single center point, and reading rendered pixels (encoded
  colours, view-dependent).
- **The mathematics:** (1) Flux through spheres of area 4π_r_² is conserved, so _E_ = _I_/_r_²; on a surface,
  _E_ = _I_ max(0, **n̂**·**l̂**)/_r_² (Lambert). (2) The window: _f_(_r_) = sat(1 − (_r_/_r_max)⁴)²/max(_r_², _r_₀²),
  zero at _r_max with zero slope (three.js's falloff). (3) A spot: _c_ = **d̂**·**â**, factor
  smoothstep(cos θ_out, cos θ_in, _c_). (4) A ray to each lamp: 0 if blocked. (5) A body: samples at head, chest, feet;
  _V_ = max over samples. (6) Sight: in range, **d̂**·**m̂** ≥ cos(fov/2), a clear ray, _V_ ≥ _T_. (7) Everything in
  linear lux, never from an encoded colour (8.6). Worked example: _I_ = 400 cd, a sample 3 m away, 25° off the axis,
  cones 30° and 20°, _r_max = 10 m: _t_ = 0,5468, smoothstep 0,5700, window 0,9839, _E_ = 24,9 lx.
- **The live figure:** the room from above: point and spot lamps (intensity, range, cones), a column, the player with
  three samples, the watcher's cone, a visibility heat map. Toggles: max ↔ mean, three.js's window ↔ the archive's
  linear falloff, linear lux ↔ encoded pixel. **One knob, two failures:** _r_max (short: lit-looking floor counted
  dark; long: every lamp in every query, rays per step grow). Panel: _E_ per lamp and sample (lx), _V_, mean, seen,
  rays per step.
- **Traps:** 1/_r_² explodes near the lamp (_r_₀); lit feet and a dark head: the max says seen; a dark player against a
  bright wall (MA's contrast: "Más a fondo"); work with _r_² (no square root); cosines of the cone computed once with
  `trig.ts`.
- **Exercises:** (1) L2 Ex. 8.1: the sun's intensity from 100 klx at 1,5·10¹¹ m (2,25·10²⁷ cd). (2) Max against mean
  on the feet-lit case. (3) Where the window halves the inverse square (_r_/_r_max = 0,7357).
- **Our angle:** Manifold's light is in the world and the hash, computed before signals; a watcher's sight is a signal
  source; its fog attenuates as 1/(1 + σℓ), without `exp`. The archive's Sutileza (drawn light reaches farther than
  logic) is solved by using three.js's window; 8.7 recognizes this function.
- **From the archive (3-01):** kept: the dark room, column, fog bank, the watcher's four tests, slabs, the rational fog
  ("Más a fondo"), the exercises (carried lamp, two fogs, sweeping watcher). Changes: physical units and three.js's
  window. New: spot cones, Lambert on the floor, samples and their maximum, the linear-quantity rule.
- **Sources:** L2 §8.1, §9.5; RTR 5.2; MA §6.1.3, §11.4.3–4.
  [Leonard, Thief's sensory system](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-);
  [Red Blob, 2D visibility](https://www.redblobgames.com/articles/visibility/).
- **Open:** none.

### 6.9 El sonido en el espacio (C)

- **Question:** ¿Qué tan fuerte, y de qué lado, se oye algo?
- **Before:** 6.8, 3.9, 1.5, 2.3 (smoothing).
- **Leads:** **G2** §15.1, §15.3.2.1, §15.4; **W3C Web Audio**; MDN. **Also:** Smus; three.js `PositionalAudio`; MA
  §11.4.4 (hearing as a signal over a threshold).
- **Approach:** G2's "audio as rendering": sources, a listener, an environment. The hook: a sound behind the player is
  equally loud in both ears at 1 m and at 20 m. Web Audio's `PannerNode` maps almost one to one. Rejected: linear
  panning. Shown on purpose: a guard's straight-line hearing leaks through a wall (7.10's hook).
- **The mathematics:** (1) Intensity ∝ _p_²; _L_ = 20 log₁₀(_p_/_p_ref) = 10 log₁₀(_I_/_I_ref); doubling the distance
  costs 6,02 dB. (2) Web Audio's inverse model: _g_ = _r_ref/(_r_ref + ρ(max(_r_, _r_ref) − _r_ref)), silenced past
  _r_max by culling. (3) The listener's frame: _x_ = **d̂**·**right**, _z_ = **d̂**·**forward**, θ = atan2(_x_, _z_).
  (4) Pan laws over β ∈ [0, 1]: constant gain (1 − β, β) dips 3 dB in the middle; constant power
  (cos βπ/2, sin βπ/2) keeps squares summing to 1. (5) A ray to the source (3.9): blocked → low-pass and gain, the state
  smoothed with 2.3's factor. Worked numbers: _r_ref = 1, ρ = 1: at 10 m, _g_ = 0,1 (−20 dB). Speakers at ±45°, a
  source 15° left: β = ⅔; constant gain (⅔, ⅓), power 5/9 (−2,55 dB); constant power (0,866; 0,5), power 1.
- **The live figure:** (a) falloff curves with a draggable listener, gain in linear and dB; (b) the speaker circle,
  bars for both laws, the total power; (c) a room with a pillar and a doorway: the direct ray, the state (free,
  obstructed, occluded), the cutoff; a "guard hearing" toggle lights a guard through the wall. Sound plays after a
  click. **One knob, two failures:** ρ (0: all equally loud; 10: gone at 2 m). Panel: distance, gain, dB, azimuth,
  left and right gains, power.
- **Traps:** the `AudioContext` starts suspended until a gesture; a curve that never reaches zero keeps voices alive;
  abrupt occlusion pops; the listener's forward and up follow the camera; audio is view (`Math.log10` allowed).
- **Exercises:** (1) The distance for −20 dB (10 m). (2) The pan law numbers. (3) Smooth the occlusion with 2.3's
  factor and count pops.
- **Our angle:** "doblar las reglas": a dialogue curve that stays intelligible farther (G2) is not physics. Manifold's
  sound is synthesized (0015) and subtitled with an arrow.
- **From the archive (3-03):** kept: the radius is the world's and the volume the listener's ("el radio no es el
  volumen"). Changes: a concept lesson on space. New: decibels, the inverse model, pan laws, occlusion rays.
- **Sources:** G2 §15.1–15.4; [Web Audio](https://webaudio.github.io/web-audio-api/);
  [MDN spatialization](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics);
  [three.js PositionalAudio](https://threejs.org/docs/#api/en/audio/PositionalAudio).
- **Open:** check whether Manifold's `audio.ts` pans by position before writing "En Manifold".

### 6.10 El sonido sale de los eventos (P)

- **Question:** ¿Cómo suena lo que pasa en el juego, sin sonar dos veces ni trabarlo?
- **Before:** 6.9, 6.5, 6.4, 2.10 (a stream per system).
- **Leads:** **GPP** ch. 15, ch. 16; **G2** §15.5. **Also:** Wilson (two clocks); jsfxr; decision 0015; G2 §14.3.8.3
  (collision materials).
- **Approach:** GPP's numbered failures with a naive `playSound` called from the rules: two coins in a step play
  doubled, two steps in a frame lose one, a decode blocks the step. The ladder: the world emits noise events (what,
  where, surface, hearing radius); the view drains each frame's events through a queue, merges, limits instances,
  varies them with a view stream, places them on the listener and schedules them on the audio clock. The audio service
  is passed or located, null in Node, logged by a decorator.
- **The mathematics:** (1) Noise in the world: a footstep every 0,8 m walked, radius by surface (wood 7, stone 6,
  metal 10 m) times a speed factor; a hit from the velocity change beyond gravity, ½_m_Δ_v_², ignored below 0,05 J. (2)
  Merging: uncorrelated sounds add in power, _g_ = √(Σ_g_i²): two equal ones +3 dB, not +6. (3) Instance limits: the
  _k_ nearest, ties by id. (4) Scheduling: when = audio time + latency + (step − drawn step)·_h_.
- **The project:** world: `noise.ts`: `Noise` events (kind, position, surface, radius), footsteps by distance,
  hits by Δ_v_; `hearingRadius`. View: `audio/service.ts` (`AudioService.play(cue, at, when)`, `NullAudio`,
  `LoggingAudio`, `WebAudioService`), `audio/cues.ts` (synth recipes as data: band-passed noise, a few partials, an
  envelope), `audio/mixer.ts` (merge per step, limits, groups with ducking, a view-side seeded stream). Playable:
  surfaces that sound and rings that show how far. Console: `view.volume`, `view.audio.log on`, `show.noise`. Recipe:
  `seed 7; restart; step 600; hash` gives one value with `view.volume 0`, with the null service and in Node.
- **Traps:** variation drawn from the world's stream would change the hash (use a view stream); drain every step's
  events each frame; a burst of contacts (limit per cue per step); never block the step on a decode.
- **Exercises:** (1) A carpet heard at 2 m. (2) Duck the effects 6 dB under a notice. (3) Log every sound in Node and
  in the browser and compare the lists.
- **Our angle:** Manifold's sound is born in the simulation with its radius (part 7's guards read the same event), hits
  come from velocities before and after (contact events live outside the state), and it is synthesized (0015). The
  thread's "seeded variation kept out of the hash".
- **From the archive (3-03):** kept: the three floors, footsteps by distance, radius by surface, hits by Δ_v_, the
  synthesis, "dos pasos en un cuadro", the minimum hit, the carpet and crouch exercises. Changes: a project lesson
  through the queue. New: the service locator, power summing, limits, the audio clock.
- **Sources:** GPP ch. 15–16 ([Service Locator](https://gameprogrammingpatterns.com/service-locator.html)); G2 §15.5;
  [Wilson](https://web.dev/articles/audio-scheduling); [jsfxr](https://sfxr.me/).
- **Open:** none.

### 6.11 Lo que se rompe (C)

- **Question:** ¿Cómo se rompe algo en pedazos sin que el juego se trabe?
- **Before:** 6.5, 4.11, 4.3 (impulse, restitution), 4.8 (inertia), 4.14 (the pool), 2.10.
- **Leads:** G2 §14.5.3.5, §16.1.1.1; MF §17.2.2; GPP ch. 19.
- **Approach:** the archive's layers: breaking changes the game (simulation), splinters only show (view). The hook: a
  lamp a watcher depends on. MF gives the criterion and pieces with their own mass and inertia; G2 the structure
  (indestructible, structural, non-structural, explosive) and a staged collapse; GPP the pool. Not stalling means few
  simulated bodies, pooled debris, fragments in a separate world, and a measured frame.
- **The mathematics:** (1) Three criteria from 4.3, with normal relative speed _v_n and reduced mass
  μ = _m_₁_m_₂/(_m_₁ + _m_₂): the impulse _J_ = μ(1 + _e_)_v_n; the energy dissipated ½μ(1 − _e_²)_v_n² (derived from
  momentum and restitution); the arriving body's ½_mv_² (the archive's). (2) Pieces: mass by volume, centre of mass,
  box inertia (4.8). (3) Structure: a brick falls when no path joins it to the ground in the support graph
  (connectivity by breadth-first search), staged by distance. Worked example: a 4 kg ball, a 2 kg vase, _v_n = 6 m/s,
  _e_ = 0,2: μ = 1,333 kg, _J_ = 9,6 N·s, dissipated 23,0 J, arrival 72 J; a threshold of 8 N·s breaks above 5 m/s.
- **The live figure:** the archived vase on a post, thrown at a chosen speed, and a brick wall with its support graph.
  Toggles: criterion, fragments on/off (the hash unchanged), pool against allocation (worst frame), fragments in the
  simulation's world against the view's (the hash and cost change). **One knob, two failures:** the threshold (low: a
  touch breaks it; high: unbreakable). Panel: _J_, dissipated energy, verdict, simulated pieces, view fragments, hash,
  worst frame time.
- **Traps:** the velocity before the step (the step already slowed it); only the first contact step; the seed from the
  world's stream in a fixed order; fragments decide nothing; bodies added at the step's end in a fixed order (2.11).
- **Exercises:** (1) A side hit at half the threshold. (2) Fragments that grow with the impulse (still a function of
  the event). (3) Pieces that break again: how many levels are worth it.
- **Our angle:** Manifold breaks from velocities before and after (not contact events, outside the state), with 2–6
  pieces (one per 20 cm of the longest side), fragments in a presentation physics, and a broken lamp that stays,
  dark.
- **From the archive (3-02):** kept: two physics worlds, the seed in the event, few pieces, the Sutilezas and
  exercises. Changes: the criterion derived from 4.3. New: the structure graph, piece inertia, the pool measured.
- **Sources:** G2 §14.5.3.5; MF §17.2.2; GPP ch. 19 ([Object Pool](https://gameprogrammingpatterns.com/object-pool.html)).
- **Open:** the curriculum's "Antes" (6.5, 4.11) misses 4.3 and 4.14.

### 6.12 La interfaz: del mundo a la pantalla (C)

- **Question:** ¿Cómo se marca en la pantalla algo que está en el mundo, aunque esté fuera de vista?
- **Before:** 6.4, 1.10 (the projection as a division by _w_), 1.3 (`toScreen`), 3.9 (rays).
- **Leads:** G2 §12.8; GPP ch. 4; decision 0019. **Also:** RTR 4.7.
- **Approach:** the hook: a marker on the exit, made with 1.3's `toScreen`, mirrors when the exit is behind and
  vanishes when it is off to the side. The ladder: clip space and _w_ → behind the camera → clamped to the edge with an
  arrow → dimmed when occluded → the HUD reads the world every frame, notices arrive as events with keys and numbers
  (0019), said in the player's language.
- **The mathematics:** (1) Clip = **P V** _P_; NDC = clip/_w_; pixels _x_ = (_x_n + 1)_W_/2, _y_ = (1 − _y_n)_H_/2.
  (2) _w_ ≤ 0 is behind: dividing flips the point; use the direction (_a_x_x_v, _a_y_y_v) instead. (3) Edge clamp
  _s_ = min(_m_/|_x_|, _m_/|_y_|) with margin _m_: a ray from the centre against a rectangle (3.9's slabs in 2D). (4)
  The arrow's angle by atan2. (5) Occlusion by a ray from the camera. Worked example: 1600 × 900, 60° vertical:
  _P_view = (2, 1, −5) gives NDC (0,390; 0,346), pixels (1111,8; 294,1); _P_view = (2, 1, 5), behind, gives the
  direction (1,949; 1,732), clamped at _m_ = 0,9 to (0,900; 0,800), pixels (1520; 90).
- **The live figure:** the player's view and a god's view with targets. Toggles: naive (divide even behind), edge clamp,
  margin, occlusion dimming, language es/en, subtitles. Panel: _P_view, _w_, NDC, pixels, on screen, arrow angle,
  occluded.
- **Traps:** _w_ near 0 (test _w_ ≤ ε); DOM overlays cost layout (write only on change); pasted sentence fragments do not
  translate (whole sentences; `Intl.PluralRules`, `Intl.NumberFormat`); a missing key is invisible until tested; UI is
  view.
- **Exercises:** (1) The pixels of a given point. (2) Four arrows instead of eight. (3) A missing key's fallback.
- **Our angle:** decision 0019: the world says keys and numbers, the page says words, in the page's language; the
  console stays in English. Manifold's `hud.ts`, `notices.ts`, `subtitles.ts`.
- **From the archive (3-08):** kept: keys and word tables, plurals and numbers, the HUD read each frame, notices as
  events, the subtitle arrow's derivation and its exercise, settings by source ("Más a fondo"). Changes: the main path
  becomes world to screen with off-screen markers. New: behind-camera handling, the edge clamp, occlusion.
- **Sources:** G2 §12.8; GPP ch. 4; decision 0019; RTR 4.7.
- **Open:** the curriculum's "Antes" misses 3.9.

### 6.13 Guardar como datos (C)

- **Question:** ¿Qué hay que guardar para seguir una partida otro día?
- **Before:** 6.1, 6.3, 2.14, 2.10.
- **Leads:** **G2** §17.4.5, §17.5; GPP ch. 18; Rapier's serialization; decision 0020.
- **Approach:** the hook: a snapshot saved, the engine updated, the save no longer loads. G2: save only what differs
  from the level data; checkpoints make saves tiny; references are ids. GPP: "unsaved changes" is a dirty flag, cleaned
  at checkpoints. The archive's thesis stays: a save is the player's progress, with its own version.
- **The mathematics:** (1) Save _S_: world → progress; load _L_: progress → world (rebuild, apply as a world change).
  *S*∘*L* is the identity on progresses, so *L*∘*S* is idempotent: (*L*∘*S*)² = *L*∘*S*. (2) Migrations
  _m_k: _v_k → _v_k+1; any old save reaches the current version by composition (induction); _n_ − 1 functions, each
  written once, against direct functions rewritten at every release. (3) Sizes: progress against snapshot bytes.
- **The live figure:** the archived seeded board of gems with its JSON panel: save, load, the snapshot under another
  engine version, a version 1 save. "Más a fondo": rewinding as a mechanic, a ring of 300 snapshots (5 s) and its
  memory. Panel: progress bytes, snapshot bytes, versions migrated, hash of _L_(_S_(_w_)) equal to that of
  _L_(_S_(_L_(_S_(_w_)))).
- **Traps:** progress names places, not entity numbers; a seed is worth the code that uses it; a save is untrusted
  input, checked before touching the world; random streams and watchers' state belong in it if they matter;
  `localStorage` may throw.
- **Exercises:** (1) A version 3 that keeps the heading, with its migration. (2) A save from the future (refused). (3)
  Keep it in the browser.
- **Our angle:** decision 0020: an envelope, never a snapshot, loading as a recipe in history, replays and the network.
  Rewinding is not networking (decision 0016).
- **From the archive (3-04):** kept almost whole: photo against progress, rebuild and apply, chained migrations, the
  Sutilezas, the memento box, the exercises. Changes: framed by G2's "only what differs" and checkpoints. New: the
  idempotence check, the dirty flag, the rewind ring.
- **Sources:** G2 §17.4.5, §17.5; GPP ch. 18; decision 0020;
  [MDN, Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).
- **Open:** none.

### 6.14 Un calabozo con una semilla (C)

- **Question:** ¿Cómo se inventa un nivel distinto para cada semilla, que siempre se pueda jugar?
- **Before:** 6.3, 3.17 (the maze as a spanning tree), 2.10, 6.4 (rooms and portals).
- **Leads:** **MA** §8.4; Shaker et al.; Nystrom, _Rooms and Mazes_; Kazemi. **Also:** G2 §16.1.2–3 (chunks and their
  topologies); L2 §9.7 (a generator can emit zones and portals); E §7.1.3; Buck.
- **Approach:** the archive's generator (rooms by rejection, a corridor to the previous room, a flood fill that does
  not trust the procedure), raised by MA: rooms joined by a minimum spanning tree over candidate links plus a few loops,
  zones and portals emitted for 7.10, a key placed before its locked door. The generator writes a level text: one path
  for every level.
- **The mathematics:** (1) Rejection: _E_ = 1/_p_ from _E_ = _p_ + (1 − _p_)(1 + _E_). (2) Prim's tree is minimal by
  the cut property; ties by index make it deterministic. (3) Connectivity by induction, checked by a flood fill in
  linear time. (4) Solvable iff the key lies in the start's component of the graph without the locked door. (5)
  Integers only: state/2³² is exact, ⌊_u n_⌋ an exact integer. Worked example: _p_ = ¼ gives 4 tries; the panel's
  tries per room for seed 7.
- **The live figure:** the archived animation (tries green or red), Prim's tree growing over the room centres, a loops
  slider, the key and door with a solvability check, a "generator v2" toggle, seed and hash. Panel: rooms placed of
  requested, tries, connected, solvable, hash.
- **Traps:** a cap on tries can place fewer rooms; the order of the random calls is part of the generator; a seed under
  another generator is another dungeon (saves break); commit the hashes of some seeds as a regression test.
- **Exercises:** (1) Lower the cap and predict. (2) Skip a corridor and find a disconnected seed. (3) Choose a colour
  without shifting the dungeon (a stream of its own).
- **Our angle:** Manifold's adventure: `dungeon(seed, depth)` writes a level text with a map, `textHash` (FNV-1a), a
  test walks 180 dungeons; decision 0017: a few rooms, not endless content.
- **From the archive (3-10):** kept: the generator, rejection and its expectation, corridors, the induction proof, the
  flood fill, the own stream, the v2 trap, the exercises. Changes: MA's tree and loops. New: zones and portals
  emitted, lock and key, the cut property.
- **Sources:** MA §8.4; [Shaker et al.](https://www.pcgbook.com/);
  [Nystrom, Rooms and Mazes](https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/);
  [Kazemi](https://tinysubversions.com/spelunkyGen/).
- **Open:** recompute every number for the tutorial's generator (the archive's were for its own).

### 6.15 Un nivel que se prueba solo (C) ◇

- **Question:** ¿Cómo se sabe, sin jugarlo, que un nivel sigue andando?
- **Before:** 6.14, 2.14, 2.15, 6.3.
- **Leads:** E §2.7.1 (a regression suite of recorded runs); G §8.5.2.4 (record and playback).
- **Approach:** the determinism thread paid back as tests. The archive's recipe with `wait` and `assert`, exact
  because the simulation is deterministic, plus a level's recorded solution (2.15's record) replayed in Node; a suite
  of levels × solutions on every change; the first divergent step when one fails.
- **The mathematics:** (1) Why an exact assert passes: the same inputs give the same bits, and a float printed with the
  shortest round-trip digits reads back identical. (2) Exact against tolerant: `~` within 0,01 or 1% of the larger. (3)
  The first divergent step: compare per-step hashes; with snapshots, bisect in O(log _n_) re-simulations.
- **The live figure:** the archived tilted board and its recipe; server delay and "wait from entry"; a "change the
  engine" toggle (friction 0,5 → 0,6): the exact assert fails, the tolerant one passes, the solution wins or not, and
  the first divergent step is shown. Panel: asserts passed, steps to the goal, first divergent step.
- **Traps:** a `wait` counts from when the change entered; what a line adds exists from the next step; seams between
  boxes make ghost collisions (merge, 6.3); an exact assert is fragile on purpose.
- **Exercises:** (1) Another track with a tolerant assert. (2) An assert on the ball's hop. (3) A compound collider
  with `FIX_INTERNAL_EDGES`.
- **Our angle:** Manifold's tests are recipes (each Dojo room with an `assert` is played headless), deliberately not a
  language; `wait` counts from entry, capped at 300 steps.
- **From the archive (3-09):** kept: the recipe interpreter, `wait` and `assert`, exactness, wait from entry, ghost
  collisions, the exercises. Changes: the map block moves to 6.3. New: recorded solutions as tests, the divergent-step
  search.
- **Sources:** E §2.7.1; G §8.5.2.4; decision 0010.
- **Open:** fold target: the last section of 6.14, or 6.16's testing step.

### 6.16 El juego: la sala de sigilo (P)

- **Question:** ¿Cómo se cruza una sala vigilada sin que te vean?
- **Before:** 6.7, 6.8, 6.10, 6.12, 6.13, and 6.11, 6.15.
- **Leads:** G2 §17.10 (the game's flow as a machine of tasks). **Also:** Leonard; MA §6.1.3 (shadow points as hiding
  spots).
- **Approach:** the rules first (the part sheet's design), then five playable diffs: watchers; lamps that break;
  the door with its mechanisms; markers and words; checkpoints with saves. Last, the recorded solution as a test.
- **The mathematics:** a detection counter _c_: +1 per step seen, −1 every two steps unseen, the alarm at _c_ = 45
  (0,75 s), all integers; a noise heard if its distance is within its radius (a straight line); hiding spots are the
  grid cells of low _V_ (MA's shadow points), drawn in a debug view.
- **The project:** `light.ts`: `illuminance`, `lightAt`, `visibility`. `watchers.ts`: `Watcher` (the turret's yaw and
  pitch), `sees`, the counter, the turn toward a noise. `breakables.ts` and `view/debris.ts`. `ui/markers.ts`
  (`toScreen`, `edgeMarker`), `ui/words.ts` (`say`), `ui/hud.ts`. `save.ts`: `saveProgress`, `readSave`,
  `MIGRATIONS`, saving at checkpoints. `checks.ts`: `wait`, `assert`, `play solution`. `game.ts`: tasks (crate on the
  plate, the lever, the exit) and the alarm's return to a checkpoint. The format gains `lamp`, `watcher`, `breakable`,
  `checkpoint`. Console: `show.vision`, `show.light`, `show.noise`, `watcher.alarm 45`, `god`, `save`, `load`. Recipe:
  `level.load sala; play solution; assert game.won = 1`, and `hash` equals the stored one.
- **Traps:** watchers read the world's light, never the drawn one; the counter is hashed state; the step's phase order
  (part sheet) decides when a broken lamp darkens (the next light phase); a straight-line hearing that passes walls is
  kept, and said.
- **Exercises:** (1) A watcher that sweeps like a lighthouse. (2) A thrown can as a decoy noise. (3) Show the hiding
  spots and check the solution uses them.
- **Our angle:** "the turret of part 1 is a watcher in part 6"; Manifold's `watch` and `keep` rooms join light, signals
  and breaking; the adventure saves this way.
- **From the archive:** none directly; it assembles the archived stage's ideas.
- **Sources:** G2 §17.10; [Leonard](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-).
- **Open:** six modules arrive at once; keep the five diffs small, or let the markers or saving enter earlier (6.10).

## Problems found in the curriculum (part 6)

1. **The map block** (old 3-09, placed in 6.15) is needed by 6.14's generator, which writes level text: it moves to 6.3.
2. **6.7's zones** are called sensors; 4.11 taught Rapier's sensors, but 6.4's zones (center inside, the world's own
   test, no one-step lag) are the right ones, as Manifold found.
3. **6.8's falloff** should be three.js's own window from the start, or 8.7 ("6.8's meter and the drawn light agree")
   must change a taught function, against 0021's stable names.
4. **Where the simulation's noise radius is taught** is not stated: the sheets put it in 6.10 (project) and show the
   straight-line flaw in 6.9's figure and in 6.16.
5. **"Antes" gaps:** 6.11 misses 4.3 and 4.14; 6.12 misses 3.9.
6. **6.16 integrates six concept lessons' code at once** (light, watchers, breaking, markers and words, saving,
   checks): a large diff for one project lesson. The sheet orders it in five diffs; the author may prefer to move the
   markers or saving into an earlier project lesson.
7. **Manifold facts to check** before writing "En Manifold": resource handling (6.2) and positional panning (6.9).
