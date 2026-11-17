# 0024. Navigation: a grid of where a body fits, sampled from the level, with edges that ask for a capability or a signal

- **Status:** accepted
- **Date:** 2026-11-17 (accepted under the author's instruction to go through phase 4 following these recommendations)

## Context

Stage 4e's guards must get from where they are to where they want to be: along a patrol, after a sound, up the keep's lift. Stage 4d builds the navigation first. Three things must be settled before any code: which graph and what it is made from, how a level names its routes and patrols, and how an edge asks for a capability or for a mechanism's state. Decision [0023](0023-where-a-bot-thinks.md) settled that brains run on the match's host, out of the hash; the navigation is what they plan with.

What there is to build on:

- **A level is text** (2a, 3b): boxes (turned or not), maps drawn with characters whose floor is one compound body (3j, 4a), zones, lamps, watchers, signals (3c: a signal is a value computed once per step from zones, uses, other signals: `zone`, `used`, `toggle`, `latch`, `all`, `not`), and movers that follow signals: doors and lifts.
- **The world answers spatial queries by entity** (2.5b: `castRay`, `castShape`), the same in every copy.
- **The character's numbers are data:** its capsule, its collision poses by mode (2e), how high it steps and jumps, what it can do (capabilities: climb, glide, a second jump, crouch, roll).

## Decision

### The graph: a grid of where a standing body fits, sampled from the level

- **Built from the level as the world has it,** by sampling the world's own queries, not by reading the level's lines: columns every 0.5 m over the level's extent; down each column, rays find every surface a character could stand on (flat enough for its controller); a cell is kept where its standing capsule fits there (a `castShape` against what does not move). Turned boxes, ramps, maps' floors and a box standing on another come out right without a case for each.
- **Its edges** join neighboring cells (eight around each): **walk** where the rise is within what the controller steps; **drop** down to a lower cell within a fall it survives; **jump** up to a cell within its jump's height and reach; **climb** up a wall to the cell above it, for a character that climbs. Each edge has a cost: the time a character takes to cross it at its speed.
- **Static:** built once when a level is loaded (and again when the console changes the level, 3j), on the host that runs the brains. It is not part of the world's state and never enters the hash. What the physics moves (a crate, a ball) is not in it: a guard steps around it as it goes (4e).
- **For one body:** the games' character, the one every guard has. A body of another size would get a graph of its own.

### A path: A\* over the cells, then pulled straight

- **A\*** over the cells, its heuristic the straight distance at the character's fastest speed (it never overestimates, so the path is the cheapest). Then **pulled straight:** of the cells it crosses, only the corners it must turn around are kept (a cell is skipped while the straight line to a later one stays on cells that walk).
- A path is a list of points, each with what it asks: walk to it, jump to it, climb to it, ride, use a button. Following it, steering, avoiding what moves: 4e.

### An edge asks for a capability, or for a signal

- **A capability:** an edge marks the capability it needs (`climb` for a climb, the second jump for a jump only it reaches). A character without it plans as if the edge were not there. Turned off live (`dojo.climb off`), the next plan goes around.
- **A signal:** a mover is not a cell like the rest. A **door** gives an edge across it, open while its signal says open. A **lift** gives a ride from where it waits at its foot to its top, possible when its signal has it down. The edge names the signal and the value it needs.
- **When the signal is not what the edge needs,** the planner reads the signal's definition to find what changes it: the zone a `zone` signal watches (stand there), the zone where a `used` signal is pressed (go and press `use`), the reset of a `latch`, one input of an `all`. The plan goes there first, then through the edge. This is "the edge points at its button", with nothing written for it in the level. Where the definition says nothing a body can do (a signal from a `seen`, a chain too long), the edge is closed, and `show.nav` says why.

### Routes, patrols and what things are for, in the level format's next version (8)

- **A route** is a named list of points: `route <name> [loop] x y z  x y z …`. A patrol is a route a guard follows, there and back or round (`loop`). Routes are read and written back with the level (3j); `show.nav` draws them.
- **What a thing is for**, as words on any line of the level: `affords cover`, `affords throw`, `affords kick`, `affords weak` (a weak point). They are data the brains read (a guard hides behind cover); the engine does nothing with them.
- A level of version 7 reads as before: no routes, nothing said about what things are for.

## What it leaves open, on purpose

- **Following a path, steering and avoiding** each other and what moves: 4e.
- **Gravity that is not one direction** (the rooms where "down" depends on where you are: `field`): the grid is sampled along one "down". A level with a field gets no graph, and `show.nav` says so.
- **Navigation meshes and dynamic navigation** (cells that change while the level plays, beyond doors and lifts): in the idea bank, if a level asks for them.

## Consequences

- **Good:** it reads any level the engine can build, with the queries the world already answers, and a test can find paths in Node.
- **Good:** a mechanism is part of a path, not an exception to it: a guard that finds the lift up goes to call it down, because the level's own signals say how.
- **Good:** capabilities on and off live (2c) change the paths with nothing more.
- **Costs:** a grid of 0.5 m has more nodes than a navigation mesh (a room of 20 × 20 m, 1,600 cells where a mesh has a few polygons); A\* over it is still under a millisecond for the Dojo's rooms. 4d measures it. Pulling the path straight hides the grid's zigzag.
- **Costs:** its edges are as good as the samples: a gap narrower than a cell can be missed. Cells are a little narrower than the character (0.5 m against its 0.6), their centers a quarter meter off the level's round numbers (where its edges are), and a test checks the keep's narrow places (its doors, 1.2 m).

## Alternatives discarded

- **A navigation mesh** (convex polygons from the walkable surfaces): fewer nodes and smoother paths, but cutting turned boxes, maps and boxes on boxes into polygons is its own project, and a grid with its path pulled straight walks the same rooms.
- **A graph of waypoints written in each level:** every level would need its own, kept in step by hand as the level changes; the console builds levels live (3j).
- **Mechanism edges written in the level** (`this edge needs the lift down; its button is there`): the signals already say it, and two descriptions drift apart.
- **The graph in the world's state:** nothing in the simulation reads it (0023: brains are out of the hash), so it would cost the hash for nothing.
