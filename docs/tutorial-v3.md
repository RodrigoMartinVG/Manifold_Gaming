# The tutorial, third version: a book

**Status:** accepted, and the tutorial since 2026-11-18 ([decision 0030](decisions/0030-the-book.md)); revised the same day after the author read the first
prototype and after [the research on how other courses are ordered](tutorial-research.md): the book starts from the
screen and the plane, and every chapter shows two ways. It replaces the plan of
[decision 0021](decisions/0021-a-new-tutorial.md) and [the curriculum](tutorial-curriculum.md) as the way the tutorial is
written; their research (the books weighed, the worked examples, the conventions, the traps, the lesson sheets) is
kept and reused as material. Text quoted as it would appear on the site is in Spanish; the rest in English.

## 1. Why a third version

The second version is correct and complete, and it does not read well. Every lesson has the same twelve sections
(El problema, La matemática, El código, Probalo, Lo importante, Más a fondo, Sutilezas, Para quien ya sabe, En los
motores, En Manifold, Para practicar, Para saber más), and tests enforce the shape: the main path over 60 %, one or
two "Más a fondo", at least two traps, at most five lines on other engines. Each rule had its reason; together they
produce reference entries, not a story. Each page starts from zero, visits the same stations and ends the same way. The
mathematics arrives as a section, a block of definitions and proofs, instead of as the moment something is understood.
The split between concept and project lessons cuts the story in two: the project moves in jumps, and most of the time
the reader is in a separate laboratory reading a panel of numbers. The tests check the form, not whether the page is a
pleasure to read.

The author's verdict (2026-11-18): it has lost its natural flow, and we are wasting good conditions on
self-imposed restrictions. This document starts again from the spirit, and keeps from before only what serves it.

## 2. The spirit

As it would open the book:

> **Construir un mundo para entenderlo.** Este libro cuenta cómo se construye, desde una página en blanco, un mundo
> físico en 3D que corre en el navegador, y los juegos que se juegan en él. Cada pieza se explica hasta la matemática
> que la hace funcionar, en el momento en que hace falta para seguir construyendo. Al final tenés tu propia versión de
> una noche en un mundo chico: una torre que se sube al atardecer, una fortaleza en la que se entra a oscuras y una
> muralla que se defiende hasta el alba.

Seven commitments, which are the measure of every chapter:

1. **Each chapter is a story.** We want to see something. We try the obvious, and it breaks where it can be seen. We
   look closer, the mathematics says why, we fix it, and we have something new to play with. The idea sets the
   chapter's shape; no template does.
2. **The mathematics is the moment of understanding.** It arrives when the reader already holds the question, and it
   feels like relief. It is exact, proved when the proof illuminates, and told as reasoning ("miremos este
   triángulo...") rather than as a block of theorem and proof. Its depth is the question's (§5).
3. **There is always something to play with.** Every chapter ends with a toy the reader can poke, and every part
   with something playable. The games proper can wait: the author prefers solid foundations, gymnastics and
   intuition to an early game (2026-11-18).
4. **The stories are real.** Manifold was built in public and its log is full of them: guards that pushed against the
   fallen for ever, a sphere that came out different on every run, a diagonal that was 41 % faster, a shot that must
   give the same result in every browser. They are the hooks. Manifold is "the big version" of what the reader builds
   small, the place to look to see where an idea goes.
5. **One voice, and margins.** First person plural, honest, with humour where it fits, admitting what it does not
   know and telling its mistakes. What is not the story goes to the margin: how other engines do it, the note for
   whoever already knows, a longer proof, where it lives in Manifold. Traps live inside the story, when they happen.
6. **The reader's time is respected.** A chapter is one sitting (30 to 45 minutes), and it says at its start what it
   builds. Nothing is there to fill a section.
7. **Two ways, always.** What a chapter makes visible it makes by hand and with the library (the canvas in the plane,
   three.js in space, Rapier for rigid bodies), and shows them together, side by side or behind a switch. They agree,
   or the difference is the lesson. Where there is no library, the comparison is with Manifold, or with the exact
   answer when the mathematics gives one (a true area, a parabola, a spring's cosine): chapter 1 found that the
   library is another approximation, not the truth.

## 3. The reader, the project, the tools

**The reader** programs a little (JavaScript: variables, functions, `if`, `for`, objects) and remembers secondary
school mathematics. Everything else the book teaches: the linear algebra, the calculus that a game needs, the
geometry, the physics. Someone who knows more reads faster and opens the margins.

**The project is one program that grows,** always runnable (as Crafting Interpreters's and tinyrenderer's), set
in the night's world (decision 0029's; the research leaves the setting free, and the author chose it). Parte I builds
our renderer and ends walking the yard at dusk. Each later part ends with something playable there: the turret
against moving targets (II), a tower of boxes knocked down (III), the tower climbed (IV), the fortress and its
guards (V), the corners joined into one night with a menu and saves (VI), and the wall held until dawn (VII): one
map that each part adds a corner to (§7, the project's thread). TypeScript, with `three.js` for the drawing from
chapter 7 and Rapier for the rigid bodies from chapter 32.

**Two ways, side by side.** The world is plain data, and there are two ways to bring it to life: ours, written in
the book, and the library's. In Parte I that is two renderers drawing the same world; later, our integrator,
our rays, our particle engine and our character controller against three.js's and Rapier's. The reader's code draws:
the hand-made side is a picture, set beside the library's, not a row of numbers. Our renderer ends Parte I drawing a
small world and slowing down with a large one, which is where the graphics card earns its place; it stays as a lab
for what a later chapter does by hand (a shadow map, chapter 55).

**The book ends at dawn.** Playing with others (the wall held by two, online) and the strange worlds (gravity as a
field, a small planet, a Möbius strip) are a second volume.

## 4. What a chapter is like

No fixed sections: the idea sets the shape. A few constants, because they serve the reader, most of them taken
from the courses that do it best ([tutorial-research.md](tutorial-research.md)):

- **It opens with where we are and where we are going:** the chapter's place on chapter 0's map (as Nand2Tetris
  places each chapter on its stack), and a picture of what it will have built, with the wish that drives it.
- **Three kinds of block, each promising one thing,** and the reader can tell which at a glance (the author's
  reading, 2026-11-18: mixed, a reader cannot tell whether the code in front of them is the lesson or a figure's
  machinery):
  - **A figure** is to look at and touch, never to read: no code button, a number and a caption that says what to
    look at, and how it is made only as a quiet link at its foot. Its code is the lab kit's and the figure's own,
    which the text does not teach.
  - **The reader's code** is the project, in the editor: only what the text has introduced, read, changed and broken.
    It always comes after a **consigna** (the `Consigna` component): what to change, what to expect before running it
    (PRIMM's "predict, then run"), and where to see it, with the answers folded. What makes the example work without
    being the lesson (a viewer, a generator explained later) is a **tool of the book**, in the project's
    `herramientas/` folder: its tabs last, in italics, read-only, with a note when opened; the chapter that teaches it
    makes it the reader's.
  - **A fragment** is fixed code in the text, read while it is explained.
- **The story,** in short sections with plain titles, and a **figure every few paragraphs**, as many as the ideas
  need, each with one job: something to drag, a slider, a naive version beside the right one. The figure is where
  the reader sees the break, and where the mathematics is checked: the numbers in the text are the ones the figure
  shows.
- **Short exercises right after each idea** (as The Nature of Code's), often asking first what will happen before
  it is run (PRIMM's "predict, then run"), their answers a click away (as LearnOpenGL's, Pikuma's and tinyrenderer's).
  Now and then a broken version to repair (as Unity's challenges).
- **The project's code** for the chapter, in the editor, its changes marked, runnable and editable, after its
  consigna. The project and the figures are one story: a figure isolates an idea, the project uses it a few
  paragraphs later.
- **Margins** (asides beside the text, collapsed on a phone): _En otros motores_, _Para quien ya sabe_, _Una
  demostración más larga_, _En Manifold_. Read when wanted; nothing in the story depends on them.
- **Diario del motor:** a boxed true story from Manifold's log, where one fits.
- **Both ways, compared** (§2, commitment 7): by hand and with the library (or Manifold, or the exact answer),
  together. Which comes first depends on
  the chapter (sometimes the library's fifteen lines surprise, sometimes ours is small enough to go first); the
  comparison is never skipped, and it ends with what the library does beyond ours (Nand2Tetris's "perspective").
- **It ends with what we have** (playable), **two or three challenges** on the project with what should happen, and
  a line on where the idea comes back.

Reference that is not story lives on its own shelf: **La caja de herramientas** (the notation and the conventions,
every formula of the book on one page, a glossary), **Los motores** (how three.js, Unity, Unreal and Godot decide
the questions the book meets, one page per subject), and the lab kit's code.

## 5. The mathematics

The rule of [curriculum §4.6](tutorial-curriculum.md) stays, because it is right: **the game's question sets the
depth**, and each result is **proved** (a page of first-years university mathematics), **stated precisely with its
idea** (hypotheses whole, why it is believable, where the proof is), or **named and pointed to**. Nothing false for
the sake of simplicity. What changes is the voice: a derivation is told as the reasoning that answers the chapter's
question, with its steps in the text and its picture in a figure, and the formal version in a margin when it adds
rigour without adding understanding. Precision is never traded for flow; flow comes from order and motivation.

Two orderings, from the research. **The simple form first, the general one when it is needed:** perspective as a
division (chapter 7) before the projection matrix (chapter 15), rotation by sine and cosine before matrices, the
painter before the depth buffer, explicit Euler before better integrators (as Pikuma and The Nature of Code do).
**An idea met again, one step higher:** the dot product is proved bouncing a ball (chapter 6), tells which faces are
seen (10), lights them (12), slides a character along a wall (34) and lets a guard see (41); barycentric coordinates
fill a triangle (3), interpolate its depth (11) and its texture (13), and say where a ray hit (27); matrices go from
the plane's 3×3 (5) to space's rigid 4×4 (9) and the projection's (15). Each return is short, and says where the idea was first met.

The second version's research (the worked examples, the traps, which book proves what, the conventions table) is
the material each chapter draws on.

## 6. Quality, and how it is checked

Tests check what matters to a reader, not the page's shape:

- every figure runs without errors, in Chromium, Firefox and WebKit;
- every number the text states is the one its figure shows (the browser tests read them);
- the project compiles and its unit tests pass at every chapter;
- each exercise's answer is the one its figure or the project gives.

And one check no test does: **a reading.** Each chapter is read start to end, aloud or as if, by the author before
it is published, noting where the reading stumbled, where a question came before its answer, and where a figure was
needed and missing. A chapter is done when that reading flows.

## 7. The syllabus

A map, seven parts, 58 chapters and an epilogue, derived from the research
([tutorial-research.md §5.2](tutorial-research.md#52-the-whole-book-re-derived) says what changed and why) and
reviewed for coherence on 2026-11-18 (§7.1). Each part takes its order from the courses that teach its subject best,
and starts in the plane where the subject allows. Each part ends with something playable in the night's world, the
first of them the yard at the end of Parte I.

For each chapter: what we want; the two ways (_by hand_, and _with_ the library, or _against_ Manifold or the exact
answer when there is no library); what breaks; the mathematics (with its level, §5, when not 1); and what we can play
with at the end.

**The project's thread.** One program that grows, always runnable, in one world (decision 0029's): a night map to
which each part adds a corner. Parte I draws it, first as the night sky of chapter 1 (which comes back as the yard's
sky), then as the yard at dusk; Parte II puts the turret in it, against moving targets; Parte III a tower of boxes;
Parte IV the tower to climb; Parte V the fortress and its guards; Parte VI joins the corners into one night with a
menu and saves; Parte VII makes it night, and the wall is held until dawn. Our renderer draws until chapter 16 and
stays afterwards as a lab for small scenes, where a chapter needs to do by hand what three.js does (shadows, chapter
55).

**0. El mapa.** One frame of a game, as a diagram the reader steps through: read the controls, move things, let them
collide, let the minds decide, draw (project, fill, light). Each piece carries the part that builds it. How to read
the book, the two ways, what is needed. _(As Nand2Tetris's chapter 0 and Crafting Interpreters's map.)_

### Parte I. Dibujar

From a pixel to a world on the screen. _Order from_ the from-scratch renderers (Gambetta, tinyrenderer, Pikuma) and
WebGL2 Fundamentals: the plane first (pixel, line, triangle, shapes that move, matrices, vectors), then space
(projection, rotation, parts, faces, depth, light, textures, camera, projection as a matrix), and last the graphics
card. _Ours:_ a small software renderer on a 2D canvas. _The library:_ the canvas's own drawing in the plane, three.js
in space. _Play at the end:_ walking the yard at dusk, collecting glowing spheres.

1. **La pantalla.** We want to paint something. The screen is a grid of pixels, each three numbers; a canvas is that
   grid in memory. _By hand:_ a gradient, a rectangle, a circle by asking which pixels are inside. _With the canvas:_
   `fillRect`, `arc`, and its gradient's dither. Breaks: our circle's edge is jagged and the canvas's is smooth;
   several samples per pixel smooth ours, and nearer the true area than the canvas's. Mathematics: the screen's
   coordinates (y downwards), a pixel's place in memory, distance by Pythagoras, coverage as an average and its error.
   Play: a night sky, painted by hand beside the canvas's.
2. **Líneas.** We want to join two stars. _By hand:_ the points between A and B, $(1 - t)A + tB$. Breaks: one step
   per pixel in x leaves holes in steep lines; as many steps as the longer side does not (Bresenham in a margin).
   _With the canvas:_ `lineTo`, and why a one-pixel line at whole coordinates comes out two pixels wide and grey.
   Mathematics: interpolation, weights that add up to one, no holes and no pixel too many (proved). Play:
   constellations and polygons.
3. **Triángulos.** We want solid shapes. _By hand:_ which side of a line a point is on (a signed area, a 2×2
   determinant), a pixel inside a triangle by three signs, only in the box around it; barycentric coordinates to blend
   the corners' colours; the rule that leaves neither gaps nor doubled pixels between neighbours. _With the canvas:_
   `fill`, compared pixel by pixel, and its seam where two triangles touch. Mathematics: the determinant as a signed
   area (proved), barycentric coordinates (P as the corners mixed, proved in a margin). Play: hills of two triangles
   that share an edge with no seam, and a stained-glass window with a colour at each corner.
4. **Girar y mover.** We want shapes that turn and travel. The loop arrives: erase, update, draw, and the time between
   frames. _By hand:_ turning by sine and cosine (where the axes go), shifting, scaling. _With the canvas:_ `rotate`,
   `translate`, `scale`. Breaks: moved and then turned, it orbits instead of spinning; speed counted per frame runs
   faster on a faster screen. Mathematics: the rotation and why it keeps lengths, angles in radians, the order of
   moves. Play: shapes that spin and travel.
5. **Matrices.** We want a sun with an earth and a moon, each turning on the one before. _By hand:_ a move as a table
   of where the axes go, a 3×3 one to carry the shift too (homogeneous coordinates), composed by multiplying; a
   hierarchy by multiplying down it; the inverse, to know what the mouse pressed on a turned piece. _With the canvas:_
   `setTransform`, `save` and `restore`, its own stack of matrices. Breaks: multiplied in the wrong order, the moon
   leaves its earth. Mathematics: matrices, their product and its order, the inverse, local and world frames. Play: a
   small solar system.
6. **Flechas.** We want a ball that bounces off a slanted wall. Changing the sign of x or y only works for straight
   walls. _By hand:_ vectors, points against vectors, length (chapter 1's Pythagoras), normalizing; the dot product,
   proved three ways (perpendicular by Pythagoras, the shadow, the cosine); projection and rejection; the reflection
   $v - 2(v \cdot n)\,n$, and the law of cosines that falls out of it. _With three.js:_ its `Vector2`, beside ours.
   Mathematics: vectors in the plane, the dot product and its geometry, the energy a bounce keeps. Play: a ball among
   slanted walls.
7. **Un cubo.** _With three.js:_ fifteen lines, and the cube is a flat square, the first disappointment of every
   three.js course. _By hand:_ eight corners drawn with chapter 2's lines, first dropping the depth (orthographic, as
   tinyrenderer starts), then dividing by it (perspective); the screen's y goes down and the world's up, and the step
   to pixels turns it over. Lift the eye and step aside, and both are a cube, ours on three.js's edges. Breaks: corners
   behind the eye come back mirrored. Mathematics: coordinates in space and the right hand, the projection by similar
   triangles, the field of view. Play: move the eye; the two drawings move together.
8. **Girar en el espacio.** Chapter 4's rotation about three axes; 3×3 matrices. Breaks: two turns in the other order
   give another cube, and three.js's Euler order decides which. Mathematics: rotations in space do not commute,
   orthogonal matrices (the transpose is the inverse). _With three.js:_ its `Euler` and `Matrix3`. Play: a cube turned
   by sliders, two orders side by side.
9. **Una torreta con partes.** We want a turret: a base that turns and a barrel that tilts on it. _By hand:_ chapter 5's
   matrices in space, 4×4 to carry the shift (homogeneous coordinates again: a point moves, a direction only turns),
   a hierarchy of parts, local and world. _With three.js:_ `Group` and `Object3D`, their `matrixWorld` set against
   ours. Breaks: multiplied in the wrong order, the barrel flies off the base. Play: aim the turret.
10. **Caras.** A model is a list of triangles; we read one from a file, by hand and with three.js's loader.
    Mathematics: a face's normal by the cross product (chapter 3's signed areas in space, the right hand as a theorem),
    "does this face look at me?" by chapter 6's dot product, back-face culling; the painter's algorithm, and two
    crossing faces where it fails. _With three.js:_ the same breaks, by turning its safeguards off. Play: a solid model.
11. **Profundidad.** _By hand:_ the depth buffer, with chapter 3's filler and the depth interpolated by barycentric
    coordinates. _With three.js:_ what WebGL does with it. Breaks: two surfaces too close flicker. Mathematics:
    interpolating depth; why the near and far planes matter (depth precision, level 2). Play: crossing objects drawn
    right.
12. **La luz.** A face is as bright as the cosine between its normal and the light: the dot product again (Lambert).
    Flat and smooth shading. _With three.js:_ a light and `MeshLambertMaterial`. Breaks: our faces are darker than
    three.js's, because colour is not linear (sRGB and its conversion). Play: the sun round the scene.
13. **Texturas.** Images on faces: coordinates on the image, interpolated across the triangle. Breaks: on a floor seen
    at a slant the image bends; dividing by the depth straightens it (perspective-correct interpolation, proved); far
    away it shimmers, and mipmaps are chapter 1's samples averaged beforehand. _With three.js:_ its textures and their
    filters. Play: a floor and a wall with their images.
14. **La cámara.** We want to walk through the world. Moving the camera is moving the world the other way (chapter 5's
    inverse); a camera that looks at a point (a frame from cross products). The keys, the mouse and the pointer lock
    arrive here, the least that walking needs (chapter 33 does the rest). _With three.js:_ `lookAt` and its
    `matrixWorldInverse`, set against ours. Play: walk through a small world.
15. **La proyección.** Chapter 7's division, written as a 4×4 matrix with its $w$ (homogeneous coordinates that
    project), set against three.js's `projectionMatrix` number for number; the near and far planes; cutting what is
    behind the eye (clipping against the near plane), which chapter 7 left mirrored. Play: the frustum, seen from
    outside.
16. **La placa de video.** Our renderer with a whole world: the frames per second fall. What a graphics card does in
    parallel, its vertex and fragment stages, and our per-pixel function written as a first shader. From here three.js
    draws, known from inside; ours stays as a lab. Play: **el patio al atardecer**, by our renderer (small) or three.js
    (whole), under chapter 1's sky.

### Parte II. Mover

Time and motion, in space. _Order from_ The Nature of Code (velocity, then forces, then oscillation, then particles;
"what we wrote was Euler" told after it is used), Freya Holmér's lectures (interpolation) and Pikuma (the fixed
step); and, because Manifold is built on it, determinism, which no course teaches this early. _Ours:_ our vectors and
integrators, against the exact motion where there is one. _The library:_ three.js's `Vector3`, `Quaternion`,
`MathUtils` and instanced drawing. _Play at the end:_ **tiro al blanco**, the turret against moving targets.

17. **El reloj.** Chapter 4's loop and its problems: on a slow machine things jump, on a fast one they hurry, a pause
    sends them flying. The fixed step and its accumulator; drawing between two states. _Against Manifold:_ its world's
    fixed step. Play: the same motion on every screen.
18. **Velocidad.** Chapter 6's vectors, moving and with a z: a position and a velocity; the keys give a direction.
    _With three.js:_ `Vector3`, beside ours. Breaks: diagonal keys move 41 % faster, until the direction is
    normalized. Play: steer a ball, then a ship in space.
19. **Acelerar.** Velocity that changes: constant, random, towards the mouse; integrating by steps. _Against the exact
    answer:_ the parabola. Breaks: what we wrote is explicit Euler, and it gains energy; the semi-implicit one does
    not. Mathematics: integration and its error, the parabola, leading a moving target (a quadratic). The turret
    (chapter 9) fires arcs; a hit is told by chapter 1's distance between centres, the simplest test (Parte III does it
    properly), and a fast shot passes through its target, which chapter 30 fixes. Play: the turret fires arcs.
20. **Fuerzas.** Newton's laws as code: forces added up, mass; gravity, friction, drag, attraction. _Against the exact
    answer:_ an orbit's energy, which ours should keep. Mathematics: $F = ma$, the laws of friction and drag,
    gravitation, orbits (stated). Play: a ship among planets.
21. **Oscilar.** Angles that change: angular velocity, waves, springs, damping, a pendulum. _Against the exact
    answer:_ the spring's cosine. Breaks: a stiff spring explodes. Mathematics: sine and cosine as motion, Hooke's law,
    the stability of an integrated spring (proved for the linear one). Play: things on springs; a rope.
22. **Suavizar.** Interpolation: lerp, its inverse, remapping, easing; following a target smoothly. _With three.js:_
    `MathUtils.lerp` and `MathUtils.damp`. Breaks: "a tenth of the way each frame" depends on the frame rate; the
    exponential does not (proved). Play: a cursor and a camera that glide.
23. **Orientar.** Orientation in space. Breaks: near straight up the turret locks, and angles interpolated wobble
    (with three.js's Euler angles too). Mathematics: the gimbal lock, every rotation is about an axis (Euler's
    theorem, level 2), axis and angle, quaternions and slerp. _With three.js:_ `Quaternion`, beside ours. Play: a
    lock-on that glides.
24. **Partículas.** Many small things: emitters, lifetimes, a pool to reuse them; fire, smoke, sparks. _By hand:_ one
    mesh per particle. _With three.js:_ `InstancedMesh`, thousands in one call. Breaks: creating and dropping
    thousands a second stutters; the pool fixes it. Play: the turret's targets, with sparks when one falls.
25. **Lo mismo, otra vez.** We want replays: the shooting gallery played again from its inputs alone, and a ghost to
    race. Breaks: the replay drifts. Chapter 24's sparks and the targets' wandering called `Math.random`, a speed read
    the clock, and the same numbers added in another order gave another sum. Mathematics: numbers that are not exact
    (rounding, why $(a + b) + c$ and $a + (b + c)$ can differ), chance with a seed (chapter 1's `random.ts`, explained
    at last), a hash of the world. _With the library:_ the browser's `Math.random`, which cannot be given a seed.
    _Against Manifold:_ its reference replays, the same hash in three browsers. Play: **tiro al blanco**, with replays
    and a ghost.

### Parte III. Chocar

What touches what, and what happens then. _Order from_ Millington (detection, then response, then rigid bodies,
each stage a working engine), MDN (the formulas by hand, then a library) and The Nature of Code (the library arrives
when collisions get hard). The plane first, then space. _Ours:_ our tests and a particle engine. _The library:_
three.js's boxes, spheres, `OBB` and `Raycaster`, then Rapier. _Play at the end:_ **voltear la torre**.

26. **¿Se tocan?** Point in circle and box, circle and circle, box and box, the closest point; then spheres and boxes
    in space. _With three.js:_ `Box3` and `Sphere`. Breaks: a turned box fools the box test. Play: things that light up
    when they touch.
27. **Un rayo.** A ray stops at the first thing: against a plane, a sphere, a box, a triangle (barycentric again); the
    mouse picks. _With three.js:_ `Raycaster`. Breaks: at a grazing angle it misses. Mathematics: solving for the
    distance, the sphere's quadratic. Play: shots that stop where they hit.
28. **Formas de verdad.** Convex polygons and the separating axis (proved in the plane, stated in space), turned boxes,
    capsules; GJK named. _With three.js:_ `OBB`. Play: shapes at any angle that collide right.
29. **Responder.** Touching is not enough: push apart and bounce. Chapter 6's reflection, impulses, restitution,
    friction, resting contact. _Against the exact answer:_ momentum kept, energy lost only as restitution says.
    Breaks: resting balls jitter and sink. Mathematics: the impulse along the normal, correcting positions. Play: a box
    of bouncing balls, our particle engine.
30. **Lo que va rápido atraviesa.** Breaks: chapter 19's fast shot crosses its target, and a fast ball a thin wall,
    between two steps; a thousand balls slow everything. Mathematics: swept tests, continuous detection, grids and
    trees that test only neighbours. _Against Manifold:_ its bolt, stepped by segments of ray. Play: a ball steered
    among thin walls.
31. **Cosas que giran.** A box that lands on a corner tips over. Rigid bodies: the centre of mass, torque, the inertia
    tensor (the spectral theorem stated), an impulse at a point, the orientation integrated with chapter 23's
    quaternions. Play: a box that tumbles.
32. **Un motor de verdad.** Rapier beside our engine, behind one switch: what ours does, and what Rapier adds
    (islands, sleep, continuous detection, sensors that notice who enters, its solver stated). Why Manifold uses its
    deterministic build: chapter 25's replays. Breaks: our stack of boxes melts, Rapier's stands. Play: **voltear la
    torre**.

### Parte IV. Alguien juega

The player in the world. _Order from_ the first-game tutorials (Godot, Unity): controls, movement, jump, camera,
animation. The jump's figures in a side view first. _Ours:_ our controller and camera. _The library:_ Rapier's
character controller, three.js's controls, skinned meshes and animation mixer. _Play at the end:_ **la torre**,
climbed at dusk.

33. **Controles.** Since chapter 14 the keys and the mouse have moved things; now as a game needs them: actions instead
    of keys (the command pattern), remapping, the gamepad, touch (decision 0028), a press between two steps kept.
    Breaks: a press between two steps is lost. _Against Manifold:_ its inputs as actions. Play: one scheme, three
    devices.
34. **Un personaje no es una caja.** As a physical body the character topples and slides down every slope. The
    kinematic controller: a capsule that collides and slides (chapter 6's rejection), ground, slopes, steps. _With
    Rapier:_ its character controller, beside ours. Play: walk the yard.
35. **Saltar.** A jump with real gravity floats. The jump by its height and its time to the top, solved exactly in
    steps; variable height, coyote time, the jump buffer, the wall jump. _Against Manifold:_ its platformer and its
    metrics gym. Play: the wall jump.
36. **La cámara que sigue.** Third person: a pivot, following with chapter 22's exponential, rays against walls so it
    never goes through; first person. _With three.js:_ `OrbitControls` and `PointerLockControls`, beside ours. Play: a
    camera that never fights the player.
37. **Un esqueleto.** A body that bends: bones as chapter 5's hierarchy, in space as chapter 9's turret; a skin that
    follows them, by hand on a few vertices. _With three.js:_ `SkinnedMesh` and its `Skeleton`. Breaks: a vertex that
    follows one bone only creases at the elbow; weights between two smooth it. Play: a mannequin moved by sliders.
38. **Pies en el suelo.** Clips blended with chapter 23's slerp; feet that find the ground (two-bone inverse
    kinematics, chapter 6's law of cosines). _With three.js:_ `AnimationMixer` and `CCDIKSolver`. Breaks: on a step,
    a foot sinks or floats. Play: **la torre**.

### Parte V. Alguien piensa

Minds. _Order from_ The Nature of Code's autonomous agents (steering first), Red Blob Games (grids, graphs, A*) and
Game Programming Patterns (state). The plane: a game's floor is one. _Ours:_ all of it. _Against Manifold:_ its guards
and its bots. _Play at the end:_ **la fortaleza**.

39. **Querer ir.** Steering: seek, flee, arrive, wander; a flock (separation, alignment, cohesion). Mathematics: the
    wanted velocity minus the velocity, a limited force. Play: bats at dusk.
40. **Encontrar el camino.** Grids and graphs; breadth first, Dijkstra, A* and its estimate (proved); navigation meshes
    (stated); following a path with chapter 39's steering. Play: a guard that finds its way.
41. **Ver.** A radius, a cone (chapter 6's dot product, met again in faces, light and bounces), a line of sight
    (Parte III's rays), the light where you stand, computed as the game's logic and not as the drawing's. _Story:_ a
    guard's cone stored as a cosine. Play: guards that see.
42. **Oír y recordar.** A sound that goes round walls (chapter 40's shortest path, through the rooms' graph), memory,
    suspicion that rises and falls. Play: guards that hear, and come to look.
43. **Decidir.** Patrol, look, chase, search: state machines, hierarchical ones; behaviour trees named. Breaks: a
    searching guard that cannot progress never stops. _Story:_ the wall's attackers stuck against the fallen. Play:
    **la fortaleza**.

### Parte VI. Un juego entero

How a game is put together: a world that does not know it is watched, its structure, its tools, its content, its
interface, its sound, its speed. _Order from_ Game Programming Patterns and the three.js manual's "making a game"
("three.js is not a game engine"), with Three.js Journey's lessons on structure, loading and performance; and from
Manifold itself for what the courses leave out: the simulation apart from its drawing, the console, art made by
code. _Ours:_ a small engine's structure. _The library:_ three.js's loaders and audio, the browser's Web Audio.
_Against Manifold:_ its packages, one by one. _Play at the end:_ **una noche**, the corners joined, with a menu and
saves.

44. **Un mundo que no sabe que lo miran.** We want the world to run with no one drawing it: in a test, in a replay, on
    a server. Since chapter 17 the world steps on its own clock and the drawing reads it; now the split becomes a rule.
    The simulation holds plain data and never imports what draws; the presentation reads it, interpolates, and adds
    only what does not change the world (sparks, sound, the camera). Breaks: a hit decided by what was drawn makes
    chapter 25's replay drift. _Against Manifold:_ `core` and `presentation`, and why. _Story:_ the camera lives only in
    the presentation; the world never knows anyone is looking. Play: the night's world run with no screen, its hash
    the same as when it is drawn.
45. **Organizar.** With dozens of kinds of things the loop becomes a tangle. Entities, components and systems; the
    update method; scenes, one per corner of the world. Play: the corners as one program.
46. **Mensajes.** A plate opens a door, a door a lift. Breaks: computed in the wrong order, the door flickers. Events,
    observers, a queue, signals computed once per step in order. Play: the fortress's gate.
47. **Herramientas.** The panels have been there since chapter 1, but a game needs more: a console where commands are
    typed and a setup is shared as a line of text, the game drawing what it decided (the paths, the cones, the
    contacts), a frame measured, and a level that plays itself and says whether it still works (chapter 25's replays
    as tests). _With the library:_ lil-gui. _Against Manifold:_ `commands`, with its variables, its one-line
    interpreter and its recipes, and its reference replays. Play: tune the jump while jumping, and break it on
    purpose to see the test fail.
48. **Cosas hechas con código.** Chapter 10 read a model from a file; someone made it. Geometry generated by code: a
    column, a merlon, the tower, with their normals and their coordinates on the image; written as glTF and read back.
    _With three.js:_ `GLTFExporter` and `GLTFLoader`. Breaks: the same script gives other bytes on another run (a list
    in no fixed order, a time stamp, a seed not set), and a change can no longer be reviewed. _Against Manifold:_ the
    mannequin, the doors, the lamps, the kit and the weapons are made by scripts that run Blender with no window
    (`art/*.py`), the same bytes on every run (chapter 25 again). _Story:_ the sphere that came out different on every
    run. Play: the fortress's pieces, made by code.
49. **Niveles y recursos.** A level written as data, built from chapter 48's kit of pieces; models loaded and freed
    (the graphics card's memory); the game saved as versioned data. Breaks: rebuilt without freeing, the memory fills.
    Play: build a room.
50. **Interfaz.** A HUD, menus, settings, the pause; drawn as a page over the world, not inside it. _Against
    Manifold:_ its shell, what its three games share. Play: the game with its menu and its settings.
51. **Sonido.** Sound placed in space, and made from events instead of recorded: a step on wood or stone, a door, a
    hit; music made in the browser like the sounds (decision 0027). _With three.js:_ `PositionalAudio`, over the
    browser's Web Audio. _Against Manifold:_ its sounds and its music. Play: the night, heard.
52. **Que ande rápido.** The frame's budget, measured; draw calls, instancing, pools, culling, levels of detail. Play:
    the whole night at sixty frames.

### Parte VII. Se hace de noche

What drawing still lacks, and the finale. _Order from_ Three.js Journey's classic techniques and shaders, and
LearnOpenGL's advanced lighting. _Ours:_ a shader of our own, and a shadow map by hand in our renderer's lab. _The
library:_ three.js's materials, shaders, shadows and post-processing. _Play at the end:_ **la muralla**, held until
dawn.

53. **Materiales.** Why metal and stone shine differently. Chapter 12's Lambert, then the highlight (Phong and
    Blinn), then the materials three.js uses everywhere, stated: roughness, metalness, light from all around. _With
    three.js:_ `MeshPhongMaterial` and `MeshStandardMaterial`, side by side with ours. Play: the kit's stone, wood and
    iron under one lantern.
54. **Pintar en la placa.** Chapter 16's first shader grows: vertex and fragment, uniforms, a material of our own. The
    sky, with its stars by a hash and the dither of chapter 1. _With three.js:_ `ShaderMaterial`. _Against Manifold:_
    its sky shader, which adds half a step of dither for the same reason Chrome's canvas did. Play: the night sky,
    written for the graphics card.
55. **Sombras.** Two passes, by hand in our renderer's lab on one light, then three.js's; acne and bias. Play: the
    lanterns' shadows.
56. **El cielo y la niebla.** Fog as an exponential (proved from a constant absorption), the sky by the hour, exposure
    and tone mapping. _With three.js:_ `FogExp2` and its `Sky`. Play: from dusk to night.
57. **Brillos.** Light that is emitted, glow as a pass over the finished image, sparks added as light. _With three.js:_
    its `EffectComposer` and `UnrealBloomPass`. Play: lanterns that glow.
58. **La muralla.** Weapons from what Partes II and III gave (projectiles, rays), waves of bots (Parte V), from night
    to dawn. Play: **la muralla**.

**Epílogo. Lo que sigue.** What the reader built, where each piece lives in Manifold, and the second volume: playing
with others (lockstep, a server, prediction, all standing on chapter 25's determinism) and the strange worlds.

### 7.1 The coherence review (2026-11-18)

The 49-chapter syllabus was read chapter by chapter against what each one uses and where it is taught. What changed:

- **Used before taught, fixed.** Vectors and the dot product (used from chapter 2, taught in Parte II, proved
  nowhere) are born in Parte I's _Flechas_ (6), with projection, rejection and the reflection; Parte II's old
  _Flechas_ became _Velocidad_ (18). The turret Parte II fires had never been built, nor anything in space with
  parts: _Una torreta con partes_ (9) brings the 4×4 rigid matrices between the plane's 3×3 (5) and the projection's
  4×4 (15). The keys and the mouse arrive with the camera (14), and _Controles_ (33) is what lies beyond. Hearing
  round walls needs a graph's shortest path: Parte V now finds paths (40) before it sees (41) and hears (42). The
  shooting gallery tells a hit by chapter 1's distance, and plants the fast shot chapter 30 fixes.
- **Inconsistencies, fixed.** Chapter 30's title, the particles drawn "on the canvas" in a three.js part, the tools'
  false hook (the panels were always there), our renderer retired at chapter 16 and used at 55 (it stays as a lab),
  "the first game in Parte II" (the yard is one), and every chapter now says what it is compared with: a library,
  Manifold, or the exact answer (chapter 1's lesson: the library is not the truth).
- **Gaps, filled.** _Materiales_ (53) and _Pintar en la placa_ (54); the project's thread written down (one world,
  a corner per part); an orthographic first step in _Un cubo_; why Manifold's Rapier is the deterministic build;
  sensors; music; tests (47).
- **Too much for one sitting, split.** _Girar y mover_ and _Matrices_ (4, 5); _La cámara_ and _La proyección_ (14,
  15); _Un esqueleto_ and _Pies en el suelo_ (37, 38); _Ver_ and _Oír y recordar_ (41, 42); _Interfaz_ and _Sonido_
  (50, 51).

## 8. How we get there

The working state, chapter by chapter, and the recipe for writing the next one: [tutorial-roadmap.md](tutorial-roadmap.md).

1. **This document,** read and corrected by the author.
2. **A prototype: chapters 1 and 2.** The first (_Un punto en la pantalla_, _¿Está delante?_) was read on
   2026-11-18 and set aside: it began past the basics, with a scene and a turret's cone. Its material moves to
   chapters 7 and 41. The second prototype is the new chapters 1 and 2, _La pantalla_ and _Líneas_.
3. **The form adjusted** by that reading; then Parte I whole, chapter by chapter, each read before the next.
4. **The switch,** done on 2026-11-18, earlier than planned, by the author's word ([decision 0030](decisions/0030-the-book.md)):
   the book took `/tutorial/` with its first two chapters, and the earlier tutorials left the site, their addresses
   landing on the book's first page, their code kept as material.
5. **Then part by part,** each part ending in its game.

What becomes of what exists: the second version's figures, worked examples, proofs and project code are the raw
material; the 146 lesson sheets become each chapter's notes; the curriculum's conventions table becomes La caja de
herramientas; its research on other engines becomes Los motores. Nothing of value is thrown away; only the form.

## 9. Questions still open

- **The setting and its games.** The night's world stays, as the author chose; the research leaves it free. The
  alternative it shows is a new small game per part (Unity), without a common world.
- **The length.** 58 chapters at 30 to 45 minutes each, some forty hours: between Pikuma's fifty and The
  Nature of Code's eleven long chapters. The author's rule (2026-11-18): the book grows where it needs to, organically,
  and nothing is cut to keep it short.
- **Manifold's own ideas.** Four chapters are there because Manifold is built on them, not because the courses teach
  them: determinism (25), the simulation apart from its drawing (44), the tools (47) and art made by code (48).
  Playing with others, the largest piece of Manifold left out, is the second volume's, and the epilogue says so.
- **The book's title.** Candidates: _Construir un mundo_, _Una noche en un mundo chico_, _Cómo se hace un mundo_.
