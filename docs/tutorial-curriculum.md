# The new tutorial's curriculum

A plan for the author to approve before any lesson is written, under [decision 0021](decisions/0021-a-new-tutorial.md).
It replaces the earlier draft built from five books. It was decided from nine readings, lesson by lesson, of the
reference books the author keeps outside the repository, from a search of free sources (about 150, checked in
November 2026), and from the author's own design draft. The tutorial's text and examples are our own: the books are
cited by chapter, never copied.

Lesson titles and the questions they answer are in Spanish, as they will appear on the site. Everything else is in
English.

## 1. What the tutorial is, and its own path

**To learn to make physical 3D worlds and games that run in the browser, understanding them down to their
mathematics** (0021), for someone who programs a little and has never done graphics, physics or games. One project
grows from the first lesson to the last and ends each part in something played. Concept lessons teach one idea for
itself, with a figure the reader touches. Project lessons take the idea into the project. The mathematics enters when
the game first asks for it, and it is taught whole and precisely, with its proofs. The text is Spanish, the code
English: TypeScript, three.js and Rapier, in the browser.

What no other tutorial offers, and where it shows:

- **One project that becomes games.** It is one world that accumulates. The turret of part 1 is the antagonist in
  part 2, a sentry in the maze of part 3, the cannon in part 4 and a watcher in part 6. The guard of part 7 drives the
  same character as the player.
- **Precise mathematics in live figures.** Every concept lesson has a figure with live numbers. Where a naive version
  exists, it sits beside the correct one behind a toggle (§4.2).
- **Determinism as a thread.** The same hash comes out in every browser. It starts with the fixed step (2.4) and
  seeded chance (2.10), runs through replays (2.14), robust geometry (3.16), a hand-built engine with its hash (4.6)
  and a deterministic mind (7.13), and ends in networking (part 9). See §6.1.
- **A real engine built in public.** Manifold solves the same problems at full size. Each lesson's "En Manifold" and
  "Dónde Manifold eligió otra cosa" give its decision and the measurement behind it.
- **A console with recipes.** The project gets its own small console in 2.6, modelled on Manifold's (decision 0010).
  From then on every project lesson ends with a recipe to type and the output it should give.
- **A destination in strange worlds.** Part 10 has surfaces, gravity that changes from place to place, parallel
  transport, orientation and spaces glued to themselves. Seeds of it are planted along the way: the unit quaternions
  as the first manifold (1.15), the determinant's sign (1.8), the frame along a curve (5.9).

## 2. The conventions ("el esperanto")

One set of conventions, fixed on the first page (the symbols page 0021 promises) and never changed in a derivation.
Every formula taken from a book is translated into it, and the table says how. Abbreviations: **L1**, **L2**
Lengyel's _Foundations of Game Engine Development_ vols. 1 (_Mathematics_) and 2 (_Rendering_); **G**, **G2**
Gregory's _Game Engine Architecture_, 4th ed., vols. I and II; **RTR** _Real-Time Rendering_, 4th ed.; **E** Ericson's
_Real-Time Collision Detection_; **MF** Millington's _Game Physics Engine Development_, 2nd ed.; **MA** Millington's
_AI for Games_, 3rd ed. (2019, Millington alone; "Millington and Funge" is the 2nd edition); **GPP** Nystrom's _Game
Programming Patterns_ (its examples are in 2D C++, with no 3D conventions to translate).

Two more books for the hard explanations (added 2026-11-16, after the tables were made; the lesson sheets cite them
where they help): **DP** Dunn and Parberry's _3D Math Primer for Graphics and Game Development_, 2nd ed. (free from its
authors at [gamemath.com](https://gamemath.com/book/), so a lesson can send the reader there), the gentlest of the
mathematics books, strongest on curves (5.9), the canonical sets of angles (1.13, 1.16), quaternions (1.15) and a
calculus and mechanics primer (2.1, 2.2, part 4); and **LM** Lengyel's _Mathematics for 3D Game Programming and
Computer Graphics_, 3rd ed. (not L1, which shares a word of its title), strongest on projection and oblique clipping
in WebGL's own conventions (1.2, 1.10, 8.14, the portals of part 10), eigenvalues and the spectral theorem (4.2, 4.8),
the damped spring by its characteristic roots (4.2, 5.5, 7.1), inertia as an integral (4.8), sine and cosine from a
table and Taylor terms (2.13's `trig.ts`, its table written as literals) and non-inertial frames (5.8). Their
conventions, to translate: **DP** is left-handed with +_z_ forward (mirror _z_: a quaternion becomes (_w_, −*x*, −*y*,
_z_), angles about _x_ and _y_ change sign), writes row vectors with the translation in the bottom row, planes as
_p_·**n** = _d_, clockwise front faces, heading positive to the right and pitch positive nose down (and its 1st
edition's quaternion product is reversed: use only the 2nd's); **LM** agrees with ours except its aspect ratio
(height over width), its focal length from the horizontal field of view (three.js's `fov` is vertical), _w_ first on
the page, and explicit Euler.

| Convention            | Ours (the mathematics)                                                                                                                                        | In code: three.js, Rapier, Manifold                                                                                                                                                                                    | L1                                | L2                                                      | G, G2                                                                      | RTR                                 | E                                    | MF                                                                  | MA                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------- |
| Handedness            | Right-handed; defined (1.6) by the sign of [**i**, **j**, **k**]                                                                                              | Right-handed                                                                                                                                                                                                           | Right                             | Right (camera space too)                                | Both discussed; its graphics examples are left-handed; G2's clip space too | Right                               | Agnostic                             | Right                                                               | Right                                    |
| Up                    | +Y, but nothing assumes it: each thing has its own "up", gravity is a field                                                                                   | three.js and glTF +Y; Blender +Z (importing is −90° about _x_, det +1)                                                                                                                                                 | Not fixed                         | A choice (§5.4.1); camera _y_ points down               | A choice to audit once                                                     | +_y_                                | —                                    | +Y                                                                  | +Y                                       |
| Forward, right        | Cameras and characters look down −Z; right is +X                                                                                                              | Cameras and lights look down −Z; `Object3D.lookAt` turns a non-camera's **+Z** to the target; glTF models face +Z; Manifold's characters face −Z                                                                       | —                                 | Camera looks down +_z_                                  | +_z_ into the screen                                                       | Camera looks down −*z*              | —                                    | —                                                                   | Heading θ from +Z: (sin θ, 0, cos θ)     |
| Vectors and products  | Column vectors, **v**′ = **Mv**; read right to left (**TRS** applies **S** first)                                                                             | `A.multiply(B)` is **AB** (B acts first); `A.premultiply(B)` is **BA**; `matrixWorld` = parent · local                                                                                                                 | Columns                           | Columns                                                 | **Row** vectors, **v**·**M**, read left to right: transpose every formula  | Columns                             | States both (§3.1)                   | Columns                                                             | Vector algebra, mostly 2D                |
| Storage               | —                                                                                                                                                             | `Matrix4.elements`: 16 numbers, column-major, translation at indices 12–14; `Matrix4.set()` takes them in **row** reading order; Manifold keeps tuples `[x, y, z]`                                                     | Column-major (§1.3)               | —                                                       | "Probe your library" (§5.3.14)                                             | —                                   | —                                    | —                                                                   | —                                        |
| Quaternion in code    | —                                                                                                                                                             | (x, y, z, w): three.js, Rapier, Manifold's tuples                                                                                                                                                                      | (x, y, z, w)                      | —                                                       | [x y z w]                                                                  | (**q**_v, q_w), vector part first   | —                                    | **[w x y z]**                                                       | —                                        |
| Quaternion in algebra | _q_ = (_w_, **v**) = (cos θ/2, **û** sin θ/2); **v**′ = _q_ **v** _q_\*; _q_₂_q_₁ applies _q_₁ first; _q_ ≡ −*q*, made canonical (_w_ ≥ 0) to compare or hash | `qa.multiply(qb)` is _q_ₐ_q_ᵦ                                                                                                                                                                                          | The sandwich; _w_ ≥ 0 (§2.7.2)    | —                                                       | _q_₃_q_₂_q_₁ applies _q_₁ first                                            | (sin φ **û**, cos φ) turns by 2φ    | —                                    | The update is stated, not derived                                   | Eq. 3.11 drops the half angle (a trap)   |
| Angles                | Radians; positive is counterclockwise seen from the axis's tip (about +Y, +Z turns towards +X)                                                                | three.js in radians, Euler order `'XYZ'` by default (`'YXZ'` for yaw then pitch); Manifold's data in whole degrees with its own sine and cosine; its input headings run from −Z towards +X (clockwise seen from above) | Counterclockwise positive         | —                                                       | Yaw, pitch, roll                                                           | Head, pitch, roll; 24 orders        | —                                    | Euler orders mixed without notice                                   | Orientations wrap; rotation rates do not |
| Planes                | [**n** \| _d_]: **n**·**x** + _d_ = 0, signed distance **n**·_P_ + _d_ with \|**n**\| = 1; a plane is a row and travels with **H**⁻¹                          | `Plane(normal, constant)`: the same                                                                                                                                                                                    | [**n** \| _d_] (§3.4)             | The same; rows that travel with the inverse             | Point and normal                                                           | **n**·**x** + _d_ = 0               | **n**·_X_ = _d_ (_d_'s sign flipped) | Normal and offset, as E                                             | —                                        |
| Winding, normals      | Counterclockwise is the front; normals transform with the inverse transpose                                                                                   | `FrontSide` is counterclockwise; `normalMatrix`                                                                                                                                                                        | Counterclockwise; normals as rows | Counterclockwise                                        | G2: Direct3D's default is clockwise                                        | Counterclockwise; the rule asserted | Counterclockwise                     | —                                                                   | —                                        |
| Clip space            | View space looks down −Z; normalized device coordinates in [−1, 1]³                                                                                           | WebGL                                                                                                                                                                                                                  | (vol. 2)                          | Direct3D/Vulkan, depth in [0, 1]; Ex. 6.8 gives [−1, 1] | G2: left-handed, _z_ into the screen                                       | [−1, 1]³ (also gives [0, 1])        | —                                    | —                                                                   | —                                        |
| Units, time           | SI (m, s, kg, N; rad, rad/s); a fixed step _h_ = 1/60 s; game time is a whole count of steps                                                                  | Rapier in SI by convention; three.js lights in candela (point, spot) and lux (directional), decay 2                                                                                                                    | —                                 | Nits, lux, candela                                      | —                                                                          | —                                   | —                                    | SI; suggests a tuned _g_ of 15–20 m/s²                              | —                                        |
| Integrator            | Semi-implicit Euler: velocity first, then position with the new velocity                                                                                      | Rapier: the same                                                                                                                                                                                                       | —                                 | —                                                       | G2: explicit Euler, Verlet                                                 | —                                   | —                                    | Explicit for particles, semi-implicit for rigid bodies, unannounced | Explicit, then clamps the speed          |

**Notation** (0021): vectors in bold (**v**), unit vectors with a hat (**v̂**), scalars in italics, matrices in bold
capitals (**M**), points in capital italics (_P_); KaTeX; a decimal comma in the Spanish text, as the pilot writes.

**What transforms how** (L1's signature: types that know how they transform). A table on the symbols page that grows
lesson by lesson:

| Object                                    | Written as         | Under **H** = [**M** \| **t**]             | Taught in |
| ----------------------------------------- | ------------------ | ------------------------------------------ | --------- |
| Point _P_                                 | (_x_, _y_, _z_, 1) | **H**_P_                                   | 1.10      |
| Direction **v** (velocity, edge, tangent) | (_x_, _y_, _z_, 0) | **Mv**: no translation                     | 1.10      |
| Normal **n**                              | A row              | (**M**⁻¹)ᵀ**n**                            | 3.2       |
| Plane [**n** \| _d_]                      | A row of four      | [**n** \| _d_] **H**⁻¹                     | 3.4       |
| Orientation _q_                           | A unit quaternion  | _r_ _q_, with _r_ the transform's rotation | 1.15      |
| Inertia tensor **I**                      | A symmetric matrix | **R I R**ᵀ                                 | 4.8       |

## 3. Who leads each subject

For each subject one or two sources lead: the lesson takes its structure and its argument from them. The others
contribute what they do best. As a rule, the proofs come from L1. RTR gives figures, worked numbers and traps, and
Gregory the engine-builder's view and the conventions. Nystrom gives the writing method and the costs. Ericson gives
reductions and counterexamples, and Millington the failures and their causes. The mathematician's own derivations
fill the gaps none of them closes.

| Subject                                         | Leads                                           | What the others bring                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vectors, matrices, spaces, rotations            | **L1** ch. 1–2                                  | G ch. 5: conventions, traps, game problems, degrees of freedom. RTR ch. 4: figures and traps (non-uniform scale, gimbal), slerp. MF: the physics uses ([**a**]×, **RIR**ᵀ, the contact frame). MA: headings, the cone test, the signed angle. E: the extreme point, orientation predicates, the \|**M**\| rule. Dunn and Parberry, gentler |
| The projection and the camera                   | **L2** ch. 6, **RTR** 4.7                       | L2 derives from conditions (re-signed for WebGL); RTR gives the figures, the numbers and three.js's conventions; G only conventions                                                                                                                                                                                                        |
| Time, the loop, the clock, input                | **G** ch. 8–9, **GPP** ch. 2, 9, 10             | MF: the physical reasons for a fixed step. Fiedler: the accumulator. MA: a mind drives the same actions                                                                                                                                                                                                                                    |
| Integration and numerical stability             | **MF** ch. 2–3, 6 (corrected)                   | G2 §14.4.3–14.4.4: Euler's error by Taylor, Verlet. Witkin and Baraff, Catto: the precise statements. Hairer, Lubich and Wanner, for the author. Our derivations: the error's order, the phase-space determinant                                                                                                                           |
| Numbers that are not exact; determinism         | **G** §3.3.1 (corrected), **E** ch. 11          | L1, L2: geometric and depth precision. Goldberg, Dawson, ECMA-262, Fiedler, Catto, Rapier's documentation. Manifold's measured findings                                                                                                                                                                                                    |
| Chance with a seed                              | **G** §5.7, **MA** §8.1                         | O'Neill (PCG), Vigna (xoshiro), Eiserloh (noise-based random numbers)                                                                                                                                                                                                                                                                      |
| The shape of the code (patterns)                | **GPP**                                         | G2 ch. 16–17: the object model, update phases, events with times. G: layers, start-up and shut-down                                                                                                                                                                                                                                        |
| Geometry and collision detection                | **E** ch. 3–5, 9, 11–12                         | RTR ch. 22: algebra turned into geometry for early exits. L1 ch. 3: lines, planes, normals with proofs. G2 §14.3: the engine's view (phases, queries, filtering, tunnelling). MF ch. 12–13: contact generation                                                                                                                             |
| Many objects (broad phase)                      | **E** ch. 6–7, **GPP** ch. 20                   | RTR 19.1; Catto (dynamic trees); Müller (spatial hashing)                                                                                                                                                                                                                                                                                  |
| Rigid bodies, contacts, solvers                 | **MF** (structure, failures), **G2** §14.4–14.5 | G2: 2D before 3D, angular momentum, kinds of bodies, the step's order. Catto: impulses, islands, solvers. Witkin and Baraff. Rapier's guide. E: GJK and detection                                                                                                                                                                          |
| The character and its camera                    | **G2** §14.5.3.6–7, Rapier's guide              | Catlike Coding; Haigh-Hutchinson, Nesky (cameras); Pittman, Thorson (feel); MA: jump trajectories, actuation                                                                                                                                                                                                                               |
| Curves                                          | **RTR** 17.1                                    | Pomax, Holmér; MA: the path parameter; G2: ease curves                                                                                                                                                                                                                                                                                     |
| Animation                                       | **G2** ch. 13                                   | RTR 4.4–4.5: skinning figures, dual quaternions. L1: IK is the law of cosines. glTF's specification                                                                                                                                                                                                                                        |
| The world as data, events, signals, saving      | **G2** ch. 16–17, **GPP**                       | G ch. 7: resources                                                                                                                                                                                                                                                                                                                         |
| Light as logic, and sight                       | **L2** ch. 8, **RTR** 5.2                       | G2 §12.2.4 (radiometry); MA ch. 11 (sense management)                                                                                                                                                                                                                                                                                      |
| Sound                                           | **G2** ch. 15                                   | W3C's Web Audio specification and MDN; Wilson's two clocks                                                                                                                                                                                                                                                                                 |
| Minds (AI)                                      | **MA**                                          | GPP (State, generators); G2 §17.9 (scripted state machines); Red Blob Games. Ours: the proofs and the determinism                                                                                                                                                                                                                          |
| Levels from a seed                              | **MA** ch. 8                                    | Shaker, Togelius and Nelson; Nystrom's "Rooms and Mazes"; Kazemi; Buck                                                                                                                                                                                                                                                                     |
| Rendering                                       | **RTR**, **L2**                                 | L2: derivations from conditions, precision, physical units, planes as rows. G2 ch. 11–12: the engine's view. three.js, WebGL2 Fundamentals, The Book of Shaders, LearnOpenGL                                                                                                                                                               |
| Tools: debug drawing, menus, console, profiling | **G** ch. 10, §2.3                              | E: collision debugging (a ring of recent queries, a brute-force reference). G2: GPU capture (Spector.js). Decision 0010                                                                                                                                                                                                                    |
| Resources and the asset pipeline                | **G** ch. 7, §6.1, §1.6                         | glTF; three.js's disposal                                                                                                                                                                                                                                                                                                                  |
| Networking                                      | **Fiedler**, **Gambetta** (no book)             | Mattis; Bettner and Terrano; Infil, GGPO; Bernier; decision 0016; G2 §14.1.3.2, §17.5.3                                                                                                                                                                                                                                                    |
| Strange worlds                                  | **Ours**, with L1                               | L2 §10.8 (marching cubes); G2 §14.4.6.5, §14.4.9; Weeks; Hanson and Ma; Wang et al.; Crane; Catlike Coding (gravity); Quilez, Hart; MA (heuristics on a torus)                                                                                                                                                                             |

**Known errors the readers found** (each lesson that leans on these books corrects them in place, and several make
good "corregí al autor" exercises):

- **MF:** superposition of forces called D'Alembert's principle; momentum conservation called "perfectly elastic"
  (that is _e_ = 1); impulse defined as a change of velocity (it is a change of momentum, N·s); the ½_a_Δ_t_² term
  dropped "because it is small" (the position error after time _t_ is about ½_at_Δ_t_, first order and growing);
  explicit and semi-implicit Euler switched without notice; projectile scaling (to slow a shot by _k_ on the same
  path, _g_ scales by _k_², not _k_); τ = **I**α without **ω** × **Iω**; the quaternion update not derived; code that
  disagrees with its equations; exact float equality in the rod.
- **MA:** the axis–angle quaternion without the half angle (eq. 3.11) and cos(−θ) = −cos θ; the 3D align never checks
  _w_ < 0; the angle as arcsin\|**f** × **t**\| (wrong past 90°); the closest approach without its minus sign
  (_t_\* = −**Δ**·**w**/\|**w**\|²); the scheduler test written backwards; the bisection midpoint as (max − min)/2;
  square roots of a negative _t_² in the firing solution; random() − random() called binomial (it is triangular). Its
  preference for a variable step is a disagreement, not an error.
- **RTR states without proof:** the rotation _q_**p**_q_\*, the inverse transpose for normals, the separating axis
  test. Pair it with L1 and E. Its collision chapter and math appendices are online only.
- **E:** typos in the printed code (the slab test's "nearest exit" must keep the minimum; an OBB axis index; a box
  corner helper). Check the errata, and test every clever routine against a brute-force one (E's own advice).
- **G:** the float clock is understated. 12.14 days is where a 30 Hz float seconds clock stops. At 60 Hz a float32
  clock already runs 6% slow after about 9 hours, runs at 1.875× after about 3 days, and stops after about 6. G and
  G2 write row vectors, and G2 states **q̇** = ½**ω**_q_ without deriving it.
- **L2:** Direct3D/Vulkan conventions throughout (re-sign every derivation); no microfacet PBR (take it from RTR).
- **GPP:** it draws ahead by extrapolating. We interpolate between two states (2.4).

## 4. How a lesson is written

### 4.1 The method

**Problem → intuition → equation → code**, for every idea. The equation comes from conditions (L2): what the thing
must do, written as equations, then solved. The code is a climb, not a jump (GPP). The naive version comes first and
breaks on screen; the next rung fixes it; the pattern is stated last, with when it pays and what it costs.

It fits 0021's lesson shape without changing it (the main path at least 60% of the page, the layers short):

| Section (0021)                 | What goes in it                                                                                                                                                                                                                              | From                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **El problema**                | The project's current code meets a new requirement, and the naive extension fails on screen (the toggle). The question is phrased as the problem, never as the mechanism.                                                                    | GPP; the design draft |
| **La matemática**              | Intuition and a picture, then the conditions, the equations and their solution, the statement and its proof, and an example with the same numbers the live example shows. Named moves: "el mismo movimiento" (§6.2), "se reduce a…" (part 3) | L2, L1, RTR, E        |
| **El código / En el proyecto** | The ladder: naive, smallest fix, next requirement, the shape that holds. Steps the size of a diff, file by file in a project lesson.                                                                                                         | GPP; 0021             |
| **Probalo**                    | Each try with what should happen. At least one perturbation (§4.2). In a project lesson, a console recipe with its expected output (§4.4).                                                                                                   | The design draft      |
| **Lo importante**              | Three or four sentences.                                                                                                                                                                                                                     | 0021                  |

The layers around it:

- **Patrón:** the intent in one line, when it pays, what it costs, and one design decision (GPP).
- **En los motores** (at most five lines): two or three design questions with their options, ending in "Dónde
  Manifold eligió otra cosa" with its decision number and the measurement behind it. This turns GPP's design
  decisions and our measured findings into one device.
- **En Manifold:** one paragraph with links to the code, or "Manifold todavía no lo tiene".
- **Sutilezas:** traps, E's counterexamples, the capsules (§4.3), and "doblar las reglas" (G2: physics bent for fun).
- **Más a fondo** (at most two): long proofs and extensions; nothing in the main path depends on them.
- **Para practicar** (two or three): each with what should come out and a hint. Short proofs are welcome (L1's
  style).
- **Para saber más:** the book chapter and one or two free sources.

### 4.2 The lab kit for live figures

One shared module for the concept lessons' figures, importable, with its source one click away from every example
(copying the same scene code into a hundred lessons would not be maintained). It grows with the curriculum:

- **Primitives that know geometry:** a vector with its label; a point; a plane with its normal and its half-space
  shaded; a frame (axes in red, green and blue, or **T**, **B**, **N**); a segment with its closest-point markers;
  intervals on an axis (the shadows of the separating axis and the slabs); a swept shape with its time of impact.
- **Live numbers:** a telemetry box with the lesson's quantities and their units.
- **Naive against correct:** a toggle in every figure that has a naive version (explicit against semi-implicit
  Euler, per-frame against exact smoothing, clamping both segment points against the true closest points). This is a
  standing rule.
- **Perturbations:** drop to 15 frames per second, a frame spike, a hidden tab, a huge impulse, a matrix that is no
  longer orthogonal, float32 instead of float64, an object far from the origin.
- **One knob, two failures** (RTR's figure style): a slider with a failure at each end and both failures measured.
  Examples: the near plane, shadow bias, crease angle, texture filtering, grid cell size, spring stiffness against
  the step, smoothing τ, the dead zone, suspicion hysteresis.
- **Time controls** for anything that moves: pause, single step, slow motion; a seed box and a hash readout where
  determinism is the point.

### 4.3 Capsules: three named kinds of Sutileza

Each capsule has the same shape: **context → the hidden danger → the engineering rule**, with a measurement when it
is about cost.

- **Rendimiento en el navegador:** garbage-collection pauses and reused temporaries; the cost of crossing from
  JavaScript into Rapier's WebAssembly; an integrated GPU's budget; draw calls and instancing; typed arrays. The
  rule: measure first (3.13).
- **Rigor numérico:** tolerant comparisons; drift and re-orthonormalization; cancellation; predicates near zero; the
  order of operations and determinism.
- **Del modelo al motor** (the asset pipeline): Blender to glb with our axes (a rotation with det +1, never a
  mirror); the collision shape is not the drawn mesh; units and scale; metadata in nodes.

### 4.4 Verification in the console

From 2.6 the project has a small console of its own: a registry of variables and commands, with Manifold's three kinds
(decision 0010). **Startup** options restart the world, **world** changes enter at a step like a key, and **view**
changes never touch the hash. Every project lesson's "Probalo" ends with a recipe, for example `seed 7; restart;
step 600; hash`, and the output it should give. "En Manifold" gives the same check in the Dojo, at full scale.

### 4.5 The quality checklist

A lesson is reviewed against this list before it is published:

1. **The why test:** every step answers a question the reader has at that point.
2. **The figure teaches with the text muted.**
3. **Nothing is used before it is taught;** a later lesson links back and recalls the idea in one line.
4. **Conventions:** every formula is in §2's conventions, and every book formula is re-signed or transposed and
   cited by chapter.
5. **Determinism of the simulation:** no unseeded randomness, no clock reads (`Date.now`, `performance.now`) in the
   state, no three.js or Rapier objects in the state, no `Math.sin`, `Math.cos`, `Math.exp` or `Math.pow` in what is
   hashed (2.9's rule), and iteration in a fixed order.
6. **Clear code first.** Reused temporaries appear only where a measurement asks for them, in a performance capsule.
7. **A naive-against-correct toggle** wherever a naive version exists.
8. **Each pattern box** says when it pays and what it costs.
9. **Exercises** come with expected results and hints.
10. **The project's public names** keep their meaning; a change is announced and taught (0021). The test that builds
    every lesson's project passes.
11. **The lesson ends saying where the idea comes back.**
12. **The game is more expressive** after a project lesson than before it.

## 5. The parts and their lessons

Before part 1: **Presentación**; **TypeScript para quien sabe JavaScript** (types, interfaces, `!`, the generics the
code uses); **La notación** (§2's conventions, the symbols, the table of what transforms how).

Legend: **C** concept lesson, **P** project lesson. **Antes** lists direct prerequisites by lesson number. **←** marks
where existing material lives: _piloto 0N_ is a written pilot lesson, _0-03_ a lesson of the tutorial being archived
(stage 0, lesson 3), and _ML_ a lab of Manifold Lab. **◇** marks a lesson that can fold into a neighbour as a section
if a part must shrink (§8). Sources are cited by chapter or section; the main source is in bold.

### Parte 1. El espacio: closing game _la torreta_

The whole part is time-free. The turret is aimed by discrete presses and the lock-on slerps along a parameter.
Nothing is smoothed per frame before part 2 makes it correct (G's rule).

| #      | Lección                                                    | K   | La pregunta que responde                                                                        | Fuentes                                                                                          | Antes      | ←               |
| ------ | ---------------------------------------------------------- | --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- | --------------- |
| 1.1    | Coordenadas                                                | C   | ¿Cómo se dice, con números, dónde está algo?                                                    | **L1** 1.1; G §5.1–5.2.2; L2 §5.4.1                                                              | —          | piloto 01; 0-00 |
| 1.2    | La proyección                                              | C   | ¿Cómo se ve un mundo de tres dimensiones en una pantalla plana?                                 | **L2** §6.1; **RTR** 4.7.2, 2.3                                                                  | 1.1        | piloto 02; 0-00 |
| 1.3    | Una ventana al mundo                                       | P   | ¿Qué hace falta para dibujar el mundo, y dónde cae cada punto?                                  | RTR 2; G §1.5, §6.1.2, §8.1, §8.3.2; L2 §5.4                                                     | 1.2        | piloto 03; 0-01 |
| 1.4    | Vectores                                                   | C   | ¿Cómo se dice cuánto y hacia dónde?                                                             | **L1** 1.1–1.2; G §5.2.3–5.2.5; E §3.2–3.3.2                                                     | 1.1        | piloto 04       |
| 1.5    | El producto escalar: proyectar y rechazar                  | C   | ¿Cuánto de un vector va en la dirección de otro, y cuánto queda de través?                      | **L1** 1.5.1, 1.6; G §5.2.4.7; E §3.3.3–3.3.4; MA §3.3.14; MF §2.1.7                             | 1.4        | —               |
| 1.6    | El producto vectorial: áreas con signo, normales, una base | C   | ¿De qué lado queda algo, qué es perpendicular a dos direcciones, y cómo se arma un marco?       | **L1** 1.5.2–1.5.3, 4.1; E §3.3.5–3.3.8, §3.1.6; G §5.2.4.8–9; MF §2.1.8–9, §14.2.1; MA §3.9.4   | 1.5        | —               |
| 1.7    | Mirar: delante, detrás, a qué lado                         | P   | ¿Cómo sabe la torreta dónde están los blancos, y cómo se ve lo que sabe?                        | G §10.2; MA §3.3.14                                                                              | 1.3, 1.6   | —               |
| 1.8    | Matrices: adónde van los ejes                              | C   | ¿Qué hace una matriz con el espacio, y por qué importa el orden?                                | **L1** 1.3–1.4, 1.7, 2.3–2.4; RTR 4.1; G §5.3.1–5.3.7, §5.3.14; E §4.2.6                         | 1.6        | 0-07            |
| 1.9 ◇  | La inversa, y las matrices que no deforman                 | C   | ¿Cómo se deshace una transformación, y cuándo deshacer es solo transponer?                      | **L1** 1.7.5, 2.1.2; MF §9.4.2–9.4.6; E §3.1                                                     | 1.8        | 0-07            |
| 1.10   | Coordenadas homogéneas: puntos y direcciones               | C   | ¿Cómo entra la traslación en una matriz, y por qué un punto y una dirección se mueven distinto? | **L1** 2.6; L2 §5.4.3, §6.2; RTR 4.1, 4.7; G §5.3.8–5.3.10, §5.3.13; MF §9.4.5                   | 1.2, 1.9   | 0-07            |
| 1.11   | Espacios y jerarquías                                      | C   | ¿Cómo se pasa de las coordenadas de una pieza a las del mundo, y de vuelta?                     | **L1** 2.1 (eq. 2.8); L2 §5.4.1–5.4.3; G §5.3.11–5.3.12; RTR 4.1.5, 19.1.5; E §4.2.2; GPP ch. 18 | 1.10       | 0-07            |
| 1.12   | Una torreta con partes                                     | P   | ¿Cómo se arma algo con piezas que giran unas sobre otras?                                       | G §5.3.11.1, §10.2.1; L2 §5.4.2                                                                  | 1.7, 1.11  | —               |
| 1.13   | Rotaciones I: los ángulos y el bloqueo de cardán           | C   | ¿Por qué tres ángulos no alcanzan para girar bien?                                              | **G** §5.5.1–5.5.2; **RTR** 4.2.1–4.2.2; L1 2.2.1; MF §9.2.1                                     | 1.11       | 0-02            |
| 1.14 ◇ | Rotaciones II: eje y ángulo                                | C   | ¿Por qué todo giro es alrededor de un eje, y cómo se calcula?                                   | **L1** 2.2.2, 4.4; RTR 4.2.4; ten Bosch                                                          | 1.13       | —               |
| 1.15   | Rotaciones III: cuaterniones y slerp                       | C   | ¿Cómo se guarda y se interpola un giro sin trabarse?                                            | **L1** 2.7; G §5.4, §5.5.3–5.5.8; RTR 4.3; MF §9.2.2–9.2.4; Blow; Eater and Sanderson            | 1.14       | 0-02            |
| 1.16   | Apuntar                                                    | P   | ¿Cómo se da vuelta algo hacia un blanco, por el camino más corto?                               | L1 1.6, Ex. 2.14; RTR 4.1.6, 4.3.2; G §5.2.4.8, §5.3.12.3; L2 §10.2                              | 1.12, 1.15 | —               |
| 1.17   | El juego: la torreta                                       | P   | ¿Qué hace falta para que algo sea un juego?                                                     | GPP ch. 7, ch. 4; MA §2.1.1                                                                      | 1.16       | —               |

The project gains:

- **1.3:** the renderer and a camera built from 1.2's numbers, and a floor. The world is plain data, and the drawing
  reads it. Start-up and shut-down run in order, and everything is disposed on reload.
- **1.7:** `vec.ts` grows dot and cross. `debug.ts` arrives: arrows, axes, points and text, with lifetimes and depth
  on or off, queued and drawn at the end of the frame (G §10.2). The turret is a single block with a forward vector.
  Each target is drawn as in front or behind, left or right.
- **1.12:** `mat.ts`, our own matrices on tuples. The turret becomes a base that yaws and a barrel that pitches. The
  muzzle is in world space, and each target is read in the base's frame through the inverse.
- **1.16:** `quat.ts`. A lock-on builds the look-at frame, takes the shortest arc, and slerps at _t_ = _k_/_N_, with
  _k_ advancing by one at each press.
- **1.17:** `input.ts` maps `KeyboardEvent.code` to logical actions, through event-driven `onPress`. `game.ts` holds
  the phases as an enum and a switch, and a hit event feeds the score. The game is turn-based: discrete turns, fire,
  a hit when the target is inside the cone, hints from the two signs, layouts as data, a par of shots, and restart.

Decided here:

- **The pilot's order stays** (the projection before the window that needs it).
- **Matrices split in two** (L1: matrix algebra, then inversion and orthogonality).
- **Rotations in three steps:** angles (G, RTR), then the axis and Rodrigues by decomposition, then quaternions,
  proved equal to Rodrigues (L1's derivation depends on Rodrigues).
- **1.10 re-reads 1.2:** the projection is the division by _w_, with the same figure relabelled, and the matrix that
  puts _z_ into _w_. Its depth row waits for 8.3 (L2 and RTR agree).
- **Names planted for part 3** (E): the extreme point along a direction (1.5); the orientation predicates ORIENT2D
  and ORIENT3D, and the triple product as a signed volume (1.6); the \|**M**\| rule as an exercise (1.8); testing in
  one object's space (1.11). The triangle inequality is stated in 1.4 and proved in 1.5 (L1). The inverse transpose
  is stated as a warning in 1.10 and derived in 3.2 (G).
- **Colour:** a "Más a fondo" in 1.4 (colours are vectors), and a "Sutileza" in 1.3 (the screen is not linear) (L2).
- **Bivectors** are a "Más a fondo" of 1.6, and two mirrors make a rotation in 1.14 (L1 ch. 4).
- **Input comes in early:** part 1 introduces logical actions, event-driven. Part 2 extends them with state per
  step, without renaming them (0021's stable names).

### Parte 2. El tiempo: closing game _juntar las monedas_, then _tu fantasma_

| #      | Lección                                              | K   | La pregunta que responde                                                               | Fuentes                                                                                                                                | Antes           | ←          |
| ------ | ---------------------------------------------------- | --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| 2.1    | Un juego es una simulación                           | C   | ¿Qué es un juego para la computadora: un estado y un paso?                             | **G** §1.1.1, ch. 8 intro; MF §1.2, §3.1–3.2; GPP ch. 9; MA §3.1; G2 §16.1.1                                                           | 1.4             | 0-05       |
| 2.2    | Integrar a pasos                                     | C   | ¿Cómo se calcula un movimiento de a pasos, y cuánto se equivoca?                       | **MF** §2.2, §3.3, §10.4 (corrected); G2 §14.4.3–14.4.4; G §8.5.2; Witkin and Baraff; Fiedler                                          | 2.1             | 0-03       |
| 2.3 ◇  | Acercarse sin pasarse                                | C   | ¿Cómo se acerca algo a un valor igual a 30 cuadros por segundo que a 144?              | **G** §9.5.3; MF §3.3.1, §16.2.1; MA §3.1.3; L2 §8.5.1; Driscoll; Holmér                                                               | 2.2             | —          |
| 2.4    | El bucle: el paso fijo y el dibujo entre dos estados | C   | ¿Cómo se mueve igual en una computadora rápida y en una lenta?                         | **GPP** ch. 9; **G** §8.2–8.3, §8.5.1–8.5.2.5; MF §3.3, §6.3.1, §7.2.3; G2 §14.5.2.2, §17.6.3.4; E §2.4.2; Fiedler                     | 2.2             | 0-03, 0-05 |
| 2.5    | El reloj del juego                                   | C   | ¿Cómo se pausa, se frena o se avanza un paso sin tocar el bucle?                       | **G** §8.4, §8.5.3–8.5.4, §10.5; G2 §13.4.1–13.4.3; GPP ch. 9                                                                          | 2.4             | —          |
| 2.6    | El reloj del proyecto                                | P   | ¿Cómo se lleva el paso fijo al proyecto, con pausa, cámara libre y consola?            | G §10.3–10.5; decision 0010                                                                                                            | 1.17, 2.3, 2.5  | —          |
| 2.7    | Entradas: estado, bordes, acciones                   | C   | ¿Qué pasó con las teclas en este paso, y qué quiere decir cada una?                    | **G** §9.2–9.5; **GPP** ch. 2; MA §14.2.1                                                                                              | 2.3, 2.4        | 1-04       |
| 2.8    | Moverse                                              | P   | ¿Cómo se mueve algo a la misma velocidad hacia cualquier lado, a pasos fijos?          | MA §3.3.6; G §8.5.2                                                                                                                    | 2.6, 2.7        | piloto 05  |
| 2.9    | Números que no son exactos                           | C   | ¿Por qué 0,1 + 0,2 no da 0,3, y qué cuentas dan lo mismo en todos los navegadores?     | **G** §3.3.1, §8.5.4.3–4, §5.3.11.2; **E** §11.1–11.3.1; L1 1.6, 2.7.2, 3.3.2–3.3.3; L2 §6.3.3; MF §16.1.5; Goldberg; Dawson; ECMA-262 | 2.5             | 0-06       |
| 2.10   | El azar con semilla                                  | C   | ¿Cómo se reparte algo al azar, y siempre igual para la misma partida?                  | **G** §5.7; **MA** §8.1–8.1.4, §3.2.2, §5.2.9; O'Neill; Vigna; Eiserloh                                                                | 2.9             | 0-04       |
| 2.11 ◇ | Muchas cosas a la vez                                | C   | ¿En qué orden avanzan muchas cosas en un paso, y qué pasa si una aparece o desaparece? | **GPP** ch. 10, ch. 8; G2 §17.6.3; E §2.4.2                                                                                            | 2.4             | —          |
| 2.12   | Reglas: el estado del juego                          | C   | ¿Cómo se dice cuándo se juega, se gana, se pierde y se vuelve a empezar?               | **GPP** ch. 7, ch. 4; MA §5.3; G §1.5.15; G2 §17.10                                                                                    | 2.11            | —          |
| 2.13   | El juego: juntar las monedas                         | P   | ¿Qué le falta a la pelota para tener un juego contra el reloj?                         | GPP ch. 4                                                                                                                              | 2.8, 2.10, 2.12 | —          |
| 2.14   | Repeticiones: lo mismo, otra vez                     | C   | ¿Qué hay que guardar para que una partida se repita idéntica?                          | **G** §8.5.2.4; GPP ch. 2; E §2.7.1; G2 §14.1.3.2, §17.8.9.1; L1 2.7.2; MA §9.3.1; Fiedler; Rapier's determinism page                  | 2.9, 2.10, 2.13 | 1-05       |
| 2.15   | Tu fantasma                                          | P   | ¿Cómo se corre contra la propia mejor vuelta?                                          | GPP ch. 2                                                                                                                              | 2.14            | 1-05       |

The project gains:

- **2.6:** `loop.ts`: the accumulator, α, a cap on catching up, the frame callback that is not the step, a clamp after
  a hidden tab. `clock.ts`: time as a whole count of steps, with pause, single step and a view-only timescale. A free
  debug camera. `console.ts`, the registry with its three kinds: `pause`, `step`, `view.timescale`, `show.axes`,
  and log channels. The turret's lock-on now turns in time, with 2.3's exact factor, and is drawn between two states
  (slerp by α).
- **2.8:** `input.ts` grows `isDown`, `pressed` and `released` per step, and commands that carry their step; `onPress`
  stays. The ball is driven by actions: a direction, normalized, times speed, approached with 2.3's factor. It jumps
  under gravity with semi-implicit Euler, with the floor as a clamp. The pilot's autopilot drives the same actions.
- **2.13:** `rng.ts`: a master seed that seeds one stream per system. `trig.ts`: our own sine and cosine (2.9's rule).
  Phases become a state machine with events. Coins are placed from the seed, and the timer counts steps. The turret is
  the antagonist: it fires when the ball is inside its cone, and a hit costs seconds. Text on screen, restart, and the
  console's `seed` and `restart`. A first "Patrón" box on how the code is organized (GPP ch. 1).
- **2.15:** `record.ts` keeps the inputs, the seed and a version. `hash.ts` hashes the state, with quaternions in
  canonical sign. The ghost is drawn from a replay, and hashes find the first step where two runs diverge.

Decided here:

- **Integration is taught as solving an ordinary differential equation,** in three places, each when it is needed.
  2.2: the state (_x_, _v_), the equation, Euler's step as following the tangent, explicit and semi-implicit side by
  side, and the error after time _t_ of about ½_at_Δ_t_ (first order: halve the step, halve the error). Its "Más a
  fondo" says why the project takes semi-implicit (Rapier's), pointing to 4.2. 2.3: the first-order relaxation
  **ẋ** = (**x**\* − **x**)/τ, Euler's factor 1 − _h_/τ (monotone, oscillating, unstable at _h_ > 2τ), and the exact
  factor _e_^(−*h*/τ). That is frame-rate-independent smoothing, the old tutorial's trap made a theorem. 4.2: the
  oscillator in phase space, where explicit Euler's determinant is 1 + ω²_h_² and semi-implicit's is exactly 1.
- **Inputs before moving** (G): "Moverse" uses actions from its first line.
- **Smoothing has its own lesson** (G's "second equation"), out of the clock lesson, which keeps pause, slow motion,
  single steps, timelines as affine maps between time axes, and the free camera on the real clock.
- **Interpolate, never extrapolate** (GPP's extrapolation is shown failing, drawn inside a wall). The drawn frame is
  a sampling of the simulation: a "Sutileza" recalled in 8.9 (RTR).
- **Game time is a whole count of steps** (G), so 2.9 opens with G's broken float clock, with our corrected numbers.
- **2.9 sets the project's rule:** + − × ÷ and √ are exactly rounded in every browser, `Math.sin` is not (ECMA-262).
  What is hashed uses only the first, plus our own sine and cosine.
- **One stream per system from a master seed,** and random decisions that do not flicker (MA). The state-machine
  vocabulary (entry and exit actions, conditions) goes in 2.12, so 7.8 can start at hierarchy (MA). "A mind drives
  the same actions as the player" is said in 2.7 (MA).

### Parte 3. Formas y choques: closing game _el laberinto_

The part's introduction page shows E's reduction graph, lit up as the lessons are done. Every test is shown twice:
first the equation, then the picture that rejects early (RTR). Every lesson has a "Se reduce a…" line.

| #      | Lección                                       | K   | La pregunta que responde                                                               | Fuentes                                                                                   | Antes               | ←    |
| ------ | --------------------------------------------- | --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------- | ---- |
| 3.1    | Mallas: vértices, triángulos, sentido         | C   | ¿De qué está hecha una forma, y cómo se sabe qué cara mira afuera?                     | **L1** 3.1; RTR 16.2–16.4; L2 §5.5.1–5.5.2; G2 §11.3.6; E §12.1–12.3                      | 1.6, 1.8            | —    |
| 3.2    | Normales                                      | C   | ¿Hacia dónde mira una superficie, y qué le pasa a esa dirección al estirarla?          | **L1** 3.2; RTR 16.3.4, 4.1.7, 5.3.1; L2 §7.2; E §12.4.2                                  | 3.1, 1.10           | —    |
| 3.3    | Rectas, rayos y segmentos                     | C   | ¿Cómo se describe un camino recto, y a qué distancia pasa de un punto?                 | **L1** 3.3; E §3.5, §5.1.2; RTR 22.2; MA §3.3.14 (sign corrected); G §5.6.1               | 1.5, 1.6            | —    |
| 3.4    | Planos                                        | C   | ¿De qué lado de una pared está algo, y dónde la cruza un rayo?                         | **L1** 3.4; L2 §6.4, §9.1; RTR 22.10, 22.14.1; E §3.6; MF §13.3.2; G §5.6.3               | 3.3, 1.10           | —    |
| 3.5    | Señalar con el mouse                          | P   | ¿Qué punto del piso está debajo del mouse?                                             | RTR 22.1; L2 §6.1, §6.3.1; G2 §14.5.3.2                                                   | 3.4, 1.11           | —    |
| 3.6 ◇  | Coordenadas baricéntricas                     | C   | ¿Cómo se dice dónde está un punto dentro de un triángulo?                              | **E** §3.4, §5.4.2; RTR 22.8; L2 §5.5                                                     | 3.4                 | —    |
| 3.7    | El punto más cercano                          | C   | ¿Cuál es el punto de una forma más cerca de otro, y por qué casi todo se reduce a eso? | **E** §5.1.1–5.1.5, §5.1.9, §3.10                                                         | 3.3, 3.6            | —    |
| 3.8    | Volúmenes que envuelven                       | C   | ¿Cómo se pregunta rápido si dos cosas pueden estar tocándose?                          | **E** §4.1–4.3, §4.5; RTR 22.2–22.4, 22.13; L2 §9.3; G §5.6.2–5.6.7; MF §12.1–12.3        | 3.7, 1.11           | —    |
| 3.9    | Rayos contra formas                           | C   | ¿Dónde choca un rayo con una esfera, una caja o un triángulo?                          | **E** §5.3, §5.4.2; **RTR** 22.5–22.9; G2 §14.3.5.1–2; Quilez                             | 3.6, 3.8            | 2-05 |
| 3.10   | El eje que separa                             | C   | ¿Cómo se prueba que dos formas convexas no se tocan?                                   | **E** §4.4, §5.2.1, §3.8; RTR 22.13; L2 §9.4.2–9.4.3; MF §13.4; G2 §14.3.5.3–6; Gregorius | 3.8                 | —    |
| 3.11 ◇ | Convexidad y la suma de Minkowski             | C   | ¿Por qué agrandar una forma y achicar la otra no cambia la pregunta?                   | **E** §3.8, §3.11, ch. 9 intro, §4.5; RTR 22.14                                           | 3.7, 3.10           | —    |
| 3.12   | Muchos objetos: partir el espacio             | C   | ¿Cómo se evita probar cada par entre cientos de cosas?                                 | **E** ch. 7, ch. 6; **GPP** ch. 20; RTR 19.1; MF §12.4; Catto (2019)                      | 3.8                 | 1-01 |
| 3.13 ◇ | El presupuesto del cuadro                     | C   | ¿Cuánto tarda cada cosa, y cómo se mide antes de optimizar?                            | **G** §2.3, §10.8; RTR 18.2; the browsers' profilers                                      | 3.12, 2.4           | —    |
| 3.14   | Chocar con las paredes, y deslizarse          | P   | ¿Cómo se queda la pelota fuera de las paredes, y se desliza en vez de frenar?          | E §5.2.5–5.2.7; RTR 22.13.2, 22.14; G2 §14.3.7.2, §14.3.8, §14.5.3.6; Fauerby             | 3.7, 3.8, 3.12, 2.8 | —    |
| 3.15   | Lo que va rápido atraviesa                    | C   | ¿Cómo se sabe si algo chocó entre un paso y el siguiente?                              | **E** §5.5, §2.4.3; G2 §14.3.5.7; Catto (2013)                                            | 3.9, 3.11, 3.14     | 2-05 |
| 3.16 ◇ | Que nada atraviese el piso: geometría robusta | C   | ¿Por qué una pelota se cuela entre dos triángulos, y cómo se diseña para que no pase?  | **E** §11.3.2–11.5, §12.1–12.3, §2.6; L1 3.3.2–3.3.3                                      | 2.9, 3.9, 3.14      | —    |
| 3.17   | El juego: el laberinto                        | P   | ¿Cómo se juega un laberinto distinto para cada semilla, y siempre con salida?          | MA §8.4.1–8.4.2; E §7.4.2; Buck                                                           | 3.13, 3.15, 2.10    | —    |

The project gains:

- **3.5:** `pick.ts`: a ray through a pixel (the inverse of the projection and the view), against the floor's plane.
  The point under the mouse is drawn, and a click marks a spot or a target.
- **3.14:** `collide.ts`: the closest point on a box, pushing out by the depth, and sliding by removing the normal
  part ("a contact with _e_ = 0 and no friction", recalled in 4.3). Several walls in one step are iterated. Walls are
  boxes on a grid broad phase. Collision shapes are not the drawn meshes, walls filter by group and have a material,
  and 3.13's frame bar comes in.
- **3.17:** a maze from a seed. Depth-first backtracking makes a spanning tree, with a few loops added: 7.2's first
  graph. The ball's dash uses the swept test. Turrets at the junctions see the ball only along a clear ray. Coins, an
  exit, a timer, and the console's `maze.seed` and `show.colliders`.

Decided here:

- **E's order:** the closest point before the bounding volumes, barycentric coordinates before ray–triangle, the
  separating axis (2D, then 3D's edge × edge axes, then the least-overlap axis as normal and depth) before Minkowski.
  Tunnelling comes after the walls, because a slow ball works with static tests and speeding it up is the part's best
  "El problema" (E over G2). Robustness comes last, when there is something to make robust.
- **3.5 picks the floor only,** with a ray and a plane. Picking objects closes 3.9 (RTR).
- **The plane–box test by projected extent goes in 3.4** (RTR). The frustum's six planes wait for culling (8.14).
  Polygon clipping waits for 4.10, where contact manifolds first need it (L2 put it in 3.4).
- **Zones and portals stay out of the maze,** which needs neither. They enter in 6.4, 7.10, 8.14 and 10.7.
- **One broad-phase lesson,** with the BVH as a section, taken further in 8.14 (E's own fallback). Its figure is a
  crowd of hundreds of balls, since the maze alone has too few objects to show the _n_² wall (GPP).
- **Profiling here** (G): the broad phase is the first algorithm whose cost the reader can measure.

### Parte 4. La física: closing game _voltear la torre_

The introduction page asks "¿Querés física en tu juego?" (G2 §14.1). Physics costs control and predictability, and
the design decides the physics. The part climbs MF's staircase. Everything a particle can do is built by hand, played
in a toy engine, and hashed. Rigid rotation is taught with figures and small hand computations. Rapier takes over when
boxes have to rotate, stack and rest: exactly where hand-built engines need a hundred pages of special cases.

| #      | Lección                                               | K   | La pregunta que responde                                                     | Fuentes                                                                                       | Antes            | ←    |
| ------ | ----------------------------------------------------- | --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------- | ---- |
| 4.1    | Fuerzas y masa                                        | C   | ¿Qué hace una fuerza con algo que tiene masa?                                | **MF** ch. 3, §4.1, ch. 5; G2 §14.4.1–14.4.3; MA §3.1.3; Witkin and Baraff                    | 2.2              | —    |
| 4.2    | Resortes                                              | C   | ¿Por qué un resorte duro explota, y qué dice eso de los choques?             | **MF** ch. 6; G2 §14.4.4; Catto (2009); Holden                                                | 4.1, 2.3, 1.8    | —    |
| 4.3    | Impulsos y choques                                    | C   | ¿Cómo cambia una velocidad de golpe cuando dos cosas chocan?                 | **MF** §7.1–7.2.2 (corrected); G2 §14.4.7.1–4; E §5.2.1; Catto (2006)                         | 4.2, 3.7         | —    |
| 4.4    | Muchos contactos a la vez: reposo, cuerdas y varillas | C   | ¿Cómo se queda quieto algo apoyado, y qué es una cuerda para la física?      | **MF** §7.2.3–7.5, ch. 8; G2 §14.4.8; Jakobsen                                                | 4.3              | —    |
| 4.5    | Rozamiento y rebote                                   | C   | ¿Qué decide si algo resbala, se frena o rebota?                              | **MF** §15.2–15.4, §16.1.2, App. B; G2 §14.4.7.5                                              | 4.4              | 3-05 |
| 4.6    | Un motor de juguete                                   | P   | ¿Puede el proyecto tener una física escrita por nosotros y entendida entera? | MF ch. 8, Project 8.1                                                                         | 4.5, 3.14, 2.14  | —    |
| 4.7 ◇  | Girar en el plano                                     | C   | ¿Qué hace girar algo, y cuánto le cuesta?                                    | **G2** §14.4.5; MF §9.1.3, §10.1–10.3                                                         | 4.1, 1.6         | —    |
| 4.8    | La inercia en el espacio                              | C   | ¿Por qué un libro que gira en el aire da vueltas raras?                      | **G2** §14.4.6; **MF** §10.2, App. A; L1 2.1.3, 2.7; Witkin and Baraff                        | 4.7, 1.11, 1.15  | —    |
| 4.9    | Choques que hacen girar                               | C   | ¿Cómo hace girar un choque que no pega en el centro?                         | **MF** ch. 14, §15.4; L1 1.5.2; Catto                                                         | 4.8, 4.3         | —    |
| 4.10 ◇ | Del choque al contacto: puntos, normal, profundidad   | C   | ¿Dónde se tocan dos cajas, y por qué un punto no alcanza?                    | **MF** ch. 13; L2 §9.1; E §9.5; Gregorius (2015)                                              | 4.9, 3.10, 3.4   | —    |
| 4.11   | Un motor de física                                    | P   | ¿Qué hace Rapier de lo que ya construimos, y cómo se le habla?               | **G2** §14.5.1–14.5.2; MF §17.1, ch. 20; E §2.2–2.4; Rapier's guide                           | 4.6, 4.10        | 1-00 |
| 4.12   | Cuando la física falla: estabilidad y sueño           | C   | ¿Por qué una pila tiembla o se hunde, y qué perillas lo arreglan?            | **MF** ch. 16, §15.5; G2 §14.3.5.7, §14.4.10; Catto (islands, Solver2D, continuous collision) | 4.11             | —    |
| 4.13   | La masa: empujar y agarrar                            | C   | ¿Cómo se empuja una caja pesada, y cómo se agarra una liviana?               | G2 §14.4.8.8, §14.5.1.4, §14.5.3.1; MF §6.2.2, §10.3.1                                        | 4.11             | 3-06 |
| 4.14   | Tirar cosas                                           | P   | ¿Hacia dónde hay que disparar para pegarle a algo lejos?                     | **MA** §3.5.1–3.5.5 (corrected); MF §4.1, §17.2.3; GPP ch. 19; G2 §14.5.3.2–3                 | 4.12, 4.13, 1.16 | —    |
| 4.15   | El juego: voltear la torre                            | P   | ¿Cuántos tiros hacen falta para tirar la torre?                              | G2 §14.5.3.4–5                                                                                | 4.14             | —    |

The project gains:

- **4.6:** `physics/`: particles with inverse mass, force generators (gravity, drag, wind), springs, contacts between
  balls and against half-spaces and 3.14's walls, and the iterative resolver with ties broken by index. Rods and
  cables are contacts that are always generated. A rope bridge spans a gap in the maze, and billiard balls collide.
  The hash still matches across browsers.
- **4.11:** Rapier, pinned in its deterministic build, behind a small boundary. The kinds of body: dynamic, kinematic
  moved by velocity, fixed. The order around the step: game-driven bodies, forces, the step, reading back, then
  queries. Sensors, the event queue, collision groups, and `show.physics` from Rapier's debug render. The toy engine
  stays for particles and effects.
- **4.14:** the turret becomes a cannon. The firing solution is a quadratic in _t_², with its envelope of reachable
  points. Projectiles come from a pool, with continuous collision for the fast ones, wind as a force generator, and an
  explosion's impulse.
- **4.15:** a tower of boxes, a limited number of shots, a score for blocks knocked off the platform, sleep shown,
  restart.

Decided here:

- **Springs come before impulses** (MF): a reader who has watched a stiff spring explode knows why contacts are not
  forces. The oscillator's phase-space determinant, with semi-implicit Euler's eigenvalues on the unit circle while
  ω_h_ ≤ 2, is the main path of 4.2, with 2.3's question asked again in two dimensions.
- **Rotation is split in two:** 2D first, then 3D (G2), which is also MF's split into rotation and inertia. In 3D the
  state is angular momentum, with the gyroscopic term **ω** × **Iω** and the middle-axis tumble. **q̇** = ½**ω**_q_ is
  derived, and renormalizing is projecting back onto the 3-sphere of 1.15.
- **Contact generation comes before Rapier** (MF), with polygon clipping (L2) and GJK as a "Más a fondo" (E's optional
  lesson). Stability and sleep come after the switch, measured on Rapier with toggles (MF).
- **A two-column dictionary** grows through 4.7–4.9: every angular law is the linear one again, with a matrix or a
  quaternion in place of a number (MF).
- **Joints move to part 5,** beside the skeleton (MF).

### Parte 5. Un personaje: closing game _plataformas contra el reloj_

| #      | Lección                                         | K   | La pregunta que responde                                                            | Fuentes                                                                                             | Antes               | ←          |
| ------ | ----------------------------------------------- | --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| 5.1    | Un personaje no es un cuerpo                    | C   | ¿Por qué un personaje no se simula como una caja?                                   | **G2** §14.5.3.6, §18.2.1; Rapier's character controller; MA §3.1.1, §3.8; E §5.5.7; Catlike Coding | 4.11, 3.15          | 1-02       |
| 5.2    | El personaje del proyecto                       | P   | ¿Cómo se arma un personaje con piezas que se suman?                                 | **GPP** ch. 14                                                                                      | 5.1, 2.7            | 1-02       |
| 5.3 ◇  | Un salto que se siente bien                     | C   | ¿Qué gravedad y qué impulso dan el salto de la altura y el largo que pide el nivel? | Pittman; Thorson; MA §3.6                                                                           | 5.1, 2.2            | —          |
| 5.4    | Modos de moverse                                | C   | ¿Cómo se ordena lo que el personaje puede hacer en cada momento?                    | **GPP** ch. 7; G2 §13.10; G §9.5                                                                    | 5.2, 2.12           | 2-02       |
| 5.5    | La cámara que sigue, también contra las paredes | C   | ¿Cómo sigue la cámara sin marear, y sin meterse en las paredes?                     | **G2** §14.5.3.7, §18.2.2; MF §6.3.2; Holden; Haigh-Hutchinson; Nesky; L2 Ex. 6.5                   | 4.2, 3.15, 1.16     | 1-03, 3-07 |
| 5.6    | El personaje salta, y la cámara lo sigue        | P   | ¿Cómo se juntan en el proyecto el salto, los modos y la cámara?                     | —                                                                                                   | 5.3, 5.4, 5.5       | —          |
| 5.7    | Capacidades como datos                          | C   | ¿Cómo se le da al personaje un doble salto sin reescribirlo?                        | **GPP** ch. 13, ch. 12, ch. 11; G2 §17.3.3                                                          | 5.4                 | 2-03       |
| 5.8    | Marcos que se mueven: plataformas               | C   | ¿Cómo lleva una plataforma al que está parado encima?                               | **L1** 2.1, 2.6; **G2** §13.11.1, §17.6.3; Catlike Coding                                           | 5.2, 1.11           | 2-04       |
| 5.9    | Curvas                                          | C   | ¿Cómo se describe un camino suave que pasa por puntos dados?                        | **RTR** 17.1; G2 §13.4.5, §13.6.2.2; MA §3.3.12; Pomax; Holmér                                      | 1.4, 2.2            | —          |
| 5.10 ◇ | Articulaciones                                  | C   | ¿Cómo se unen dos cuerpos para que giren o se deslicen solo como se quiere?         | MF §17.2.1; G2 §14.4.8; Rapier's joints; Catto                                                      | 4.11, 4.4           | —          |
| 5.11   | Un nivel que se mueve                           | P   | ¿Cómo se arma un nivel de plataformas que se mueven, se balancean y dan poderes?    | —                                                                                                   | 5.7, 5.8, 5.9, 5.10 | —          |
| 5.12   | El esqueleto y la piel                          | C   | ¿Cómo mueve un esqueleto a la malla que lo cubre?                                   | **G2** §13.1–13.3, §13.5; RTR 4.4–4.5; GPP ch. 18; glTF                                             | 1.11, 1.15          | 2-06       |
| 5.13   | Clips, tiempos y mezclas                        | C   | ¿Cómo se pasa de caminar a correr sin saltos en la animación?                       | **G2** §13.4, §13.6, §13.9, §13.10.1–2                                                              | 5.12, 2.5, 5.9, 3.6 | 2-06       |
| 5.14   | Cinemática inversa                              | C   | ¿Cómo se dobla una pierna para que el pie toque el escalón?                         | **L1** 1.5, Ex. 2.14; G2 §13.7.2, §13.11.3–4; Holden; Quilez; FABRIK                                | 5.12, 1.15          | ML 1.8     |
| 5.15   | El personaje con cuerpo                         | P   | ¿Cómo se carga un personaje animado y se lo ata a lo que hace?                      | G ch. 7; glTF                                                                                       | 5.13, 5.14, 5.6     | 2-06       |
| 5.16   | El juego: plataformas contra el reloj           | P   | ¿Cómo se juega un nivel de plataformas contra el reloj?                             | G2 §13.12, §17.6.3.1                                                                                | 5.11, 5.15          | —          |

The project gains:

- **5.2:** `character/` as components: a body (a kinematic capsule that moves and slides by shape casts), a motor,
  input and a camera rig. The player is now the character. The guard will drive the same components in 7.7.
- **5.6:** a jump derived from its height and its time to the top, with stronger gravity falling, coyote time and a
  buffered press. Modes as a state machine. The follow camera uses an exact critically damped spring, and a sphere
  cast pulls it in against walls.
- **5.11:** platforms that follow curves by arc length, a hinged bridge and a swinging platform (joints), and
  pickups that grant capabilities (double jump, dash) as data. The update order puts the platform before its rider.
- **5.15:** a glTF character (the asset pipeline capsule), clips blended by speed, an action state machine that
  follows 5.4's modes, and feet placed on steps by two-bone IK.
- **5.16:** checkpoints, a timer, the best time kept, and 2.15's ghost again.

Decided here:

- **Component in 5.2, Type Object in 6.1** (GPP). 5.7 keeps GPP's middle road: data selects among coded behaviours,
  with parameters. It names the Subclass Sandbox and warns against growing a language.
- **State's full ladder in 5.4:** flags, an enum, state objects, concurrent and hierarchical machines (GPP), with
  context-sensitive input (G).
- **Skeleton and clips are two lessons** (G2): the skinning matrix as a round trip through joint space, then clips
  as affine time maps, blends of local poses as weighted averages, and the action state machine. Curves come first,
  because cross-fades need their continuity classes and ease functions (G2). The dirty-flag pattern, with its counting
  argument, goes in 5.12, where its conditions hold (GPP).
- **Joints come before the skeleton** (MF), as constraints that remove degrees of freedom.
- **The jump from its conditions** is new: a model of L2's method, and what Manifold's platformer needs in phase 5.
- **Platforms carry the update-order lesson** (G2), seeded by a paragraph in 2.11. The one-step lag is visible when
  the order is wrong.
- **Resources move to 6.2,** where counting references across level changes is the problem. 5.15 loads one model,
  with a short section.
- **A "Más a fondo" in 5.9:** a frame that follows a curve, the design draft's early taste of strange worlds,
  pointing to 10.5.

### Parte 6. Un mundo que responde: closing game _la sala de sigilo_

| #      | Lección                                   | K   | La pregunta que responde                                                             | Fuentes                                                                               | Antes                      | ←          |
| ------ | ----------------------------------------- | --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| 6.1    | El mundo como datos                       | C   | ¿Cómo se describe un mundo entero sin escribir una clase por cosa?                   | **GPP** ch. 13, ch. 14, ch. 5; **G2** §16.1–16.3, §17.2, §17.3.3, §17.5.3             | 2.11, 5.7                  | 2-00, 3-00 |
| 6.2    | Recursos: cargar una vez, soltar a tiempo | C   | ¿Cómo se carga cada modelo una sola vez, y cuándo se suelta?                         | **G** ch. 7, §6.1–6.2, §3.2, §1.6; glTF; three.js's disposal                          | 6.1, 1.3                   | —          |
| 6.3    | Niveles como texto                        | P   | ¿Cómo se escribe un nivel en un archivo y se lo carga?                               | —                                                                                     | 6.1, 6.2                   | 2-00       |
| 6.4    | Zonas que notan quién entra               | C   | ¿Cómo sabe el mundo que alguien entró o salió de un lugar?                           | **GPP** ch. 4; G2 §14.3.7.3, §17.8.1–8; E §4.2.1, §7.7; MA §11.1–11.2                 | 6.3, 3.8, 2.12             | 2-01       |
| 6.5 ◇  | La cola de eventos                        | C   | ¿Cómo se avisa algo para después, en un orden que no dependa de la suerte?           | **GPP** ch. 15; **G2** §17.8.9                                                        | 6.4                        | —          |
| 6.6    | Señales y mecanismos                      | C   | ¿Cómo se conecta una palanca con una puerta sin que se conozcan?                     | **G2** §17.8.10–11; GPP ch. 8; MA §11.2.3                                             | 6.5, 2.11                  | 3-00       |
| 6.7    | Puertas, palancas y placas                | P   | ¿Cómo responde el nivel a lo que hace el jugador?                                    | —                                                                                     | 6.6                        | —          |
| 6.8    | La luz como lógica, y la vista            | C   | ¿Cuánta luz le llega al jugador, y quién lo puede ver?                               | **L2** §8.1.1–8.1.3, §9.5; **RTR** 5.2; G2 §12.2.4.3–5, §12.4.2; MA §6.1.3, §11.4.3–4 | 6.4, 3.9, 1.5              | 3-01       |
| 6.9    | El sonido en el espacio                   | C   | ¿Qué tan fuerte, y de qué lado, se oye algo?                                         | **G2** §15.1, §15.3.2.1, §15.4; W3C Web Audio; MDN                                    | 6.8, 3.9                   | —          |
| 6.10   | El sonido sale de los eventos             | P   | ¿Cómo suena lo que pasa en el juego, sin sonar dos veces ni trabarlo?                | **GPP** ch. 15, ch. 16; **G2** §15.5; Wilson; jsfxr                                   | 6.9, 6.5                   | 3-03       |
| 6.11   | Lo que se rompe                           | C   | ¿Cómo se rompe algo en pedazos sin que el juego se trabe?                            | G2 §14.5.3.5, §16.1.1.1; MF §17.2.2; GPP ch. 19                                       | 6.5, 4.11                  | 3-02       |
| 6.12   | La interfaz: del mundo a la pantalla      | C   | ¿Cómo se marca en la pantalla algo que está en el mundo, aunque esté fuera de vista? | G2 §12.8; GPP ch. 4; decision 0019                                                    | 6.4, 1.10                  | 3-08       |
| 6.13   | Guardar como datos                        | C   | ¿Qué hay que guardar para seguir una partida otro día?                               | **G2** §17.4.5, §17.5; GPP ch. 18; Rapier's serialization; decision 0020              | 6.1, 2.14                  | 3-04       |
| 6.14   | Un calabozo con una semilla               | C   | ¿Cómo se inventa un nivel distinto para cada semilla, que siempre se pueda jugar?    | **MA** §8.4; Shaker et al.; Nystrom ("Rooms and Mazes"); Kazemi                       | 6.3, 3.17, 2.10            | 3-10       |
| 6.15 ◇ | Un nivel que se prueba solo               | C   | ¿Cómo se sabe, sin jugarlo, que un nivel sigue andando?                              | E §2.7.1; G §8.5.2.4                                                                  | 6.14, 2.14                 | 3-09       |
| 6.16   | El juego: la sala de sigilo               | P   | ¿Cómo se cruza una sala vigilada sin que te vean?                                    | G2 §17.10                                                                             | 6.7, 6.8, 6.10, 6.12, 6.13 | —          |

The project gains:

- **6.3:** `level/`: a text format, kinds as data, ids and handles, spawners. `resources.ts`: a registry, counts kept
  across levels, disposal, and a visible placeholder for a missing asset.
- **6.7:** zones (sensors) that send enter and exit events. The event queue: a ring buffer, a delivery step, ties
  broken by a fixed rule. Signals wired as data: plates, levers, and doors with delays, double-buffered.
- **6.10:** sounds from events, through the queue: aggregated, instances limited, varied by a seeded stream.
  Positional audio on the listener, an audio service located (silent in tests), and scheduling on the audio clock.
- **6.16:** watchers (the turrets, as cameras) that see by light, by cone and along a line of sight. Lamps to break,
  noise, a door to open with mechanisms, markers on screen, saving at checkpoints, and the level tested by a recorded
  solution.

Decided here:

- **Sound is split in two** (G2). 6.9 is the concept: decibels, 1/_r_ between a minimum and a maximum, the listener's
  frame, constant-power panning (sin² + cos² = 1), occlusion by rays. 6.10 takes it into the project.
- **The event queue has its own lesson, before signals.** A queue decouples _when_, where Observer decouples _who_
  (GPP). Delayed signals are its first need, with delivery times, priorities and a tie-breaking rule (G2). Sound uses
  it after.
- **Light as logic is physical** (L2): sources with units and a windowed falloff, spot cones, **n**·**l**. The meter
  is computed in linear quantities, never from encoded colours. A watcher sees the brightest part of the body, not
  its average (MA).
- **Hearing is a straight line here,** and its flaw through walls is shown on purpose, as 7.10's hook (MA).
- **Zones are rooms, and their doorways are portals,** the room graph 7.10 walks.
- **"Un nivel que se prueba solo"** stays (old 3-09): the determinism thread paid back as tests (E's regression
  suite). Rewinding time as a mechanic, a ring of snapshots, is a "Más a fondo" of 6.13, distinct from networking
  (decision 0016).

### Parte 7. Mentes: closing game _el guardia te persigue_

The introduction page shows MA's layered model (movement, decisions, strategy, with world interfacing and execution
management), and the perception window. The player sees a guard only briefly, so its changes of mind must read, and
the guard knows only what it perceives.

| #     | Lección                                               | K   | La pregunta que responde                                                            | Fuentes                                                           | Antes          | ←      |
| ----- | ----------------------------------------------------- | --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- | ------ |
| 7.1   | Dirigirse I: buscar, llegar, girar                    | C   | ¿Cómo llega algo a un punto sin pasarse ni dar vueltas?                             | **MA** §3.1–3.3.10; MF Ex. 10.4–10.5; Reynolds; Shiffman          | 2.3, 2.8, 1.16 | ML 5.3 |
| 7.2   | Grafos y el camino más corto: Dijkstra                | C   | ¿Cuál es el camino más corto entre dos lugares de un laberinto?                     | **MA** §4.1–4.2; Red Blob Games                                   | 3.17, 2.10     | —      |
| 7.3   | A\*: buscar con una estimación                        | C   | ¿Cómo se encuentra el camino más corto mirando menos?                               | **MA** §4.3; Red Blob Games; Hart, Nilsson and Raphael            | 7.2            | ML 4.5 |
| 7.4   | Mallas de navegación                                  | C   | ¿Por dónde se puede caminar en un nivel que no es una grilla?                       | **MA** §4.4, §12.1; E §5.4.1, §12.2; Recast                       | 7.3, 3.6, 1.6  | —      |
| 7.5 ◇ | Seguir un camino                                      | C   | ¿Cómo se camina un camino planeado sin chocar las esquinas?                         | **MA** §3.3.12; Mononen (funnel)                                  | 7.4, 3.3       | —      |
| 7.6   | Dirigirse II: anticipar, esquivar, combinar           | C   | ¿Cómo se esquiva a otros que también se mueven?                                     | **MA** §3.3.8, §3.3.13–15, §3.4.1–3; Reynolds; Guy and Karamouzas | 7.1, 3.3, 3.15 | ML 5.3 |
| 7.7   | El guardia patrulla                                   | P   | ¿Cómo recorre un guardia su ronda por el nivel?                                     | MA §14.1                                                          | 7.5, 7.6, 5.2  | —      |
| 7.8   | Los modos del guardia: máquinas de estado jerárquicas | C   | ¿Cómo se organiza una mente que patrulla, sospecha, persigue y vuelve?              | **MA** §5.3.8–9, §5.10, §5.4; GPP ch. 7; G2 §17.9.5.6–7           | 5.4, 2.12      | —      |
| 7.9   | Lo que el guardia puede saber: ver                    | C   | ¿Qué ve el guardia, y por qué no debe saber más que eso?                            | **MA** §11.4.1–4, §6.1.3; G2 §18.2.3                              | 7.8, 6.8       | —      |
| 7.10  | Oír a través de las salas                             | C   | ¿Cómo oye el guardia un ruido a la vuelta de la esquina, y no a través de la pared? | **MA** §11.4.5; G2 §15.4.3–5; GPP ch. 20                          | 7.2, 6.9       | —      |
| 7.11  | Memoria, sospecha y búsqueda                          | C   | ¿Dónde te busca el guardia cuando te perdió de vista?                               | **MA** §6.2.6, §5.6, §11.4.3                                      | 7.9, 7.10      | —      |
| 7.12  | El guardia nota                                       | P   | ¿Cómo reacciona el guardia a lo que ve y a lo que oye?                              | MA §14.2.2–3                                                      | 7.7, 7.8, 7.11 | —      |
| 7.13  | Una mente determinista                                | C   | ¿Cómo piensa el guardia igual en cada repetición y en cada navegador?               | **MA** §10.1–10.2 (corrected); G ch. 8; GPP ch. 10                | 7.12, 2.14     | —      |
| 7.14  | El juego: el guardia te persigue                      | P   | ¿Cómo se escapa de un guardia que te busca?                                         | MA §14.1                                                          | 7.13           | —      |

The project gains:

- **7.7:** `mind/`: steering (arrive, align, avoid), A\* on the level's navigation mesh, and path following. The
  guard drives the character's components through the same actions as the player.
- **7.12:** a hierarchical state machine (patrol, suspicious, investigate, chase, search) with a suspicion level and
  hysteresis. Senses go through a knowledge model: sight by light, cone and ray; hearing over the room graph. Memory
  keeps the last known position.
- **7.14:** a search that floods out from the last known position. Minds are scheduled by step, with phases and a
  seeded stream per guard. Replays and ghosts contain the guard for free. The console gets `possess <id>` and
  `show.mind`.

Decided here:

- **Movement first** (MA): steering, then graphs, the navigation mesh, following and avoidance. Decisions come next,
  then senses, then memory. Decisions output movement requests, a path is useless without a follower, and the guard
  should move well before it thinks.
- **Three project lessons** (patrol, notices, hunts), so the guard is playable at every step.
- **Behaviour trees are a "Más a fondo" of 7.8.** The guard needs a hierarchical machine with history, and generators
  as coroutines (GPP, G2). Trees are the next reading, with the action that keeps running and the interruption.
- **The proofs are ours:** Dijkstra's invariant; A\*'s optimality with a consistent heuristic, read as reduced costs;
  "arrive" as a damped oscillator with its damping ratio ζ, the same algebra as the turret's aim in part 1.

### Parte 8. El dibujo: closing game _la sala de noche_

The introduction page has RTR's pipeline strip. Every lesson in the part carries a badge saying where in the
pipeline it is.

| #      | Lección                              | K   | La pregunta que responde                                                                               | Fuentes                                                                                           | Antes            | ←      |
| ------ | ------------------------------------ | --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 8.1    | El camino de la placa de video       | C   | ¿Qué pasa entre un triángulo y un píxel, y dónde se va el tiempo?                                      | **RTR** 2, 3.1–3.3, 18.2; L2 §5.5; G2 §11.1, §11.4.1–3; WebGL2 Fundamentals; Spector.js           | 1.11, 3.1, 3.13  | ML 2   |
| 8.2    | Tu primer shader                     | C   | ¿Cómo se le dice a la placa qué hacer con cada vértice y con cada píxel?                               | **RTR** 3.3, 3.5, 3.8; G2 §11.4.10; The Book of Shaders                                           | 8.1, 3.6         | ML 2.1 |
| 8.3    | La profundidad                       | C   | ¿Cómo sabe la placa qué está delante, y por qué a veces titila?                                        | **L2** §6.2–6.3.3; RTR 4.7.2, 23.7; G2 §11.3.10–11                                                | 8.2, 1.10, 2.9   | —      |
| 8.4 ◇  | Lo transparente                      | C   | ¿Por qué el vidrio y el humo dependen del orden en que se dibujan?                                     | **RTR** 5.5; G2 §11.3.12; L2 §5.5.3                                                               | 8.3              | —      |
| 8.5    | Luz y sombreado                      | C   | ¿Cómo se calcula de qué color se ve una superficie iluminada?                                          | **L2** §7.1–7.3; **RTR** 5.1–5.3; G2 §12.1–12.4                                                   | 8.2, 6.8, 3.2    | —      |
| 8.6    | El color no es lineal                | C   | ¿Por qué dos luces de 0,5 no se ven como una de 1?                                                     | **RTR** 5.6, 8.2; **L2** §5.2–5.3, Ex. 5.5; G2 §11.2.3, §12.7.1                                   | 8.5              | —      |
| 8.7    | La luz del proyecto                  | P   | ¿Cómo se ilumina el proyecto con luces que miden lo mismo que el juego?                                | —                                                                                                 | 8.6              | —      |
| 8.8    | Texturas                             | C   | ¿Cómo se pega una imagen sobre una superficie?                                                         | **RTR** 6.1–6.2, 6.5–6.6; L2 §7.4; G2 §11.3.14                                                    | 8.2, 3.6         | —      |
| 8.9 ◇  | Muestrear: por qué tiembla lo lejano | C   | ¿Por qué lo lejano parpadea, y cómo se evita?                                                          | **RTR** 5.4, 6.2.2                                                                                | 8.8, 2.4         | —      |
| 8.10   | Mapas de normales                    | C   | ¿Cómo parece rugosa una superficie plana?                                                              | **L2** §7.5–7.6; RTR 6.7–6.8; G2 §11.6.2                                                          | 8.8, 8.5, 1.6    | —      |
| 8.11   | Materiales físicos                   | C   | ¿Por qué el metal y el plástico reflejan distinto, y de dónde viene la luz que no sale de una lámpara? | **RTR** 9.1, 9.3, 9.5–9.8, 10.2–10.6; G2 §12.4.3–4, §12.5.2–4; LearnOpenGL                        | 8.10, 8.6, 8.9   | —      |
| 8.12   | Sombras                              | C   | ¿Cómo sabe un píxel si la luz lo ve?                                                                   | **RTR** 7.1, 7.4–7.6; **L2** §8.3; G2 §12.5.6–7                                                   | 8.3, 8.5, 1.11   | —      |
| 8.13   | Superficies y sombras del proyecto   | P   | ¿Cómo se le dan al proyecto materiales y sombras que no fallen?                                        | —                                                                                                 | 8.11, 8.12       | —      |
| 8.14   | Ver menos para dibujar más           | C   | ¿Cómo se deja de dibujar lo que no se ve?                                                              | **L2** ch. 9; **RTR** 19.2–19.9, 22.14; E ch. 6; G2 §11.5                                         | 8.1, 3.4, 3.12   | —      |
| 8.15 ◇ | Muchas copias de una malla           | C   | ¿Cómo se dibujan mil monedas en una sola llamada?                                                      | **RTR** 18.4; GPP ch. 3; three.js's instanced meshes                                              | 8.1, 3.13        | —      |
| 8.16   | Partículas, billboards y efectos     | C   | ¿Cómo se hacen chispas, humo, niebla y brillo?                                                         | **RTR** 12.1–12.5, 13.3, 13.6, 13.8, 14.2.1, 15.1–2; L2 §10.1–10.3, §8.5; MF §4.2–4.4; GPP ch. 19 | 8.4, 8.15, 4.14  | —      |
| 8.17   | El juego: la sala de noche           | P   | ¿Cómo se juega la sala cuando la sombra que ves es la que te esconde?                                  | —                                                                                                 | 8.13, 8.14, 8.16 | —      |

The project gains:

- **8.7:** lamps with physical units and a range, so that 6.8's meter and the drawn light agree. Tone mapping and
  exposure. A shader of our own for one material (a glowing coin), with the colour space handled at the output.
- **8.13:** PBR materials with textures (colour textures in sRGB, data textures linear), normal maps and light from
  the environment. Shadow maps with the bias tuned (the knob and its two failures), and the light's frustum fitted
  to the room.
- **8.17:** the stealth room at night. The drawn shadows are the same "who sees whom" as the watchers, and the
  player hides in shadows they can see. Instanced coins and debris, frustum culling with correct bounds, particles from
  a pool, fog and a post effect. The frame bar stays under budget on an integrated GPU.

Decided here:

- **The first shader comes right after the pipeline** (RTR). Every later idea is "what runs per vertex, what runs
  per pixel, what is a uniform", and the concept lessons become code to touch.
- **Transparency gets its own lesson after depth** (RTR, G2): order dependence, premultiplied alpha, depth writes off.
- **Colour comes after shading** (RTR): the convincing figure, two lights of 0,5 and 0,5, needs lights that add. L2
  wanted the full lesson before 6.8, and G2 before shading in this part. Both lose for one reason: the game's meter
  (6.8) computes in linear quantities and never touches an encoded colour. The game does not ask for the encoding
  until the reader writes light into a shader. 8.2 says, in a "Sutileza", that a custom shader must convert at the
  output, and why, pointing here.
- **Textures and sampling come before PBR** (RTR): PBR's parameters are textures, and mipmaps come before
  prefiltered environment maps. Light from the environment is part of 8.11 (RTR 10.2–10.6), or the shaded faces go
  black.
- **Phong and Blinn–Phong are derived from L2,** and PBR comes from RTR. L2's depth row is derived from conditions
  (near and far go to the ends of the range, 1/_z_ interpolates linearly, hence perspective-correct interpolation),
  with its signs converted to WebGL's [−1, 1] (L2 Ex. 6.8). Reversed depth is a "Más a fondo".
- **Planes return in 8.14:** the frustum's six planes read off the matrix, culling by signed distance, conservative
  tests that may only err one way (RTR), the BVH of 3.12, and portals as a "Más a fondo".

### Parte 9. Jugar con otros: closing game _dos pestañas, una partida_

No book covers networking. The part leans on Fiedler and Gambetta, and on Manifold's model as the main line
(decision 0016): the server orders the inputs, everyone simulates, and each copy predicts only its own character.

| #     | Lección                                  | K   | La pregunta que responde                                                                 | Fuentes                                                                                                   | Antes           | ←    |
| ----- | ---------------------------------------- | --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| 9.1   | Las mismas cuentas en todas las máquinas | C   | ¿Qué hace falta para que dos navegadores calculen exactamente lo mismo?                  | Fiedler (floating-point determinism); Dawson; ECMA-262; Catto (2024); Rapier's determinism page; L1 2.7.2 | 2.9, 2.14, 4.11 | —    |
| 9.2   | Mensajes que tardan y se pierden         | C   | ¿Qué le pasa a un mensaje entre dos computadoras?                                        | Fiedler (networking for game programmers); MDN: BroadcastChannel, WebSocket, WebRTC, Workers              | 2.4             | —    |
| 9.3   | Al mismo paso: lockstep                  | C   | ¿Cómo juegan dos copias del mismo mundo mandándose solo las teclas?                      | Fiedler (deterministic lockstep); Bettner and Terrano; Mattis (part 1)                                    | 9.1, 9.2, 2.7   | —    |
| 9.4   | Dos pestañas al mismo paso               | P   | ¿Cómo se juega el proyecto en dos pestañas a la vez?                                     | MDN: BroadcastChannel                                                                                     | 9.3             | —    |
| 9.5   | Instantáneas                             | C   | ¿Cómo se manda o se guarda el mundo entero, y cuánto pesa?                               | Fiedler (snapshot interpolation, compression); L1 2.7.2; Rapier's serialization; decisions 0000, 0004     | 6.13, 2.4, 1.15 | 1-06 |
| 9.6   | Un servidor y sus clientes               | C   | ¿Quién decide qué pasó cuando dos jugadores no están de acuerdo?                         | Gambetta (I); Fiedler (state synchronization); G2 §14.1.3.2, §17.5.3; decision 0016                       | 9.3, 9.5        | 1-07 |
| 9.7   | Predecir lo propio, y corregir           | C   | ¿Cómo responde tu personaje al instante si el servidor está lejos?                       | Gambetta (II, with its demo); decision 0016                                                               | 9.6             | —    |
| 9.8   | Ver a los otros en el pasado             | C   | ¿Dónde están los demás cuando los ves, y a quién le pegó el tiro?                        | Gambetta (III, IV); Bernier; Aldridge; decision 0016                                                      | 9.7             | —    |
| 9.9 ◇ | Volver atrás: rollback                   | C   | ¿Cómo juegan con lag los juegos de pelea sin que se note, y por qué Manifold no lo hace? | Infil; GGPO; Stallone; Mattis (part 2); decisions 0000, 0016                                              | 9.7, 9.5        | —    |
| 9.10  | El juego: dos pestañas, una partida      | P   | ¿Cómo se juega una partida entre dos pestañas, con lag de verdad?                        | —                                                                                                         | 9.8             | —    |

The project gains:

- **9.4:** `net/`: a host tab orders the inputs by step over a BroadcastChannel. Both tabs simulate, and they compare
  hashes every second.
- **9.10:** a server in a worker, with simulated latency, jitter and loss (`net.latency`, `net.loss`, `show.net`).
  Each tab predicts its own character and reconciles it by re-simulating only that character; the others are seen in
  the past. A race through the maze, with the guard.

Decided here:

- **Lockstep first,** because it is determinism and nothing else; it is also Manifold's model between tabs today.
- **Snapshots are taught with their measured weight** (571 KB, decision 0016), which is why Manifold reconciles by
  re-simulating one character. Rollback is the alternative a reader will meet in fighting games, with Manifold's
  reason for refusing it as "Dónde Manifold eligió otra cosa".
- **A hidden tab gets no frame callbacks** (MDN), so the closing game never drives its simulation from them.

### Parte 10. Mundos extraños: closing game _un nivel sobre un planeta chico_

Ahead of the engine (Manifold's phase 7), and the mathematician's part.

| #    | Lección                                   | K   | La pregunta que responde                                                                | Fuentes                                                         | Antes           | ←    |
| ---- | ----------------------------------------- | --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------- | ---- |
| 10.1 | Superficies dadas por parámetros          | C   | ¿Cómo se describe una superficie curva, y cómo se miden distancias sobre ella?          | G2 §11.3.5; L1 3.2; Crane                                       | 3.2, 1.6        | ML 5 |
| 10.2 | Distancias con signo                      | C   | ¿Cómo se describe una forma por la distancia a ella, y para qué sirve su gradiente?     | Quilez; Hart; L2 §10.8; G2 §12.5.13.1                           | 10.1, 3.7, 8.2  | —    |
| 10.3 | La gravedad que cambia de lugar en lugar  | C   | ¿Hacia dónde es "abajo" en un planeta chico, y cómo se para alguien ahí?                | G2 §14.4.9; Catlike Coding (gravity); L1 1.6, Ex. 2.14; MF §5.2 | 10.2, 4.1, 1.15 | ML 5 |
| 10.4 | Caminar sobre un planeta chico            | P   | ¿Cómo camina el personaje alrededor de un mundo redondo?                                | —                                                               | 10.3, 5.6       | —    |
| 10.5 | Llevar un marco a lo largo de una curva   | C   | ¿Cómo se lleva una dirección por una superficie sin girarla, y por qué vuelve cambiada? | Hanson and Ma; Wang et al.; Crane; L1 1.6; G2 §14.4.6.5         | 10.1, 5.9       | ML 5 |
| 10.6 | Orientación: la cinta de Möbius           | C   | ¿Cómo puede un mundo devolverte al revés?                                               | L1 1.7.2, 2.1.2, 3.2.2; Weeks                                   | 10.5, 1.8, 3.1  | ML 5 |
| 10.7 | Espacios pegados a sí mismos              | C   | ¿Qué pasa al salir por un borde y entrar por el otro?                                   | Weeks; L1 2.6; L2 §6.4, §9.7; MA §4.3                           | 10.6, 7.3, 8.14 | ML 5 |
| 10.8 | Un cuarto pegado a sí mismo               | P   | ¿Cómo se juega en un cuarto que se continúa en sí mismo?                                | —                                                               | 10.7            | —    |
| 10.9 | El juego: un nivel sobre un planeta chico | P   | ¿Cómo se juega un nivel en un mundo chico, curvo y pegado?                              | —                                                               | 10.4, 10.8      | —    |

The project gains:

- **10.4:** the engine's gravity off, and a force on each body towards the surface (−∇*d*). The character has its own
  "up", re-aligned by the shortest arc every step, and its velocity is kept tangent ("el mismo movimiento"). The camera
  is carried along.
- **10.8:** a room that wraps (a torus) and a mirrored seam (det < 0: winding and handedness flip). The guard's A\*
  uses the minimum over the room's translates as its heuristic, and queries cross the seams.
- **10.9:** a small planet with coins and a guard that walks on it (a great-circle heuristic), and a mirrored portal.

Decided here:

- **Signed distances come before gravity:** the gradient of the distance is the surface's normal and "down" for a
  planet of any shape. Marching squares, then marching cubes with their symmetry counting (orbit–stabilizer), are a
  "Más a fondo" (L2).
- **Walking on walls is adhesion, not gravity,** as Manifold's phase 7 decides: gravity belongs to the space,
  adhesion to the contact. "En Manifold" says so.
- **Parallel transport has its holonomy:** a frame carried around a loop on a sphere comes back turned by the
  enclosed area. Each discrete step is one Gram–Schmidt step (L1 1.6), and its drift is 1.15's renormalization again.
- **A "Más a fondo" in 10.7:** the projective plane, and rotations as the 3-sphere with antipodes glued
  (_q_ ≡ −*q*). It is why a turn of 360° is undone only by a second turn: 1.15 paid back.

## 6. Threads through the parts

### 6.1 Determinism: the same hash in every browser

- **The state is data** (1.3): no three.js or Rapier objects in it, and the drawing reads it.
- **The fixed step** (2.4), **a whole count of steps as time** (2.5), and **what the standard guarantees** (2.9): + − ×
  ÷ √ are exactly rounded; `Math.sin` is not. Our own `trig.ts` (2.13).
- **Seeded streams per system** (2.10), **the order within a step and double buffering** (2.11), **replays, hashes, the
  first divergent step, canonical quaternions** (2.14).
- **Shared predicates:** the same expression, in the same order, gives the same answer (3.16).
- **Ties broken by index** in the resolver (4.4), **a hand-built engine with its hash** (4.6), and **Rapier's
  deterministic build** with its conditions: same version, same construction order (4.11).
- **Event queues with a tie-breaking rule** (6.5), **seeded variation kept out of the hash**, since sound is view
  (6.10), and **a level tested by its replay** (6.15).
- **Priority queues with fixed ties** (7.2), and **minds scheduled by step, with their own streams, emitting actions**
  (7.13).
- **The drawing is outside the hash** (part 8). L2's precision engineering is its rendering face (8.3).
- **Across machines** (9.1), **lockstep** (9.3), and **Manifold's model** (9.6–9.8).
- **Renormalizing and drift** in strange worlds (10.3, 10.5).

### 6.2 "El mismo movimiento" (L1's signature)

Split a vector into the part along a direction and the part across it, act on each, put them back together. It is
introduced in 1.5. It returns in scale along a direction and reflection (1.8), Rodrigues (1.14), look-at by
Gram–Schmidt (1.16), reflection through a plane (3.4), sliding along a wall (3.14), restitution on the normal part
(4.3), friction on the tangential part (4.5), the contact frame (4.9), move-and-slide (5.1), avoidance (7.6), the
tangent frame (8.10), the velocity kept tangent (10.3) and parallel transport (10.5). Each time, the lesson says "el
mismo movimiento" and links to 1.5.

### 6.3 Tools (G ch. 10, as lessons, not only a thread)

- **Debug drawing** is born in 1.7 and used in every later figure: Rapier's debug render in 4.11, the minds' overlay
  in part 7.
- **The game clock, the free camera and the console** come in 2.6, with recipes in every project lesson from then on.
  Cheats (no-clip, invincibility) arrive with the character (5.6).
- **Profiling** comes in 3.13, with a frame bar in every closing game from 3.17.
- **Collision debugging** follows E: a brute-force reference beside the clever test (3.9, 3.16), a ring of recent
  queries to replay, and the regression suite (6.15).
- **GPU capture** comes in 8.1 (Spector.js), and the networking lab in 9.10.

### 6.4 Patterns, where the project needs them (GPP)

| Pattern                              | Enters                                      | Returns                                 |
| ------------------------------------ | ------------------------------------------- | --------------------------------------- |
| Command                              | 2.7                                         | 2.14, 7.7, 7.13, 9.3                    |
| Observer                             | 1.17 (first), 2.12                          | 6.4, 6.12                               |
| State                                | 1.17 (enum and switch), 2.12 (machine)      | 5.4 (ladder), 7.8 (hierarchy, pushdown) |
| Game Loop                            | 2.4                                         | 2.6                                     |
| Update Method                        | 2.11                                        | 5.8, 7.13                               |
| Double Buffer                        | 2.11                                        | 6.6                                     |
| Component                            | 5.2                                         | 6.1, 7.7                                |
| Type Object (Subclass Sandbox named) | 5.7 (the middle road), 6.1                  | 6.14                                    |
| Event Queue                          | 6.5                                         | 6.10, 9.3                               |
| Service Locator (Singleton warned)   | 6.10                                        | —                                       |
| Object Pool                          | 4.14                                        | 6.11, 8.16                              |
| Dirty Flag                           | 1.11 (the algebra only), 5.12 (the pattern) | 6.13 (synchronization)                  |
| Spatial Partition                    | 3.12                                        | 7.10, 8.14                              |
| Flyweight                            | 8.15 (shared geometry mentioned in 1.3)     | —                                       |

Left out: Bytecode, and Data Locality except as typed arrays in a performance capsule.

### 6.5 Resources

Start-up and shut-down order, and disposal on reload (1.3). One glTF model and the asset pipeline capsule (5.15). The
registry, lifetimes, counts across levels and visible placeholders (6.2–6.3). Texture memory and colour spaces (8.8).
GPU memory measured in the closing game (8.17).

### 6.6 Recurring devices

- **"Una perilla, dos fallas"** (RTR), in the figures listed in §4.2.
- **"Se reduce a…"** (E), in part 3, and wherever a new test turns into a solved one (5.5's camera, 7.6's avoidance).
- **The linear ↔ angular dictionary** (MF), 4.7–4.9.
- **"Doblar las reglas"** (G2): grenades with extra drag, a designed camera, a jump that is not physical. A "Sutileza"
  on the introduction pages of parts 4 and 5, and in 4.13, 5.3, 5.5 and 6.9.
- **Design decisions in "En los motores"** (GPP), answered by Manifold's choice and its measurement.

## 7. Decisions, and questions for the author

### 7.1 Decisions made, and why

1. **Space before time; part 1 is time-free.** G, L1 and MF agree, and the pilot's thin order was the reason for this
   plan. The first game is turn-based. Actions are event-driven in part 1 and extended, not renamed, in part 2.
2. **The pilot's order and text are kept** for 1.1–1.4. Its "Moverse" becomes 2.8, after input.
3. **The projection is taught in three steps** (1.2, 1.10, 8.3) (L2 and RTR).
4. **Colour's full lesson comes after shading** (8.6) (RTR over L2 and G2), with a "Sutileza" in 1.3 and a "Más a
   fondo" in 1.4. The reason is in part 8's notes.
5. **Integration is an ordinary differential equation solved in steps,** in 2.2, 2.3 and 4.2, each when the game asks
   for it.
6. **Inputs before moving, and the game clock as a whole count of steps** (G).
7. **Part 3 grows to 17 lessons around the closest point** (E), with profiling (G). The BVH, polygon clipping and
   portals go where they are first needed.
8. **Part 4 builds a toy engine by hand and switches to Rapier at rigid contacts** (MF's staircase, with G2's 2D → 3D
   split). Joints move to part 5.
9. **Part 5 splits skeleton and clips** (G2) and adds the jump from its conditions. Resources move to part 6.
10. **Part 6 splits sound and gives the event queue its own lesson,** before signals (GPP, G2). It keeps the level
    that tests itself.
11. **Part 7 is reordered movement-first, with three project lessons** (MA). Behaviour trees are a "Más a fondo".
12. **Part 8:** the shader after the pipeline, transparency and sampling as lessons, textures before PBR, and three
    project lessons (RTR). Its closing game is the stealth room at night, so that drawing changes play.
13. **Part 9 follows Manifold's networking model** (decision 0016) as the main line. Rollback is the alternative,
    with the measured reason against it.
14. **Tools are lessons** (G): 1.7, 2.6, 3.13.
15. **One shared lab kit with visible source,** and the naive-against-correct toggle as a standing rule.
16. **Clear code first.** Reused temporaries appear only in a performance capsule with a measurement (the design
    draft's question, answered as decision 0004 already does: "when the profiler asks").
17. **One world that accumulates:** each part's game is a new mode of the same project (the floor, the turret, the
    maze, the room), not a fresh demo.
18. **The hashed simulation uses only exactly rounded operations and our own trigonometry** from 2.9, so replays and
    ghosts match across browsers from part 2.
19. **Book errors are corrected in place,** and several become "corregí al autor" exercises (§3).

### 7.2 The author's answers (2026-11-16)

The author approved this curriculum, with these answers to the questions it left:

1. **One world that accumulates**, each part's game a new mode of the same project. A narrative frame (the design
   draft's "Santuario Fracturado") is decided later, when an art direction is needed: a place more than a plot.
2. **The full plan of 146 lessons** stays; each ◇ fold is decided when that lesson is written, not now.
3. **Part 1 stays time-free**, on one condition: every concept lesson's figure is touched and dragged, and the turret
   appears early (1.7). A fresh reader said many lessons where nothing responds would make them quit.
4. **Clear code first;** reused temporaries only where a measurement asks for them (decision 0004).
5. **The project grows its own small console** (it also teaches how a console works); "En Manifold" points to the
   Dojo's.
6. **Behaviour trees stay a "Más a fondo"** (the guard uses a hierarchical state machine) and **rollback a ◇ lesson.**

## 8. Size

| Part                     | Lessons | Concept | Project | ◇ (fold candidates)   | After folding |
| ------------------------ | ------- | ------- | ------- | --------------------- | ------------- |
| 1. El espacio            | 17      | 12      | 5       | 1.9, 1.14             | 15            |
| 2. El tiempo             | 15      | 11      | 4       | 2.3, 2.11             | 13            |
| 3. Formas y choques      | 17      | 14      | 3       | 3.6, 3.11, 3.13, 3.16 | 13            |
| 4. La física             | 15      | 11      | 4       | 4.7, 4.10             | 13            |
| 5. Un personaje          | 16      | 11      | 5       | 5.3, 5.10             | 14            |
| 6. Un mundo que responde | 16      | 12      | 4       | 6.5, 6.15             | 14            |
| 7. Mentes                | 14      | 11      | 3       | 7.5                   | 13            |
| 8. El dibujo             | 17      | 14      | 3       | 8.4, 8.9, 8.15        | 14            |
| 9. Jugar con otros       | 10      | 8       | 2       | 9.9                   | 9             |
| 10. Mundos extraños      | 9       | 6       | 3       | —                     | 9             |
| **Total**                | **146** | **110** | **36**  | **19**                | **127**       |

Plus the pages before part 1 (presentation, TypeScript, notation) and an introduction page per part. The earlier
draft listed 84 lessons in parts 1–8 and left parts 9 and 10 as paragraphs. The growth is where the readers agreed:
parts 3 and 4 (E's and MF's missing lessons), part 7 (MA's movement layer and project lessons), and the splits in
parts 1, 5, 6 and 8. A fold moves a lesson's main path into its neighbour as a section, keeping its figure. A lesson
that listed the folded one as a prerequisite then points to the lesson that absorbed it; no order changes.

## Appendix A. The archived tutorial's lessons, and where they go

0-00 → 1.1–1.2 · 0-01 → 1.3 · 0-02 → 1.13, 1.15 · 0-03 → 2.2, 2.4 · 0-04 → 2.10 · 0-05 → 2.1, 2.4 · 0-06 → 2.9 ·
0-07 → 1.8–1.11 · 1-00 → 4.11 · 1-01 → 3.12 · 1-02 → 5.1–5.2 · 1-03 → 5.5 · 1-04 → 2.7 · 1-05 → 2.14–2.15 ·
1-06 → 9.5 · 1-07 → 9.6 · 2-00 → 6.1, 6.3 · 2-01 → 6.4 · 2-02 → 5.4 · 2-03 → 5.7 · 2-04 → 5.8 · 2-05 → 3.9, 3.15 ·
2-06 → 5.12, 5.13, 5.15 · 3-00 → 6.1, 6.6 · 3-01 → 6.8 · 3-02 → 6.11 · 3-03 → 6.10 · 3-04 → 6.13 · 3-05 → 4.5 ·
3-06 → 4.13 · 3-07 → 5.5 · 3-08 → 6.12 · 3-09 → 6.15 · 3-10 → 6.14. All 34 have a place; Manifold Lab's labs are
noted in the tables where they feed a lesson (ML 1.8, block 2, 4.5, 5.3, block 5).

## Appendix B. Free sources cited in the tables

Beside the nine books (all outside the repository). All were fetched or confirmed in November 2026.

- **Physics and time:** Erin Catto's GDC talks and Box2D blog, [box2d.org/publications](https://box2d.org/publications/)
  (integration 2009, impulses 2006, GJK 2010, continuous collision 2013, dynamic BVH 2019; [simulation
  islands](https://box2d.org/posts/2023/10/simulation-islands/), [Solver2D](https://box2d.org/posts/2024/02/solver2d/),
  [determinism](https://box2d.org/posts/2024/08/determinism/)) · Witkin and Baraff, _Physically Based Modeling_,
  [cs.cmu.edu/~baraff/sigcourse](https://www.cs.cmu.edu/~baraff/sigcourse/) · Glenn Fiedler, _Gaffer On Games_
  ([Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/), [Integration
  Basics](https://gafferongames.com/post/integration_basics/), [networked
  physics](https://gafferongames.com/categories/networked-physics/), [floating-point
  determinism](https://gafferongames.com/post/floating_point_determinism/)) · Thomas Jakobsen, _Advanced Character
  Physics_ (2001) · Rapier's guide, [rapier.rs/docs](https://rapier.rs/docs/) · Dirk Gregorius, _The Separating Axis
  Test_ (GDC 2013) and _Robust Contact Creation_ (GDC 2015) · Kasper Fauerby,
  [_Improved Collision Detection and Response_](https://www.peroxide.dk/papers/collision/collision.pdf) · Inigo Quilez,
  [intersectors](https://iquilezles.org/articles/intersectors/), [distance
  functions](https://iquilezles.org/articles/distfunctions/), [ray marching](https://iquilezles.org/articles/raymarchingdf/)
  · Christer Ericson's errata, [realtimecollisiondetection.net](https://realtimecollisiondetection.net/).
- **Smoothing and numbers:** Rory Driscoll, [_Frame Rate Independent Damping using
  Lerp_](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/) · Freya Holmér, _Lerp
  smoothing is broken_ (2024) and _The Continuity of Splines_ (2022) · Daniel Holden, [_Spring-It-On_](https://theorangeduck.com/page/spring-roll-call)
  · David Goldberg, [_What Every Computer Scientist Should Know About Floating-Point
  Arithmetic_](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) · Bruce Dawson, [_Comparing Floating
  Point Numbers_](https://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/) ·
  [ECMA-262, `Math`](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sin) · Melissa O'Neill,
  [PCG](https://www.pcg-random.org/paper.html) · Sebastiano Vigna, [xoshiro](https://prng.di.unimi.it/) · Squirrel
  Eiserloh, _Noise-Based RNG_ (GDC 2017).
- **Space:** Dunn and Parberry, [_3D Math Primer_](https://gamemath.com/book/) · Eater and Sanderson,
  [_Visualizing quaternions_](https://eater.net/quaternions) · Marc ten Bosch, [_Let's remove
  Quaternions_](https://marctenbosch.com/quaternions/) · Jonathan Blow, _Understanding Slerp, Then Not Using It_
  (2004).
- **Character, camera, feel, curves, animation:** Catlike Coding's [movement
  series](https://catlikecoding.com/unity/tutorials/movement/) (surface contact, orbit camera, moving the ground,
  custom and complex gravity) · Kyle Pittman, _Building a Better Jump_ (GDC 2016) · Maddy Thorson, [_Celeste &
  Forgiveness_](https://maddymakesgames.com/articles/celeste_and_forgiveness/) · Mark Haigh-Hutchinson, _Real-Time
  Cameras_ (book) · John Nesky, _50 Game Camera Mistakes_ (GDC 2014) · Pomax, [_A Primer on Bézier
  Curves_](https://pomax.github.io/bezierinfo/) · Khronos, glTF 2.0 · Daniel Holden, _Simple Two Joint IK_ · Aristidou
  and Lasenby, _FABRIK_ (2011).
- **Levels and sound:** Shaker, Togelius and Nelson, [_Procedural Content Generation in Games_](https://www.pcgbook.com/)
  · Bob Nystrom, [_Rooms and Mazes_](https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/) · Darius
  Kazemi, [_Spelunky Generator Lessons_](https://tinysubversions.com/spelunkyGen/) · Jamis Buck, [_Maze
  Generation_](https://weblog.jamisbuck.org/2011/2/7/maze-generation-algorithm-recap) · W3C, [Web Audio
  API](https://webaudio.github.io/web-audio-api/) and [MDN's guides](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
  · Chris Wilson, [_A Tale of Two Clocks_](https://web.dev/articles/audio-scheduling) · [jsfxr](https://sfxr.me/).
- **Minds:** Amit Patel, [_Red Blob Games_](https://www.redblobgames.com/) · Hart, Nilsson and Raphael (1968) ·
  Mikko Mononen, [_Recast & Detour_](https://github.com/recastnavigation/recastnavigation) and [_Simple Stupid Funnel
  Algorithm_](http://digestingduck.blogspot.com/2010/03/simple-stupid-funnel-algorithm.html) · Craig Reynolds,
  [_Steering Behaviors_](https://www.red3d.com/cwr/steer/gdc99/) · Daniel Shiffman, [_The Nature of
  Code_](https://natureofcode.com/autonomous-agents/) · Guy and Karamouzas, _Anticipatory Collision Avoidance_ (Game AI
  Pro 2), [gameaipro.com](https://www.gameaipro.com/).
- **Drawing:** [three.js manual](https://threejs.org/manual/) · [WebGL2 Fundamentals](https://webgl2fundamentals.org/)
  · [The Book of Shaders](https://thebookofshaders.com/) · [LearnOpenGL](https://learnopengl.com/) ·
  [Spector.js](https://spector.babylonjs.com/).
- **Networking:** Gabriel Gambetta, [_Fast-Paced
  Multiplayer_](https://www.gabrielgambetta.com/client-server-game-architecture.html) · Jay Mattis, [_Netcode
  Architectures_](https://www.snapnet.dev/blog/netcode-architectures-part-1-lockstep/) · Bettner and Terrano,
  [_1500 Archers on a 28.8_](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond)
  · Infil, [_Netcode_](https://words.infil.net/w02-netcode.html) · [GGPO](https://www.ggpo.net/) · Yahn Bernier,
  [_Latency Compensating Methods_](https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization)
  · David Aldridge, _I Shot You First_ (GDC 2011) · Michael Stallone, _8 Frames in 16ms_ (GDC 2018) · MDN,
  [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) and
  [Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).
- **Strange worlds:** Jeffrey Weeks, _The Shape of Space_ and [Geometry Games](https://www.geometrygames.org/) ·
  Hanson and Ma, _Parallel Transport Approach to Curve Framing_ (1995) · Wang, Jüttler, Zheng and Liu, _Computation of
  Rotation Minimizing Frames_ (2008) · Keenan Crane, [_Discrete Differential
  Geometry_](https://www.cs.cmu.edu/~kmcrane/Projects/DDG/) · John C. Hart, _Sphere tracing_ (1996).
- **Tools:** the [Chrome](https://developer.chrome.com/docs/devtools/performance) and
  [Firefox](https://profiler.firefox.com/docs/) profilers · [lil-gui](https://github.com/georgealways/lil-gui) ·
  [stats.js](https://github.com/mrdoob/stats.js).
