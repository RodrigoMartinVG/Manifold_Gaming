# 0013. One tutorial, deeper: the short path stays, and the depth goes around it

- **Status:** accepted (it refines [0007](0007-executable-tutorial.md), and replaces the pace of the lessons in [0005](0005-way-of-working.md))
- **Date:** 2026-11-14

## Context

The tutorial has the shape [0007](0007-executable-tutorial.md) gave it: short lessons, one idea each, a live example that can be edited and run, the math in layers, and a link to where Manifold does it. That shape is what makes it easy to follow, and it works: eleven lessons, each tested in the browser.

What it lacks is depth and breadth:

- **Depth.** The lessons have 850 to 1,350 words and one or two "Más a fondo" boxes each; the stage 1 lessons, one. The snapshots lesson has no "Para saber más". There is no view of how other engines and the literature solve the same problems, and nothing to practice with.
- **Breadth.** Ideas the engine already has are not taught: why the same numbers can give other bits in another browser, and how Manifold gets the same ones (the project's thesis); how a collision is found before it is solved; inputs as actions; how a camera follows. And phase 2 (2a to 2c) has no lessons yet.
- **The pace is undecided.** [0005](0005-way-of-working.md) asks for lessons with each step; phase 1 paid them at its end (1f). It is an open question in the roadmap.

An idea draft proposed a second, much bigger tutorial: a textbook by topic, in its own repository, with 14 modules and 72 lessons tied to a university math degree. The author's verdict: one tutorial, not two, and not tied to a degree; the one there is, with more depth wherever it fits.

## Decision

### One tutorial, by stages, with a short main path

Every lesson keeps its main path as it is: one idea, the live example, what to try, the code step by step, what matters. Depth goes **around** that path, never in its way: whoever only wants to follow, follows; whoever wants more, opens it.

### Four layers of depth in every lesson

| Layer                    | What it is                                                                                                                                                                                                                                                           | Today                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Más a fondo**          | The why: where a formula comes from, a derivation step by step, why a trick works. At least two per lesson, and the important derivations complete                                                                                                                   | One or two per lesson |
| **En los motores** (new) | How other engines and the literature solve the same problem, and where Manifold chose otherwise, and why (the fixed step, collisions in two phases, lockstep against state replication…), with the source and its chapter                                            | Missing               |
| **Patrón** (new)         | A short callout when the lesson's code is a known design pattern (the game loop, command, event queue, component, double buffer, state, observer…), named so the reader recognizes it elsewhere. A "Patrones" page gathers them, like the glossary gathers the words | Missing               |
| **Para practicar** (new) | Two or three exercises at the end, from easy to harder (change a number and predict what happens; modify the example; build something small on it), starting from the lesson's example. With a hint that opens, not a solution                                       | Missing               |

And **Para saber más**, which exists, goes in every lesson.

### More breadth: lessons where the engine already has the idea

New lessons, in the same short format and tested like the others, where the engine already has the idea and the tutorial skips it:

- **Stage 0:** moving, turning and scaling with matrices, and the spaces a point lives in (the object's, the world's, the camera's); numbers that are not exact (floating point, and why the same operation can give other bits in another browser).
- **Stage 1:** how a collision is found (two phases: the boxes that may touch, then the exact test), before the physics engine resolves it; inputs as actions (from the key to the action, with its player and its step); the camera that follows (the leash and the chase).
- **Stage 2, at the phase's close:** a level as text; zones that notice who comes in; one mode per step and contributions that add up; capabilities as data; platforms that carry you.

The first pass goes over stages 0 and 1 once, with the four layers and the new lessons, before phase 2's lessons are written, so those are born in the new shape.

### The pace: per phase

Lessons are written **at each phase's close**, when its ideas have settled (as 0007 asked: "a lesson is written when the idea of its stage has settled"). This replaces the "with each step" of 0005, on purpose. Each step's report in the Bitácora notes the lessons its ideas will need.

### The books

The reference books (Lengyel's _Foundations of Game Engine Development_, Gregory's _Game Engine Architecture_, Nystrom's _Game Programming Patterns_, _Real-Time Rendering_, and the classic articles: Catto on physics, Ericson on collisions, Fiedler on time steps and networked physics) are a **map of topics** and recommended reading: cited by chapter in "En los motores" and "Para saber más". The text, the figures and the examples are our own: the site is public, and those works have copyright.

### What does not change

The live examples and their tests, the math in layers, the glossary, the link to Manifold's code, the Spanish text with the English terms at their first appearance.

## Consequences

- The lessons grow (maybe half again), but their main path does not.
- "En los motores" and the "Patrones" page also document why Manifold is built the way it is: they connect the tutorial with the decisions.
- More prose to keep up to date. The tests catch a broken example, not a stale paragraph: each phase's close rereads its stage's lessons.
- The exercises are not tested (they are the reader's), but they start from tested examples.

## Alternatives discarded

- **A second tutorial, deep and by topic** (the idea draft's _Manifold Lab_): two tutorials split the reader and the maintenance, and the short one would fall behind.
- **Tying it to a university math degree:** it narrows the audience; the math stays in layers, as deep as each reader wants.
- **Lessons with every step** (0005): the ideas change while a phase is being built (2d is changing how a character is carried); per phase, they are written once they have settled.
