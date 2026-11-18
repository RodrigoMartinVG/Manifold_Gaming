# 0021. A new tutorial: one project that grows, and the math when the game asks for it

- **Status:** proposed (it is accepted with its pilot; it replaces the structure of [0013](0013-a-deeper-tutorial.md) and keeps [0007](0007-executable-tutorial.md)'s live examples and [0011](0011-languages.md)'s languages)
- **Superseded** by [0030](0030-the-book.md) (2026-11-18): the tutorial is the book; this one's pages left the site, its code stays as material
- **Date:** 2026-11-16

## Context

The tutorial grew with the engine, a stage of lessons per phase ([0013](0013-a-deeper-tutorial.md)): 34 lessons by the end of phase 3, each one correct, each with its live example and its layers. Before phase 4, two readings said what that shape cannot do:

- **A fresh reader** who programs a little and wants to make games walked it from start to end. It explains very well why each mechanism works, but it teaches how this engine is built, not how to make a game. There is no thread: every lesson is a separate demo, the character is rewritten in each. Little can be played, and nothing in stage 3. Vectors are never taught, yet quaternions and matrices use them. And the material about the engine (its stages, its history, its decisions) takes more of each page than the lesson does.
- **The author's other tutorial, Manifold Lab** (28 labs written apart from this repository), has what this one lacks: vectors before quaternions, an introduction page per block, examples played with the keys, unit tests for each example's logic, the GPU, the physics from inside, pathfinding, steering, manifolds. It also has what this one avoided: several ideas per lesson, dense notation without preparation, and pages about a "Manifold" with packages and decisions that do not exist.

Each pass over the current tutorial patched a structure made for another idea of what it is for. A further pass would add lessons, trim layers and reorder, and every new idea would collide with the old shape again. The author decided to write a new tutorial instead, and to keep both existing ones as raw material.

## Decision

### What it is for, and for whom

**To learn to make physical 3D worlds and games that run in the browser, understanding them down to their mathematics.** For someone who programs a little (variables, functions, loops, objects in JavaScript) and has never done graphics, physics or games. Secondary-school mathematics is enough to start; everything beyond it is taught.

The mathematics is part of what the tutorial is, not an extra: it is present, precise, and taught with care for whoever meets it for the first time.

### One project that grows

**The reader follows one project that grows: a small world, which becomes a game.** Each part ends in something that is played, with rules (a goal, a score or a time, winning and losing, starting again).

**The project is the thread, not a corset.** Not every lesson is a step of it: a concept that deserves its own space gets a lesson of its own, with an example made for it, when bending it into the project would explain it worse. The tutorial is longer for it, and that is fine (the author's words, refining this decision after the pilot). So there are two kinds of lessons, which a part alternates as the explanation needs:

- **Concept lessons** teach one idea for itself: vectors, the projection, integrating in steps, the dot product, rotations. Their example is an experiment or a figure to play with, as clear as the idea asks, in a folder of its own (`src/lessons/`), and they end saying where the project will use it.
- **Project lessons** take the idea to the project: a step of its code (`src/course/`), the project changed, played.

Usually a concept lesson comes first and the project lesson that uses it after it; a small idea can live inside a project lesson, and a large one can take several concept lessons.

How the project's code grows without being copied by hand:

- **The project is one tree of modules.** Each lesson has a folder with only the files it adds or changes, whole (not as patches). A lesson's project is, for each file, its latest version up to that lesson.
- **The editor shows what the lesson changed first**, and the rest of the project behind it. "En el proyecto" shows each changed file against its previous version.
- **A module's public functions keep their names and their meaning once taught.** A lesson extends them; it does not rename them. When one has to change, the lesson that changes it says so and teaches why: that is what keeps a later idea from forcing a refactor of everything before it.
- **A test builds and type-checks the project of every lesson.** A change to an early module that breaks a later lesson fails at once, not when a reader finds it.
- **What a reader changes stays in that lesson.** The editor is for trying things there: a change lives in that lesson's example until the page is reloaded, and the next lesson starts from the project as the tutorial left it. Nothing a reader writes is carried forward: the project is the same for every reader.
- **The project can leave the site:** a lesson shows how to run it in its own folder, with Vite, three.js and Rapier, and the project as each lesson leaves it can be downloaded.

### The mathematics, when the game asks for it

**Each mathematical idea enters when a problem of the game first needs it, and is taught whole there:** in a concept lesson of its own, right before the project lesson that uses it, or inside the project lesson when it is small. The dot product enters when a guard must know whether it sees you; quaternions when something has to turn without locking; integration when time has to advance in steps. There is no part of mathematics before the games.

- **It has its own section, in the main path,** not in a closed box: where the question comes from (the game's problem), the definitions, the statement, the derivation step by step, and an example with the same numbers the live example shows. "Más a fondo" keeps long proofs and extensions; nothing in the main path depends on having opened one.
- **It is typeset** (KaTeX, as Manifold Lab already does), with a fixed notation and its own page of symbols: vectors in bold, unit vectors with a hat, scalars in italics, matrices in bold capitals; a right-handed space with +Y up; units of the International System; angles in radians in the mathematics.
- **Its assumptions are named** (Coulomb's friction with one coefficient, a fixed step of 1/60 s), and figures drawn by code show what is geometric.
- **Nothing is used before it is taught.** A later lesson that needs an idea links to its lesson and recalls it in one line.
- **Interesting things come before and after it:** the playable problem first, the consequences and the code after.

### A lesson

One idea per lesson, explained to be understood: first the intuition and a picture, then the definitions, the statement and its derivation, then worked examples; the precise form is never skipped, and a lesson takes the room its idea needs. Its main path, which is at least 60% of the page:

1. **El problema:** the question the idea answers, or what the project needs now, shown in the live example.
2. **La matemática,** when the lesson has some (most do; in a concept lesson, it is the lesson).
3. **El código** (a concept lesson: the example's code, step by step) or **En el proyecto** (a project lesson: what changes, file by file).
4. **Probalo:** what to try, each with what should happen.
5. **Lo importante:** three or four sentences to keep.

Around it, shorter than today: "Más a fondo" (at most two), "Sutilezas", "Patrón" when the code is one, "En los motores" (at most five lines, with "Dónde Manifold eligió otra cosa" in a few lines), "En Manifold" (one paragraph, or "Manifold todavía no lo tiene"), "Para practicar" (two or three exercises, each with what should come out and a hint) and "Para saber más". A test measures the main path's share and the layers' limits, as today's test checks the layers.

Each part has an introduction page: what the reader will be able to do at its end, its lessons (which teach a concept, which take it to the project) with the question each one answers, and the game that closes it. Before the first part, a short page of TypeScript for someone who knows JavaScript (types, interfaces, the `!`, the generics the code uses).

### The tutorial and the engine

**The project is the tutorial's, not Manifold.** It is smaller and made to be understood. Manifold is the real engine that solves the same problems at full size: each lesson says where, in a paragraph, with links to its code. The tutorial **may teach ahead of the engine** (the GPU, pathfinding, manifolds), saying that Manifold does not have it yet. Manifold's history (its stages, its findings, its decisions) lives in the Bitácora; the tutorial's text never names an engine stage.

The tutorial is no longer written at each phase's close ([0013](0013-a-deeper-tutorial.md)): it has its own parts, written one after the other, each whole (its lessons and the game that closes it) before the next. Each Bitácora report still notes the lesson ideas its stage leaves, for the part that will need them.

### Its parts (provisional)

The inventory of both tutorials, lesson by lesson, refines this outline before part 1 is written.

| Part                     | The project gains                                                                                                                                                           | The game that closes it                         | The material it starts from                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| 1. Something that moves  | A window into a world; moving with vectors; time in fixed steps; looking (dot product); turning (quaternions); chance with a seed; the simulation apart from the drawing    | Collect the coins before time runs out          | Today's 0-00 to 0-05 and 0-07; Manifold Lab 1.1 to 1.6                |
| 2. Bodies that collide   | A physics engine; finding a collision; impulses; friction and bounce; mass; rays and sweeps                                                                                 | Knock down a tower with what you throw          | Today's 1-00, 1-01, 2-05, 3-05, 3-06; Manifold Lab 3.1 to 3.4         |
| 3. A character           | A character that is driven; its camera, also against walls; inputs as actions; modes and capabilities; platforms that carry; animation                                      | A level of platforms against the clock          | Today's 1-02 to 1-04, 2-02 to 2-04, 2-06, 3-07; Manifold Lab 3.4, 1.8 |
| 4. A world that responds | A level as text and zones; signals and mechanisms; light as logic; sound from events; what breaks; the interface; saving; levels that test themselves; dungeons from a seed | A stealth room with a door to open              | Today's 2-00, 2-01, stage 3; Manifold Lab 4.2, 5.4                    |
| 5. Minds                 | States and events; seeing and hearing; finding a path; steering                                                                                                             | A guard that hunts you                          | Manifold Lab 4.2, 4.5, 5.3; Manifold's phase 4                        |
| 6. The drawing           | The GPU's pipeline and its depth buffer; shaders; materials; shadows; many copies of one mesh; particles                                                                    | The project, with its own look                  | Manifold Lab block 2                                                  |
| 7. Playing with others   | Numbers that are not exact; replays and ghosts; snapshots; a server and its clients; lockstep, rollback and Manifold's model                                                | A race against your ghost, and two tabs playing | Today's 0-06, 1-05 to 1-07; Manifold Lab 1.7, 4.3, 4.4                |
| 8. Strange worlds        | Surfaces given by parameters; gravity that changes from place to place; parallel transport; spaces glued to themselves                                                      | A level on a small planet                       | Manifold Lab block 5; Manifold's phase 7                              |

### How it starts

1. **This decision, and a pilot:** part 1's introduction page and its first two lessons (the window into the world, and moving with vectors), with what they need: KaTeX, the project's tree of modules, and the tests. Until it is accepted it lives at an address of its own, out of the navigation. (Done: the pilot grew into the curriculum, and on 2026-11-16 the new tutorial took the Tutorial section, the old one archived at `/tutorial/archivo/`.) The author reads it as a learner and as a mathematician; what the pilot teaches changes this decision before it is accepted.
2. **The archive:** the current tutorial moves, as it is, to an archive of the site (its pages and examples working, with a notice that it is archived, out of the main navigation, its old addresses sent there). The new tutorial takes its place in the Tutorial section.
3. **The inventory:** every lesson of both tutorials with its destination in the outline, or dropped with why. Then Manifold Lab can be deleted by its author.
4. **Part 1,** whole, and then the next.

## Consequences

- **Good:** each part ends in something that is played, made of what the reader learned: one project, a thread from the first lesson to the last.
- **Good:** the mathematics has its place, visible and precise, and arrives with a reason; a reader never needs a closed box to follow.
- **Good:** two tutorials become one, without the engine pages that do not match the engine.
- **Costs:** it is a large piece of work, a part at a time, and for a while the new tutorial has fewer lessons than the archived one. With concept lessons beside the project's, it is also longer: chosen, for the explanation.
- **Costs:** a project that grows binds lessons together: changing an early one can touch many. The stable names and the test that builds every lesson's project are what keeps that cost visible and small.
- **Costs:** teaching ahead of the engine means some lessons have no Manifold code to point at.

## Alternatives discarded

- **Reforming the current tutorial in place:** the author's verdict, "dying in refactors that never quite fit the new ideas"; every pass patched a shape made for another purpose.
- **Two tutorials with different orientations:** two places to maintain, a reader who does not know which to follow, and one of them describing an engine that does not exist.
- **Lessons that stand alone, with a project at each part's end:** easier to write, but the thread is what the reader missed most.
- **A part of mathematics first:** the author chose the mathematics when the game asks for it, taught whole in that lesson.
- **Teaching only what Manifold has:** it would leave out the GPU, pathfinding and manifolds until the engine reaches them, if it ever does.
