# How other courses are organized, and what it means for the book

**Status:** research and a proposal, for the author's reading (2026-11-18). It answers the author's reading of the
third version's prototype (chapters 1 and 2 of [the book](tutorial-v3.md)):

> no me convence... empieza por algo muy sofisticado, cono de percepción... siento que hay que empezar por lo básico y
> de a poco ir construyendo y creando... qué es 3D, cómo se dibuja en la pantalla... cosas básicas primero que sí
> tengan algo de practicidad, ahí se debe poder jugar con la idea de usar las librerías y también no usarlas, las dos
> perspectivas siempre suman... investigá más a fondo cómo otros tutoriales, manuales y cursos son organizados.

Twenty-three courses, books and syllabi were read for their **order** (not their content, which the
[curriculum](tutorial-curriculum.md) already weighed): what comes first, how the basics are sequenced, and how each
combines using a library with doing the same thing by hand. Facts come from the pages listed in §8; the few taken
from memory are marked _(mem)_.

## 1. What was read

Three families. The "first hour" column says what the reader has on screen after the first real chapter.

| Source                                         | Order, in short                                                                                                                                                                                               | First hour                                                                    | Library or by hand                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **From the pixel up**                          |                                                                                                                                                                                                               |                                                                               |                                                                                                |
| tinyrenderer (Sokolov), 2nd ed.                | lines → triangles and back-face culling → barycentric → painter, then z-buffer → naive camera (a division) → matrices → shading → textures → normal maps → shadows → SSAO                                     | three white pixels in a file; a model's wireframe by lesson 2                 | everything by hand, ~500 lines; the 1st ed. ended with "now the same in OpenGL"                |
| _Computer Graphics from Scratch_ (Gambetta)    | `PutPixel` → ray tracing (spheres, light, shadows) → rasterizing: lines, filled triangles, shaded, perspective (a division), scene, clipping, hidden surfaces, textures                                       | three spheres, in the first real chapter                                      | everything from `PutPixel`; a live JavaScript demo per chapter                                 |
| Pikuma, _3D Computer Graphics Programming_     | window and colour buffer → points → projection (a division) → rotation (trig) → loop → lines → mesh → culling (cross, dot) → filling → painter → matrices → light → z-buffer → camera → clipping → CPU vs GPU | rectangles in a buffer, then a cloud of points in 3D                          | by hand on the CPU; the GPU only as a closing comparison                                       |
| _Ray Tracing in One Weekend_ (Shirley)         | an image file → `vec3` → rays and a sky → a sphere → normals → antialiasing → materials → camera                                                                                                              | a colour gradient: "the graphics hello world"                                 | by hand, standard C++                                                                          |
| LearnOpenGL (de Vries)                         | window → triangle → shaders → textures → transformations → coordinate systems → camera → lighting → models → advanced                                                                                         | nothing: an afternoon of setup; the triangle in chapter 4                     | the GPU from day one; the matrices taught on paper, then a library computes them               |
| WebGL2 Fundamentals (Tavares)                  | a triangle → 2D: translate, rotate, scale by hand, then as a matrix → 3D: orthographic (the mess, then culling, then depth) → perspective (a fudge division, then `w`, then the matrix)                       | a triangle, in the browser, in the first article                              | raw WebGL with a hand-written math object                                                      |
| Scratchapixel                                  | the corners of a box projected and printed → pinhole camera → rasterization → projection matrix → ray tracing → shading                                                                                       | printed coordinates, joined by hand in a paint program                        | by hand; mathematics front-loaded                                                              |
| javidx9, _Code-It-Yourself 3D Engine_          | 1 triangles and projection (a spinning wireframe cube) → 2 normals, culling, light, models → 3 camera, clipping → 4 depth buffer, textures                                                                    | a spinning wireframe cube in episode 1                                        | by hand; its own console engine draws lines and fills                                          |
| **From a library or an engine**                |                                                                                                                                                                                                               |                                                                               |                                                                                                |
| Three.js Journey (Simon)                       | what WebGL is → first project → transforms → animation → cameras → resizing → geometries → debug UI → textures → materials → lights → shadows → … → physics → shaders                                         | a red cube that looks like a flat square, about two hours in                  | the library; shaders opened after 26 lessons; physics only with a library                      |
| _Discover three.js_ (Lemmon)                   | app structure → hello cube → a world app → light → transformations → loop → textures → controls → models                                                                                                      | a white cube, face-on: a flat square                                          | the library; the matrices as an optional section                                               |
| three.js manual                                | fundamentals (a diagram of the parts, a cube) → responsive → primitives → scene graph (sun, earth, moon) → materials → lights → cameras → shadows                                                             | a cube within minutes                                                         | the library; "WebGL only draws points, lines and triangles", then a pointer elsewhere          |
| _The Nature of Code_ (Shiffman)                | randomness → vectors → forces → oscillation → particles → agents → **physics libraries** → automata → fractals → evolution → neural networks                                                                  | a random walker moving, in seconds                                            | **by hand for five chapters, then the library**, and then "what you wrote all along was Euler" |
| Godot, _Your first 3D game_                    | the floor in the editor → the player → moving it with code → enemies → jumping → score → animation                                                                                                            | a lit slab with shadows, no code                                              | the engine; its physics never opened                                                           |
| Unity Learn, _Create with Code_                | a new small game per unit: player control → gameplay → sound → mechanics → interface                                                                                                                          | a car on a road, no code                                                      | the engine, never opened                                                                       |
| MDN, 3D on the web                             | a theory page with no code → the same demo in four libraries → collisions: the formulas by hand, then a library                                                                                               | a cube, then shapes that are black until a light is added                     | theory and practice on separate pages that never meet                                          |
| **Build it yourself; syllabi; research**       |                                                                                                                                                                                                               |                                                                               |                                                                                                |
| _Crafting Interpreters_ (Nystrom)              | a map of the whole territory → the language → **built once** leaning on Java → **built again** in C, replacing what Java gave                                                                                 | a map, then a scanner                                                         | **twice**: first on a host, then by hand                                                       |
| Nand2Tetris                                    | chapter 0 previews the stack → gates → arithmetic → memory → machine language → CPU → assembler → VM → compiler → OS                                                                                          | 15 chips from Nand                                                            | you build every layer, but **every chip has a built-in version** you can use before yours      |
| _Game Physics Engine Development_ (Millington) | particles → mass-aggregate → rigid bodies → collision detection → contacts; each part ends in a working engine                                                                                                | a ballistics demo in chapter 4                                                | by hand                                                                                        |
| Handmade Hero (Muratori)                       | window → pixels → input → sound → timing → platform layer → … → the game, around day 26                                                                                                                       | an animated pattern on day 4                                                  | no libraries; retired without a finished game                                                  |
| Berkeley CS184, CMU 15-462                     | triangles, sampling, transforms, the pipeline; **the first assignment is a rasterizer**, inside a supplied application                                                                                        | Berkeley's warm-up: write the matrix product by hand instead of the library's | the application is supplied; you write one piece at a time                                     |
| MIT 6.837 (2012)                               | curves, surfaces, transformations, hierarchies, animation, physics; ray casting at lecture 11; rasterization at 21                                                                                            | an OpenGL mesh viewer                                                         | the library first, its inside last                                                             |

And the research on ordering: Perkins's _Making Learning Whole_ (play "the whole game", in a junior version), fast.ai
(a working whole first, then "how those tools are made"), cognitive load and the worked-example effect (Sweller),
concreteness fading (Fyfe), Bret Victor's ladder of abstraction, Red Blob Games's practice, Use-Modify-Create and
PRIMM, and Buchberger's white box, black box principle.

## 2. What the best ones share

1. **Something is on screen in the first chapter, from the smallest piece there is.** A pixel, a gradient, three
   spheres, a spinning wireframe cube. LearnOpenGL's afternoon of setup is its most common complaint (a starter
   project exists only to skip it), and Three.js Journey's first pixel arrives about two hours in. In the browser
   there is no setup to pay.
2. **The screen comes before the scene.** Most from-scratch courses start with how a picture is made of pixels
   (`PutPixel`, a colour buffer, an image file) and only then put a 3D point on it; javidx9 and Scratchapixel start
   with a box's corners projected. None starts with a scene.
3. **The first 3D object is a cube, and perspective is a division.** Points, or a wireframe, divided by their depth
   (similar triangles). The 4×4 matrices come much later, when composing moves needs them (Gambetta, tinyrenderer,
   Pikuma, WebGL2 Fundamentals, Scratchapixel; javidx9 is the only exception).
4. **Every three.js course meets the same first disappointment:** the cube looks like a flat square (face-on, or
   unlit). Each fixes it in passing, by turning it or adding a light, without explaining it. That disappointment is
   a lesson waiting to be told.
5. **The mathematics comes from drawing.** The dot product arrives with "does this face look at me?" (back-face
   culling) and "how much light falls on it?" (shading). The cross product arrives with a triangle's normal. Rotation
   arrives with a spinning cube, by sine and cosine first. Matrices arrive with the camera and with parts that move
   together. In none of the drawing courses is the dot product's first use a game's perception (Freya Holmér's
   mathematics lectures for game developers do start with a look-at trigger, but they teach the mathematics, not
   how a picture is made).
6. **The naive version first, broken where it can be seen, then the fix.** The painter's algorithm before the depth
   buffer (tinyrenderer, Pikuma, javidx9); WebGL2 Fundamentals's F in 3D, "a mess", then culling, then depth;
   tinyrenderer's four attempts at a line. This is the book's spirit already (tutorial-v3.md §2), and the research
   confirms it.
7. **Both ways teach more than either.** The strongest designs combine using a tool with building it, in one of
   three forms:
   - **By hand first, then the library** (Nature of Code: five chapters by hand, then Matter.js; MDN's collisions;
     Buchberger: "do it by hand first, then use the system's routine").
   - **The library first, then built again** (fast.ai's two parts; Crafting Interpreters's two interpreters, the
     second replacing what Java gave for free).
   - **Your piece swapped into a working whole** (Nand2Tetris's built-in chips, used before you build yours;
     Berkeley's warm-up, your matrix product in place of the library's; CMU's rasterizer inside Scotty3D).

   Courses that stay with the library (Unity, Godot, Three.js Journey) are praised for speed and criticized for
   depth ("finishing it is only a good start"). Courses that never use one (Handmade Hero) take weeks to reach a
   game.

8. **A playable thing at the end of every stretch.** Millington's parts each end in an engine; Crafting
   Interpreters's program always runs; Perkins's "junior version of the whole game". Handmade Hero is the warning:
   25 episodes before any game, and it was retired without one.
9. **The whole map first, briefly.** Nand2Tetris's chapter 0 and Crafting Interpreters's map of the territory show
   all the layers before the first one, so each chapter knows where it stands.

## 3. Where they disagree, and the choice for us

- **Bottom-up from the pixel, or top-down from a working whole?** Bottom-up: Berkeley, CMU, Nand2Tetris, Crafting
  Interpreters, Millington. Top-down: fast.ai, Perkins, MIT, Use-Modify-Create (which reports lower difficulty and
  more ownership). No study compares them on the same deep subject. Even the bottom-up ones lean on a whole: a map
  first, a supplied application, built-in chips. **For us:** bottom-up in what is _explained_ (the pixel, then the
  point, then the triangle), top-down in what is _running_ (three.js always there, drawing the same thing beside
  ours). The reader never waits for the bottom to be finished to see a world.
- **Ray tracing first, or rasterizing?** Gambetta and Ray Tracing in One Weekend start by tracing rays; it gives
  pretty images fast, but it is not how a real-time game draws. **For us:** rasterizing, as three.js does; rays
  come back with shots and picking.
- **Light early, or after the camera?** Divided. **For us:** early, because it is what turns the flat square into a
  cube, and it is the dot product's natural first use.
- **Library first, or by hand first, within a chapter?** Divided. **For us:** whichever makes the break visible.
  Sometimes the library's fifteen lines come first and surprise (the flat square); sometimes the hand-made version
  is small enough to come first (a pixel, a circle). Always both, and always compared.

## 4. What this says about the prototype

The author's reading is borne out on every count:

- **It starts past the basics.** Chapter 1 opened with a three.js scene and a turret, so the screen, the pixel and
  how anything is drawn were never shown. Every course read starts there.
- **The dot product arrived through a perception cone,** a game mind's idea, where every course meets it through
  drawing: which faces look at you, how much light falls on them. The cone belongs with the guards, much later,
  where "it is the same sum that lit a face" will be a pleasure to say.
- **The hand-made side was a number in a panel.** Our projection was compared with three.js's as two pixel
  coordinates in a table. In the courses that work, the reader's own code _draws_, and the drawing is set beside the
  library's.
- **Drawing was left for the end.** The plan put rasterizing, depth and light in act VIII. The research puts them in
  the first act, since they are what "how it is drawn on the screen" means.

What survives, because the research supports it: the chapter as a story (naive, broken, explained, fixed), the
destination at the start, the margins, the true stories, the mathematics at the moment it is needed and to the
depth of §4.6, a game at the end of each part.

## 5. The proposal

### 5.1 One device for the whole book: two ways, side by side

**The world is plain data, and there are two ways to bring it to life:** ours, written in the book, and the
library's. In Parte I that means two renderers drawing the same world: **ours**, on a 2D canvas, pixel by pixel, and
**three.js's**, on the graphics card. A switch, or the two side by side. Each chapter teaches ours something new
(points, then lines, then turning, then faces, then depth, then light), and each time it is compared with three.js
drawing the same thing: they agree, or the difference is the lesson (why theirs is smoother: sampling; why theirs is
brighter: colour is not linear).

Later parts keep the device wherever a library exists: our integrator and three.js's clock; our ray tests and
three.js's `Raycaster`; our particle engine and Rapier; our character controller and Rapier's; our pathfinding and a
library's. Where there is none (a guard's mind, determinism), the comparison is with Manifold, "the big version".

Our renderer is not thrown away. At the end of Parte I it draws a small world, and gets slow with a large one: that is
where the graphics card earns its place, and from there three.js draws, used by someone who knows what it does.

### 5.2 The whole book, re-derived

A first revision changed only the start and kept the old plan's acts III to IX almost word for word; the author
caught it (2026-11-18). This is every aspect of the plan, set against the research. Something old stays only where
the research supports it.

| Aspect                  | The old plan                                                   | What the research says                                                                                                                                                                                                                                                                 | Now                                                                                     |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Where drawing goes      | the last act                                                   | first, from the pixel: every from-scratch course; the first assignment at Berkeley and CMU                                                                                                                                                                                             | Parte I                                                                                 |
| The order of drawing    | a scene, then a projection                                     | pixel → line → triangle → projection → depth → light → camera (Gambetta, tinyrenderer); the plane's transforms before space's (WebGL2 Fundamentals)                                                                                                                                    | the plane first, then the cube, then the graphics card                                  |
| Time and motion         | a clock and a flight in act II, springs in the physics act     | one arc: vectors → forces → oscillation → particles (The Nature of Code, 1–4); "that was Euler" told after it is used (its interlude); interpolation as a subject (Freya Holmér)                                                                                                       | Parte II, Mover, whole                                                                  |
| Collisions and physics  | two acts, the library at the end                               | detection → response → rigid bodies, each stage a working engine (Millington); the formulas by hand, then a library (MDN); the library arrives when collisions get hard (Nature of Code, 6)                                                                                            | Parte III, Chocar, one arc ending in Rapier                                             |
| The player              | a character act                                                | first-game tutorials put controls, movement, camera and jump together (Godot, Unity)                                                                                                                                                                                                   | Parte IV, Alguien juega                                                                 |
| Minds                   | act VII                                                        | steering first (Nature of Code, 5), then grids and A* (Red Blob Games), then state (Game Programming Patterns)                                                                                                                                                                         | Parte V, Alguien piensa; the cone arrives here                                          |
| How a game is organized | "the world responds": levels as text, signals, light and noise | a subject of its own: components, update method, events, pools, spatial partition (Game Programming Patterns); "three.js is not a game engine" (its manual builds one)                                                                                                                 | Parte VI, Un juego entero                                                               |
| Advanced drawing        | shadows, sky and fog with the rest of drawing, at the end      | after the basics, as "classic techniques" (Three.js Journey) and "advanced lighting" (LearnOpenGL)                                                                                                                                                                                     | Parte VII, Se hace de noche                                                             |
| Determinism and replays | a chapter of act II                                            | no course teaches it early; it is what networking needs                                                                                                                                                                                                                                | Parte II, chapter 25: Manifold is built on it (the author's review, §7)                 |
| The plane or space      | space from the start                                           | the plane first within each subject (WebGL2 Fundamentals, Freya Holmér, Gambetta); a whole simulation course fits in the plane (Nature of Code)                                                                                                                                        | each part starts in the plane where its subject allows                                  |
| Library and by hand     | some pieces built small first                                  | always both, in one of three forms (§2, 7)                                                                                                                                                                                                                                             | every chapter                                                                           |
| A map first             | none                                                           | the whole map before the first layer (Nand2Tetris's chapter 0, Crafting Interpreters's map of the territory)                                                                                                                                                                           | chapter 0, El mapa                                                                      |
| Inside a chapter        | destination, story, figures, margins, two or three challenges  | where it sits on the map (Nand2Tetris); exercises right after each idea (Nature of Code), predicted before they are run (PRIMM), with answers (LearnOpenGL, Pikuma, tinyrenderer); a broken version to repair (Unity); what the library does beyond ours (Nand2Tetris's "perspective") | tutorial-v3.md §4                                                                       |
| Mathematics             | §4.6's three levels                                            | at the moment it is needed (most courses); the simple form first and the general one when it is needed (Pikuma: a division, then the projection matrix; the painter, then the depth buffer)                                                                                            | §4.6 stays, with the simple form first and ideas met again at a higher level            |
| Games                   | one per act, from the night's world                            | a playable stage at the end of each part (Millington, Perkins's junior game); either one project that grows (Nature of Code, Godot) or a new small game per unit (Unity)                                                                                                               | one per part, in the night's world: the author's choice, which the research leaves free |
| Stories from Manifold   | a boxed story where one fits                                   | nothing against; asides that are optional (Crafting Interpreters)                                                                                                                                                                                                                      | kept, as optional asides                                                                |

After the author's review (2026-11-18), the research's order was checked against what it would let a reader understand
of Manifold itself, and four chapters were added where they arise in the story, nothing cut: determinism (25, when
the shooting gallery wants replays), the simulation apart from its drawing (44), the tools (47) and art made by code
(48, before levels are built from a kit). A coherence review then put vectors and the dot product in Parte I,
built the turret in space, split what did not fit one sitting and added materials and shaders: 58 chapters
(tutorial-v3.md §7.1).

Considered and set aside: two whole passes, the library first and then everything again by hand (fast.ai,
Crafting Interpreters). It plays the whole game early, but the author wants the basics first and both ways at every
step.

### 5.3 Inside a chapter

The constants of tutorial-v3.md §4 stay, and two are added:

- **Both ways, compared:** each chapter does its visible thing by hand and with the library, and shows the two
  together, by switch or side by side. The order depends on the chapter; the comparison never is skipped.
- **The reader's code draws.** The hand-made side is a drawing, not a row of numbers. Numbers appear where they
  prove the two agree.

## 6. What the prototype becomes

Chapters 1 and 2 are rewritten as **La pantalla** (pixels, a rectangle and a circle by hand and with the canvas, the
jagged edge and its sampling, a night sky) and **Líneas** (interpolation, the holes of the naive line, the canvas's
half pixel, constellations). The first prototype's projection material goes to chapter 7, _Un cubo_; its dot product, to
chapter 6, _Flechas_; its cone, to chapter 41, _Ver_.

## 7. The author's answers (2026-11-18)

1. **Two dimensions first:** yes.
2. **How fast:** "ir de a poco aprendiendo cada cuestión": delaying the most interesting is fine if it builds
   gymnastics, intuition, experience and solid foundations. So the plane is an act, and our renderer is built whole.
3. **The games can wait:** "no me preocupa que los juegos o lo jugable se retrase".

And: a sketch of the whole syllabus before the prototype; then, that the first sketch had changed the start and kept
the rest ("revisá todo todo con lo que investigaste"), which §5.2 now does.

And, after the re-derived syllabus: "ampliemos de manera orgánica pero no recortemos" — the four chapters of §5.2's last
paragraph, and nothing merged or cut.

## 8. Sources

From the pixel up: [tinyrenderer](https://haqr.eu/tinyrenderer/) and
[its repository](https://github.com/ssloy/tinyrenderer) ·
[Computer Graphics from Scratch](https://gabrielgambetta.com/computer-graphics-from-scratch/) ·
[Pikuma, 3D Computer Graphics Programming](https://pikuma.com/courses/learn-3d-computer-graphics-programming) ·
[Ray Tracing in One Weekend](https://raytracing.github.io/books/RayTracingInOneWeekend.html) ·
[LearnOpenGL](https://learnopengl.com/) · [WebGL2 Fundamentals](https://webgl2fundamentals.org/) ·
[Scratchapixel](https://www.scratchapixel.com/) ·
[javidx9's 3D engine sources](https://github.com/OneLoneCoder/Javidx9/tree/master/ConsoleGameEngine/BiggerProjects/Engine3D).

From a library: [Three.js Journey](https://threejs-journey.com/) ·
[Discover three.js](https://discoverthreejs.com/book/) ·
[three.js manual](https://threejs.org/manual/) ([its sources](https://github.com/mrdoob/three.js/tree/dev/manual)) ·
[The Nature of Code](https://natureofcode.com/) ·
[Godot, Your first 3D game](https://docs.godotengine.org/en/stable/getting_started/first_3d_game/index.html) ·
[Unity, Junior Programmer](https://learn.unity.com/pathway/junior-programmer) ·
[MDN, 3D on the web](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web).

Build it yourself: [Crafting Interpreters](https://craftinginterpreters.com/contents.html) ·
[Nand2Tetris](https://www.nand2tetris.org/course) ·
[Game Programming Patterns](https://gameprogrammingpatterns.com/contents.html) ·
[Game Physics Engine Development](https://www.routledge.com/Game-Physics-Engine-Development/Millington/p/book/9780123819765) ·
[Handmade Hero's episode guide](https://guide.handmadehero.org/code/).

Syllabi: [Berkeley CS184/284A](https://cs184.eecs.berkeley.edu/sp25) ·
[CMU 15-462/662](https://15462.courses.cs.cmu.edu/fall2026) ·
[MIT 6.837 (2012)](https://ocw.mit.edu/courses/6-837-computer-graphics-fall-2012/).

On ordering:
[Perkins, Making Learning Whole (Harvard GSE summary)](https://www.gse.harvard.edu/ideas/usable-knowledge/09/01/education-bat-seven-principles-educators) ·
[fast.ai, chapter 1](https://github.com/fastai/fastbook/blob/master/01_intro.ipynb) ·
[Clark, Kirschner and Sweller, 2012](https://www.aft.org/sites/default/files/GuidedInstruction.pdf) ·
[Bret Victor, Up and Down the Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/) ·
[Amit Patel's notes on interactive explanations](https://www.redblobgames.com/x/2306-educ432/) ·
[Lytle et al. 2019, Use-Modify-Create](https://par.nsf.gov/biblio/10122993) ·
[Corless on Buchberger's white box, black box principle](https://rcorless.github.io/TeachingMechanizedEnvironment__Talk_.pdf).
