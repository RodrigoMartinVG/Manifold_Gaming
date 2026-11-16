# Parte 5. Un personaje: the lesson sheets

Sheets for the sixteen lessons of part 5 of [the curriculum](../tutorial-curriculum.md), under
[decision 0021](../decisions/0021-a-new-tutorial.md). Book abbreviations as in the curriculum's §2. "From the archive"
says what a lesson keeps, changes and adds from the archived tutorial (`site/src/content/docs/tutorial/etapa-*`,
examples in `site/src/lessons/stage-*`). Lesson text never names an engine stage (0021): Manifold's measured findings
are cited as findings, with a decision number when there is one.

## The part sheet

**At the end the reader can** drive a character that is not a body: a kinematic capsule that moves and slides by
shape casts, with a jump designed from its height and time, modes that never contradict each other, a follow camera
smooth at any frame rate that never enters a wall, abilities given as data, platforms that carry it exactly, paths
walked at constant speed, bodies joined by joints, and a skinned glTF model whose clips and feet follow what the
simulation did. The reader knows where the line runs: the character's state is hashed simulation; its camera,
animation and feet are view.

**The closing game, _plataformas contra el reloj_.** One level of moving things: two ferries (triangle waves), a
carousel, two rail platforms on Catmull–Rom curves at constant speed, a swinging platform (a pendulum joint) and a
hinged bridge. Two pickups grant capabilities as data (double jump, dash); each opens a shortcut whose gap was sized
with 5.3's reach. Checkpoints are sphere tests (3.8; 6.4 replaces them by zones). Falling returns to the last
checkpoint and costs 2 s. Win: touch the goal. Time is a whole count of steps shown in seconds; par times give medals
(data); the best time and its ghost (2.15) are kept; restart is one key. Optional hazard: 4.14's cannon lobs balls
across one section (a hit costs 2 s). It exercises every lesson of the part.

**How the code grows** (stable names in bold):

- **5.2** `character/`: **`Character`** (container: position, velocity, heading, grounded, ground normal),
  **`stepCharacter`**; `body.ts` (**`CharacterBody`**, **`moveAndSlide`**, over 4.11's Rapier boundary); `motor.ts`
  (**`moveToward`**, **`wantedVelocity`**); `intent.ts` (**`Intent`**, **`intentFromActions`**; the autopilot and the
  ghost emit `Intent`s too). `view/rig.ts` (**`CameraRig`**, view only).
- **5.6** `character/jump.ts` (**`jumpFor`**), `character/modes.ts` (**`Mode`**, **`nextMode`**), coyote and buffer
  counters; `view/camera.ts` (**`springStep`**, **`castBack`**); cheats `noclip`, `god`.
- **5.11** `curve.ts` (**`catmullRom`**, **`arcLengthTable`**, **`atDistance`**), `platforms.ts` (**`Platform`**,
  **`poseAt`**), `carry.ts` (**`carriedBy`**), joints through the boundary, `pickups.ts`; the character gains
  **`can`** and **`airJumps`**; the step gains its phases (platforms, physics, characters, attached things).
- **5.15** `view/model.ts` (**`loadCharacterModel`**), `view/locomotion.ts` (**`directionWeights`**,
  **`advancePhase`**), `view/actions.ts` (**`ActionMachine`**), `view/feet.ts` (**`twoBoneIK`**, **`placeFeet`**).
- **5.16** `game.ts` grows the race's phases; `checkpoints.ts`; the best time and its ghost.

**Lab-kit pieces:** a swept capsule with time of impact and contact normal; a plane with its normal; frames (axes;
**T**, **B**, **N**); a two-viewport figure (god's view and player's view); time controls with single step; curves with
draggable points and tangent handles; plots of position, velocity and acceleration against time; a timeline strip with
clips as boxes; a triangle widget with barycentric weights; joints drawn as axes with a weight strip; a heat map over
two parameters; the perturbations "15 fps", "frame spike of 250 ms" and "_h_ = 1/30"; seed box and hash readout.

## The lessons

### 5.1 Un personaje no es un cuerpo (C)

- **Question:** ¿Por qué un personaje no se simula como una caja?
- **Before:** 4.11 (body kinds, queries), 3.15 (swept tests), 3.14 (the ball pushed out and sliding), 1.5 (rejection).
- **Leads:** **G2** §14.5.3.6, §18.2.1; **Rapier's character controller**. **Also:** MF §3.2 (setting a velocity
  "abuses" Newton's law: the hook); E §4.5, §5.5.7 (a capsule is a swept sphere: its cast is a segment against the
  world grown by _r_); MA §3.1.1 (kinematic against dynamic, as vocabulary); Catlike Coding; Fauerby.
- **Approach:** G2's list is the argument: stop on a coin, climb a curb, stand on a 30° ramp, never tip, slide along a
  wall. The hook: 4.11's world with a dynamic capsule driven by forces; it tips, slides down the ramp, takes a second
  to stop. Then the kinematic capsule: the program says where it wants to go, the world says how far it can. MA's
  "characters as points" is rejected as a model (no shape). "Se reduce a…" a segment against a grown world (3.11).
- **The mathematics:** (1) Why forces fail (4.1–4.7): stopping 70 kg from 4,5 m/s in 0,1 s takes 3150 N, applied at
  the feet it tips the body (**r** × **F**); on a slope it slides when tan θ > μ. (2) Collide-and-slide: cast **d**,
  get _t_ and **n̂**, advance _t_|**d**| − ε, slide the rest: **r**′ = **r** − (**r**·**n̂**)**n̂** ("el mismo
  movimiento"; 3.14's slide; a contact with _e_ = 0, 4.3); at most _k_ times. (3) Two walls with normals at angle φ:
  alternating rejections shrink by |cos φ| and chatter in an acute corner; the exact move is the projection onto the
  crease **n̂**₁ × **n̂**₂ (1.6); a third plane stops. (4) Walkable if **n̂**·**up** ≥ cos θ_max. (5) Step-up (lift,
  cast forward, cast down) and snap (cast down). Worked numbers: _r_ = 0,3 m, height 1,6 m, ε = 0,02 m, 0,075 m per
  step; θ_max = 45° (0,7071): a 30° ramp gives 0,8660, a 50° one 0,6428; a 0,30 m curb climbs with a 0,35 m step.
- **The live figure:** a test room (angled walls, a 60° corner, a curb, 30° and 50° ramps, a narrow gap). Toggle
  **dynamic body ↔ kinematic capsule**; checkboxes for slide, crease, step-up, snap, slope limit. **One knob, two
  failures:** the skin ε (0: stuck and jittering; 0,1 m: floating). Panel: grounded, ground angle, slide iterations,
  |moved|/|**d**|, drift standing on the ramp (kinematic 0), jitter in the corner (crease 0 mm). Perturbation: 15 fps.
- **Traps:** a box snags on step edges; the cast excludes the character's own collider; an uncapped slide loops in a
  crease; "up" is a vector, not +Y (§2: gravity is a field). Rigor: compare with cos θ_max computed once.
- **Exercises:** (1) Moved distance in one step at 45° into a wall at 4,5 m/s (0,053 m; hint: reject, then length).
  (2) Prove two alternating rejections shrink by cos² φ (hint: projecting onto a line multiplies by the cosine). (3)
  The highest curb climbed without step-up (about _r_(1 − cos θ_max); hint: where the rounded end meets the edge).
- **Our angle:** Manifold uses Rapier's controller only to not pass through things; how it moves is its own data, and
  its "up" is the opposite of gravity (a seed of 10.3). The figure's own slide is checked against Rapier's, E's
  brute-force-reference habit. Rapier's deterministic build, same construction order (4.11).
- **From the archive (1-02):** kept: the scene (steps, 18° ramp, wall), the list of behaviours, the "Más a fondo" on
  the shape cast (2 cm offset, 35 cm step, 30 cm snap). Changes: a concept lesson, the dynamic capsule as the naive
  toggle; coyote and buffer move to 5.3, acceleration to 5.2. New: the slide derived, the crease, the slope test.
- **Sources:** G2 §14.5.3.6; E §5.5.7; MF §3.2.
  [Rapier, character controller](https://rapier.rs/docs/user_guides/javascript/character_controller);
  [Catlike Coding, Surface Contact](https://catlikecoding.com/unity/tutorials/movement/surface-contact/);
  [Fauerby](https://www.peroxide.dk/papers/collision/collision.pdf).
- **Open:** verify Rapier's deterministic package has the controller with the same API; measure the corner jitter.

### 5.2 El personaje del proyecto (P)

- **Question:** ¿Cómo se arma un personaje con piezas que se suman?
- **Before:** 5.1, 2.7 (actions, commands with their step), 2.8 (the ball driven by actions), 2.15 (the ghost), 4.11.
- **Leads:** **GPP** ch. 14. **Also:** GPP ch. 14 § Design Decisions (shared state, references, messages); G
  §5.3.12.3 (camera-relative controls); decision 0004 (entity as id).
- **Approach:** GPP's staging. The ball's code grows a `Player` that reads keys, moves, casts, draws and follows; then
  the autopilot, the ghost and later the guard (7.7) must drive it. Cut along domains: a thin **`Character`** of
  shared state and parts: body, motor, intent source, camera rig. The intent source is the swap point. G2's object
  models wait for 6.1.
- **The mathematics:** (1) Camera-relative input: forward **f**(ψ) = (−sin ψ, 0, −cos ψ), right
  **r**(ψ) = (cos ψ, 0, −sin ψ), ψ the camera's heading about +Y (§2); the wanted velocity is _s_ times the normalized
  combination (2.8). (2) `moveToward`: **Δ** = **w** − **v**; if |**Δ**| ≤ _ah_, **v** = **w**; else
  **v** += **Δ**·_ah_/|**Δ**|. Against 2.3's exponential (never arrives, skates), it arrives in |**Δ**|/_a_. Numbers:
  _a_ = 50 m/s², 0,83 m/s per step, 0 → 4,5 m/s in 0,09 s, a 90° turn (|**Δ**| = 6,36) in 0,13 s; 14 m/s² in the air.
- **The project:** `character/character.ts`: `Character`, `createCharacter`, `stepCharacter(c, intent, h)` in a fixed
  order (intent, motor, gravity semi-implicit, `moveAndSlide`, read back). `character/body.ts`: `CharacterBody` wraps
  Rapier's controller (offset, autostep, snap, slope angles) behind `moveAndSlide(desired)` → movement, grounded,
  ground normal. `character/motor.ts`: `wantedVelocity`, `moveToward`. `character/intent.ts`: `Intent` (move, heading
  in whole degrees, jump edge, jump held), `intentFromActions` over `input.ts` (names unchanged). The autopilot (2.8)
  and the ghost (2.15) emit `Intent`s. `view/rig.ts`: a plain follow rig. Playable: the character walks the maze of
  3.17, climbs steps, slides, jumps. Console: `char.speed 6` (world), `inspect me`, `view.cam` (view). Recipe:
  `seed 7; restart; step 600; hash` twice gives one value; `view.cam top` before it does not change it.
- **Traps:** the camera's heading enters the world only in the command, rounded to whole degrees, and the motor uses
  `trig.ts`'s `sinCosDegrees` (2.9's rule). Shared state makes the parts' order matter (2.11). Manifold's input
  headings run clockwise from −Z; ours follow §2 (ψ_M = −ψ).
- **Exercises:** (1) Swap the intent source for the ghost and race it. (2) Make an invisible prop by removing a part,
  not by writing a class (GPP's zone). (3) Time a reversal at _a_ = 50 (0,18 s).
- **Our angle:** "a mind drives the same actions" (2.7) becomes code: 7.7's guard plugs in where the keyboard did.
  Manifold's character is a component of an entity (0004), with the same 50 and 14 m/s².
- **From the archive (1-02):** kept: the kinematic capsule, Rapier's controller parameters, the "acelerar hacia lo
  pedido" Más a fondo (now main path). Changes: parts in a container, not one script. New: Component, intent sources,
  camera-relative input as a quantized command.
- **Sources:** GPP ch. 14 ([online](https://gameprogrammingpatterns.com/component.html)); G §5.3.12.3; decision 0004.
- **Open:** align 4.11's boundary name, and keep `moveToward` distinct from 2.8's smoothing function.

### 5.3 Un salto que se siente bien (C) ◇

- **Question:** ¿Qué gravedad y qué impulso dan el salto de la altura y el largo que pide el nivel?
- **Before:** 5.1, 2.2 (semi-implicit Euler, its error), 2.4 (the fixed step).
- **Leads:** **Pittman**; **Thorson**. **Also:** MA §3.6 (a jump as a one-shot decision; the trajectory solve, for an
  exercise); L2's method (unknowns from conditions); G2's "doblar las reglas".
- **Approach:** L2's method as a model: the designer states the apex height _H_ and the time to it _t_h (or distance
  _x_h at speed _v_x), and the constants are solved for. The hook: real _g_ with the level's 2 m ledge is floaty, and
  tuning by hand moves height and time together. Then the game's twist: it runs in steps, so the conditions are solved
  again in steps, exactly. Rejected as main path: MA's solve (an AI's question).
- **The mathematics:** (1) _y_ = _v_₀_t_ − ½_gt_², _y_′(_t_h) = 0, _y_(_t_h) = *H*: *g* = 2_H_/_t_h²,
  _v_₀ = 2_H_/_t_h. (2) In steps (velocity first): _y_n = _nhv_₀ − _gh_²_n_(_n_ + 1)/2; with the continuous constants
  the apex is _H_ − _v_₀_h_/2 (2.2's first order). (3) Exact in steps: _v_N = 0 and _y_N = *H* give
  *g* = 2_H_/(_h_²_N_(_N_ − 1)), _v_₀ = 2_H_/(_h_(_N_ − 1)); the apex is held at steps _N_ − 1 and _N_. (4) A stronger
  falling gravity; a released button switches to _g_c with _H_min = _v_₀²/(2_g_c). (5) Coyote and buffer counted in
  steps. Worked example: _H_ = 2 m, _N_ = 24 (0,4 s): continuous 25 m/s² and 10 m/s, apex 1,9167 m; exact
  26,0870 m/s² and 10,4348 m/s, apex 2,0000 m.
- **The live figure:** side view of ledges; sliders _H_, _t_h, fall multiplier, cut height; the parabola under the
  steps' dots. Toggle **continuous ↔ step constants**; perturbation _h_ = 1/30 (the error doubles). Coyote and buffer
  sliders with "press _k_ steps late". **One knob, two failures:** the coyote window (0: jumps eaten; 20: jumping from
  mid-air). Panel: _g_, _v_₀, apex (2,0000 within 1e-9, at steps 23 and 24), range, apex error.
- **Traps:** limits after the sum (a terminal speed clamped after gravity); a jump is an edge, never "held"; coyote
  must not refill mid-jump. "Doblar las reglas": two gravities and a lighter apex are not physics, and that is fine.
- **Exercises:** (1) The flat gap cleared at 6 m/s with _g_f = 2_g_ (hint: count steps up and down). (2) A double jump
  at the apex (2_H_ exactly). (3) MA's _t_ = 2_v_y/_g_ against the dots (one step off on the descent: why?).
- **Our angle:** the exact-in-steps form is ours and makes the console's apex equal the designer's number; only
  - − × ÷, so it is hashable. Manifold counts coyote and buffer as 6 steps each.
- **From the archive (1-02):** kept: coyote and buffer "contados en pasos", the exercise "¿hasta dónde sube?".
  Changes: a derivation from conditions instead of parameters. New: the discrete solution, falling gravity, variable
  height.
- **Sources:** [Pittman, GDC 2016](https://www.gdcvault.com/play/1023559/Math-for-Game-Programmers-Building);
  [Thorson](https://maddymakesgames.com/articles/celeste_and_forgiveness/); MA §3.6.
- **Open:** fold target: the first section of 5.6, with the figure.

### 5.4 Modos de moverse (C)

- **Question:** ¿Cómo se ordena lo que el personaje puede hacer en cada momento?
- **Before:** 5.2, 2.12 (entry and exit actions, conditions), 1.17 (phases as an enum and a switch).
- **Leads:** **GPP** ch. 7. **Also:** G §9.5.8–9.5.9 (context-sensitive controls, disabling inputs with fail-safes);
  G2 §13.10 (the action state machine, for 5.13).
- **Approach:** GPP's ladder in "spot the bug" steps on our character: jump (air jumps), crouch (standing pose
  mid-jump), glide (gliding while climbing), each fixed by a flag until flags break; then the diagram, enum and switch,
  state objects with their data, entry and exit, concurrent machines (moving × holding, for 4.13's grab), hierarchical
  ("on the ground"). Pushdown waits for 7.8. Context-sensitive input (G): `jump` jumps, glides or wall-jumps by mode.
- **The mathematics:** a machine (_S_, Σ, δ, _s_₀), δ made total by self-loops. _k_ flags give 2^_k_ combinations,
  few valid (4 flags: 16, 4 valid). Concurrent: _n_ × _m_ states merged against _n_ + _m_ in two machines (the product
  _S_₁ × _S_₂). Hierarchical: one transition on a superstate replaces one per substate. A priority list (δ ignores _s_)
  can never get stuck but cannot say "only from walk". Worked example: walk, air, glide, climb × empty, carrying: 8
  states against 4 + 2.
- **The live figure:** two panels driven by the same keys: the flag version with impossible combinations lit red and
  buttons that replay each bug; the diagram with the current state and its transitions. A "carry" toggle shows 8
  boxes against 4 + 2. The archived tower and wind box stay (wind is a contribution after the mode). Panel: mode,
  invalid combinations (flags > 0, machine 0), transitions fired, fall speed and "limit reached".
- **Traps:** one state's data on the character; changing state inside a handler (return the next state); two machines
  consuming one input. Determinism: a state is plain data (enum plus fields); state objects, if any, are stateless
  flyweights. Limits after the sum: gliding, max(−1,5; −1,5) − 0,163 = −1,663 against max(−1,663; −1,5) = −1,5.
- **Exercises:** (1) 4 modes × 3 held items, merged and concurrent (12 against 7). (2) Add `swim` (one entry, one rule;
  where in the priority?). (3) What an "on ground" superstate removes (three jump transitions become one).
- **Our angle:** "Dónde Manifold eligió otra cosa": modes as rows of a table and one decision from scratch each step,
  "already climbing" its only memory; numbers in the world (hashed, replayed); contributions outside the modes let
  moving platforms arrive without touching a mode.
- **From the archive (2-02):** kept: the four modes, the tower and wind, contributions and "limits after the sum", the
  swim exercise. Changes: GPP's ladder as the main path, Manifold's decision as the alternative. New: concurrent and
  hierarchical machines with their counting, context-sensitive input.
- **Sources:** GPP ch. 7 ([online](https://gameprogrammingpatterns.com/state.html)); G §9.5.8–9.5.9; G2 §13.10.
- **Open:** 5.6 uses a machine with transitions; say so in Manifold's comparison.

### 5.5 La cámara que sigue, también contra las paredes (C)

- **Question:** ¿Cómo sigue la cámara sin marear, y sin meterse en las paredes?
- **Before:** 4.2 (springs, Euler's stability), 3.15 (the swept sphere), 1.16 (look-at), 2.3 (exact smoothing), 2.5
  (the free camera on the real clock).
- **Leads:** **G2** §14.5.3.7, §18.2.2; **MF** §6.3.2. **Also:** Holden (exact damped springs); Haigh-Hutchinson;
  Nesky; L2 Eq. 6.6, Ex. 6.5 (the near rectangle); RTR 19.3; G Fig. 8.4 (cameras after physics).
- **Approach:** two problems. Following: glued to the back, every turn spins the world; a leash keeps distance and
  height and the turn emerges (a toy dragged on a string); chase returns behind. Smoothing runs on the real clock at
  any frame rate: the critically damped spring solved exactly, the second-order 2.3. Walls: G2's rule, zoom in rather
  than swing (a swing breaks camera-relative controls). Rejected: parenting the camera; per-frame lerp.
- **The mathematics:** (1) Leash: **c** ← **h** + _L_ normalize(**c** − **h**); signed angle
  atan2(**up**·(**a** × **b**), **a**·**b**). (2) Spring _ẍ_ = −ω²_e_ − 2ω_ẋ_, _e_ = _x_ − _x_\*: by the double root
  of λ² + 2ωλ + ω², _e_(_t_) = (_e_₀ + (*v_₀ + ω_e_₀)*t*)e^(−ω_t*). Explicit Euler has the double eigenvalue 1 − ωΔ_t_
  and explodes past ωΔ_t_ = 2 (4.2's bound; 2.3's _h_ > 2τ one order up); the exact step never does; it is _C_¹ where
  2.3's relaxation kinks. (3) Walls: a sphere cast from the head to the wanted place, "se reduce a" a ray against
  walls grown by the radius; the radius covers the near rectangle's corner *n*√(1 + (_s_² + 1)/_g_²). (4) In at once,
  out slowly: cut ← max(takes, cut·e^(−3Δ_t_)). Worked numbers: _n_ = 0,05 m, 60°, 16:9: corner 0,077 m. Tunnel:
  wanted 5,5 m back and 2,2 m up (5,92 m), ceiling 3 m, head 1,4 m, sphere 0,25 m: impact 3,63 m, cut 2,29 m.
- **The live figure:** god's view and player's view; rig rigid, leash, chase; smoothing per-frame lerp, Euler spring,
  exact spring; screen 10–144 fps; perturbation "frame spike of 250 ms"; walls: sweep, ease out, "the leash learns the
  wall" (the bug). **One knob, two failures:** ω (low: the character leaves the frame; high: step jitter shows, and
  Euler explodes after the spike). Panel: leash, cut, closest to a wall (≥ 25 cm), frames with a wall between (0),
  fastest out (< 15 m/s), overshoot (0), time to 1% (6,64/ω s).
- **Traps:** follow the drawn pose, not the simulated one; the cast starts at the head and excludes characters and
  dynamic bodies; keep wanted and shown apart; the camera is view, so `Math.exp` is allowed; a vertical dead zone
  keeps jumps from bouncing the view.
- **Exercises:** (1) Chase's half-life at strength 4 (0,17 s). (2) The ω at which Euler explodes at 30 fps (60 rad/s).
  (3) Drop the character's exclusion and predict the cut (all of it).
- **Our angle:** Manifold's camera lives in the presentation (follow, chase, aim, free), with a 25 cm sweep, 35 cm
  closest, and `pulled`/`unpull` so no leash or wheel learns a wall (a bug found by continuous integration). It asks
  the world, not Rapier, so a sweep will cross a glued seam in one place (10.7).
- **From the archive (1-03, 3-07):** kept: rigid, leash, chase with the minimap, the 10 fps per-frame trap, the signed
  angle; the tunnel corridor, its numbers, two places and its toggles. Changes: one lesson; the first-order factor
  becomes the exact critically damped spring. New: the spring and its stability bound, the near-rectangle radius, G2's
  design rules.
- **Sources:** G2 §14.5.3.7, §18.2.2; MF §6.3.2; L2 Ex. 6.5.
  [Holden, Spring-It-On](https://theorangeduck.com/page/spring-roll-call);
  [Nesky](https://www.youtube.com/watch?v=C7307qRmlMI);
  [Catlike Coding, Orbit Camera](https://catlikecoding.com/unity/tutorials/movement/orbit-camera/).
- **Open:** whether the spring also smooths the yaw (an angle needs 1.13's wrap).

### 5.6 El personaje salta, y la cámara lo sigue (P)

- **Question:** ¿Cómo se juntan en el proyecto el salto, los modos y la cámara?
- **Before:** 5.3, 5.4, 5.5, 5.2.
- **Leads:** none; it assembles. **Also:** G §10.6 (cheats); G Fig. 8.4 (camera after interpolation).
- **Approach:** three diffs, each playable: the jump (the level's 2 m ledges become exactly reachable), the modes (the
  air-jump and glide bugs cannot happen), the camera (3.17's corridors no longer hide the character). Cheats arrive
  with the character (thread 6.3).
- **The mathematics:** recalled in a line each (5.3's exact constants, the counters, the exact spring, the cast). New:
  the frame's order, drawn: steps, interpolation (2.4), then the camera reads the interpolated pose and casts, then
  the drawing.
- **The project:** `character/jump.ts`: `jumpFor(height, stepsToApex)`, `fallGravity`, `cutGravity`.
  `character/modes.ts`: `Mode`, `nextMode(c, sensed)` with transitions and entry actions (entering `air` from `walk`
  starts coyote). `Character` gains `mode`, `coyoteSteps`, `bufferSteps` (integers, hashed). `view/camera.ts`:
  `springStep(x, v, target, ω, dt)`, `castBack(head, wanted, radius)`, wanted and shown apart. Cheats `noclip` and
  `god` are world changes, recorded. Console: `char.jump.height 2.5` (world), `view.cam chase`, `show.cam`. Recipe:
  `restart; act jump; step 24; inspect me` gives 2.0000 m above the ground and vertical speed 0.0000 (the apex is held at steps 23 and 24), the same with
  `view.timescale 0.25`.
- **Traps:** the jump edge is read per step (2.7's `pressed`), not per frame; entry actions must not fire twice in one
  step; reset the camera's spring on restart and teleport.
- **Exercises:** (1) A wall jump in `climb` (an entry action; out of the wall at 4 m/s). (2) Find the smallest fair
  coyote window for the level's edge (design; Manifold uses 6). (3) Show `show.cam` never changes the hash.
- **Our angle:** the recipe pins the designer's apex in the console, a measured check that 5.3 is what the game does.
- **From the archive:** none directly (its pieces are reused in 5.3–5.5).
- **Sources:** G §10.5–10.6; those of 5.3–5.5.
- **Open:** the console verb that injects an action (`act jump`) must match 2.6/2.7's sheets.

### 5.7 Capacidades como datos (C)

- **Question:** ¿Cómo se le da al personaje un doble salto sin reescribirlo?
- **Before:** 5.4, 5.3 (reach), 2.14 (what a replay keeps).
- **Leads:** **GPP** ch. 13, ch. 12, ch. 11 (as the warning); **G2** §17.3.3 (type schemas with defaults).
- **Approach:** GPP's middle road: data selects among coded behaviours, with parameters. Naive: a subclass per ability,
  then their combinations, then an object that cannot change class mid-jump. The ladder: booleans in `can` read in one
  place; a counter for air jumps; parameters per ability; a narrow toolbox (Subclass Sandbox: `impulse`, `setMode`,
  `spend`). Named and refused: a little language (Bytecode).
- **The mathematics:** (1) _k_ abilities: 2^_k_ combinations (3: 8; 5: 32), a class each, a value each here. (2) A
  schema is a function kind → defaults; an instance is a merge of partial functions (overrides win). (3) Reach sets
  _R_(_C_): a gate needs _c_ exactly when its target is outside _R_(_C_ ∖ {_c_}) and inside _R_(_C_). Numbers with
  5.3's exact jump (_H_ = 2 m): double jump 4 m; gliding at 4,5 m/s falling 1,5 m/s, 3 m per metre dropped; a dash at
  12 m/s for 0,2 s, 2,4 m.
- **The live figure:** the archived three stars (a 5 m tower, a 3,6 m ledge, an island across a gap) with the reach
  envelope of each of the 8 sets drawn; the same recorded inputs replayed with other `can`; toggles mid-run are world
  changes logged with their step. **One knob, two failures:** `airJumps` (0: the ledge is out of reach; 2: two stars
  stop asking for their ability). Panel: stars, air jumps left, reach (m), the hash after the demo.
- **Traps:** turning an ability off cancels nothing (the next decision stops choosing it); the counter refills on the
  ground and when climbing; 0 or `null` as "not overridden" (GPP's sample) makes a real 0 inexpressible; a sandbox
  base that grows to expose everything; a format that slowly becomes a language.
- **Exercises:** (1) A third jump: which stars stop asking, and how to fix the level (tower above 6 m, island lower).
  (2) Add `dash` (one boolean, one counter, one rule). (3) A movement schema with defaults and an instance overriding
  one value (test the absent case).
- **Our angle:** in Manifold `can` is three booleans in the world (hashed, snapshotted, `dojo.climb on` recorded at its
  step); the cost stated: a new ability is engine code. Decision 0004 is the reason.
- **From the archive (2-03):** kept: the three abilities and stars, the demo with identical inputs, `airJumps` and its
  rules, "una capacidad es estado", the dash exercise. Changes: Type Object and the sandbox as the ladder. New: schemas
  with defaults, reach sets, the warning against a language.
- **Sources:** GPP ch. 11–13 ([Type Object](https://gameprogrammingpatterns.com/type-object.html),
  [Subclass Sandbox](https://gameprogrammingpatterns.com/subclass-sandbox.html)); G2 §17.3.3.
- **Open:** none.

### 5.8 Marcos que se mueven: plataformas (C)

- **Question:** ¿Cómo lleva una plataforma al que está parado encima?
- **Before:** 5.2, 1.11 (change of frame), 1.15 (composing orientations), 2.11 (order within a step), 4.11.
- **Leads:** **L1** §2.1, §2.6; **G2** §13.11.1, §17.6.3. **Also:** MF §9.3.1 (**v** + **ω** × **r**); E §2.4.3;
  Catlike Coding _Moving the Ground_; GPP ch. 10.
- **Approach:** three questions: where the platform is at each step, how far it carries the rider, in what order
  things update. L1's frame algebra answers the second exactly, G2's buckets the third. Rejected: parenting the rider
  (inherited scale, no velocity when leaving, physics unaware).
- **The mathematics:** (1) Pose as a function of the step: a triangle wave, an angle ω_t_; never _x_ += _vh_ (drift,
  no rewind). (2) A point fixed in the platform's frame: _P_′ = **H**′**H**⁻¹_P_; with arm **r**, the displacement is
  **Δc** + (**R**(Δθ) − **I**)**r**; the tangent shortcut (**ω** × **r**)_h_ grows the radius by _r_(ω_h_)²/2 per
  step. (3) Heading carried by the same rotation, _q_′ = _rq_. (4) Leaving: inherit **v** + **ω** × **r**. (5)
  Order: platforms, riders, held things; a bucket is a depth in the dependency forest; the wrong order lags by **v**_h_.
  Numbers: carousel 40°/s, rider at 1,3 m: 0,907 m/s; tangent shortcut ≈ 4,8 cm of radius per turn, exact < 1 mm after
  two; ferry at 2 m/s: lag 3,3 cm.
- **The live figure:** the archived carousel and ferry plus G2's crate on the platform and lantern in hand. Toggles:
  carry, exact rotation ↔ tangent, fixed for the controller, order (creation ↔ buckets), inherit velocity. Panel:
  carried speed, turned (°), radius drift after two turns (mm), rider lag (cm), velocity kept in the air.
- **Traps:** Rapier's controller does not walk on a moving kinematic body (measured: jerky; zero on a still one), so
  the platform is fixed for the controller and the carry added after; a ray down misses the edge the capsule rests on
  (use a thinner capsule); sweep the carry, or a passing wall swallows the rider; the camera must not turn with a
  carousel.
- **Exercises:** (1) Carried speed at 1,9 m (1,33 m/s). (2) An elevator with the carry added to the wanted movement
  (the controller refuses the descent: why). (3) The closing level's dependency forest and buckets.
- **Our angle:** Manifold's findings (the controller on kinematic bodies, < 1 mm after two turns, the thinner capsule,
  the swept carry); no hierarchy, only the accumulated turn (`carriedTurn`), so any step can be recomputed for
  replays and the network.
- **From the archive (2-04):** kept: the ferry and carousel, pose as a function of the step, `carriedBy`, fixed for the
  controller, the kept velocity, the three Sutilezas and the elevator exercise. Changes: the carry derived as a change
  of frame with its drift. New: buckets and the one-step lag.
- **Sources:** L1 §2.1, §2.6; G2 §13.11.1, §17.6.3; MF §9.3.1.
  [Catlike Coding, Moving the Ground](https://catlikecoding.com/unity/tutorials/movement/moving-the-ground/).
- **Open:** none.

### 5.9 Curvas (C)

- **Question:** ¿Cómo se describe un camino suave que pasa por puntos dados?
- **Before:** 1.4 (linear combinations), 2.2 (velocity as a derivative), 1.15 (slerp).
- **Leads:** **RTR** 17.1. **Also:** Pomax; Holmér (continuity); MA §3.3.12 (the path parameter interface); G2
  §13.4.5, §13.6.2.2 (channel functions; ease curves and continuity as the language of pops).
- **Approach:** RTR's problem first: a platform must pass through given points in a given time. Lerp jerks at each
  corner; de Casteljau as repeated lerps (dragged), Bernstein as its expansion; Hermite with tangents; Catmull–Rom
  with tangents from neighbours; arc length so equal steps are equal distances. Rejected: Bernstein first.
- **The mathematics:** (1) Lerp's corner: the velocity jumps (not _C_¹). (2) de Casteljau: three lerps, two, one;
  expanded, Bernstein weights, non-negative and summing to 1: the convex hull property. (3) _C_¹ against _G_¹ at a
  joint. (4) Hermite from two points and tangents; Catmull–Rom tangents (_P_i+1 − _P_i−1)/2. (5) Arc length: a table
  of cumulative chords, inverted by binary search. (6) Smoothstep is Hermite with zero tangents. Worked example:
  _P_₀ = (0, 0), _P_₁ = (1, 2), _P_₂ = (3, 2), _P_₃ = (4, 0) at _t_ = ½: (0,5; 1), (2; 2), (3,5; 1); (1,25; 1,5),
  (2,75; 1,5); (2; 1,5).
- **The live figure:** draggable points and tangent handles; a _t_ slider showing every lerp; polyline, Bézier,
  Hermite, Catmull–Rom; speed and acceleration plotted along the path; a dot at constant _t_ beside one at constant
  arc length. **One knob, two failures:** the table's samples (4: speed ripple; 4096: build time and memory). Panel:
  _B_(_t_), speed max/min (constant arc length: within 0,5% with 64 samples), length.
- **Traps:** equal _t_ is not equal distance; chained slerps along a path have corners (squad, RTR 4.3.2, named); the
  table is built once, in a fixed order.
- **Exercises:** (1) The example at _t_ = ¼ both ways (weights 27/64, 27/64, 9/64, 1/64). (2) Prove Catmull–Rom passes
  through its points. (3) Samples needed for 1% speed error on the example (measure).
- **Our angle:** 5.11's rails move at constant speed through the table. The "Más a fondo" carries a frame along a
  curve (the design draft's early taste of strange worlds): Frenet fails at inflections; a rotation-minimizing frame
  projects the previous normal (one Gram–Schmidt step, 1.6), pointing to 10.5. Manifold todavía no lo tiene.
- **From the archive:** nothing; new.
- **Sources:** RTR 17.1; MA §3.3.12; G2 §13.6.2.2. [Pomax](https://pomax.github.io/bezierinfo/);
  [Holmér](https://www.youtube.com/watch?v=jvPPXbo87ds).
- **Open:** L2 §10.2.3's polyboard trail: an exercise here or in 8.16.

### 5.10 Articulaciones (C) ◇

- **Question:** ¿Cómo se unen dos cuerpos para que giren o se deslicen solo como se quiere?
- **Before:** 4.11, 4.4 (constraints as contacts always generated), 4.8–4.9 (rotation, impulses at a point), 4.2.
- **Leads:** **MF** §17.2.1; **G2** §14.4.8; Rapier's joints. **Also:** Catto (velocity constraints, Jacobians, soft
  constraints); MF §20.2 (degrees of freedom, reduced coordinates).
- **Approach:** MF's thread: a joint is 4.4's constraint again. Degrees of freedom as the counting language, Catto's
  velocity form as the precise statement, Rapier as the implementation (impulse joints, maximal coordinates, against
  multibody joints, reduced). The hook: the level needs a platform that swings when the character lands on it.
- **The mathematics:** (1) A free body has 6 degrees of freedom; fixed removes 6, revolute and prismatic 5, spherical 3. (2) Spherical: **C** = (**x**_A + **R**_A**r**_A) − (**x**_B + **R**_B**r**_B) = **0**; differentiated,
  **v**_A + **ω**_A × **r**_A − **v**_B − **ω**_B × **r**_B = **0**, rows of **J** with **Jv** = 0. (3) Drift and
  its feedback (4.12). (4) A motor is a spring and damper on the free coordinate (4.2). (5) Limits are one-sided like
  contacts. Worked example: a 2 m pendulum platform: 2π√(_L_/_g_) = 2,837 s; at 10°, × (1 + θ₀²/16) = 2,842 s.
- **The live figure:** a pendulum platform, a drawbridge with a motor, a slider with limits, a plank bridge. Toggle
  **impulse ↔ multibody** under a heavy load. **One knob, two failures:** solver iterations (2: the chain stretches; 32:
  the frame bar grows). Panel: measured period against 2π√(_L_/_g_), joint error (mm), solver time (ms).
- **Traps:** joints created in another order give other bits (4.11); an undamped motor rings; limits that let knees
  bend backwards; large mass ratios stretch a joint.
- **Exercises:** (1) Degrees of freedom of 5 planks hinged and pinned at both ends (set up the count). (2) The
  revolute joint's two extra rows. (3) A door motor that closes in 1 s without overshoot (_c_ = 2√(_kI_)).
- **Our angle:** MF says no general engine uses reduced coordinates; Rapier has both, and the figure measures them.
  Manifold todavía no lo tiene (its doors and lifts are kinematic, decision 0018); a ragdoll is 5.12's skeleton with
  these joints.
- **From the archive:** nothing; new.
- **Sources:** MF §17.2.1, §20.2; G2 §14.4.8; [Rapier's guide](https://rapier.rs/docs/) (joints);
  [Catto](https://box2d.org/publications/).
- **Open:** fold target: a section of 5.11.

### 5.11 Un nivel que se mueve (P)

- **Question:** ¿Cómo se arma un nivel de plataformas que se mueven, se balancean y dan poderes?
- **Before:** 5.7, 5.8, 5.9, 5.10, 5.6.
- **Leads:** none; it assembles. **Also:** G2 §17.6.3.1 (update phases).
- **Approach:** four playable diffs: ferry and carousel with the carry; rails at constant speed; a pendulum platform
  and a hinged bridge; pickups. Last, the step's order made explicit, and broken once on purpose to see the lag.
- **The mathematics:** recalled. New: a ping-pong rail runs a triangle wave in distance; an eased rail applies
  smoothstep to its phase.
- **The project:** `curve.ts`: `catmullRom`, `arcLengthTable(points, samples)`, `atDistance(table, s)`.
  `platforms.ts`: `Platform`, `poseAt(platform, step)`, kinds `ferry`, `carousel`, `rail`. `carry.ts`:
  `carriedBy(platform, point, step)`, the kept velocity. Joints through the boundary: `hinge`, `pendulum` (a dynamic
  platform; its velocity read back from Rapier for the carry). `pickups.ts`: a pickup is a world change granting
  `can.doubleJump` or `can.dash`; `Character` gains `can`, `airJumps`, `dashes`. The step's phases: platforms, physics,
  characters, attached things. The level is a TypeScript data module (text arrives in 6.3). Console: `show.paths`,
  `char.can.dash on`, `order.wrong on` (debug: riders first). Recipe: `restart; place me carousel; step 540; inspect me`
  gives turned 360° at radius 1.300 (1 mm); with `order.wrong on` the ferry's rider lags 3,3 cm.
- **Traps:** a dynamic platform's pose comes from Rapier after the step, a kinematic one's from `poseAt`; two
  characters taking a pickup in one step: the first in a fixed order wins; `place` is a cheat, recorded.
- **Exercises:** (1) An elevator (a ferry along _y_). (2) Ease a rail's ends and compare the rider's jerk. (3) Break the
  bridge above a joint impulse read from Rapier.
- **Our angle:** Manifold's level format writes `move 9 0 0 5` and `spin y 40`; here the reader sees the update-order
  lag and its fix in their own project.
- **From the archive:** 2-04's ferry and carousel and 2-03's stars are its starting code.
- **Sources:** G2 §17.6.3.1; those of 5.7–5.10.
- **Open:** whether 6.3's format expresses rails, joints and pickups (the level becomes text then, or stays code).

### 5.12 El esqueleto y la piel (C)

- **Question:** ¿Cómo mueve un esqueleto a la malla que lo cubre?
- **Before:** 1.11 (world = parent · local), 1.15, 1.9 (the inverse), 3.2 (normals).
- **Leads:** **G2** §13.1–13.3, §13.5. **Also:** RTR 4.4–4.5 (the rigid elbow, weights, candy wrapper, morph targets);
  GPP ch. 18 (Dirty Flag, where its conditions hold); glTF skins; three.js `SkinnedMesh`.
- **Approach:** G2's "animation as compression by constraints" names the kinds. The hook: the archived figure of boxes
  hung from bones overlaps at the elbow. G2's derivation over RTR's formula-first: a vertex keeps its coordinates in its
  joint's space, so skinning is a round trip. The dirty flag lives here: many locals change, few globals are read.
- **The mathematics:** (1) Joints in an array, parents first; locals **L**_j (SRT); **G**_j = **G**_p(j)**L**_j
  (column vectors: G2's row form transposed). (2) **K**_j = **C**_j**B**_j⁻¹: to joint space, move, back; a deformation
  in model space, **I** in the bind pose. (3) _v_′ = Σ _w_i**K**_i_v_, _w_i ≥ 0, Σ = 1: a convex combination. (4)
  Candy wrapper: ½(**I** + twist θ) scales the cross-section's area by cos²(θ/2) (0,5 at 90°, 0 at 180°); dual
  quaternions in a "Más a fondo". (5) Normals by the blend's inverse transpose (3.2). (6) Dirty flag: a chain of _k_
  joints all changed costs _k_(_k_ + 1)/2 products eagerly, _k_ lazily. Worked example (2D): joint bound at (2, 0),
  vertex (4, 1) is (2, 1) in joint space; the joint turns 90°: (1, 2); with weight ½ on the root: (2,5; 1,5).
- **The live figure:** (a) the one-joint round trip in three panels; (b) a two-bone arm with a weight gradient, bend
  and twist sliders, toggle **linear blend ↔ dual quaternions**; (c) a chain counting products, eager against lazy.
  Panel: **K**_j, the blend's determinant (cos²(θ/2) for the twist), products per frame.
- **Traps:** blending matrices or global poses; weights not summing to 1 (three.js fills with the rest pose);
  non-uniform joint scale; CPU picking does not see the skinned shape. A dirty flag pays only when changes outnumber
  reads.
- **Exercises:** (1) **K** for given **B**, **C** in 2D, applied. (2) Why the fourth weight is not stored. (3) Find
  `boneInverses` and `bindMatrix` in three.js and name them.
- **Our angle:** Manifold's mannequin has eleven bones with rigid pieces and no skin (a headless Blender script);
  skinning is ahead of the engine. A ragdoll is this skeleton with 5.10's joints.
- **From the archive (2-06):** kept: the box figure and `buildFigure` as the rigid starting point. Changes: 2-06
  splits into 5.12, 5.13 and 5.15. New: the skinning matrix, the candy wrapper's determinant, the dirty flag counted.
- **Sources:** G2 §13.1–13.5; RTR 4.4–4.5; GPP ch. 18 ([online](https://gameprogrammingpatterns.com/dirty-flag.html));
  [skinning.org](https://skinning.org/);
  [glTF skins](https://github.khronos.org/glTF-Tutorials/gltfTutorial/gltfTutorial_020_Skins.html).
- **Open:** verify the cos²(θ/2) factor on the figure's mesh.

### 5.13 Clips, tiempos y mezclas (C)

- **Question:** ¿Cómo se pasa de caminar a correr sin saltos en la animación?
- **Before:** 5.12, 2.5 (timelines as affine maps), 5.9 (continuity, ease), 3.6 (barycentric), 1.15, 5.4.
- **Leads:** **G2** §13.4, §13.6, §13.9, §13.10.1–2. **Also:** three.js `AnimationMixer`; Unity blend trees and Unreal
  sync groups (for "En los motores").
- **Approach:** G2's order: clips and local timelines, samples, blending local poses, cross-fades, directional and 2D
  blends, additive, then the action state machine fed by 5.4's mode. The hook: switching clips pops; cross-fading
  unsynced loops slides the feet. On top, ours: the phase advances with the distance walked.
- **The mathematics:** (1) _t_ = (τ − τ_start)_R_, clamped (one-shot), mod _T_ (loop), clamp to [0, _NT_] then mod _T_
  (_N_ loops): 2.5's maps; 30 frames are 31 samples, a loop drops the last. (2) β between samples; lerp **T**, slerp or
  nlerp **Q**, lerp **S**, per joint, local. (3) Eased cross-fade (_C_¹). (4) Phase by distance, dφ = d_x_/_D_: the
  stance foot moves back _D_dφ = d_x_ and stays put. (5) Directional weights pointing the blended stride along θ:
  _w_a = (cos θ/_D_a)/(cos θ/_D_a + sin θ/_D_b). (6) A triangle of clips: barycentric weights. (7) Additive
  **D** = **SR**⁻¹, check **DR** = **S**. Numbers: τ_start = 2 s, _R_ = 1,5, _T_ = 1,2 s, two loops, τ = 3 s: 0,3 s.
  Strides 1,2 m and 0,6 m: at 45°, weights ⅓ and ⅔, stride 0,57 m.
- **The live figure:** (a) a timeline strip of clips under a global time slider; (b) the archived walking figure around
  a square: phase by distance, blend directions, crossfade time; (c) a blend triangle to drag. Panel: local times,
  weights, foot slide (2–9 cm/s with phase by distance, 20–65 without), stride.
- **Traps:** an integer frame clock; blending global poses; the view's stride differing from the clip's; additive
  over-rotation. Footsteps that guards hear come from the simulation (6.10), never from an animation's events (view).
- **Exercises:** (1) Multiply the stride by 1,25 and predict the slide (0,2 _v_). (2) Weights linear in the angle: the
  slide at 45°. (3) Barycentric weights of the centroid.
- **Our angle:** Manifold has no root motion: the simulation moves the capsule and the animation follows, so replays
  and the network never depend on art; weights and phase are pure functions tested without a screen.
- **From the archive (2-06):** kept: the walking figure, phase by distance and its proof, directional weights, the
  three exercises, `gait.ts`. Changes: framed by G2's timelines and local blending. New: loops and rates, eased fades,
  the 2D triangle, additive clips, the action state machine.
- **Sources:** G2 §13.4–13.10.
  [three.js AnimationMixer](https://threejs.org/docs/#api/en/animation/AnimationMixer);
  [blending example](https://threejs.org/examples/#webgl_animation_skinning_blending).
- **Open:** add 5.4 to the curriculum's "Antes".

### 5.14 Cinemática inversa (C)

- **Question:** ¿Cómo se dobla una pierna para que el pie toque el escalón?
- **Before:** 5.12, 1.15, 1.16 (shortest arc), 1.5 (law of cosines), 1.4 (triangle inequality), 3.9 (rays).
- **Leads:** **L1** §1.5, Ex. 2.14; **G2** §13.7.2, §13.11.3–4. **Also:** Holden; Quilez; FABRIK; E p. 214 (feet as
  rays down).
- **Approach:** G2's picture frames it (distance to target as a surface over two joint angles, with one, two or no
  minima); L1's law of cosines solves two bones exactly; FABRIK solves longer chains. The hook: 5.15's character on a
  step, one foot floating.
- **The mathematics:** (1) Reach: |_L_₁ − _L_₂| ≤ _d_ ≤ _L_₁ + _L_₂; clamp _d_. (2) cos κ = (_L_₁² + _L_₂² − _d_²)/(2_L_₁_L_₂)
  for the knee, cos α = (_L_₁² + _d_² − _L_₂²)/(2_L_₁_d_) for the hip's offset. (3) Bend plane from a pole:
  normalize(**a** × **pole**). (4) The hip turned by the shortest arc. (5) FABRIK's two passes keep lengths. (6) Feet:
  a ray down per foot, the pelvis lowered by the larger drop, the IK weight following the contact phase. Numbers:
  _L_₁ = _L_₂ = 0,45 m, foot 0,78 m below: α = 29,9°, the knee bends 59,9°.
- **The live figure:** a two-bone leg with a draggable target beside the heat map over its two angles, a point rolling
  downhill, two valleys (knee forward, backward), no zero out of reach. Toggle **analytic ↔ FABRIK ↔ CCD**. Panel:
  _d_, α, κ, reachable, residual distance.
- **Traps:** acos of a value just outside [−1, 1] (clamp: rigor capsule); a pole parallel to the leg; IK solves
  position, not the foot's orientation; it runs after the blend, before the palette.
- **Exercises:** (1) Playback rate for a 1,2 m/s walk played at 0,9 m/s (0,75). (2) A target out of reach: the
  solver's answer. (3) Prove FABRIK keeps lengths.
- **Our angle:** IK is view, so `acos` is allowed and the hash is untouched. Manifold todavía no lo tiene.
- **From the archive (2-06):** kept: the law-of-cosines leg and its numbers. New: everything else. ML 1.8 (outside
  the repository) is the other source.
- **Sources:** L1 §1.5, Ex. 2.14; G2 §13.7.2, §13.11.3–4. [Holden](https://theorangeduck.com/page/simple-two-joint);
  [Quilez](https://iquilezles.org/articles/simpleik/);
  [FABRIK](https://www.andreasaristidou.com/publications/papers/FABRIK.pdf).
- **Open:** add 1.16 and 3.9 to the curriculum's "Antes"; ask the author for ML 1.8.

### 5.15 El personaje con cuerpo (P)

- **Question:** ¿Cómo se carga un personaje animado y se lo ata a lo que hace?
- **Before:** 5.13, 5.14, 5.6, 1.3 (start-up, shut-down, disposal).
- **Leads:** **G** ch. 7; **glTF**. **Also:** decision 0015 (art from scripts and CC0 packs); three.js `GLTFLoader`.
- **Approach:** four diffs: load one model (with the asset capsule), blend clips reading the simulation, drive an
  action machine from the modes, place the feet. Resources in general wait for 6.2.
- **The mathematics:** recalled. New checks: the model scaled to the capsule (1,6 m); Blender's +Z up imported as
  −90° about _x_ (det +1, never a mirror).
- **The project:** `view/model.ts`: `loadCharacterModel(url)` (scene, skeleton, clips by name; checks a clip per mode;
  scales; disposed on shut-down). `view/locomotion.ts`: pure functions without three.js: `directionWeights`,
  `runWeight`, `advancePhase(phase, walked, stride)`. `view/actions.ts`: `ActionMachine`, a state per mode with clips
  and fade times, reading `Character.mode`. `view/feet.ts`: `twoBoneIK`, `placeFeet` with rays down. The simulation is
  untouched. Console: `view.model off`, `show.skeleton`, `show.feet`. Recipe: `seed 7; restart; step 600; hash` gives
  the same value with `view.model on` and `off`.
- **Traps (Del modelo al motor):** context: a CC0 character shaped by a script; danger: the exporter strips constant
  tracks, keys start at frame 1, cycles off whole frames deform; rule: a test reads the file as loaded, clips named by
  mode, no root motion, collision is the capsule. Performance: `renderer.compile` before the first frame.
- **Exercises:** (1) A hat on a socket node. (2) The drawn body turns at most 360°/s while the simulation turns at
  once. (3) Frame time with and without IK (3.13's bar).
- **Our angle:** Manifold's mannequin comes from a headless Blender script checked by `assets.test.ts`; decision 0015
  decides where art comes from.
- **From the archive (2-06):** kept: the glTF "Más a fondo" and its three exporter traps, separated presentation,
  "los pesos tienen que sumar 1". Changes: a skinned model instead of boxes. New: the action machine and foot IK in
  the project.
- **Sources:** G ch. 7; [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html);
  [three.js, loading glTF](https://threejs.org/manual/#en/load-gltf); decision 0015.
- **Open:** which CC0 model, its license entry, and whether the tutorial ships the conforming script.

### 5.16 El juego: plataformas contra el reloj (P)

- **Question:** ¿Cómo se juega un nivel de plataformas contra el reloj?
- **Before:** 5.11, 5.15, 2.15 (the ghost), 2.12 (rules), 3.8 (bounding volumes).
- **Leads:** **G2** §17.6.3.1, §13.12 (motion matching, for the "Más a fondo"). **Also:** GPP ch. 7; Thorson.
- **Approach:** the rules first (the part sheet's design), then the code. The level exists (5.11); this lesson adds the
  race and the best run's ghost.
- **The mathematics:** a checkpoint is |_P_ − _C_|² ≤ _r_² (no square root); time _n_ steps shown as _n_/60 s; a medal
  is the first par ≥ _n_; the ghost is exact because the seed, the `Intent`s and platforms-as-functions-of-the-step
  determine the run.
- **The project:** `game.ts`: phases `ready`, `running`, `finished` with entry actions. `checkpoints.ts`: ordered
  spheres; falling below _y_ = −10 respawns at the last and adds 120 steps. Two shortcuts gated by 5.11's pickups. The
  best time in `localStorage` (view, try/catch) beside the best run's record (2.15's `record.ts`), replayed as a ghost.
  Optional cannon. The frame bar stays. Console: `race.par` (startup), `ghost on`, `god`. Recipe: `play best` then
  `hash` at the end equals the hash stored with the record.
- **Traps:** checkpoints tested on the center, once per step, in a fixed order; a record from another level version is
  refused; `localStorage` may throw.
- **Exercises:** (1) A fourth medal in the table. (2) The time difference to the ghost at each checkpoint. (3) Is a
  dash that skips a checkpoint allowed? (design).
- **Our angle:** platforms as functions of the step make the ghost exact for free; Manifold's `circuit` room is this
  game at full size (26 boxes, 9 zones, about 125 m, each part measured).
- **From the archive:** none directly; 2-03's star demo and 1-05's ghost are its ancestors.
- **Sources:** G2 §17.6.3.1, §13.12; [Thorson](https://maddymakesgames.com/articles/celeste_and_forgiveness/).
- **Open:** 6.4's sheet replaces these sphere checkpoints by zones.

## Problems found in the curriculum (part 5)

1. **5.2's camera rig** is listed as a component of the character, but the camera is view: it stays outside the hashed
   state, and its heading enters the world only as a whole-degree command.
2. **5.13's "Antes"** omits 5.4, though its action machine follows 5.4's modes.
3. **5.14's "Antes"** omits 1.16 (shortest arc) and 3.9 (rays for the feet).
4. **5.16's checkpoints** come before zones (6.4): sphere tests here, replaced in 6.4.
5. **The level text format** arrives in 6.3, after part 5's closing level, which is therefore a TypeScript module; 6.3
   must decide whether the format expresses rails, joints and pickups.
6. **Names to align with other parts:** 4.11's boundary module, 2.8's smoothing function against 5.2's `moveToward`,
   and the console verb that injects an action (`act`).
7. **Rapier's deterministic build:** verify the character controller is there with the same API.
