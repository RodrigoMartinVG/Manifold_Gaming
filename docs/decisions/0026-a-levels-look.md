# 0026. A level's look: kit pieces that bring their own collision, and a budget for what is drawn

- **Status:** accepted
- **Date:** 2026-11-17 (accepted under the author's instruction to go through stage 4.5 following these recommendations)

## Context

A level is text (2a): boxes, turned or not, with a color, and maps drawn with characters (3j). That is what makes it a level the console can build and write back, a test can play, and a diff can read. It is also why every level so far looks like grey boxes: what is drawn is the box itself.

Stage 4.5 builds the modular kit of level pieces the three games share (4.5e), and then a level that pushes the engine, with a look made by Blender scripts (4.5f). Before either, how a level's look hangs on its data must be settled: what a level says for a wall with a doorway, and what then collides and what is drawn. Decision 0015 already settled where art comes from (scripts of ours or CC0, made headless) and gave models a budget (the mannequin's: under 3,000 triangles, 4 materials, no textures); boxes already carry a model of their own (`box … model dojo.door`, 3c).

## Decision

### A kit piece is a mesh and its collision, from one source

- **A piece** of the kit is a named mesh in the kit's model (one file, every piece a node of it: `wall_2`, `stairs_1`, `ramp_1`, …) and the boxes it collides with, in the piece's own frame (a box may be turned within it: a ramp). Both come from the same script (`art/kit.py`, run by Blender without a screen): it writes the model and, beside it, the pieces' data (`kit.json`: each piece's boxes and size). What is drawn and what collides cannot drift apart: they are made together.
- **Their frame:** the origin at the piece's footprint center, on the floor it stands on (y = 0 is the floor under a wall, the top of a floor tile), facing −Z; sizes on a grid of a meter (a wall 1, 2 or 4 m long, 3 m tall, 0.3 m thick).
- **In a level,** a line puts a piece where it goes, turned as any box can be: `kit wall_door  4 0 -6  rotate y 90  name gate_west` (level format 9). It builds one entity: a body that never moves, its shape the piece's boxes as one compound (so its seams do not trip, 4a), and its look the piece's mesh. The console's `add` takes the same line; the level is written back as the same line (the entity remembers which piece it is). The game gives the level reader its kit, as it gives its zones (3b): the engine knows what a kit is, not what is in one.
- **Boxes stay:** a level may still say a box, with a color, or with a model drawn over it (`box … model dojo.door`): one-off shapes, mechanisms (a door, a lift: the simulation moves a box), and anything the kit does not have.

### A budget for what is drawn, per level

- Each kit piece: under 600 triangles and the kit's few materials (one palette); the whole kit, under 10,000 triangles. Measured by a test on the model file, as the mannequin's (2e).
- Each level, measured where it is drawn (the page counts the draw calls and triangles of every frame, 3d): the budget is set in 4.5f, where the first level built with the kit and its look is measured on the author's machine; this decision says only that it will be there, in numbers, and checked.

### Set in 4.5f, by the citadel

Added on 2026-11-17, when stage 4.5f built the first level with the kit (the citadel: 293 kit pieces, fourteen lamps, two guards, three floors) and measured it on the author's laptop (an Intel Iris Plus, the page at 1280 × 720, unthrottled frames: what a frame costs, not 60 a second):

- **A level's budget, wherever one stands in it:** at most **300 draw calls** and **50,000 triangles** a frame, and the drawing lights with at most **six** lamps at once. The citadel draws 97 to 277 calls and 7,800 to 19,600 triangles; a browser test reads both in five places of it (`data-draws`, `data-triangles`) and the lights it draws with (`data-lights`).
- **The lights are what costs, not the draw calls:** every point light three.js has is worked out for every pixel of every lit material, wherever the lamp is, and each one more recompiles them all. The citadel's fourteen cost a frame 9 to 10.5 ms; with four lamps, 5.5; the hall's 250 draw calls cost the same as the library's 101. So the page keeps as many lights as the world has lamps, six at most, and gives them each frame to the lamps whose reach the camera sees, the nearest first (`lampsToLight`); every lamp still glows, and the simulation's light (what a watcher sees by) is all of them, as always. The citadel's frames went to 4.2 to 7.2 ms (textures included: they cost nothing measurable).
- **Repeated pieces are not drawn as instances, yet:** measured, the draw calls are not where the time goes; instancing waits for a level whose draw calls do (around a thousand), and costs what it would cost then (the pieces' own entities in the inspector and the views).
- **Light is not baked:** in this engine the light is the simulation's (3d), and lamps break and switch (3e); light baked into a texture would stay when its lamp went out, and every repeated piece would need its own. What a texture keeps is only a stone's darker joints.
- **The kit's look is a picture of a meter for each material,** made by `art/kit.py` with the pieces (stone in courses, paving, a darker stone, wood, metal), periodic so that it repeats without a seam, and every face mapped a meter to it, so that the stones run on from one piece to the next: pieces stand on a meter's grid. Made in the script with numpy, not baked from Blender's shader nodes: those are not periodic over a tile (a brick's tint goes by its index), and Cycles adds noise; these give the same bytes on every run. JPEG, under 64 KB each; the kit's file under 500 KB (it is 368 KB). Seen nearly edge on, sharp (anisotropy 8).

## Consequences

- A level's text stays readable and its own: `kit stairs_3 0 0 4` says what is there; the console builds with it and writes it back.
- The look is the kit's: a level made of kit pieces looks like the kit. Free-form art (a statue, a tree) is a model drawn over a box, or a piece added to the kit.
- The navigation (0024) samples a kit piece as any body that never moves: its tops (each step of a stair, a ramp's slope) come from its boxes, turned within it.
- Pieces that repeat are the same mesh drawn many times: drawing them as instances, to keep the draw calls down, is for 4.5f to measure and decide.

## Alternatives considered

- **Meshes over boxes only** (every wall a box with a model): a doorway is three boxes and a model that must line up with them by hand, in every level; a stair, one box per step. The kit's own boxes, made with its mesh, line up by construction.
- **Collision taken from the mesh** (a triangle mesh from the model): exact, but slower to collide with, rough for the character controller's steps and edges, and a level could not be read as text any more.
- **A level made in Blender** and exported whole: the author never works in Blender by hand (scripts only), and the console, the tests and the diffs would lose the level's text.
