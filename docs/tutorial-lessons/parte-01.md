# Parte 1. El espacio: the lesson sheets

The design of every lesson of part 1, and of the three pages before it, under the approved
[curriculum](../tutorial-curriculum.md) and [decision 0021](../decisions/0021-a-new-tutorial.md). A writer follows a
sheet to write its lesson. Lesson titles are Spanish, as on the site; the rest is English. Numbers in the worked
examples were computed for these sheets; the figure must show the same ones.

Abbreviations as in the curriculum's §2: L1, L2, G, G2, RTR, E, MF, MA, GPP. "Kit" is the shared lab kit for concept
figures (curriculum §4.2), proposed here at `site/src/lessons/kit/`.

---

## The pages before part 1

These three are pages, not lessons: no "El problema", no project step. Each is short.

### Presentación

- **Question:** ¿Qué voy a aprender, cómo, y qué voy a poder hacer al final?
- **Content:** 0021's sentence of purpose and its reader (programs a little, never did graphics, physics or games;
  secondary-school mathematics is enough to start). One world that accumulates: the turret of part 1 is the antagonist
  of part 2, a sentry in part 3's maze, the cannon of part 4 and a watcher in part 6; the guard of part 7 drives the
  same character as the player. The two kinds of lesson. The lesson's five steps and its layers, with "En los motores"
  described as it now is (two or three design questions, ending in "Dónde Manifold eligió otra cosa" with its
  measurement), not as "how Unity, Unreal and Godot do it". The editor (what a change does, where it lives). The
  console, which the project builds in 2.6, and the recipe that ends every project lesson from then on. Determinism as
  a thread ("the same hash in every browser"). Manifold as the full-size engine built in public. The table of the ten
  parts with their closing games (curriculum §5), each linking to its introduction page once it exists.
- **Figure:** the closing game of part 1, playable with the keys, framed as "esto lo vas a construir en la parte 1".
  No numbers; it is a promise, not a lesson.
- **Reuses:** the pilot's `tutorial-nuevo/index.mdx`, whose parts table still lists eight parts and the provisional
  games (it must list the curriculum's ten), and whose description of "En los motores" changes as above.
- **Open:** when the turret game exists, embed it; until then, a still image of the project.

### TypeScript para quien sabe JavaScript

- **Question:** ¿Qué agrega TypeScript a lo que ya sé de JavaScript, y qué tengo que saber para leer el código del
  proyecto?
- **Content, only what the project uses, each with a line from the project:** annotations (`length(a: Vec): number`);
  `interface Vec { x: number; y: number; z: number }` against `type` (labelled tuples, `type Mat4 = [...16 numbers]` in
  `mat.ts`, `type Quat = [x: number, y: number, z: number, w: number]`); structural typing (a `Point` and a `Vec` with
  the same fields are interchangeable to the compiler, which is why 1.10 names them by role); unions of string
  literals (`type Phase = 'aiming' | 'won' | 'lost'`) and the `switch` that the compiler checks for exhaustiveness with
  `never`; `null` as a result (`toScreen` returns `null` behind the camera) and narrowing with `if`; `readonly`; `?.`
  and `??`; the `!` (non-null assertion), which the project needs because `noUncheckedIndexedAccess` makes `list[i]`
  possibly `undefined`, and why each `!` is a promise the reader must be able to justify; generics as the project
  uses them (`Map<string, number>`, `Set<string>`, `Record<Action, string[]>`, the console's `Variable<T>` in 2.6);
  `import { type Vec }` (the project compiles with `verbatimModuleSyntax`); what a type error in the editor looks like.
- **Figure:** a small editor with `vec.ts`; "Probalo" asks the reader to call `length(vec(1, 2))` and read the error,
  then to remove a `!` and read the other one.
- **Our angle:** types as documentation of what a function promises: the same reason 0021 keeps names stable.
- **Open:** whether to teach `enum` at all. The sheets use string-literal unions (erasable syntax, readable in a replay
  or a hash as text); the curriculum's word "enum" in 1.17 is read as "an enumeration", written as a union.

### La notación

- **Question:** ¿Cómo se escribe la matemática en este tutorial, y cómo se traduce lo que dicen los libros?
- **Content:** curriculum §2, the reader's columns only ("Ours" and "In code"): right-handed, +Y up but nothing assumes
  it, cameras and characters look down −Z, right is +X; column vectors, **v**′ = **Mv**, read right to left; storage
  (`Matrix4.elements` column-major, translation at 12–14, `set()` in row order); quaternions (x, y, z, w) in code and
  _q_ = (_w_, **v**) in algebra, _q_ ≡ −*q* with _w_ ≥ 0 to compare or hash; radians, positive counterclockwise seen
  from the axis's tip (about +Y, +Z turns towards +X, so a positive yaw turns the forward −Z towards −X, to the left);
  planes [**n** | _d_]; counterclockwise winding is the front; SI units, a fixed step _h_ = 1/60 s, time as a count of
  steps; semi-implicit Euler. Typography: bold vectors, hats for unit vectors, italic scalars, bold capitals for
  matrices, capital italics for points, the decimal comma. The table "qué se transforma cómo", whose rows link to the
  lesson that teaches each (1.10 points and directions, 1.15 orientations, 3.2 normals, 3.4 planes, 4.8 inertia).
  The books' columns go in a closed table at the end ("Si leés los libros"), with the warning that G and G2 write row
  vectors and that L2 uses Direct3D's conventions.
- **Figure:** none needed; the axes figure of 1.1 may be linked.
- **Open:** the page is a reference that grows; each lesson that adds a row also adds it here (a check in the test that
  reads the page could list the rows and the lessons that teach them).

---

## Part sheet

**What the reader can do at the end.** Say where things are and how far apart (coordinates, vectors); put a point of
the world on a pixel (the projection, the window); tell whether something is in front or behind, to the left or right,
inside a cone (dot and cross products); build, compose and undo transformations, and tell a point from a direction
(matrices, inverses, homogeneous coordinates); place parts on parts (spaces and hierarchies); store a rotation and
interpolate it without locking (angles, axis and angle, quaternions, slerp); turn something towards a target by the
shortest way; and make a turn-based game with phases and logical actions.

**The part is time-free.** Nothing in the project's state changes except on a discrete press. What moves in a concept
figure is a closed-form function of a parameter (an autopilot that stops at the first touch, as the pilot's figures
do), never a quantity integrated frame by frame. No smoothing per frame before 2.3 (G's rule). The author's condition:
**every concept figure is touched and dragged**, and the turret appears early: it is drawn, static, from 1.3, and it
sees from 1.7.

**The closing game, _la torreta_ (1.17).** A turret (a base that yaws, a barrel that pitches) in the middle of a floor;
targets on posts, placed from a layout. The game is turn-based: every action costs one move (a yaw step of 15°, a
pitch step of 5°, a lock-on step, a shot). The lock-on turns the aim along the shortest arc towards the selected
target in four presses, but only if that target is in front (dot > 0); a target behind needs manual turns, guided by
the hints "delante/detrás · izquierda/derecha" (the two signs of 1.7). A shot hits if the target's centre is inside the
cone of fire (half-angle 4°, range 12 m) measured from the muzzle. Win: every target down within the move budget (par
plus a margin); lose: out of moves. Score: targets hit, and moves against par. Restart, and the next layout on a win.
It exercises the dot product (front, cone), the cross product (left or right), the hierarchy (muzzle and aim read off
the barrel's world matrix; targets read in the base's frame), quaternions (the lock-on), logical actions and phases.

**How the code evolves** (each name keeps its meaning once taught, 0021):

| Lesson | Files                    | Public names                                                                                                                                                          |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3    | `view.ts`, `screen.ts`   | `createView` (with `onFrame`, `dispose`), `toScreen`                                                                                                                  |
| 1.3    | `world.ts`, `layouts.ts` | `World`, `createWorld(layout)`, `LAYOUTS`                                                                                                                             |
| 1.7    | `vec.ts`, `debug.ts`     | `vec`, `add`, `sub`, `scale`, `length`, `normalize`, `dot`, `cross`; `debug.arrow`, `debug.line`, `debug.point`, `debug.axes`, `debug.text`, `debug.flush`            |
| 1.7    | `turret.ts`              | `inFront`, `sideOf`, `inCone`, `classify`, `HEADINGS`                                                                                                                 |
| 1.12   | `mat.ts`, `turret.ts`    | `mat4.identity`, `translation`, `rotationX`, `rotationY`, `multiply`, `transformPoint`, `transformDirection`, `rigidInverse`, `column`; `turretPose`, `toBase`        |
| 1.16   | `quat.ts`, `turret.ts`   | `quat.identity`, `multiply`, `conjugate`, `rotate`, `normalize`, `fromAxisAngle`, `shortestArc`, `slerp`, `toMat4`; `lockStep`. The turret's state changes (see 1.16) |
| 1.17   | `input.ts`, `game.ts`    | `BINDINGS`, `onPress`; `Phase`, `createGame`, `act`, `onHit`                                                                                                          |

**Kit pieces the part needs** (one importable module with its source a click away; the pilot's three copies of
`scene.ts` become one): `scene` (renderer, orbit camera, lights, grid, the frame loop); `drag` (a handle on a plane, on
a sphere, along an axis, at an arrow's tip; it stops the orbit while held and stops the autopilot); `arrow` (a vector
with its label), `point`, `frame` (axes in red, green, blue), `labels`; `panel` (lil-gui rows with stable English names,
which the browser tests read); `toggle` (naive against correct); `autopilot` (stops at the first touch, a checkbox
brings it back); `inset` (a picture-in-picture camera, from 1.2's `overlay.ts`); `sphere` (a unit sphere with great
arcs and draggable points); `grid` (a deformable grid with a shape on it, for matrices); `perturb` (float32 through
`Math.fround`, a matrix no longer orthogonal, an object far from the origin).

**The part's introduction page** (`parte-1/index.mdx`) still lists the pilot's thirteen lessons and the coin game; it
takes the seventeen lessons and _la torreta_.

---

### 1.1 Coordenadas (C)

- **Question:** ¿Cómo se dice, con números, dónde está algo?
- **Before:** nothing.
- **Leads:** L1 1.1 (components depend on the coordinate system); **also:** G §5.1–5.2.2 (handedness changes the
  picture, not the arithmetic; "solve in 2D first"); L2 §5.4.1 ("up" is a convention; the Blender import exercise).
- **Approach:** the pilot's, kept: a line (origin, unit, sense), a plane (ordered pairs), space (ordered triples), then
  the choice every engine made (hand and up), then the first computation a game makes, the distance. Handedness is
  stated here as a convention with the hand rule; it is defined as mathematics in 1.6 (L1: the cross product is the
  first thing that can tell the two hands apart). The hook is the game's own question: how far is the target, higher or
  lower (the pilot says "la moneda"; part 1's game has targets, part 2's coins).
- **The mathematics:** an axis; the distance |_b_ − _a_|; pairs and triples; the mirror (_x_, _y_, _z_) ↦ (_x_, _y_,
  −*z*); counting swaps and sign changes to decide whether a conversion flips the hand; Pythagoras twice (on the floor,
  then standing), with the assumptions named (perpendicular axes, one unit). Worked example: _P_ = (3; 2; 1),
  _Q_ = (−1; 0,5; −2): Δ = (−4; −1,5; −3), floor distance 5, distance √27,25 ≈ 5,2202 m; in Unity the same points give
  the same distance; in Unreal 522,02.
- **Depth:** Proved: the distance by Pythagoras twice (perpendicular axes, one unit, named); whether a change of axes
  flips the hand, by counting swaps and sign changes. Stated: that the hand is a convention, defined as mathematics in
  1.6.
- **The live figure:** the pilot's: drag _P_ and _Q_ on the floor, a height slider, the box of the distance, a
  left-handed toggle that mirrors the frame while the numbers stay. Panel rows: "P (x, y, z)", "Δ = Q − P", "floor
  distance", "our distance", "three.js distanceTo". Test: "our distance" equals "three.js distanceTo" to 4 decimals;
  the worked-example button gives 5 and 5.2202; with _P_ at height 0,5 the two distances are equal.
- **Traps:** the same numbers in another convention are another point; Unreal's centimetres; "forward" is a third choice
  the hand does not fix (glTF models face +Z, cameras look down −Z).
- **Exercises:** the pilot's three (another distance by hand: Δ = (−3; −2,5; −4), _d_ ≈ 5,590; Unity to ours:
  √34 ≈ 5,83 in both; _P_ in Unreal: (−100; 300; 200)).
- **Our angle:** "Dónde Manifold eligió otra cosa": up is not an axis but the opposite of gravity at each point, a
  datum of the world (`gravityAt`, `upAt`): the first seed of the strange worlds.
- **Sources:** L1 1.1; G §5.1–5.2.2; L2 §5.4.1; Dunn and Parberry ch. 1 ([gamemath.com](https://gamemath.com/book/)).
- **Reuses:** pilot 01 whole (text, `coordinates/` example); archived 0-00 §1 adds nothing the pilot lacks.
- **Open:** move `coordinates/scene.ts`, `figure.ts` and `labels.ts` onto the kit; add the missing browser test
  (`lessons.e2e.ts` covers only 03 and 05 of the pilot).

### 1.2 La proyección (C)

- **Question:** ¿Cómo se ve un mundo de tres dimensiones en una pantalla plana?
- **Before:** 1.1.
- **Leads:** **L2** §6.1 (the camera at the origin, a projection plane, the viewport normalized to height 2, the focal
  length _g_ = 1/tan(φ/2)), **RTR** 4.7.2 and 2.3 (similar triangles first; the field of view from a physical setup);
  **also:** L2 Fig. 6.4 (equal steps on screen are not equal steps along a segment), RTR's FOV numbers (a 22-inch-wide
  screen seen from 12 inches is about 85°), G2 §11.2.2.3 (field of view and focal length are one thing).
- **Approach:** the pilot's: a pinhole made tidy (an eye and a plane 1 m in front), similar triangles, then the same
  result with the line through the eye (signs, and points behind). Rejected for now: the matrix with _w_ (it needs 1.10)
  and depth (8.3), as L2 and RTR agree. The hook: every frame, every point must land on a pixel.
- **The mathematics:** camera coordinates (subtract the eye; depth _d_ = _e_z_ − _z_); _x_′ = _x_c_/_d_,
  _y_′ = _y_c_/_d_ by similar triangles and again by the parameter of the line; size falls as 1/_d_; vanishing points
  (_w_x_/(−*w_z*), _w_y_/(−*w_z*)), independent of the starting point, by dividing numerator and denominator by _t_;
  the horizon; the vertical field of view, _h_ = tan(φ/2), normalized coordinates, tan(θ/2) = _a_ tan(φ/2) (not
  θ = _a_φ); pixels with _y_ down. Name _g_ = 1/_h_ in one paragraph (L2's focal length), since 1.10 and part 8 use it.
  Worked example: eye (0; 1; 2), φ = 55°, 800 × 450, _P_ = (1; 1,5; −3): _d_ = 5, (_x_′, _y_′) = (0,2; 0,1),
  (_u_, _v_) ≈ (0,2161; 0,1921), pixel ≈ (486,4; 181,8). Rails at 20°: vanishing point _x_′ = tan 20° ≈ 0,3640, pixel
  (557,3; 225). θ ≈ 85,6°, not 97,8°.
- **Depth:** Proved: the projection by similar triangles and again by the line's parameter; vanishing points; tan(θ/2)
  = a tan(φ/2). Named: the 4 × 4 matrix with w (1.10) and depth (8.3).
- **The live figure:** the pilot's: drag _P_; sliders for the rails' turn, the field of view and the picture size; the
  inset photo by three.js with our rings on it. The side view is drawn so that 1.10 can relabel its depth axis as _w_.
  "One knob, two failures" (RTR): the field of view, too wide distorts the edges and exaggerates the near, too narrow
  flattens. Panel rows: "depth d (m)", "on the plane", "normalized u, v", "our pixel", "three.js pixel", "vanishing
  point", "horizontal fov (°)". Test: our pixel equals three.js's to 0,1 px; with _P_ at the example, the values above;
  _z_ = −8 doubles _d_ and halves (_x_′, _y_′).
- **Traps:** behind the eye the formula still gives a number (mirrored); horizontal fov is not _a_φ; verticals do not
  converge until the camera tilts.
- **Exercises:** the pilot's three (the far post's tip at (287,6; 225); `verticalFov` with 90° horizontal in 16:9 ≈
  58,7°; a point behind the eye lands at about (−32,2; 484,3)).
- **Our angle:** "Dónde Manifold eligió otra cosa": the camera lives in the presentation, never in the simulation; the
  world does not know anyone is looking (`stage.ts`, `camera.ts`, which uses the half height to pan under the pointer).
  In first person (stage 4g) what the character holds is drawn in a second pass with a projection of its own (50°,
  near plane 1 cm), over the world with the depth cleared: it neither goes into a wall nor stretches.
- **Sources:** L2 §6.1; RTR 4.7.2, 2.3; G2 §11.2.2.3; Scratchapixel, "Computing the pixel coordinates of a 3D point".
- **Reuses:** pilot 02 (text, `projection/` example with `projection.ts`, `overlay.ts`). Archived 0-00 §3.
- **Open:** the pilot is marked unfinished: what remains is the paragraph naming _g_, the kit migration, the browser
  test, and a check that the inset photo and the rings agree at every picture size (the 450 × 800 portrait case).
- **Para quien ya sabe** (curriculum §4.3): a projection taught before its matrix: the division by depth is the whole idea, and the 4 × 4 matrix with _w_ (1.10) is the same computation with machinery the reader does not have yet.

### 1.3 Una ventana al mundo (P)

- **Question:** ¿Qué hace falta para dibujar el mundo, y dónde cae cada punto?
- **Before:** 1.2.
- **Leads:** RTR 2 (a camera sees a frustum); **also:** G §1.5 (layers: three.js below, our game above), §6.1.2
  (start-up in order, shut-down in reverse), §8.1 (redraw everything each frame), §8.3.2 (the browser's frame callback
  is a framework: it calls us); L2 §5.4 (the chain object → world → camera → screen as a map of coming lessons).
- **Approach:** the project starts, and its first decision is the one that holds every later lesson up: **the world is
  plain data, and the drawing reads it**. The hook: put 1.2's computation to work and check that three.js, with its own
  matrices, draws the thing exactly where our numbers say. The second hook, G's: a renderer created twice without being
  disposed leaks GPU memory and, after about sixteen, the browser refuses new WebGL contexts.
- **The mathematics:** 1.2's four steps from a camera at _E_ in one formula; size on screen
  _s_/_d_ · _H_/(2_h_). Worked example (the pilot's camera, now looking at the turret's first target): eye
  (1,5; 1,6; 6), φ = 55°, 800 × 450, target _T_1 = (2; 0,5; −3): _d_ = 9, (_u_, _v_) ≈ (0,0600; −0,2348), pixel
  ≈ (424,0; 277,8); its 0,6 m sphere spans ≈ 28,8 px.
- **Depth:** Proved: 1.2's steps from any eye, and the size on screen. Nothing stated or named: a project lesson.
- **The project:** `view.ts` (`createView({ eye, fov })` returns `scene`, `camera`, `onFrame(update)` and `dispose()`;
  the picture follows the window's size); `screen.ts` (`toScreen`, the pilot's, unchanged); `world.ts` (`World`, plain
  data: the floor's size, the turret `{ position }`, the targets `{ id, position }`; `createWorld(layout)`);
  `layouts.ts` (`LAYOUTS`, the first one: turret at the origin, targets at (2; 0,5; −3), (−1; 0,5; 2), (−1; 0,5; −4));
  `main.ts` (start-up in order: view, world, meshes built from the world; shut-down in reverse, disposing geometries,
  materials and the renderer). The turret is drawn, static: a block with a nose. Nothing moves by itself (part 1 is
  time-free): the panel moves the camera (eye _x_, _y_, _z_, field of view) and picks the target whose pixel is checked.
  Playable: nothing yet; touchable: the camera.
- **Check:** no console yet (2.6). The panel rows "our pixel", "three.js pixel", "depth (m)", "size on screen (px)";
  a "rebuild ×20" button and a row "renderer.info geometries" that stays constant with disposal and grows with the
  naive toggle "skip dispose".
- **Traps:** degrees and radians in `Math.tan`; behind the camera `toScreen` returns `null`; "Sutileza" (curriculum):
  the screen is not linear: hex colours are sRGB, three.js converts them, and a grey of 0,5 shows at about 22 % of the
  light (L2 §5.3), pointing to 8.6.
- **Exercises:** compute _T_3's pixel by hand: _d_ = 10, pixel ≈ (291,9; 272,5); make a target disappear when it goes
  behind the camera; add a fourth target to the layout and check that only `layouts.ts` changed.
- **Our angle:** the first determinism rule (curriculum §6.1): no three.js object in the state. "Patrón" box at its
  smallest (GPP ch. 3): a mesh is shared geometry and material plus its own transform, the seed of instancing (8.15).
  "Dónde Manifold eligió otra cosa": the core compiles without the browser, and a lint rule keeps three.js out of it
  (decision 0003); its state is data (decision 0004).
- **Sources:** RTR 2; G §1.5, §6.1.2, §8.1, §8.3.2; L2 §5.4; the three.js manual, "Cleanup"
  ([threejs.org/manual](https://threejs.org/manual/)).
- **Reuses:** pilot 03 and `course/parte-1/01-ventana/` (`view.ts`, `screen.ts`, the comparison with `project()`);
  archived 0-01 (renderer, scene, camera, lights, loop). Changes: the ball that moved by a closed form becomes the
  turret's targets as data; camera sliders; start-up and shut-down.
- **Open:** whether `onFrame` keeps passing `dt` in part 1 (the pilot's signature): the sheet keeps it, unused until
  2.6, so the name keeps one meaning.
- **Para quien ya sabe** (curriculum §4.3): the world as plain data, not three.js's scene: the simulation must run without the browser (tests in Node, replays, a server in part 9) and be hashed; three.js only draws it (Manifold's decisions 0003 and 0004).

### 1.4 Vectores (C)

- **Question:** ¿Cómo se dice cuánto y hacia dónde?
- **Before:** 1.1.
- **Leads:** L1 1.1–1.2; **also:** G §5.2.3–5.2.5 (points are absolute, vectors relative; the table of what may be
  added to what), E §3.2–3.3.2 (bound and free vectors), MA §3.1.2 (a heading as a unit vector).
- **Approach:** the pilot's: a vector is an instruction with no starting place; components; adding tip to tail;
  scaling; length by Pythagoras; normalizing; the basis; points against vectors and affine combinations. The triangle
  inequality is **stated** here and **proved** in 1.5 (L1, curriculum §5), so the pilot's proof moves.
- **The mathematics:** as the pilot, with the derivation |_k_**v**| = |_k_||**v**| and |**v̂**| = 1. Worked example
  (the autopilot's first stop): **a** = (3; 0; −1), **b** = (1; 0; −2), _k_ = −0,5: sum (4; 0; −3), difference
  (2; 0; 1), |**a**| = √10 ≈ 3,162, |**b**| = √5 ≈ 2,236, |**a** + **b**| = 5 ≤ 5,398, **â** ≈ (0,949; 0; −0,316).
- **Depth:** Proved: the operations' rules component by component, |k v| = |k| |v|, |v̂| = 1, uniqueness in a basis,
  affine combinations. Stated: the triangle inequality (proved in 1.5).
- **The live figure:** the pilot's: drag both tips (snapped to half metres), the parallelogram, _k_**a**, **â** on the
  unit circle, the autopilot. Panel rows: "vector a", "sum a + b", "difference a − b", "length |a + b|", "|a| + |b|",
  "unit â", "length |â|", "three.js â", "scalar k". Test: at the first stop the values above; with both tips on the same
  point "difference a − b" is (0, 0, 0); with **a** at the origin "length |â|" is 0.
- **Traps:** three.js mutates the vector it is called on; √(_k_²) = |_k_|; normalizing zero; a unit vector measures
  0,9999999999999999.
- **Exercises:** the pilot's three (|**a** + **b**| = √10 against 2√5; the midpoint (2; 0; −1,5); a fixed length
  |_k_|).
- **Our angle:** "Dónde Manifold eligió otra cosa": vectors as tuples with functions returning new ones, and the length
  as `Math.sqrt` of the sum of squares, never `Math.hypot` (exactly rounded everywhere; 2.9 explains why).
- **Sources:** L1 1.1–1.2; G §5.2.3–5.2.5; 3Blue1Brown, _Essence of linear algebra_, ch. 1; Ström, Åström and
  Akenine-Möller, [_Immersive Linear Algebra_](https://immersivemath.com/ila/index.html), ch. 2.
- **Reuses:** pilot 04 and `lessons/parte-1/vectors/`. Changes: the "Más a fondo" on the triangle inequality moves to
  1.5's exercises; in its place "Los colores también son vectores" (L2 §5.2, §5.2.3: three cones, Grassmann's law,
  adding and scaling lights are vector operations, multiplying two colours component by component is not; the RGB cube
  as a small figure). The forward links to "Moverse" now point to 1.7 (the turret's forward) and 2.8.
- **Open:** `vectors/vec.ts` says it is "the project's": it becomes so in 1.7, not in Moverse.
- **Para quien ya sabe** (curriculum §4.3): functions that return a new vector (garbage per operation, which three.js avoids by mutating): clear code first, reused temporaries only where a measurement asks (3.13 measures it); and `Math.sqrt` of the sum of squares over `Math.hypot`, which avoids overflow but is implementation-approximated in ECMA-262 (2.9).

### 1.5 El producto escalar: proyectar y rechazar (C)

- **Question:** ¿Cuánto de un vector va en la dirección de otro, y cuánto queda de través?
- **Before:** 1.4.
- **Leads:** **L1** 1.5.1, 1.6; **also:** G §5.2.4.7 (the table of what the sign says; front or behind; height above a
  plane), E §3.3.3–3.3.4 (the dot as a measuring stick: the extreme point along a direction, no normalizing needed to
  compare), MA §3.3.14 (the cone test without an arccosine), MF §2.1.7 (its Ex. 2.6: rejection discovered by the
  reader; the separating velocity as a forward link), RTR 5.1 (Fig. 5.4: why a cosine).
- **Approach:** L1's: the dot product is a tool for splitting a vector, not a number to memorize. Defined by components;
  its geometry proved. Our route to the cosine: perpendicularity by Pythagoras and its converse, then the projection,
  then the cosine in the right triangle; the law of cosines falls out as a corollary. L1's route (law of cosines first)
  is rejected because the reader has Pythagoras from 1.1 and 1.4 and not necessarily the law of cosines. The hook: the
  turret will need to know whether a target is in front of it and inside its cone.
- **The mathematics:** **a**·**b** = Σ _a_i_ _b_i_; commutative, distributive, (_k_**a**)·**b** = _k_(**a**·**b**),
  **a**·**a** = |**a**|². |**a** + **b**|² = |**a**|² + 2**a**·**b** + |**b**|², so **a** ⟂ **b** ⇔ **a**·**b** = 0
  (Pythagoras and its converse). For **û** unit, **a** = (**a**·**û**)**û** + (**a** − (**a**·**û**)**û**), the second
  part perpendicular; so **a**·**û** is the signed length of **a**'s shadow and equals |**a**| cos θ; then
  **a**·**b** = |**a**||**b**| cos θ. Projection **a**∥ = (**a**·**b**/**b**·**b**) **b**, rejection
  **a**⊥ = **a** − **a**∥, |**a**⊥| = |**a**| sin θ. **El mismo movimiento** is named here: split, act on each part,
  recombine (drop the across part: projection; drop the along part: rejection; flip the along part: reflection, used
  in 1.8 and 3.4). Cauchy–Schwarz from |cos θ| ≤ 1, and the triangle inequality proved (moved from 1.4). The cone:
  **f̂**·(_T_ − _E_)/|_T_ − _E_| ≥ cos α, with cos α computed once. The extreme point along **d** named for part 3.
  Worked example (1.4's vectors): **a** = (3; 0; −1), **b** = (1; 0; −2): **a**·**b** = 5, cos θ = 5/√50, θ = 45°;
  **a**∥ = (1; 0; −2), **a**⊥ = (2; 0; 1), |**a**⊥| = √5 = √10 · sin 45°. Cone from the origin along **b̂**: outside at
  α = 30° (cos 45° < cos 30°), inside at 50°.
- **Depth:** Proved: perpendicularity by Pythagoras and its converse, the shadow and the cosine, projection, rejection
  and |a⊥| = |a| sin θ, Cauchy–Schwarz (by the angle, and without it in "Más a fondo"), the triangle inequality, the
  cone. Named: the support point (part 3).
- **The live figure:** two modes. "Split": drag **a** and **b**; the shadow on **b**'s line, the rejection, the right
  angle, the arc θ; "flip b" and "b × 2" leave **a**∥ unchanged (one projects onto the line). "Look": an eye with a
  draggable facing direction and a draggable target, the front half-plane shaded, a cone with an α slider. Naive
  against correct: "normalize" off compares the raw dot with cos α, and far targets pass outside the cone while near
  ones fail inside it. Panel rows: "a · b", "|a| |b| cos θ", "angle θ (°)", "projection a∥b", "rejection a⊥b",
  "|a⊥b|", "in front", "inside the cone". Test: at the example, 5, 45.00, (1, 0, −2), (2, 0, 1); with normalize off
  and **a** as the target at α = 30°, "inside the cone" wrongly says yes (2,236 ≥ 0,866).
- **Traps:** forgetting 1/**b**·**b** when **b** is not unit; the dot of unnormalized vectors is not a cosine; the zero
  vector is perpendicular to everything, uselessly; a zero rejection that is then normalized.
- **Exercises:** (1) prove the triangle and reverse triangle inequalities (L1 Ex. 1.2–1.3); hint: expand
  |**a** ± **b**|². (2) Turret at the origin facing (0; 0; −1), targets (2; 0; −3), (−1; 0; 2), (4; 0; −2): in front?
  inside 40°? Should give 33,7° inside, behind, 63,4° in front but outside. (3) Reflect **a** = (3; 0; −1) across the
  plane with **n̂** = (0,6; 0; 0,8) by flipping its along part: (1,8; 0; −2,6), same length √10.
- **Our angle:** the first "mismo movimiento", which returns in fourteen places (curriculum §6.2); the cone compared
  with a cosine computed once, never `Math.acos` per step (2.9's rule pays it later). "En Manifold": `vec3.dot`,
  `vec3.onPlane` (a rejection) in `math.ts`, used by the character's climbing.
- **Sources:** L1 1.5.1, 1.6; G §5.2.4.7; E §3.3.3–3.3.4; MA §3.3.14; MF §2.1.7; RTR 5.1; Dunn and Parberry ch. 2;
  _Immersive Linear Algebra_ ch. 3.
- **Reuses:** none (new); the pilot 04's Lagrange-identity proof becomes exercise 1's second hint.
- **Open:** whether "the extreme point" gets a figure here or only a sentence; E's figure (a point cloud with its two
  extremes lit) is cheap and pays in 3.8. _Written (batch 2):_ a "Más a fondo" in words, no figure; the panel's
  projection row is "projection a‖b" (U+2016: U+2225 rendered as a dotless i in the panel's font).

### 1.6 El producto vectorial: áreas con signo, normales, una base (C)

- **Question:** ¿De qué lado queda algo, qué es perpendicular a dos direcciones, y cómo se arma un marco?
- **Before:** 1.5.
- **Leads:** **L1** 1.5.2–1.5.3, 4.1 (Ex. 4.1: the signed area by cutting a bounding rectangle; eq. 4.7: the three
  shadows are the components); **also:** E §3.3.5–3.3.8, §3.1.6 (ORIENT2D and ORIENT3D; the triple product as a signed
  volume), G §5.2.4.8–9 (a basis from forward and up; pseudovectors), MF §2.1.8–9, §14.2.1 (a basis from one vector,
  choosing the helper axis by the smaller component), MA §3.9.4 (its arcsin trap).
- **Approach:** L1's chapter-4 route, not its chapter-1 one (a formula "without explanation", as L1 admits): a signed
  area in the plane first, then the three shadows of a parallelogram on the coordinate planes, which are exactly the
  three components of **a** × **b**. Perpendicularity, length and the hand then follow, with L1's proofs. The hook: the
  turret must know whether to turn left or right.
- **The mathematics:** the signed area of the parallelogram of (_a_1, _a_2), (_b_1, _b_2) is _a_1_b_2 − _a_2_b_1,
  positive when **b** is counterclockwise from **a** (L1's rectangle proof). In space, the shadows on the _yz_, _zx_
  and _xy_ planes, in that cyclic order, give **a** × **b** = (_a_y_b_z − _a_z_b_y, _a_z_b_x − _a_x_b_z,
  _a_x_b_y − _a_y_b_x). Perpendicular to both (**a**·(**a** × **b**) = 0 expanded); |**a** × **b**|² =
  |**a**|²|**b**|² − (**a**·**b**)² (Lagrange), so |**a** × **b**| = |**a**||**b**| sin θ; anticommutative; zero for
  parallel vectors. **Handedness defined:** (**u**, **v**, **w**) is right-handed when [**u**, **v**, **w**] =
  (**u** × **v**)·**w** > 0; [**i**, **j**, **k**] = 1. ORIENT3D: the sign of a triple product says on which side of a
  plane a point is; on the floor, ORIENT2D is the _y_ component, _f_z_t_x − _f_x_t_z_: positive means the target is to
  the left (counterclockwise seen from above, where a positive yaw turns). The frame from a forward and an up:
  **r** = normalize(**f** × **ŷ**), **u** = **r** × **f**; with **f** = (0; 0; −1) it gives **r** = **x̂**, **u** = **ŷ**.
  Worked example: **a** = (3; 0; −1), **b** = (1; 0; −2): **a** × **b** = (0; 5; 0), area 5 (= √10 · √5 · sin 45°),
  triangle 2,5, **b** to the left of **a**. In space: **a** = (2; 1; 0), **b** = (0; 1; 3): **a** × **b** =
  (3; −6; 2), length 7 (Lagrange: 5 · 10 − 1² = 49).
- **Depth:** Proved: the signed area in the plane (by the sine of a difference, which gives its sign), the components
  as shadows, perpendicularity, Lagrange's identity and the length, anticommutativity, handedness as the triple
  product's sign, the frame from a gaze. Named: bivectors and the exterior product, why there is no cross product in
  4D, pseudovectors.
- **The live figure:** three modes, all dragged. "Área con signo": drag **a** and **b** on the floor; the parallelogram
  green or red by sign; "show the proof" draws L1's rectangle cut. "Las tres sombras": drag **a** and **b** in space
  (handles on a vertical plane plus a height handle); the shadows on the three planes with their signed areas beside
  the components; "b × a" flips the normal. "Un marco": drag a target around an eye; **f**, **r**, **u** in red, green,
  blue; straight above, **r** collapses and flashes red. A draggable **c** crosses the plane of **a** and **b** and the
  parallelepiped's volume changes sign. Naive against correct: "x then z" computes _a_x_b_z − _a_z_b_x on the floor, and
  left and right swap. Panel rows: "a × b", "|a × b|", "area of triangle", "side (seen from above)", "[a, b, c]",
  "right-handed". Test: at the example, (0, 5, 0), 5, 2.5, "left"; with **a** = (2, 1, 0) and **b** = (0, 1, 3), 7.
- **Traps:** the operand order sets the direction; parallel inputs give zero (a look-at straight up breaks; three.js's
  `lookAt` too); × is not associative; the floor's cyclic order (_z_, _x_), not (_x_, _z_); the angle as
  arcsin |**f** × **t**| is wrong past 90° (MA): use atan2((**f** × **t**)·**ŷ**, **f**·**t**).
- **Exercises:** (1) **i** × **j** = **k** and its cycle, [**i**, **j**, **k**] = 1, and −1 in 1.1's mirrored frame.
  (2) "Corregí al autor": **f** = (0; 0; −1), **t** = (−1; 0; 1): atan2 gives 135° to the left, MA's arcsin 45°.
  (3) The level's triangle (0; 0; 0), (4; 0; 0), (0; 0; −3): area 6, normal up.
- **Our angle:** ORIENT2D and ORIENT3D are named for part 3, and "the same expression in the same order gives the same
  sign" is planted for 3.16; the triple product is 1.8's determinant; the sign of a frame is the seed of the Möbius
  strip (10.6). "Más a fondo" (curriculum): bivectors (L1 4.1: **a** ∧ **a** = 0, an oriented area with no shape, why
  three components let it pass for a vector, why there is no cross product in 4D). Second "Más a fondo": Lagrange's
  identity proved. "En Manifold": `quat.look` builds right as forward × up.
- **Sources:** L1 1.5.2–1.5.3, 4.1; E §3.1.6, §3.3.5–3.3.8; G §5.2.4.8–9; MF §2.1.8–9, §14.2.1; MA §3.9.4;
  _Immersive Linear Algebra_ ch. 4.
- **Reuses:** none (new).
- **Open:** three modes may be too many for one figure; if so, the frame mode moves into 1.7's project view. _Written
  (batch 2):_ two modes, "signed area" and "in space" (the tips' heights as sliders, c and its box in the second); the
  frame moved into 1.7, drawn at the turret with `debug.axes`; L1's rectangle proof replaced by the sine of a
  difference, which also gives the sign.

### 1.7 Mirar: delante, detrás, a qué lado (P)

- **Question:** ¿Cómo sabe la torreta dónde están los blancos, y cómo se ve lo que sabe?
- **Before:** 1.3, 1.6.
- **Leads:** G §10.2 (debug drawing: simple calls, primitives, colour, world or screen space, depth on or off,
  queued and drawn at the end of the frame, a lifetime per primitive); MA §3.3.14 (the cone).
- **Approach:** the turret, drawn since 1.3, now sees. The hook: three targets, and the turret must say of each whether
  it is in front, to which side, and inside its cone; and the reader must see what it decided, not read it in a log.
  So the tool comes with the need (G: a picture is worth a thousand minutes of debugging), and it is a lesson, not only
  a thread (curriculum §6.3).
- **The mathematics:** recalled in one line each from 1.5 and 1.6: with **t** = _T_ − _E_, in front ⇔ **t**·**f** > 0;
  left ⇔ (**f** × **t**)·**ŷ** = _f_z_t_x − _f_x_t_z_ > 0 (ORIENT2D on the floor); inside the cone ⇔ the normalized
  dot ≥ cos α. New here: turning without rotations, which are not taught yet: the turret's heading is one of eight,
  `HEADINGS[k] = normalize(vec(i, 0, j))` for the compass combinations, so turning is changing _k_ (1.12 replaces it
  with any angle, 1.16 with the shortest arc). Worked example: eye at (0; 0,5; 0), facing (0; 0; −1), α = 30°, targets
  at the eye's height: _T_1 = (2; 0,5; −3) in front, right, 33,7° (outside); _T_2 = (−1; 0,5; 2) behind, left;
  _T_3 = (−1; 0,5; −4) in front, left, 14,0° (inside). One eighth to the right, **f** = (1; 0; −1)/√2: _T_1 at 11,3°,
  inside.
- **Depth:** Proved: the three tests (recalled), the nearest heading as the largest dot product, the cone's edges as
  cos α f ± sin α r. Nothing stated or named: a project lesson.
- **The project:** `vec.ts` (new: the 1.4 functions plus `dot` and `cross`); `debug.ts` (new: `debug.arrow`,
  `debug.line`, `debug.point`, `debug.axes`, `debug.text`, each with a lifetime in seconds of the real clock, default one
  frame, and depth on or off; requests are queued and `debug.flush` draws them at the end of the frame); `turret.ts`
  (new: `HEADINGS`, `inFront`, `sideOf`, `inCone`, `classify`); `world.ts` (the turret gains a heading and an eye
  height); `main.ts` (keys read raw, by `e.code`, auto-repeat ignored: Q and E change the heading, W A S D step the
  turret by 1 m, Tab faces the next target). Drawn each frame: the forward arrow, the cone's edges, an arrow to each
  target, and a label "delante · derecha · fuera del cono". Playable: place the turret so that all three targets are in
  its cone.
- **Check:** no console yet. Each press logs `console.table(classify(...))`; the panel rows "target 1", "target 2",
  "target 3" read as above at start. Naive against correct: "normalize forward" off widens the cone at the diagonal
  headings (length √2).
- **Traps:** debug drawing is view: never in the state, never in a hash; a debug call from the rules must not need the
  scene (hence the queue); depth off for arrows inside the block; an arrow of zero length (target on the eye).
- **Exercises:** (1) find a heading and position (on the 1 m grid) with all three targets in the cone; one answer:
  turret at (0; 0; 5), heading north. (2) Add `debug.text` showing each target's angle in degrees. (3) Make the cone's
  half-angle a panel slider and find the smallest α for which _T_1 and _T_3 are both inside from the start (33,7°).
- **Our angle:** G's tools become the project's from the first lesson that needs them; "Dónde Manifold eligió otra
  cosa": Manifold's debug views are declared variables (`show.axes`, `show.vectors`, `show.physics` in
  `presentation/src/views.ts`), each costing nothing when off; the project's console (2.6) will declare `show.axes`
  the same way.
- **Sources:** G §10.2; MA §3.3.14; three.js `ArrowHelper` and `Line` docs.
- **Reuses:** the pilot's `course/parte-1/02-moverse/vec.ts` and `vec.test.ts` (as `vec.ts` with `dot` and `cross`
  added, and their tests); its raw key handling.
- **Open:** the curriculum says `vec.ts` "grows" here, but with "Moverse" moved to 2.8 no earlier project lesson adds
  it: 1.7 adds it whole. Also decide whether `debug.ts` lifetimes count real seconds (as here) or frames. _Written
  (batch 2):_ real seconds; `debug.ts` is only the queue (no three.js, so rules may ask), `view/debug-view.ts` draws it;
  the step is `parte-1/02-mirar`, and Moverse's step moved to `parte-2/08-moverse`. The camera looks down with
  three.js's `lookAt` (1.3's did not turn, to be checked against `toScreen`). Panel buttons mirror the keys.
- **The kit's bridge** (the author's decision, 2026-11-16): the lab kit is never taught as a topic. When `debug.ts` arrives here, the lesson says that the kit under every concept figure is the same idea at full size (arrows, points, lines, labels, drawn each frame), and that from now on it can be read: the link under each figure's editor.

### 1.8 Matrices: adónde van los ejes (C)

- **Question:** ¿Qué hace una matriz con el espacio, y por qué importa el orden?
- **Before:** 1.6.
- **Leads:** **L1** 1.3–1.4, 1.7, 2.3–2.4 (**Mv** = _v_x_**a** + _v_y_**b** + _v_z_**c**: the columns are where the axes
  go; scale and reflection by decomposition); **also:** RTR 4.1 (Fig. 4.4, the order with numbers; Fig. 4.2, a pivot;
  Fig. 4.3, shear keeps area; a negative scale mirrors and flips the winding), G §5.3.1–5.3.7, §5.3.14 (probe your
  library), E §4.2.6 (the |**M**| rule).
- **Approach:** columns first (L1), the row-times-column rule after, as a way to compute. The determinant is not
  Leibniz's formula but the signed area or volume of the image of the unit square or cube, which is 1.6's signed area
  and triple product of the columns. The hook: the turret will need any yaw, not eight; and a turn followed by a
  stretch is not a stretch followed by a turn.
- **The mathematics:** a matrix as three columns; **Mv** as their combination; composition **M**2(**M**1**v**) =
  (**M**2**M**1)**v**, the right one acts first, and **AB** ≠ **BA**. **The single-axis rotations are derived here**, by
  where the axes go: about +Y, **i** ↦ (cos θ; 0; −sin θ), **k** ↦ (sin θ; 0; cos θ) (so a positive yaw turns the
  forward −Z to the left); about +X, the forward tilts up. Scale diag(_s_x_, _s_y_, _s_z_); "el mismo movimiento":
  scale along **â** is **I** + (_s_ − 1)**ââ**ᵀ, reflection is **I** − 2**n̂n̂**ᵀ (the outer product is 1.5's
  projection as a matrix). det as signed volume = [**a**, **b**, **c**]; det(**AB**) = det **A** det **B** (volumes
  multiply); det < 0 mirrors. Worked example: **R** = **R**_y(30°), **S** = diag(2; 1; 0,5), _p_ = (1; 0; 0):
  **SR**_p_ = (1,732; 0; −0,25), **RS**_p_ = (1,732; 0; −1); both have det 1: same area, different shapes. Reflection
  with **n̂** = (0,6; 0; 0,8): columns (0,28; 0; −0,96), (0; 1; 0), (−0,96; 0; −0,28), det −1; it sends (3; 0; −1) to
  (1,8; 0; −2,6), as 1.5's exercise.
- **The live figure:** the floor from above with a grid and an asymmetric shape (the turret's silhouette with its
  nose): drag the tips of the images of **i** and **k** (the columns), the grid and the shape follow, the image of the
  unit square is shaded with its signed area = det, red and mirrored when negative. A 3D mode: a cube with three
  draggable column tips. An "order" mode: pick **A** and **B** (turn 30°, scale, shear, mirror) and see **AB** and **BA**
  side by side. Naive against correct: "read as rows" uses the same nine numbers transposed, and the shape turns the
  other way (the `set()` trap). Panel rows: "column 1 (where i goes)", "column 3 (where k goes)", "det", "M p",
  "S R p", "R S p". Test: at the example, (1.732, 0, −0.25) and (1.732, 0, −1); det 1; the mirror's det −1.
- **Traps:** order; row-vector books (G) must be transposed; three.js's `elements` are column-major but `set()` takes
  rows (G §5.3.14's probe); a zero scale makes later inverses impossible; a mirror flips triangles' winding (three.js
  flips the front face when `determinantAffine()` < 0, L2 §7.4.3).
- **Exercises:** (1) det(_t_**A**) = _t_³ det **A** (L1 Ex. 1.10): scaling by 2 multiplies volume by 8. (2) The |**M**|
  rule (E §4.2.6): a box of half extents (1; 0,5; 2) turned by **R**_y(30°) has a world box of half extents
  (1,866; 0,5; 2,232). (3) Build a matrix with `Matrix3.set(...)` and find where the image of **i** lands in `elements`
  (indices 0–2).
- **Our angle:** the determinant's sign is orientation, which part 10 turns into a world that mirrors you; "Del modelo
  al motor" capsule: importing from Blender is −90° about _x_, det +1, never a mirror. "Dónde Manifold eligió otra
  cosa": no matrices in the state (a position and a quaternion, no scale); matrices only in the drawing and inside
  `quat.look`.
- **Sources:** L1 1.3–1.4, 1.7, 2.3–2.4; RTR 4.1; G §5.3.1–5.3.7, §5.3.14; E §4.2.6; 3Blue1Brown, _Essence of
  linear algebra_, ch. 3, 4, 6; Dunn and Parberry ch. 4–5.
- **Reuses:** archived 0-07 (its "move, then turn" against "turn, then move" toggle and its matrix shown by rows) feeds
  the order mode; its spaces part goes to 1.11.
- **Open:** the curriculum puts L1 2.2.1 (rotation about the axes) in 1.13, but the project needs **R**_y and **R**_x
  in 1.12, before 1.13: this sheet derives them here, and 1.13 composes them.

### 1.9 La inversa, y las matrices que no deforman (C) ◇

- **Question:** ¿Cómo se deshace una transformación, y cuándo deshacer es solo transponer?
- **Before:** 1.8.
- **Leads:** **L1** 1.7.5 (the inverse of a 3 × 3 as three cross products over a triple product), 2.1.2 (orthogonal
  matrices); **also:** MF §9.4.2–9.4.6 (invert an affine matrix "the easy way"; **BMB**⁻¹), E §3.1 (the same inverse,
  checked by multiplying).
- **Approach:** the inverse as the reciprocal basis (L1, E): geometric, short, and built from 1.6. Gauss–Jordan and
  cofactors are rejected: no geometry, and the reader would not see why a flat matrix cannot be undone. The hook: to
  read a target in the turret's own frame (1.12), the world must be undone.
- **The mathematics:** **I**; **M**⁻¹ sends the images back; (**AB**)⁻¹ = **B**⁻¹**A**⁻¹ (socks and shoes). For
  **M** = [**a** **b** **c**], the rows of **M**⁻¹ are **b** × **c**, **c** × **a**, **a** × **b** over [**a**, **b**,
  **c**]: each row is perpendicular to two columns and has dot 1 with the third (triple product over itself). det = 0:
  coplanar columns, no way back, and near it the reciprocal vectors grow like 1/det. Orthogonal: unit, perpendicular
  columns ⇒ **M**ᵀ**M** = **I** (its entries are the columns' dot products) ⇒ **M**⁻¹ = **M**ᵀ; lengths and angles kept;
  det ±1. The two routes agree: for a right-handed orthonormal frame **b** × **c** = **a**, so the rows are the columns.
  Drift: repeated products lose orthogonality; Gram–Schmidt (1.5's step, now three times) restores it. Worked example:
  **a** = (2; 0; 0), **b** = (0; 1; 0), **c** = (1; 0; 1): det 2; rows of **M**⁻¹ (0,5; 0; −0,5), (0; 1; 0), (0; 0; 1).
  The transpose is not the inverse here: **M**ᵀ**M**(1; 0; 1) = (6; 0; 4), not (1; 0; 1).
- **The live figure:** 1.8's editor with an "undo" layer: drag the columns; the reciprocal vectors (the rows of
  **M**⁻¹) drawn as arrows, each perpendicular to two columns; drag towards coplanar and they explode. An "orthonormal"
  mode: drag one column, the others follow by Gram–Schmidt, and the rows "inverse" and "transpose" read the same.
  Naive against correct: "undo by transposing" applied to any matrix; the round trip misses. Perturbation (kit): apply a
  1° turn many times in float32: after 36 000 products |**M**ᵀ**M** − **I**| ≈ 1,1 · 10⁻³, columns 0,05 % too long;
  "re-orthonormalize" fixes it. Panel rows: "det", "M⁻¹ (rows)", "Mᵀ (rows)", "M⁻¹ M p", "Mᵀ M p", "|MᵀM − I|".
  Test: at the example, M⁻¹'s first row (0.5, 0, −0.5) and "Mᵀ M p" (6, 0, 4).
- **Traps:** order in (**AB**)⁻¹; transposing a matrix with scale; invert parameters in reverse order when they are
  known (RTR 4.1.8): more exact than a general inverse; a zero scale.
- **Exercises:** (1) the product of orthogonal matrices is orthogonal (L1 Ex. 2.2). (2) Inverse of a rotation with
  per-axis scale (L1 Ex. 2.4): **M**⁻¹ = **N M**ᵀ with **N** = diag(1/|**a**|², …); check with **R**_y(30°) · diag(2;
  1; 0,5). (3) (**RS**)⁻¹ = **S**⁻¹**R**ᵀ, computed for the same pair.
- **Our angle:** "Rigor numérico" capsule: drift and re-orthonormalization. "En Manifold": `quat.conjugate` is the
  inverse of a unit rotation, and `world.ts` brings a body's centre into a zone's space with it; quaternions are
  renormalized after every integration, so drift never accumulates.
- **Sources:** L1 1.7.5, 2.1.2; MF §9.4.2–9.4.6; E §3.1; RTR 4.1.8; Dunn and Parberry ch. 6.
- **Reuses:** archived 0-07's inverse mention (`matrixWorldInverse`); nothing else.
- **Open:** if folded (◇), the reciprocal-basis figure survives as a section of 1.8 and the orthonormal mode as a
  "Sutileza".

### 1.10 Coordenadas homogéneas: puntos y direcciones (C)

- **Question:** ¿Cómo entra la traslación en una matriz, y por qué un punto y una dirección se mueven distinto?
- **Before:** 1.2, 1.9.
- **Leads:** **L1** 2.6 (a 4D line through the origin meeting _w_ = 1; directions at infinity; _w_ arithmetic as type
  rules; the columns of an object's matrix are its axes and origin); **also:** L2 §5.4.3, §6.2 (the matrix that copies
  depth into _w_; the sun as a point at infinity), RTR 4.1, 4.7 (Fig. 4.6: a normal under a non-uniform scale, as a
  warning), G §5.3.8–5.3.10, §5.3.13 (a 3 × 3 cannot translate; the inverse transpose stated), MF §9.4.5 (a direction
  transformed fully picks up the offset).
- **Approach:** G's problem first (no 3 × 3 matrix moves the origin, since **M0** = **0**), then L1's picture, drawn as
  **the same figure as 1.2 relabelled**: depth becomes _w_, and the projection turns out to be the division by _w_
  (curriculum §5). The hook: the turret's nose must move with the turret, its forward arrow must only turn.
- **The mathematics:** (_x_, _y_, _z_, 1) and **H** = [**M** | **t**; 0 0 0 1]; points _w_ = 1, directions _w_ = 0, so
  the translation column is multiplied by 0 for directions. Type rules from _w_: point − point = direction, point +
  direction = point, point + point has _w_ = 2 (a midpoint, with weights summing to 1, is fine: 1.4's affine
  combinations). **H**⁻¹ = [**M**⁻¹ | −**M**⁻¹**t**]; rigid: [**R**ᵀ | −**R**ᵀ**t**]. The columns of **H** are the local
  axes and the origin in the parent's space. The projection: in camera coordinates the matrix with rows (1 0 0 0),
  (0 1 0 0), (0 0 1 0), (0 0 −1 0) sends 1.2's _P_ = (1; 0,5; −5; 1) to (1; 0,5; −5; 5), and dividing by _w_ gives
  (0,2; 0,1; −1): the point on the plane. It is singular (it flattens); 8.3's keeps depth. The inverse transpose for
  normals is stated as a warning only (derived in 3.2). Worked example: **R** = **R**_y(90°), **t** = (4; 0; −2): the
  nose (0; 0,5; −1; 1) goes to (3; 0,5; −2); the forward (0; 0; −1; 0) to (−1; 0; 0); back again with **R**ᵀ(_p_ − **t**)
  = (0; 0,5; −1).
- **The live figure:** (a) the (_x_, _w_) plane: drag a 4D vector; scaling it does not move its point on _w_ = 1;
  turn it down to _w_ = 0 and the point runs off to infinity; a toggle "esto es la proyección" relabels _w_ as depth
  and shows 1.2's eye and plane. (b) The turret block with its nose (a point) and its forward (a direction); drag its
  position on the floor and turn it with a slider; a _w_ slider from 1 to 0 on a transformed arrow fades the
  translation out (G). Naive against correct: "transform the forward as a point" adds the translation and the arrow
  points from the origin to the turret. Panel rows: "H (rows)", "nose P′", "forward v′", "elements[12..14]", "w".
  Test: at the example, (3, 0.5, −2), (−1, 0, 0), and elements 12–14 equal (4, 0, −2).
- **Traps:** three.js has one `Vector3` for both: `applyMatrix4` treats it as a point and divides by _w_,
  `transformDirection` as a direction and normalizes; normals are a third kind (3.2); non-uniform scale breaks them.
- **Exercises:** (1) products of [**M** **t**; 0 1] keep the last row (L1 Ex. 2.7). (2) Predict `applyMatrix4` and
  `transformDirection` on (0; 0; −1) under a camera translated to (2; 0; 5): (2; 0; 4) and (0; 0; −1). (3) Invert
  **T**(**t**)**R** by hand in reverse order and check against (b).
- **Our angle:** the table "qué se transforma cómo" gains its first two rows (curriculum §2), and TypeScript can carry
  them: `Point` and `Vec` are interchangeable to the compiler (structural typing), so the project names variables by
  role (`pos`, `dir`); branded types as a "Más a fondo". "Dónde Manifold eligió otra cosa": no 4 × 4 in the state; a
  `Transform` is a position and a quaternion, and `quat.rotate` turns a direction without building a matrix.
- **Sources:** L1 2.6; L2 §5.4.3, §6.2; RTR 4.1, 4.7; G §5.3.8–5.3.10, §5.3.13; MF §9.4.5; Dunn and Parberry ch. 6.
- **Reuses:** archived 0-07 (the nose tip read in several spaces; the last column as the position) for (b); the
  projection figure of pilot 02 for (a).
- **Open:** the shared component for 1.2's and 1.10's figure must be written once in the kit.

### 1.11 Espacios y jerarquías (C)

- **Question:** ¿Cómo se pasa de las coordenadas de una pieza a las del mundo, y de vuelta?
- **Before:** 1.10.
- **Leads:** **L1** 2.1 (eq. 2.8: a transform expressed in another space is **MAM**⁻¹); **also:** L2 §5.4.1–5.4.3
  (choose the cheaper space; attachments), G §5.3.11–5.3.12 (the wingtip example; active against passive; subscripts
  that cancel), RTR 4.1.5, 19.1.5 (a scene graph: transforms root to leaves, bounds leaves to root), E §4.2.2 (test in
  one object's space), GPP ch. 18 (the ship, the crow's nest, the pirate, the parrot).
- **Approach:** GPP's picture, L1's algebra. World = parent · local, computed on the way down the tree; never by a node
  walking up. GPP's dirty flag is not taught here (only its algebra; the pattern waits for 5.12, curriculum §6.4). The
  hook: the turret's barrel sits on the base, which sits on the world; the muzzle must be found in the world, and a
  target must be read in the base's frame.
- **The mathematics:** _W_child = _W_parent _L_child; _p_parent = **H**_p_local, _p_local = **H**⁻¹_p_parent; read
  right to left. Reparenting keeps the world pose: _L_′ = _W_newParent⁻¹ _W_node. A transform about a pivot:
  **T**(_c_)**R T**(−*c*) (L1 Ex. 2.8, RTR Fig. 4.2), the case of **MAM**⁻¹. Active against passive (G): moving the
  point one way equals moving the axes the other way. Forward, right and up are read from the world matrix's columns.
  Worked example (the figure's chain at its start): ship at (10; 0; −4) yawed 90°, nest at (0; 8; 2) on the ship,
  pirate at (−1; 1; 0) in the nest, unturned, parrot at the pirate's origin: the parrot is at (−1; 9; 2) in the ship's
  space and (12; 9; −3) in the world; back: **R**ᵀ((12; 9; −3) − (10; 0; −4)) = (−1; 9; 2).
- **The live figure:** GPP's chain ship → nest → pirate → parrot, each with its axes and a drag handle that moves it in
  its parent's space, plus a yaw slider for the ship and the pirate. The product _W_ = _L_ship _L_nest _L_pirate
  _L_parrot shown with the factor being changed highlighted; a selector "coordinates in: parrot / nest / ship /
  world" for the parrot's beak; a button "the parrot hops onto the mast" that reparents it without moving it. A pivot
  mode: a door on its hinge, **R** against **T**(_c_)**R T**(−*c*). Naive against correct: "parent on the right"
  multiplies _L W_parent_ and the parrot flies off. Panel rows: "parrot in ship", "parrot in world", "beak in …",
  "W (rows)". Test: at the example, (−1, 9, 2) and (12, 9, −3).
- **Traps:** multiplication order; local against world rotation (**MR** against **RM**); reading forward from the local
  matrix instead of the world one; the camera's up is not the world's; non-uniform scale in a parent skews its
  children.
- **Exercises:** (1) only the nest moves: which world matrices change? The nest's subtree. (2) Reparent the parrot onto
  the mast at (0; 4; 2) on the ship: its new local position is (−1; 5; 0). (3) Rotate 10° about the barrel's own _x_
  and about the world's _x_: write both as **MR** and **RM**, using eq. 2.8.
- **Our angle:** E's "test in one object's space" is named for part 3 (two boxes overlapping in the world can be
  separate in one box's space: fewer transforms, numbers near the origin where floats are dense). "En Manifold": a zone
  is tested in its own space (`world.ts`: the body's centre turned by `quat.conjugate`, and a world box around the zone
  from 1.8's |**M**| rule, `holdingBox`).
- **Sources:** L1 2.1; L2 §5.4.1–5.4.3; G §5.3.11–5.3.12; RTR 4.1.5, 19.1.5; E §4.2.2; GPP ch. 18 (free at
  [gameprogrammingpatterns.com](https://gameprogrammingpatterns.com/dirty-flag.html)).
- **Reuses:** archived 0-07 (the table and its ship as parent and child, the nose read in object, world and camera
  space): its figure can be the starting point for the chain.
- **Open:** G's wingtip in our conventions is (−25; 50; 13), not his (−25; 50; 3): a good "convenciones" exercise if
  room allows.

### 1.12 Una torreta con partes (P)

- **Question:** ¿Cómo se arma algo con piezas que giran unas sobre otras?
- **Before:** 1.7, 1.11.
- **Leads:** G §5.3.11.1 (yaw and pitch about named axes; a hierarchy of single-axis joints is the practical turret),
  §10.2.1 (axes red, green, blue); **also:** L2 §5.4.2 (an attachment point is a node with no geometry: the muzzle).
- **Approach:** the turret stops being a block with eight headings. The hook: aiming at a target on a high post needs
  pitch, and any yaw, not eighths; the naive composition pitches about the world's _x_, and with the base turned 90°
  the barrel rolls sideways instead of rising. That bug is the lesson's toggle and 1.13's preview.
- **The mathematics:** recalled: **R**_y and **R**_x from 1.8, world = parent · local from 1.11. New: the barrel's
  world matrix **T**(_E_)**R**_y(yaw) · **T**(pivot)**R**_x(pitch), the muzzle as its fourth column applied to
  (0; 0; −*L*; 1), the aim as its −Z column; a target in the base's frame through the rigid inverse, where "in front"
  is _z_ < 0 and "right" is _x_ > 0, and these agree with 1.7's dot and cross because the coordinates in an
  orthonormal frame are three dot products (1.9's **R**ᵀ). Worked example: pivot (0; 1; 0), _L_ = 1,2 m, yaw 0, pitch
  30°: muzzle (0; 1,6; −1,0392). Yaw 90°: _T_1 = (2; 0,5; −3) reads (3; 0,5; 2) in the base: behind, right; 1.7's tests
  agree (dot −2, ORIENT2D −3).
- **The project:** `mat.ts` (new: our own 4 × 4 matrices as tuples of 16 numbers, column-major like three.js, so the
  view copies them into `Object3D.matrix` with `matrixAutoUpdate = false`: `mat4.identity`, `translation`,
  `rotationX`, `rotationY`, `multiply`, `transformPoint`, `transformDirection`, `rigidInverse`, `column`); `turret.ts`
  (the state becomes `{ position, yaw, pitch }` in radians; `turretPose(turret)` returns the base's and the barrel's
  world matrices and the muzzle; `toBase(turret, p)`; `classify` reads targets in the base's frame; pitch clamped to
  [−10°, 60°]); `layouts.ts` (a second layout with targets at heights 0,5, 2 and 3,5 m); `main.ts` (Q and E yaw by
  15°, R and F pitch by 5°). Drawn: the base's and the barrel's axes, the aim ray from the muzzle, the cone. Playable:
  aim at any target with presses until it is inside the cone.
- **Check:** no console yet; each press logs the targets in the base's frame. Naive against correct: "pitch about
  world x" (**R**_x **R**_y order). Panel rows: "yaw (°)", "pitch (°)", "muzzle (m)", "aim", "target in base".
- **Traps:** order of the factors; reading the aim from the barrel's local matrix; joint limits as clamps on the
  angles; angles accumulate past 360° (harmless here, a wrap problem in 1.16).
- **Exercises:** (1) aim at layout 2's high target with the fewest presses, and say its yaw and pitch. (2) Add a
  third joint, a sight on the barrel, and draw its axes. (3) Show that `toBase(p).z` equals −(_p_ − _E_)·**f** for the
  base's forward **f**.
- **Our angle:** "Dónde Manifold eligió otra cosa": its state has no hierarchy and no matrices; each body has a world
  position and a quaternion, and attachments live in the presentation. The project keeps matrices in `mat.ts` because
  1.8–1.11 taught them, and its angles only until 1.16.
- **Sources:** G §5.3.11.1, §10.2.1; L2 §5.4.2.
- **Reuses:** nothing from the pilots; archived 0-07's `matrixAutoUpdate = false` technique.
- **Open:** `mat.ts` uses `Math.sin` and `Math.cos`, allowed before 2.9's rule; decide in 2.13 whether `mat.ts` stays
  out of the hashed simulation (it can: from 1.16 the state is quaternions, and matrices are only for drawing).
- **Para quien ya sabe** (curriculum §4.3): our own `mat.ts` beside three.js's `Matrix4`: the lessons 1.8–1.11 taught matrices, and the project shows them working, column-major like three.js so the view copies them in; from 1.16 the state is quaternions and matrices are only drawn.

### 1.13 Rotaciones I: los ángulos y el bloqueo de cardán (C)

- **Question:** ¿Por qué tres ángulos no alcanzan para girar bien?
- **Before:** 1.11.
- **Leads:** **G** §5.5.1–5.5.2 (the honest comparison of representations), **RTR** 4.2.1–4.2.2 (_E_(_h_, _p_, _r_);
  extraction with atan2; the lock appears in the algebra, eq. 4.26; constraining a rotation to one angle); **also:**
  L1 2.2.1 (a rotation happens in a plane), MF §9.2.1 (the hand experiment; the Apollo story).
- **Approach:** three ways to see the same fault. MF's hand: pitch 30° then yaw 30° is not yaw then pitch, so angles do
  not add like a vector. RTR's algebra: compose **R**_y(_h_)**R**_x(_p_)**R**_z(_r_) (three.js's order `'YXZ'`), set
  _p_ = 90° and the matrix depends only on _h_ − _r_: one freedom lost. And ours, from the project: a direction given
  by yaw and pitch is a longitude and a latitude (spherical coordinates); at the pole the longitude is undefined, which
  is the turret's own lock with two angles. The hook: the turret aiming straight up cannot tell which way its base
  should face.
- **The mathematics:** the product for _p_ = 90° written out: rows (cos(_h_ − _r_), sin(_h_ − _r_), 0), (0, 0, −1),
  (−sin(_h_ − _r_), cos(_h_ − _r_), 0); so (_h_, _r_) = (30°, 0°) and (60°, 30°) give the same matrix. Extraction
  (RTR): pitch from one entry, head and roll by atan2 (atan2 introduced in a sentence); unstable near the lock. A
  direction's yaw = atan2(−*x*, −*z*) and pitch = atan2(_y_, √(_x_² + _z_²)) (positive yaw to the left, positive pitch
  up). Worked example: the target at (3; 2; −4) from the pivot has yaw −36,87° (to the right) and pitch 21,80°. Near the
  pole, (0,01; 5; −0,01) and (−0,01; 5; −0,01) differ by 2 cm and by 90° of yaw (−45° against 45°). Interpolating angles:
  from yaw 170° to −170° the halfway angle is 0°, facing backwards, while the short way passes 180°. Degrees of freedom
  (G, corrected): **R**ᵀ**R** = **I** is six independent equations, 9 − 6 = 3; det = +1 removes no dimension, it picks
  one of two pieces (the other is the mirrors: part 10's seed).
- **The live figure:** two modes. "La nave": the archived 0-02 ship with yaw, pitch and roll sliders in `'YXZ'`, the
  three gimbal rings drawn, and the matrix's entries; at pitch 90° yaw and roll move it the same way and the rings
  coincide. "La torreta": drag a target point on a sphere around the turret (kit `sphere`); yaw and pitch readouts; near
  the pole the yaw readout spins while the point barely moves. Naive against correct: "interpolate angles" against a
  ghost "shortest arc" (labelled "en 1.15") between two directions. Panel rows: "yaw (°)", "pitch (°)", "roll (°)",
  "matrix (rows)", "h − r". Test: at pitch 90°, the matrices for (30, 90, 0) and (60, 90, 30) are equal to 1e−12.
- **Traps:** three.js's default order is `'XYZ'`; "yaw" is about whatever axis is up; asin returns pitch only in
  [−90°, 90°]; component-wise lerp of angles; wrapping differences into (−180°, 180°].
- **Exercises:** (1) extract (_h_, _p_, _r_) from a given matrix. (2) At _p_ = 90°, find two pairs (_h_, _r_) with the
  same matrix. (3) RTR's constrained rotation: from a target direction keep only the yaw (the turret's base is a
  cylindrical billboard, L2 §10.2.2).
- **Our angle:** the turret's joints are single-axis angles with limits, which is what angles are good at (G); what they
  cannot do is take the shortest way. "Dónde Manifold eligió otra cosa": no Euler angles in the state; angles only in
  data ("18° about _x_", built by `quat.fromDegrees` with its own sine).
- **Sources:** G §5.5.1–5.5.2; RTR 4.2.1–4.2.2; L1 2.2.1; MF §9.2.1; Dunn and Parberry ch. 7 (polar coordinates) and
  ch. 8.
- **Reuses:** archived 0-02's ship figure (`stage-0/02-quaternions`, its angle half) and its "Más a fondo" on why the
  angles lock.
- **Open:** none.

### 1.14 Rotaciones II: eje y ángulo (C) ◇

- **Question:** ¿Por qué todo giro es alrededor de un eje, y cómo se calcula?
- **Before:** 1.13.
- **Leads:** **L1** 2.2.2 (Rodrigues by decomposition), 4.4 (a rotation is two reflections); **also:** RTR 4.2.4 (three
  ways to rotate about an axis; eq. 4.27, a robust perpendicular), ten Bosch (rotation in a plane; rotors).
- **Approach:** Euler's theorem first (every rotation fixes a line), with MF's ball with marked axes as the intuition and
  a short proof in "Más a fondo" (a 3 × 3 rotation has eigenvalue 1: det(**R** − **I**) = 0). Then Rodrigues as the
  canonical "mismo movimiento". Then two mirrors, in the main path (curriculum §5): they explain the half angle and
  _q_ ≡ −*q* before quaternions arrive. The hook: the shortest way between two aims is one turn about one axis.
- **The mathematics:** **v** = **v**∥ + **v**⊥ about **â**; **v**∥ stays; **v**⊥ turns in the plane ⟂ **â**, where
  "**v**⊥ turned 90°" is **â** × **v** (same length): **v**′ = **v**∥ + cos θ **v**⊥ + sin θ (**â** × **v**). As a
  matrix: cos θ **I** + (1 − cos θ)**ââ**ᵀ + sin θ [**â**]×, with the skew matrix [**a**]× introduced (part 4 needs
  it). From a matrix back: trace = 1 + 2 cos θ, and (**R** − **R**ᵀ)/2 = sin θ [**â**]×. Two mirrors: reflecting
  through a plane and then through another (1.8's **I** − 2**n̂n̂**ᵀ twice) turns by twice the angle between them about
  their common line, in the sense from the first to the second; the pairs (**n**1, **n**2) and (−**n**1, −**n**2) give
  the same rotation. Worked example: **â** = (1; 1; 1)/√3, **v** = (1; 0; 0), θ = 120°: **v**∥ = (⅓; ⅓; ⅓),
  **v**⊥ = (⅔; −⅓; −⅓), **â** × **v** = (0; 1; −1)/√3, **v**′ = (0; 1; 0): a third of a turn about the diagonal
  permutes the axes. Mirrors with normals (1; 0; 0) and (cos 60°; 0; sin 60°): (0; 0; −1) goes to (0,866; 0; 0,5),
  which is **R**_y(−120°).
- **The live figure:** "Rodrigues": drag the axis's tip on a sphere and **v**'s tip; a θ slider; drawn: **v**∥ fixed,
  the circle traced by **v**⊥, the **â** × **v** arrow, the result. "Dos espejos": two mirror planes through an axis
  with draggable normals; a shape, its first reflection as a ghost, its second as a solid: the angle readout is twice
  the mirrors'. Naive against correct: "turn without splitting" uses cos θ **v** + sin θ (**â** × **v**), and when **v**
  is not perpendicular to **â** the result shrinks and leaves its circle. Panel rows: "v∥", "v⊥", "â × v", "v′
  (Rodrigues)", "v′ (three.js applyAxisAngle)", "angle between mirrors (°)", "rotation (°)". Test: at the example,
  (0, 1, 0) by both; mirrors at 60° give 120°.
- **Traps:** **â** must be unit; the sense of a positive angle; a perpendicular to a vector built carelessly is nearly
  zero (RTR eq. 4.27: zero the smallest component, swap and negate the others).
- **Exercises:** (1) the trace of **R**_y(30°) is 1 + 2 cos 30° ≈ 2,732. (2) [**a**]×**v** = **a** × **v**, checked
  for **a** = (2; 1; 0), **v** = (0; 1; 3) (gives (3; −6; 2), from 1.6). (3) A robust perpendicular to (2; 0,1; −1):
  (1; 0; 2).
- **Our angle:** "a rotation happens in a plane" (L1, ten Bosch), the thread to torque (part 4) and to bivectors.
  "En Manifold": `quat.rotate`'s formula **v** + _w_**t** + **q**×**t** with **t** = 2 **q** × **v** is Rodrigues in
  disguise, shown in 1.15.
- **Sources:** L1 2.2.2, 4.4; RTR 4.2.4; ten Bosch, [_Let's remove Quaternions_](https://marctenbosch.com/quaternions/).
- **Reuses:** none (new).
- **Open:** if folded (◇), the Rodrigues figure becomes 1.15's first section, and the two mirrors its intuition for the
  half angle.

### 1.15 Rotaciones III: cuaterniones y slerp (C)

- **Question:** ¿Cómo se guarda y se interpola un giro sin trabarse?
- **Before:** 1.14.
- **Leads:** **L1** 2.7 (the product with dot and cross inside; the sandwich expanded and matched with Rodrigues, the
  half angle from the double-angle identities; _q_ ≡ −*q*; conversion to a matrix and back by the largest component);
  **also:** G §5.4, §5.5.3–5.5.8 (the matrix's three faults as motivation; lerp along a chord against slerp along the
  arc; degrees of freedom; double cover), RTR 4.3 (eq. 4.46; slerp as a geodesic, Fig. 4.10), MF §9.2.2–9.2.4 (the
  pattern: a natural representation with boundary problems, one more number, a constraint, renormalize), Blow (nlerp),
  Eater and Sanderson (the picture of the 3-sphere).
- **Approach:** MF's pattern made literal, without shying from the 4D sphere: in the plane, a turn is a unit complex
  number and composing is multiplying; in space, unit quaternions. Quaternions arrive explained, by L1's argument: the
  sandwich _is_ Rodrigues. Slerp is derived as the geodesic, first for unit vectors on the visible sphere (it is "el
  mismo movimiento": rotate _p_ towards _q_'s rejection), then for quaternions with the same formula. The hook: the
  turret must keep a turn and interpolate it without locking and by the shortest way.
- **The mathematics:** Hamilton's rules; _q_1_q_2 = (_s_1_s_2 − **v**1·**v**2, _s_1**v**2 + _s_2**v**1 + **v**1 ×
  **v**2), the cross the only non-commuting part; conjugate, norm (multiplicative), inverse. Expand _q_**v**_q_\* with
  _q_ = (_c_, _s_**â**): (_c_² − _s_²)**v** + 2_s_²(**v**·**â**)**â** + 2_cs_(**â** × **v**); matching Rodrigues gives
  _c_ = cos θ/2, _s_ = sin θ/2. _q_ and −*q* give the same turn (the signs cancel); canonical _w_ ≥ 0. _q_2_q_1 applies
  _q_1 first. The unit quaternions are the 3-sphere: the tutorial's first manifold, and renormalizing projects back onto
  it. Slerp: with Ω the angle between _p_ and _q_, *q*⊥ = _q_ − (_p_·_q_)_p_ has length sin Ω, so
  slerp(_p_, _q_, _t_) = _p_ cos _t_Ω + (*q*⊥/sin Ω) sin _t_Ω = [sin((1 − _t_)Ω)_p_ + sin(_t_Ω)_q_]/sin Ω; negate _q_ when
  _p_·_q_ < 0. Nlerp: the same path, uneven speed. Worked example: _q_1 = identity, _q_2 = 90° about +Y = (0; 0,7071;
  0; 0,7071): slerp at ½ is 45°, (0; 0,3827; 0; 0,9239); at ¼ slerp gives 22,5° and nlerp 21,6°; _q_2 sends the
  forward (0; 0; −1) to (−1; 0; 0), to the left.
- **The live figure:** (a) the visible sphere: two draggable points, the great arc and the chord, eight points at
  _t_ = _k_/8 by slerp (even) and by nlerp (uneven), a _t_ slider. (b) An object between two orientations set by
  dragging it (an arcball, itself quaternion-based); a "q / −q" toggle that leaves it identical while its four numbers
  change sign; "long way" (no sign check) makes it take 270° instead of 90°. Naive against correct: "lerp the matrices"
  makes the object shrink and shear halfway (the middle of two rotations is not a rotation). Panel rows: "q (x, y, z,
  w)", "|q|", "angle Ω (°)", "slerp angle at t", "nlerp angle at t". Test: at the example, 22.5 and 21.6 at _t_ = 0,25;
  |q| = 1 within 1e−12.
- **Traps:** (x, y, z, w) against (w, x, y, z) (MF writes w first); only unit quaternions rotate cleanly; renormalize
  after products; compare and hash with a canonical sign; slerp tilts a camera's up (RTR); chained slerps jerk at the
  keys (squad, pointing to 5.9).
- **Exercises:** (1) the axis–angle quaternion is unit (L1 Ex. 2.11). (2) The 90° quaternions about _x_, _y_ and _z_
  (L1 Ex. 2.13). (3) "Corregí al autor": MA's eq. 3.11 writes (cos θ, **â** sin θ): show it turns by 2θ.
- **Our angle:** the 3-sphere comes back in 10.7 (rotations as the 3-sphere with antipodes glued: why one full turn is
  not undone and two are, the belt trick); the canonical sign is what 2.15's hash needs. "En Manifold": `Quat` as
  tuples (x, y, z, w), `quat.multiply`, `quat.rotate`, `quat.normalize`, and `quat.look`, which turns a frame into a
  quaternion with square roots only by Shoemake's largest-component branch (L1's precision advice). Slerp needs `acos`
  and `sin`: 2.6 explains why the hashed simulation will approach with nlerp instead.
- **Sources:** L1 2.7; G §5.4, §5.5.3–5.5.8; RTR 4.3; MF §9.2.2–9.2.4; Blow, _Understanding Slerp, Then Not Using
  It_; Eater and Sanderson, [_Visualizing quaternions_](https://eater.net/quaternions).
- **Reuses:** archived 0-02 (its quaternion half: the 15° buttons, the four numbers with |q| = 1, its "Más a fondo" on
  θ/2 and on slerp against nlerp).
- **Open:** the arcball must be in the kit (it is used again in 4.8).

### 1.16 Apuntar (P)

- **Question:** ¿Cómo se da vuelta algo hacia un blanco, por el camino más corto?
- **Before:** 1.12, 1.15.
- **Leads:** L1 1.6 (Gram–Schmidt), Ex. 2.14 (the quaternion that turns **v**1 onto **v**2 without trigonometry); RTR
  4.1.6 (look-at), 4.3.2 (eq. 4.56: the shortest arc, stable when the directions are close); G §5.2.4.8, §5.3.12.3
  (forward from a matrix); L2 §10.2 (billboards as aiming: the base is a cylindrical billboard).
- **Approach:** the hook breaks on screen: a lock-on that interpolates the turret's yaw and pitch angles goes the long
  way across ±180° (340° instead of 20°) and swings near the zenith. The fix is to interpolate the aim, a direction,
  along its great circle, and only then set the two joints. The turret's state changes from angles to quaternions; the
  lesson says so and why (0021).
- **The mathematics:** the look-at frame by Gram–Schmidt: **f** = normalize(_T_ − pivot), **r** = normalize(**f** ×
  **ŷ**), **u** = **r** × **f**. The shortest arc from **f**0 to **f**1: _q_ = normalize(1 + **f**0·**f**1,
  **f**0 × **f**1), proved by the half angle: (1 + cos Ω, sin Ω **â**) = 2 cos(Ω/2)(cos(Ω/2), sin(Ω/2) **â**);
  opposite directions need any perpendicular axis (1.14's robust one). The lock-on: after _k_ of _N_ presses the aim is
  slerp(1, _q_, _k_/_N_) applied to **f**0, so the aim follows the great circle. The joints from the aim: the base's
  quaternion is the shortest arc from (0; 0; −1) to the aim's horizontal part, normalized (a turn about +Y, since both
  are horizontal); the barrel's is the shortest arc, in the base's frame, from (0; 0; −1) to (0; _f_y_; −*h*), with _h_
  the horizontal length. At the pole the horizontal part vanishes and the base keeps its yaw. Worked example: pivot
  (0; 1; 0), aim (0; 0; −1), target (3; 2,5; −4): **f**1 = (3; 1,5; −4)/5,2202 ≈ (0,5747; 0,2873; −0,7663),
  Ω ≈ 39,98°, _q_ ≈ (0,1529; −0,3058; 0; 0,9398); with _N_ = 4 the remaining angle reads 39,98°, 29,99°, 19,99°, 9,995°,
  0°; at the end the yaw is −36,87° (the horizontal part is (0,6; 0; −0,8)) and the pitch 16,70°.
- **The project:** `quat.ts` (new: `quat.identity`, `multiply`, `conjugate`, `rotate`, `normalize`, `fromAxisAngle`,
  `shortestArc`, `slerp`, `toMat4`); `turret.ts` (the state becomes `{ position, base: Quat, barrel: Quat }`, announced;
  `turretPose` keeps its name and meaning; new `lockStep(turret, target, k, N)`; Q, E, R, F now multiply by fixed step
  quaternions; the pitch limit checked on the barrel's aim); `main.ts` (Tab selects a target, L advances the lock by one
  press, _N_ = 4). Drawn: the great-circle arc with its four stops, the shortest-arc axis, the look-at frame at the
  target. A toggle "view from the barrel" uses the full look-at frame as a camera. Playable: lock onto any target in four
  presses.
- **Check:** no console yet; each lock press logs the remaining angle (the five values above). Naive against correct:
  "interpolate angles". A second toggle, "slerp the whole frame": slerping between two look-at frames rolls the barrel
  midway, which a turret without a roll joint cannot do.
- **Traps:** opposite directions; nearly equal directions (return the identity); the pole; canonical sign before
  slerp; three.js's `lookAt` turns a non-camera's +Z to the target, not its −Z (curriculum §2).
- **Exercises:** (1) lock from yaw 170° to a target at yaw −170°: the aim turns 20°. (2) Prove that the base's
  shortest arc between two horizontal unit vectors is a turn about +Y. (3) With _N_ = 3, list the remaining angles for
  the example.
- **Our angle:** "Más a fondo: girar sin trigonometría": for _N_ a power of two the presses need no sine at all, since
  _q_^½ = normalize(1 + _q_) for _w_ ≥ 0 (the same half-angle identity); two halvings give the quarter turn, and each
  press multiplies by it, with only + − × ÷ √ (2.9 explains why that matters). "Dónde Manifold eligió otra cosa":
  `quat.look` builds an orientation from three axes with square roots only, never angles.
- **Sources:** L1 1.6, Ex. 2.14; RTR 4.1.6, 4.3.2; G §5.2.4.8, §5.3.12.3; L2 §10.2.
- **Reuses:** none from the pilots.
- **Open:** the change of the turret's state from angles to quaternions is decided by this sheet, not by the
  curriculum; it keeps part 2's hashed turret free of `atan2`.

### 1.17 El juego: la torreta (P)

- **Question:** ¿Qué hace falta para que algo sea un juego?
- **Before:** 1.16.
- **Leads:** GPP ch. 7 (State: an enumeration and a switch; entry actions), ch. 4 (Observer at its smallest; the lapsed
  listener); MA §2.1.1 (a simple rule done well looks clever).
- **Approach:** the hook: the turret aims and locks, but nothing is at stake (no goal, no limit, no end, no restart),
  and the keys are wired into the turret's code, so a "game over" phase where Q must not turn, or on-screen buttons for a
  touch screen, would mean `if`s everywhere. Two small patterns answer, each earned by its failure. GPP's ladder stops
  at the enumeration here (the machine is 2.12; the full ladder 5.4).
- **The mathematics:** recalled only: the cone (1.5), the two signs (1.6), the muzzle and aim (1.12), the lock (1.16).
  New and small: booleans `playing`, `won`, `lost` allow 2³ = 8 combinations of which 3 mean something; a type with
  three values makes the other five unwritable.
- **The project:** `input.ts` (new: `BINDINGS`, a table from `KeyboardEvent.code` to logical actions `turnLeft`,
  `turnRight`, `pitchUp`, `pitchDown`, `nextTarget`, `lockOn`, `fire`, `restart`; `onPress(action, handler)`,
  event-driven, auto-repeat ignored; on-screen buttons dispatch the same actions); `game.ts` (new: `Phase`, a union of
  `'aiming'`, `'won'` and `'lost'`; `createGame(layout)`; `act(game, action)` with a `switch` on the phase; entry actions
  that reset moves and score; `onHit(listener)` feeding the score and a text flash); `layouts.ts` (three levels, each
  with its targets and its par); the rules of the part sheet (moves, the lock only for targets in front, the 4° cone,
  hints). Playable: the whole game.
- **Check:** no console yet. Each action logs `{ move, action, phase }`; a fixed sequence of presses on level 1 must end
  in `won` with the same move count every time (the game is deterministic by construction: no time, no chance).
- **Traps:** booleans for phases; re-registering the score listener on every restart makes each hit count twice (GPP's
  lapsed listener): register once at start-up, or rebuild everything from data on restart; a key that also types in the
  editor.
- **Exercises:** (1) beat level 1's par. (2) Add a fourth action, "fire twice", and only touch `BINDINGS` and `act`.
  (3) Restart five times with the naive registration and count the score on one hit (6 instead of 1).
- **Our angle:** the game is a list of actions; replaying that list replays the game: 2.14's idea, planted. "Patrón"
  boxes: State (enumeration and switch: when it pays, what it costs) and Observer (who, not when). "Dónde Manifold eligió
  otra cosa": actions are declared, and the Dojo's `inputs` command lists what a player can ask for and which key asks.
- **Sources:** GPP ch. 7, ch. 4 (free at [gameprogrammingpatterns.com](https://gameprogrammingpatterns.com/)); MA
  §2.1.1.
- **Reuses:** none from the pilots; archived 1-04's binding table idea.
- **Open:** the par of each level should be computed, not guessed: a breadth-first search over the turret's states is
  cheap and is 7.2's first graph in disguise; the writer runs it once and stores the result. The design numbers (15°,
  5°, 4°, _N_ = 4, 12 m) are to be tuned in play.

---

## Problems found in the curriculum

1. **`vec.ts` "grows" in 1.7, but nothing adds it before.** With "Moverse" moved to 2.8, the pilot's project lesson
   that brought `vec.ts` is gone from part 1. 1.7 adds it whole (the five functions of 1.4 plus `dot` and `cross`).
2. **1.12 needs the single-axis rotation matrices before 1.13.** The curriculum cites L1 2.2.1 (rotation about the
   axes) in 1.13, but the turret's base and barrel rotate in 1.12. 1.8 derives **R**_y and **R**_x as "where the axes
   go"; 1.13 composes them into Euler angles.
3. **The turret's state must change from angles to quaternions in 1.16.** The curriculum is silent. Angles cannot take
   the shortest arc, and recovering them from a direction needs `atan2`, which 2.9's rule bars from the hashed
   simulation that the turret joins in 2.13. 1.16 announces the change (0021); `turretPose` keeps its name.
4. **Slerp with an arbitrary parameter needs `acos` and `sin`,** which 2.9's rule bars from what is hashed, and
   `trig.ts` (2.13) only has sine and cosine. Part 1 is unaffected (no hash, and _N_ = 4 can be exact by halving);
   part 2's sheet handles the timed lock-on with nlerp (see `parte-02.md`).
5. **The pilot's 1.3 animates a ball by a closed-form path,** which is harmless but sits badly in a time-free part; the
   sheet replaces it with the turret's targets as data and a movable camera.
