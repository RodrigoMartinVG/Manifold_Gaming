# Parte 7. Mentes: the lesson sheets

The design each of part 7's fourteen lessons is written from, under the approved
[curriculum](../tutorial-curriculum.md) (§5, part 7) and [decision 0021](../decisions/0021-a-new-tutorial.md). Millington's
_AI for Games_, 3rd ed. (**MA**), leads; the readers' notes were matched by subject, not by their earlier numbers. MA
gives the structure, the weaknesses and the exercises; the proofs, the corrections and the determinism are ours.
Abbreviations as in the curriculum §2. MA's pages are cited by section only (its printed and PDF pages differ by 21).

## The part sheet

**At the end, the reader can** make a guard that moves well before it thinks: steering as control (arrive and align
as damped oscillators with a damping ratio they choose), the shortest path on a graph with Dijkstra and A\* (both
proved), a navigation mesh built from the level, a path pulled taut and followed, avoidance of others by closest
approach. Then a mind: a hierarchical machine with history, suspicion as a leaky integrator with hysteresis, senses as
the only door to the world (sight by light, cone and ray; hearing through rooms), memory and a search from the last
known position. All of it deterministic: the same guard in every replay, ghost and browser.

**The closing game (7.14, _el guardia te persigue_).** 6.16's stealth level grown into four rooms and a corridor (with
6.14's generator available for more), with one to three guards. Goal: take the three keys (one hangs from a guard's
belt and is taken only from behind, 1.7's front test) and reach the exit. You lose when a guard in _chase_ comes within
0.8 m while it sees you; a checkpoint (6.13) restarts you. Tools: shadows (6.8's light), noise (a thrown stone from
4.14 makes a noise at its landing point; a dash makes one where you are), doors (6.7). The score is the time, the times
you were seen, and a "fantasma" rating if never seen. The 6.16 watchers stay as cameras that raise a narrowcast alarm
(MA §11.2.3) the guards hear. It exercises all fourteen lessons, and the replay of your best run holds the guards too.

**How the code evolves.** One folder, `mind/`, whose public names keep their meaning (0021):

| Lesson | Module (public names)                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7.7    | `mind/steer.ts` (`seek`, `flee`, `arrive`, `align`, `face`, `matchVelocity`, `pursue`, `avoid`, `combine`); `mind/graph.ts` (`Graph`, `MinQueue`, `dijkstra`); `mind/astar.ts` (`astar`); `mind/navmesh.ts` (`buildNavMesh`, `locate`, `corridor`); `mind/funnel.ts` (`funnel`); `mind/follow.ts` (`PathFollower`); `mind/guard.ts` (`Guard`, `think`) |
| 7.12   | `mind/hsm.ts` (`Machine`, `State`, history); `mind/senses.ts` (`Senses`, `Percept`, `see`, `hear`); `mind/memory.ts` (`Memory`, `suspicion`, `perceive`, `decay`); `think` grows the states                                                                                                                                                            |
| 7.14   | `mind/search.ts` (`flood`, `candidates`, `clear`); `mind/schedule.ts` (`shouldThink`); one `rng` stream per guard; console `possess`, `show.mind`                                                                                                                                                                                                      |

The guard is 5.2's character with the input component replaced by a mind component: `think(guard, view)` returns the
same per-step command record the keyboard produces (2.7, 2.8). Nothing downstream knows it is not a player.

**Lab-kit pieces the part adds** (curriculum §4.2): a time plot of a scalar (_x_(_t_), _s_(_t_)) with threshold lines; a
top-view agent (triangle with heading, trail); a graph and grid stepper (open and closed colours, back-arrows, _g_,
_h_, _f_ labels, an open-list table); a polygon-mesh view (polygons, portals, a located point, the funnel); a vector
field with streamlines; a live state diagram with the active state and the history marker lit; a sense view (cone with
inner and outer edges, rays to body samples, sound rings); a flood view; a scheduler timeline; a two-run hash
comparator (seed box, hash per second, first divergent step).

**MA's errors, corrected where they are used:** the heading inverse atan2(−*x*, _z_) and the arcsin angle (7.1), the
3D align without the _w_ < 0 check (7.1), A\*'s stopping claim and its additive bound (7.3), closest approach without
its minus sign (7.6), blended steering clipped component-wise (7.6), the scheduler test written backwards (7.13). Its
preference for a variable step is a disagreement, said once in 7.13.

---

### 7.1 Dirigirse I: buscar, llegar, girar (C)

- **Question:** ¿Cómo llega algo a un punto sin pasarse ni dar vueltas?
- **Before:** 2.3 (relaxation, the exact factor), 2.8 (the ball's velocity approached by that factor, driven by actions),
  1.16 (the shortest arc); 5.5's critically damped camera, a second-order system already met.
- **Leads:** MA §3.1–3.3.10 (kinematic against steering; seek, arrive, align, velocity matching; delegation, the family
  tree). **Also:** Reynolds (GDC 99: selection, steering, locomotion); Shiffman ch. 5 (the behaviours in JavaScript).
- **Approach:** MA's structure: three primitives (seek, align, velocity matching); every other behaviour computes a target
  and delegates. MF's force generators are rejected: a character is not a body (5.1), so the guard requests a velocity
  and 5.2's motor approaches it. Hook: a guard told to stop at its post. Kinematic "full speed" steps 4.2 cm and chatters;
  dynamic seek orbits.
- **The mathematics:** seek, **v**\* = _v_max_ **x̂**, overshoots and orbits. Arrive: inside the slow radius _R_,
  **v**\* = −(_v_max_/_R_)**x** (**x** from the post); the motor gives **ẍ** + **ẋ**/τ + (_v_max_/(*R*τ))**x** = 0, so
  ω₀² = _v_max_/(*R*τ) and ζ = ½√(_R_/(_v_max_ τ)); critical at _R_ = 4 _v_max_ τ, where entering at full speed gives
  _x_(_t_) = (_R_ + _v_max_ _t_)e^(−*t*/2τ) > 0: it never crosses. A satisfaction radius stops the residue. Align is the same
  equation on the angle, read from _s_ = (**f** × **t**)·**up** and _c_ = **f**·**t** without atan2 (2.9's rule): linear in
  _s_ near zero, full rate with the sign of _s_ when _c_ < cos *R*θ. **Example** (the figure's): _v_max_ = 2.5 m/s,
  τ = 0.1 s, from 4 m at full speed, **v** ← **v**\* + (**v** − **v**\*)e^(−*h*/τ), then **x** ← **x** + _h_**v**. _R_ = 1:
  ζ = 1.00, no overshoot, settled (5 cm, 5 cm/s) at step 143; _R_ = 0.5: ζ = 0.71, 3.4 cm over, step 112; _R_ = 0.25:
  ζ = 0.50, 7.5 cm, step 125; _R_ = 2: ζ = 1.41, step 217.
- **The live figure:** top view, drag the post, trails; toggle naive (kinematic seek, dynamic seek) against arrive;
  sliders _R_, τ, _v_max_; an _x_(_t_) plot. Panel: ζ, ω₀, overshoot, settle step. One knob, two failures: _R_ small
  overshoots, large arrives late. At 15 fps nothing changes (the step is fixed).
- **Traps:** unwrapped angles go the long way (MA fig. 3.10); "halfway each frame" depends on frame rate (2.3). Corregí al
  autor: MA's heading is θ from +Z, (sin θ, 0, cos θ), a model facing +Z (ours faces −Z: **f**(ψ) = (−sin ψ, 0, −cos ψ));
  its code inverts with atan2(−*x*, _z_), against its own formula; its 3D align takes arcsin\|**f** × **t**\| (wrong past
  90°) and never checks _w_ < 0.
- **Exercises:** (1) MA ex. 3.1–3.3 in our axes: guard (5, 0, 6), post (8, 0, 2): seek (0.6, 0, −0.8), kinematic velocity
  at 5 m/s (3, 0, −4), flee (−3, 0, 4); hint: no trigonometry. (2) _R_ for ζ = 1 at _v_max_ = 4, τ = 0.15 (2.4 m). (3) MA's
  atan2 bug at θ = π/2; hint: the vector is (1, 0).
- **Our angle:** arrive is 2.8's motor closed by one more feedback: 5.5's spring with a speed cap, in + − × ÷ √ only.
  "Dónde Manifold eligió otra cosa": its motor approaches the wanted velocity by a bounded step (50 m/s², `approach` in
  `core/src/character.ts`): saturation, never an overshoot, no `exp`.
- **Sources:** MA §3.1–3.3.10; [Reynolds](https://www.red3d.com/cwr/steer/gdc99/);
  [Shiffman ch. 5](https://natureofcode.com/autonomous-agents/). Reuses ML 5.3's `steering.ts` and tests; its
  tangent-plane projection waits for 10.4.
- **Open:** the curriculum's "the same algebra as the turret's aim in part 1" should read "5.5's spring" (problem 1).

### 7.2 Grafos y el camino más corto: Dijkstra (C)

- **Question:** ¿Cuál es el camino más corto entre dos lugares de un laberinto?
- **Before:** 3.17 (the maze from a seed is a spanning tree of the grid graph, with a few loops added), 2.10.
- **Leads:** MA §4.1–4.2 (directed non-negative graphs, paths as connections, cost-so-far, "chalk arrows", stop when
  the goal is the cheapest open node, fill). **Also:** Red Blob Games (BFS → Dijkstra, drawn live).
- **Approach:** the maze becomes a graph with costs (mud 3, a door 2, a ledge one way). Hook: the guard must reach a
  noise; walking towards it hits dead ends, and BFS counts cells but not costs. MA's framing kept; its proof is missing:
  ours is the invariant.
- **The mathematics:** definitions (directed graph, _c_ ≥ 0, path cost, dist(_s_, _u_)); the algorithm (open set, _g_,
  back-pointers); **invariant**: when _u_ is popped with the least _g_, _g_(_u_) = dist(_s_, _u_). Proof: on a cheaper path
  to _u_, let _y_ be its first node not closed and _x_ its closed predecessor; _g_(_y_) ≤ dist(_s_, _x_) + _c_(_x_, _y_) ≤ len(_P_) <
  _g_(_u_), using _c_ ≥ 0, so _y_ would have been popped first. Corollary: popped _g_ never decreases; stop when the goal
  is popped. A negative edge breaks exactly the inequality used. Ties: (_g_, node id), strict "<" on relaxation (a binary
  heap is not stable). **Example** (MA ex. 4.1): S→A 6, S→B 15, A→C 6, A→D 12, B→D 3, B→G 15, D→C 9, D→G 6. Open:
  {S0} → {A6, B15} → {C12, B15, D18} → {B15, D18} → {D18 (tie kept), G30} → {G24} → G popped at 24. Two optimal paths
  (S-A-D-G, S-B-D-G); the tie rule picks S-A-D-G. G was first reached at 30.
- **The live figure:** grid stepper on 3.17's maze (seed box), open cells coloured, closed shaded, back-arrows, _g_ on
  cells; a mud brush; step and run. Beside it MA's small graph with the open-list table. Toggle naive: stop when the goal
  is first reached, or BFS ignoring costs. Panel: popped node, _g_, open size, fill, path cost (24 against 30 naive).
- **Traps:** stopping at first sight; ties that depend on the heap; float costs summed in different orders (sum in path
  order; costs on a grid are integers).
- **Exercises:** (1) the open-list trace above; hint: write the table. (2) A negative-edge counterexample: S→A 2, S→B 3,
  B→A −2; Dijkstra fixes A at 2, the truth is 1. (3) Prove popped values never decrease.
- **Our angle:** a priority queue with fixed ties (§6.1). Dijkstra returns twice: hearing through rooms (7.10) and the
  search flood (7.11). In a perfect maze there is one path, which is why 3.17 adds loops: chases need choices. Manifold
  todavía no lo tiene (phase 4's navigation is 🔒).
- **Sources:** MA §4.1–4.2; [Red Blob Games, _Introduction to A\*_](https://www.redblobgames.com/pathfinding/a-star/introduction.html).
- **Open:** whether 3.17's grid uses 4- or 8-connectivity (it fixes 7.3's heuristic menu).

### 7.3 A\*: buscar con una estimación (C)

- **Question:** ¿Cómo se encuentra el camino más corto mirando menos?
- **Before:** 7.2; the triangle inequality (1.4, proved in 1.5).
- **Leads:** MA §4.3 (estimated total cost, heuristics and their fill, h = 0 is Dijkstra). **Also:** Hart, Nilsson and
  Raphael (1968) for the original proof; Amit Patel's pages (heuristics, ties); ML 4.5.
- **Approach:** the same loop ordered by _f_ = _g_ + _h_. Hook: Dijkstra's fill floods the whole level to reach a door
  10 m away. MA states without proof; we prove it twice, and the second proof is the lesson's insight.
- **The mathematics:** admissible (_h_ ≤ _h_\*) ⇒ optimal: while running, some node _n_ of an optimal path is open with
  _g_(_n_) = _g_\*(_n_), so _f_(_n_) ≤ _C_\*; a goal popped with _g_ > _C_\* would have _f_ > _f_(_n_). Consistent (_h_(_u_) ≤ _c_(_u_, _v_) + _h_(_v_))
  ⇒ reduced costs _c_′ = _c_ − _h_(_u_) + _h_(_v_) ≥ 0, and _c_′(_P_) = _c_(_P_) − _h_(_s_) for every path to the goal (telescoping, with _h_(goal) = 0):
  **A\* is Dijkstra on reduced costs**, same optimal paths, no closed node reopens. Euclidean distance is consistent by
  the triangle inequality; Manhattan on a 4-grid, octile on an 8-grid. Weighted A\*: _f_ = _g_ + _wh_ costs at most _wC_\*.
  Ties: least _f_, then least _h_, then node id (ML 4.5's rule). **Example** (MA ex. 4.4, on 7.2's graph):
  _h_ = {S 0, A 6, B 9, C 3, D 3, G 0}: {S0} → {A12, B24} → {C15, D21, B24} → {D21, B24} → {G24, B24}, G popped by the
  tie rule: cost 24. Admissible; not consistent (_h_(B) = 9 > _c_(B, D) + _h_(D) = 6).
- **The live figure:** 7.2's stepper with a heuristic menu: 0, Manhattan, octile, Euclidean, Euclidean², 1.5 × Euclidean.
  Panel: fill, path cost, reopenings. Expected relations on an open room: same cost for 0, Manhattan (4-grid) and
  Euclidean, fill(0) > fill(Euclid) > fill(Manhattan); Euclidean² and 1.5× fill less and may cost more, the latter never
  more than 1.5 _C_\*. In the maze heuristics help little (dead ends).
- **Traps:** squared distance overestimates; dropping the closed list with a merely admissible _h_. Corregí al autor: MA
  says stopping when the goal is the cheapest open node does not guarantee optimality (true only for inadmissible _h_),
  and bounds an overestimate additively (for _wh_ the bound is multiplicative).
- **Exercises:** (1) the trace above, and the largest admissible _h_(D) (6). (2) Prove Euclidean is consistent; hint:
  one triangle. (3) Show Euclidean² inadmissible with two cells 3 apart. (4) Prove the _wC_\* bound.
- **Our angle:** the proofs are ours, and "reduced costs" turns a new algorithm into an old one. 10.7 pays it back: on a
  torus the admissible heuristic is the minimum over translates. Determinism: the tie rule, and costs compared exactly.
- **Sources:** MA §4.3; [Amit Patel, _Amit's A\* Pages_](https://theory.stanford.edu/~amitp/GameProgramming/); Hart et
  al., [DOI](https://doi.org/10.1109/TSSC.1968.300136). Reuses ML 4.5's `astar.ts` (swamp cells, tie rule, tests), with its
  `1e-9` tolerance replaced by exact comparisons.
- **Open:** none.

### 7.4 Mallas de navegación (C)

- **Question:** ¿Por dónde se puede caminar en un nivel que no es una grilla?
- **Before:** 7.3; 3.6 (inside a triangle); 1.6 (ORIENT2D); 3.11 (Minkowski: a disc against a wall is a point against a
  grown wall).
- **Leads:** MA §4.4 (a division scheme judged by quantization, localization and validity; tiles, Dirichlet domains,
  points of visibility, navigation meshes), §12.1. **Also:** E §5.4.1 (point in a convex polygon by ORIENT2D, binary
  search), §12.2 (adjacency), §12.5 (ear cutting, convex pieces); Recast; recast-navigation-js.
- **Approach:** MA's general problem first: world ↔ graph, and the three criteria. Hook: 6.16's room is boxes, not cells;
  a grid wastes nodes, draws staircase paths and lets diagonals clip corners. Convex floor polygons make "anywhere in
  this node sees anywhere else in it" true. Built from 6.3's boxes: erode the floor by the agent's radius _r_ (grow each
  obstacle by _r_), cut the free region into rectangles by a sweep along _x_, and join rectangles that share an edge
  segment (a portal). Ear cutting for general polygons is a "Más a fondo".
- **The mathematics:** convex ⇒ the segment between two of its points stays inside (definition); point in a CCW convex
  polygon ⇔ ORIENT2D(**v**ᵢ, **v**ᵢ₊₁, _P_) ≥ 0 for all _i_ (proof from 1.6's sign); nodes at portal midpoints, costs as
  straight distances, so the Euclidean heuristic stays consistent; MA's validity fails across a portal, which is why 7.5
  exists. **Example:** room [0, 10] × [0, 6], pillar 2 × 2 at (5, 3), _r_ = 0.3. Free region [0.3, 9.7] × [0.3, 5.7] minus
  [3.7, 6.3] × [1.7, 4.3]: four rectangles (left, bottom, top, right), four portals (_x_ = 3.7 and 6.3; _z_ ∈ [0.3, 1.7] and
  [4.3, 5.7]). From (2, 3) to (8, 3): two equal corridors, the tie picks one; through midpoints (3.7, 1.0), (6.3, 1.0) the
  path is 7.85 m (7.5 pulls it to 6.88 m). Validity counterexample: (0.5, 5.5) in the left piece and (6, 0.5) in the
  bottom one are neighbours, yet their segment crosses _x_ = 3.7 at _z_ = 2.59, inside the grown pillar.
- **The live figure:** the stealth room from above; polygons coloured, portals drawn; drag a point and its polygon lights
  (the ORIENT2D signs shown); an _r_ slider rebuilds the mesh (a 0.8 m doorway closes at _r_ > 0.4); toggle naive: a
  tile graph. Panel: polygons, nodes, located polygon, corridor, path length (7.85 m above).
- **Traps:** a big region's representative point makes costs lie (MA); non-convex pieces break localization; a body in
  the air locates wrongly; stale coherence (look in the last polygon and its neighbours first, then everywhere).
- **Exercises:** (1) MA ex. 4.13: the edges-as-nodes graph of the example. (2) Prove the ORIENT2D criterion. (3) Why the
  doorway closes; hint: Minkowski.
- **Our angle:** "se reduce a…" a point in an eroded floor (3.11). The mesh is data built at load from 6.3's format, in a
  fixed order, so every copy agrees. Manifold todavía no lo tiene; its phase 4 has "which graph" as 🔒.
- **Sources:** MA §4.4, §12.1; E §5.4.1, §12.2, §12.5; [Recast & Detour](https://github.com/recastnavigation/recastnavigation);
  [recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js).
- **Open:** that 6.3's format gives walkable floors and obstacles as boxes; arbitrary meshes need ear cutting in the main
  path (problem 9).

### 7.5 Seguir un camino (C) ◇

- **Question:** ¿Cómo se camina un camino planeado sin chocar las esquinas?
- **Before:** 7.4, 3.3 (the closest point on a segment, clamped).
- **Leads:** MA §3.3.12 (the path parameter, coherence, "chase the rabbit", predictive following). **Also:** Mononen's
  _Simple Stupid Funnel Algorithm_; MA §4.4.3 (shortest paths bend only at convex corners) and §4.4.7 (ray-cast smoothing,
  which misses the optimum).
- **Approach:** two pieces. Hook: seeking each portal midpoint in turn zig-zags and brushes the grown corners; a global
  nearest-point search on a hairpin makes the guard jump arms. First pull the string (funnel), then follow by parameter.
- **The mathematics:** taut string: a shortest path in the corridor bends only at corridor corners (if it bent elsewhere,
  the triangle inequality shortens it). Funnel: apex, left and right edges; each portal tightens a side by ORIENT2D, and
  when a side crosses the other the apex moves to that corner. Follow: _t_ = clamp((_P_ − _A_)·(_B_ − _A_)/\|_B_ − _A_\|², 0, 1)
  ("el mismo movimiento": the part along the segment), parameter _s_ = *L*ₖ + _t_\|_B_ − _A_\|, target at _s_ + _d_, then seek;
  arrive at the end (7.1); search only a window of segments near the last _s_. **Example:** 7.4's corridor, funnel path
  (2, 3) → (3.7, 1.7) → (6.3, 1.7) → (8, 3), segments 2.14 + 2.60 + 2.14 = 6.88 m (midpoints: 7.85). Guard at (3, 2):
  _t_ = 3.0/4.58 = 0.655, _s_ = 1.40 m, cross-track 0.19 m; lookahead 1 m gives _s_ = 2.40, target (3.96, 1.70).
- **The live figure:** the corridor with the funnel tightening portal by portal; a hairpin path with coherent against
  global search side by side (naive toggle). One knob, two failures: lookahead small wobbles around the path, large cuts
  corners into the grown obstacle (both measured: cross-track RMS, least clearance). Panel: _s_, cross-track, clearance,
  funnel and midpoint lengths.
- **Traps:** the funnel on the un-eroded mesh hugs walls; a parameter that runs backwards after a push (clamp it to
  non-decreasing, relocate when off the mesh); predictive following cuts patrol corners (MA fig. 3.17).
- **Exercises:** (1) The parameter and target above. (2) Prove the bending lemma. (3) A window size that prevents the
  hairpin jump at speed _v_ and step _h_; hint: how far can _s_ move in one step.
- **Our angle:** "el mismo movimiento" (§6.2) in a projection onto a segment; clearance for free because the mesh was
  eroded (Minkowski again). Foldable into 7.4 as a section, keeping the hairpin figure.
- **Sources:** MA §3.3.12, §4.4.3, §4.4.7; [Mononen, funnel](http://digestingduck.blogspot.com/2010/03/simple-stupid-funnel-algorithm.html).
- **Open:** none.

### 7.6 Dirigirse II: anticipar, esquivar, combinar (C)

- **Question:** ¿Cómo se esquiva a otros que también se mueven?
- **Before:** 7.1, 3.3, 3.15 (sweeps, time of impact).
- **Leads:** MA §3.3.8 (pursue, evade), §3.3.13–3.3.15 (separation, collision avoidance, obstacle and wall avoidance),
  §3.4.1–3.4.3 (blending, priorities, equilibria). **Also:** Reynolds; Guy and Karamouzas (anticipatory avoidance); Sunshine-Hill
  (RVO and ORCA, for the author).
- **Approach:** two guards meet head-on in a corridor following their paths: they collide and push, or freeze. MA's
  closest approach, not a panic cone; avoid only the soonest collision. Then combining: blending dilutes, priorities with
  an ε threshold do better, and no local rule sees round a corner, so avoidance never replaces planning.
- **The mathematics:** three "when do they meet" quadratics, one family (with 4.14's firing solution). Pursue: find
  _t_ > 0 with \|**Δ** + **u**_t_\| = _s t_: (\|**u**\|² − *s*²)*t*² + 2(**Δ**·**u**)_t_ + \|**Δ**\|² = 0, one positive root iff _s_ > \|**u**\| (the
  product of roots is negative). Closest approach: **r**(_t_) = **Δ** + **w**_t_, _t_\* = −**Δ**·**w**/\|**w**\|², _d_min_ = \|**Δ** + **w**_t_\*\|;
  collision iff _d_min_ < _r_A_ + _r_B_ and 0 < _t_\* < horizon: "se reduce a" 3.15's point against a grown disc. Response
  sideways along the rejection of **Δ** + **w**_t_\* ("el mismo movimiento"). Blends: a vector field **F**(**x**); its zeros
  are equilibria; a stable one has a basin where the guard freezes; priorities escape unstable ones only.
  **Example** (MA ex. 3.11): A (4, 2), **v**A (3, 4); B (20, 12), **v**B (−5, −1): **Δ** = (16, 10), **w** = (−8, −5),
  _t_\* = 178/89 = 2, both at (10, 10): a dead-on collision. MA's formula, without the minus, gives −2, "moving apart".
- **The live figure:** two discs with draggable velocity arrows, ghosts at _t_\*, a collision lamp; toggle MA's sign. A
  corridor with two guards, avoidance off and on. A field of "seek goal + avoid two foes" with streamlines and the basin
  shaded; blend against priorities. Panel: _t_\*, _d_min_, collide?, basin fraction.
- **Traps:** corregí al autor (the sign; blends clipped with max per component instead of by length; its code uses
  `distance` before defining it); whiskers trapped by acute corners (MA fig. 3.27); avoidance by distance only.
- **Exercises:** (1) MA ex. 3.11 and the book's bug. (2) Interception: target at (10, 0, 0) moving (0, 0, −2), chaser at
  the origin at 4 m/s: _t_ = √(100/12) = 2.89 s, aim (10, 0, −5.77). (3) MA ex. 3.7–3.8: target (8, 2) moving (3, 4),
  prediction ½ s: (9.5, 4). (4) A stable equilibrium for one goal and two symmetric foes.
- **Our angle:** "se reduce a" (§6.6); pairs handled in id order so the result does not depend on iteration order. ML 5.3's
  separation is reused as the first, naive rung.
- **Sources:** MA §3.3.8, §3.3.13–3.3.15, §3.4.1–3.4.3; Guy and Karamouzas, _Game AI Pro 2_ ch. 19,
  [gameaipro.com](https://www.gameaipro.com/).
- **Open:** none.

### 7.7 El guardia patrulla (P)

- **Question:** ¿Cómo recorre un guardia su ronda por el nivel?
- **Before:** 7.5, 7.6, 5.2 (the character as components); 6.3 and 6.16 (the level and the room).
- **Leads:** MA §14.1 (behaviours first; the simplest technique per layer; playable at every step). **Also:** MA §14.2.1
  and GPP ch. 2, ch. 14 (a mind emits the player's commands; a component swapped).
- **Approach:** list the behaviours (walk the route, wait at posts, look round, step aside), then pick per layer: A\* on
  the navmesh, funnel, follower, arrive at posts, align to the post's heading, avoidance. Hook: 6.16's room is still; a
  guard makes it a place.
- **The project:** `mind/` as in the part sheet. The level format (6.3) gains the kinds `guard` and `patrol` (named
  waypoints, a wait in steps and a heading per post, loop or ping-pong). `think(guard, view)` returns a command record;
  5.2's input component is replaced by a mind component reading it. The navmesh is built at level load; paths are
  replanned on a new goal or when the follower leaves its corridor, never every step. The order: minds think at the step's
  start from the previous step's state, and their commands enter like keys (4.11's order). Playable: a first mini-game,
  _robar la llave_: take the key from the guard's belt from behind (1.7's front test); in front of it the guard turns and
  pushes you back. Console: `show.nav` and `show.steer` (view); recipe `seed 4; restart; nav.path 1` prints the corridor
  and its length (6.88 m for 7.4's example room), and `step 600; hash` gives the same hash twice and in two browsers.
- **Traps:** replanning per step (cost, flicker); arriving at every waypoint instead of only at posts; a guard pushed off
  the mesh (relocate to the nearest polygon); reading the world mid-step.
- **Exercises:** (1) Add a post that waits 120 steps and faces the door. (2) Make the route ping-pong. (3) Measure the
  plan's cost in the frame bar (3.13) against the step budget.
- **Our angle:** the guard is a player without a keyboard: 2.15's ghost and 2.14's replays carry it unchanged. En los
  motores: where a bot's brain runs, in the simulation (small replays, but a changed brain breaks old ones) or as a player
  whose commands are recorded (robust, larger). "Dónde Manifold eligió otra cosa": Manifold has not chosen; ROADMAP
  phase 4.0 lists it as 🔒. The tutorial runs it in the simulation and says why (7.13).
- **Sources:** MA §14.1, §14.2.1; GPP ch. 2, ch. 14.
- **Open:** the command record's name and fields as parts 2 and 5 fix them (problem 6).

### 7.8 Los modos del guardia: máquinas de estado jerárquicas (C)

- **Question:** ¿Cómo se organiza una mente que patrulla, sospecha, persigue y vuelve?
- **Before:** 5.4 (the state ladder, up to nested machines), 2.12 (entry and exit actions, conditions).
- **Leads:** MA §5.3.8–5.3.9 (alarm behaviours, hierarchy, history, trees in transitions), §5.10 (actions take time and
  are interrupted), §14.1 (a scalar fear level with thresholds driving a small machine). **Also:** GPP ch. 7 (pushdown
  automaton, the machine's limits); G2 §17.9.5.6–7 (scripted machines, cooperative threads); behaviour trees (MA §5.4) as a
  "Más a fondo".
- **Approach:** start where 5.4 stopped. Hook: add "heard a noise → look, then resume" to a flat patrol: every patrol
  state needs a "look and come back to me" twin, and a second alarm multiplies again (MA fig. 5.15). Hierarchy with a
  history state resumes the exact inner state. Above it, suspicion: a number that rises with evidence and decays, read
  through two thresholds per change (hysteresis).
- **The mathematics:** suspicion as a leaky integrator (2.3 again): _ṡ_ = _kI_ − λ*s*, exact step
  _s_ ← _s_\* + (_s_ − _s_\*)e^(−λ*h*) with _s_\* = _kI_/λ; a threshold _s_T_ is reachable iff _s_\* > _s_T_, at
  _t_T_ = −(1/λ) ln(1 − _s_T_/_s_\*). Hysteresis: up at _a_, down at _b_ < _a_; a noisy _I_ that makes _s_ hover crosses one
  threshold many times and a band once. **Example:** _k_ = 1, λ = 0.5 s⁻¹, _I_ = 0.6: _s_\* = 1.2; suspicious (0.5) at
  _t_ = 1.08 s, step 65; chase (0.8) at 2.20 s, step 132. A faint _I_ = 0.2 gives _s_\* = 0.4: never. The factor
  e^(−λ*h*) = 0.991701292639 is a literal of the tuning data, never `Math.exp` at run time (2.9's rule).
- **The live figure:** the diagram (patrol ⊃ {walk, wait, look}; alert ⊃ {suspicious, investigate, search}; chase) with
  the active state and the history marker lit; the suspicion bar with its up and down lines; drag the evidence _I_. Toggle
  naive: one threshold. One knob, two failures (the band): zero flickers (state changes per minute in the dozens), too
  wide keeps the guard alert long after (seconds to calm). Panel: _s_, state, changes per minute, steps to suspicious (65).
- **Traps:** transition states for actions that take time (use entry and exit, MA fig. 5.55); entry actions fired every
  step; ignoring an obvious event (MA §2.1.3). Generators read beautifully, but their suspended state lives inside the
  engine, not in the world data: it cannot be hashed, saved (6.13) or sent (9.5). The guard keeps explicit state; the
  generator version is a "Sutileza".
- **Exercises:** (1) MA ex. 5.4–5.6: count the flat machine's states with one resuming alarm (twice the patrol's) against
  the hierarchical one. (2) The detection time for given _I_, _k_, λ, and the condition _kI_/λ > _s_T_. (3) Write the patrol as
  a generator and as explicit fields; save and restore the second mid-wait.
- **Our angle:** suspicion is 2.3's equation with evidence as input; state, history and suspicion are data, so they are
  hashed and saved. Behaviour trees with RUNNING and interruption, with MA's hybrid (the machine picks which tree runs),
  are the "Más a fondo" the author decided.
- **Sources:** MA §5.3.8–5.3.9, §5.4, §5.10, §14.1; GPP ch. 7; G2 §17.9.5.6–7; Champandard and Dunstan,
  [_The Behavior Tree Starter Kit_](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter06_The_Behavior_Tree_Starter_Kit.pdf).
  Recalls archived 2-02 (one mode per step) through 5.4.
- **Open:** "generators as coroutines" in the curriculum (problem 2); the line between 5.4 and 7.8 (problem 3); how part 2
  computes e^(−*h*/τ) (problem 4).

### 7.9 Lo que el guardia puede saber: ver (C)

- **Question:** ¿Qué ve el guardia, y por qué no debe saber más que eso?
- **Before:** 7.8; 6.8 (the light meter, the cone, the line of sight, the brightest body sample).
- **Leads:** MA §11.4.1–11.4.4 (sense management: what a character may know; sight's tests), §6.1.3 (shadow points).
  **Also:** G2 §18.2.3 ("perception is reality"); G §10.2 (draw where the NPC believes you are); RTR 5.2 (a view cone is a
  spotlight in reverse, with a soft edge); E §5.3 (a thin capsule instead of a ray); Leonard (Thief); Walsh (Splinter Cell).
- **Approach:** hook: 7.8's guard reads `player.position` and finds you through walls and in the dark: players call it
  cheating. The rule: the mind reads a `Senses` object of percepts, never the world. 6.8 gave the tests; this lesson adds
  the knowledge model, a soft cone with peripheral vision, a detection rate into 7.8's integrator, and the order of cost.
- **The mathematics:** percept = (what, where, step). Evidence per step _I_ = _V_ · _a_(θ) · _f_(_d_): _V_ the brightest
  visible body sample (6.8), _a_ = smoothstep(cos θ_out, cos θ_in, cos θ) (cosines stored as data), _f_(_d_) = 1 − _d_/_d_max_.
  Tests by cost: range (squared), cone (one dot), light (6.8's sum), ray last (MA reports line-of-sight checks above 30% of
  a game's processor time). **Example:** guard at the origin facing −Z, cone 60° outer and 30° inner, range 12 m; player
  at (3, 0, −6): _d_ = 6.71, cos θ = 0.894 (inside the inner cone, _a_ = 1), _f_ = 0.441; head lit 0.7, chest 0.5, feet 0.9 but
  behind a crate: _V_ = 0.7, _I_ = 0.309, _s_\* = 0.617, suspicious after 3.32 s. At (5, 0, −5): cos θ = 0.707, _a_ = 0.598,
  _I_ = 0.172, _s_\* = 0.344: it never gets past curious.
- **The live figure:** drag the player round a guard; the cone's two edges; rays to head, chest and feet coloured by the
  test that failed; each sample's light; the believed-position marker left where it last saw you. Toggle naive:
  omniscient. Panel: _d_, cos θ, _a_, _f_, _V_, _I_, rays cast per step (tests in order against ray first).
- **Traps:** the cone in the body's frame instead of the head's (1.11); a stale percept used as current; peeking through
  the crack between two boxes (fat ray); a dark player against a bright doorway should be seen (MA's contrast, a "Más a
  fondo").
- **Exercises:** (1) Find a spot visible but undetectable (dark) and one lit but invisible (behind a wall). (2) _I_ and the
  detection time for a given place. (3) Count ray casts per step for three guards, in cost order and ray first.
- **Our angle:** the same light function the drawing will use (8.7 makes them equal); percepts are data, in the hash. En
  Manifold: its watcher (stage 3d, `illuminate` in `core/src/world.ts`) sees in range, in a cone stored as a cosine,
  through nothing, and lit enough as seen from it: the same four tests.
- **Sources:** MA §11.4.1–11.4.4, §6.1.3; [Leonard, _Thief_'s sensory system](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-);
  Walsh, [_Splinter Cell Blacklist_ perception](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter28_Modeling_Perception_and_Awareness_in_Tom_Clancy%27s_Splinter_Cell_Blacklist.pdf).
  Reuses archived 3-01's four tests through 6.8.
- **Open:** what 6.8 already teaches (body samples, the cone); 7.9 must recall, not repeat (problem 7).

### 7.10 Oír a través de las salas (C)

- **Question:** ¿Cómo oye el guardia un ruido a la vuelta de la esquina, y no a través de la pared?
- **Before:** 7.2; 6.9 (attenuation between a minimum and a maximum, occlusion); 6.4 (zones are rooms, doorways portals).
- **Leads:** MA §11.4.5 (the sense graph: regions, one-way per-modality connections, sound processed node by node in
  distance order). **Also:** G2 §15.4.3–5 (occlusion, obstruction, exclusion); GPP ch. 20 (a radius query is a spatial
  partition); GPP ch. 15 (capture the noise's place and step when it is emitted).
- **Approach:** hook: 6.16's straight-line hearing, flawed on purpose: the guard hears a noise in the next room and walks
  into the wall. Sound goes round, through doorways: shortest distance on the room graph, Dijkstra again, and the guard
  heads for the doorway the sound came through, since it cannot know the source.
- **The mathematics:** graph: doorway midpoints, the source and the listener; inside a room the straight distance; a door
  multiplies by its factor. Gain in linear terms, _g_ = _L_·min(1, _d_min_/_d_graph_)·Π(doors) (no logarithms in what is hashed;
  decibels belong to the audio), heard iff _g_ ≥ the listener's threshold; delay _d_graph_/_c_; apparent source = the last
  portal on the path. **Example:** listener (2, 0, 4), source (8, 0, 4), a wall at _x_ = 5 with a doorway at _z_ ∈ [0, 1]
  (midpoint (5, 0, 0.5)). Straight: 6 m, _g_ = 0.167 (threshold 0.12: "heard", wrongly). Graph: 2 × 4.61 = 9.22 m,
  _g_ = 0.108: not heard. A dash of loudness 2: 0.217, heard, and the guard goes to (5, 0, 0.5).
- **The live figure:** two rooms and a corridor; click to make a noise; rings for the straight model and for the graph
  model (naive toggle); listeners light up with an arrow to their apparent source; doors open and closed. Panel: straight
  and graph distances, both gains, threshold, heard, apparent source.
- **Traps:** distance hearing through walls and in the wrong order round corners (MA figs. 11.3–11.4); a noise read when
  the guard thinks instead of when it happened; one-way glass that passes sight but not sound (modality per edge).
- **Exercises:** (1) MA ex. 11.1 (*I*₀ = 4, _a_ = 0.8: at 2 units 2.56 < 2.6, not heard; at 3 units 2.05 ≥ 2, heard: the
  farther one hears it) and the same with our 1/_d_. (2) The example's numbers with the door shut at factor 0.5. (3) MA ex.
  11.2: draw a level for a given sense graph.
- **Our angle:** "se reduce a" the shortest path (§6.6); deliveries ordered by (step, source id). "Dónde Manifold eligió
  otra cosa": Manifold's sounds carry a straight hearing radius (`core/src/sound.ts`, for phase 4's bots); its bots will
  meet this lesson's flaw.
- **Sources:** MA §11.4.5; G2 §15.4.3–5; GPP ch. 15, ch. 20.
- **Open:** that 6.9 and 6.16 compute hearing in linear gain in the simulation (problem 8).

### 7.11 Memoria, sospecha y búsqueda (C)

- **Question:** ¿Dónde te busca el guardia cuando te perdió de vista?
- **Before:** 7.9, 7.10 (and 7.4's mesh, 7.2's Dijkstra).
- **Leads:** MA §6.2.6 (map flooding), §5.6 (Markov systems, for a "Más a fondo"), §11.4.3 (trails), §6.1.1 (hiding
  spots). **Also:** G §10.2 (the believed position drawn); Welsh, _Looking for Trouble_ (Game AI Pro 2 ch. 27).
- **Approach:** hook: when you break line of sight the guard either still knows where you are (cheats) or forgets at once
  (dull). Memory keeps the last known position (LKP), its step and velocity; suspicion decays (7.8). The search: where
  could you be by now, visited cheapest first, cleared by the cone.
- **The mathematics:** reachable set _R_(Δ*t*) = {_n_ : _d_graph_(LKP, _n_) ≤ _v_max_ Δ*t*}: a Dijkstra flood with a radius on
  the navmesh, monotone in Δ*t*. Candidates: hiding spots in _R_ (6.x's shadow points), ordered by the guard's own path
  cost; a node is cleared when it is in the cone and in sight; cleared nodes can be re-entered from uncleared neighbours
  at _v_max_ (a "Sutileza", or its own exercise). First look at LKP + **v**Δ*t* located on the mesh. **Example:** _v_max_ =
  3 m/s, Δ*t* = 2 s: radius 6 m; spots at graph distances 4.5, 5.2 and 7.0 m: two candidates; the third joins at
  Δ*t* = 2.33 s.
- **The live figure:** the room with the flood growing from the LKP; cleared cells greyed by the sweeping cone; spots
  numbered in visiting order; a Δ*t* slider. Toggle naive: go to the LKP and give up. Panel: Δ*t*, radius, candidates,
  cleared %, next target.
- **Traps:** a flood in straight-line distance (through walls again); clearing that never expires (the player walks back
  in); a search that never ends (a time limit or suspicion below the down threshold returns to patrol, by history).
- **Exercises:** (1) Which spots are candidates at Δ*t* = 1.5 s (only the first, 4.5 ≤ 4.5). (2) Prove _R_ is monotone and
  that clearing commutes with it as long as re-entry is ignored. (3) MA ex. 5.15: a doubly stochastic matrix sends any
  belief to the average (the "Más a fondo": belief diffused by a matrix and zeroed where seen).
- **Our angle:** Dijkstra the third time; memory is data, so a save holds it (6.13). The probabilistic version stays
  deterministic only with a fixed order of operations.
- **Sources:** MA §6.2.6, §5.6, §11.4.3, §6.1.1; Welsh, [_Game AI Pro 2_](https://www.gameaipro.com/).
- **Open:** whether 6.x computes hiding spots as data (MA's shadow points) or 7.11 does.

### 7.12 El guardia nota (P)

- **Question:** ¿Cómo reacciona el guardia a lo que ve y a lo que oye?
- **Before:** 7.7, 7.8, 7.11.
- **Leads:** MA §14.2.2–3 (perception and pathfinding in shooters). **Also:** MA §2.1.3 (the perception window).
- **Approach:** the guard's changes of mind must read in the few seconds the player watches it: a "?" and a head turn
  before it walks, a "!" before it runs. Hook: 7.7's guard walks past you in full light.
- **The project:** `mind/hsm.ts` (states with parent, entry, exit, update, history); `mind/senses.ts` (`see`, `hear`,
  producing `Percept`s in a fixed order, sight then hearing, guards by id); `mind/memory.ts` (LKP, its step, suspicion with
  its two bands); `think` grows patrol (walk, wait, look), suspicious (face the stimulus), investigate (go to the stimulus
  or the apparent doorway), chase (pursue, 7.6), search (go to the LKP and look round; the flood is 7.14's). Senses run in
  the light phase after physics, so a mind reads the last step's percepts: one step of latency, the same in every copy.
  Level data gains thresholds and cone cosines per guard. Playable: _robar la llave_ with senses; a stone (4.14) lands and
  lures. Console: `show.senses` (cone, rays, rings: view); `noise x y z loudness` (a world change entering at a step).
  Recipe on 7.10's rooms: `seed 3; restart; noise 8 0 4 2; step 120; guard.state 1` gives `investigate`, and
  `guard.lkp 1` gives `5 0 0.5`.
- **Traps:** states that flicker (tune the band); percepts consumed twice; the head turning slower than the body (a
  hierarchy, 1.12).
- **Exercises:** (1) Add a "calls the others" state that emits a narrowcast event (6.5). (2) Make crouching (lower body
  samples) count. (3) Tune the bands so a lit player at 10 m is noticed within 2 s and a dark one never.
- **Our angle:** the mind is a pure function of the state and its own data; the guard is already in every replay. En
  Manifold: phase 4's "a small brain (patrol, look into a light or a sound, chase…)" is this lesson, not yet built.
- **Sources:** MA §14.2.2–3, §2.1.3.
- **Open:** `show.senses` is added here, before 7.14's `show.mind` (problem 5).

### 7.13 Una mente determinista (C)

- **Question:** ¿Cómo piensa el guardia igual en cada repetición y en cada navegador?
- **Before:** 7.12, 2.14 (replays, hashes, the first divergent step).
- **Leads:** MA §10.1–10.2 (scheduling by frequency and phase; anytime algorithms), corrected. **Also:** G ch. 8 (several
  update rates: minds at a few hertz); GPP ch. 10 (update order, dormant objects whose rule is itself state).
- **Approach:** hook: two runs of one replay with three guards diverge at some step. Each cause is a place where MA is
  silent or unsafe: a planner sliced by a 1 ms budget read from the clock, `Math.random` in an idle choice, ties in a
  heap, a generator, listeners called in insertion order, `Math.atan2` in a steering rule.
- **The mathematics:** a mind with period _p_ and phase φ thinks at step _n_ iff (_n_ + φ) mod _p_ = 0. Equal periods
  with distinct phases never clash (two congruences mod _p_ with different residues); coprime periods clash once every
  _pq_ steps whatever the phases (Chinese remainder theorem). Budget by iterations: A\* expands at most _K_ nodes per
  think and keeps its open list as data. Streams: `rng(seed, 'guard', id)` (2.10). Output: commands, so replays, ghosts and
  the network carry the minds. **Example:** three guards, _p_ = 4, φ = 0, 1, 2: guard 0 thinks at steps 0, 4, 8…, guard 1
  at 3, 7, 11…, guard 2 at 2, 6, 10…; never two at once. MA's test, `frequency % (frame + phase) == 0`, is true only when
  _frame_ + _phase_ divides 4: a mind thinks at frames 1, 2 and 4, then never again.
- **The live figure:** a scheduler timeline (rows per guard, think marks, clashes) with period and phase sliders and MA's
  test as the naive toggle. Then a two-run comparator: seed box, hash per second for runs A and B, the first divergent
  step, and switches that break one rule each (clock budget, `Math.random`, untied heap, generator, insertion order). The
  clock rule is shown with run B made deterministically slower, so its divergence is reproducible.
- **Traps:** corregí al autor (the backwards test; budgets measured in time); `Array.prototype.sort` is stable, but a
  comparator that returns 0 for distinct guards still depends on insertion order; dormancy decided by distance to the
  camera (a view quantity) instead of a state rule.
- **Exercises:** (1) MA ex. 10.1: choose phases so three behaviours never clash. (2) Prove the two scheduling claims.
  (3) Find the frames where MA's test fires for _p_ = 6. (4) Make a sliced A\* deterministic; hint: what is its state.
- **Our angle:** the thread's mind stop (§6.1: priority queues with fixed ties, minds by step, with streams, emitting
  actions). MA prefers a variable step (§3.1.3): a disagreement for determinism, said here. Manifold: its own trig
  (`sinCosDegrees`), its replays, and the 🔒 of where a brain runs.
- **Sources:** MA §10.1–10.2; G ch. 8; GPP ch. 10; [Fiedler, _Floating Point Determinism_](https://gafferongames.com/post/floating_point_determinism/).
- **Open:** none.

### 7.14 El juego: el guardia te persigue (P)

- **Question:** ¿Cómo se escapa de un guardia que te busca?
- **Before:** 7.13.
- **Leads:** MA §14.1 (design method). **Also:** MA §2.1 (the perception window).
- **Approach:** the part sheet's game. Hook: 7.12's guard loses you behind a door and gives up: there is no tension.
- **The project:** `mind/search.ts` (`flood`, `candidates`, `clear` from 7.11); `mind/schedule.ts` (`shouldThink(n, p, φ)`),
  guards spread by phase; one rng stream per guard; the watchers' alarm as a narrowcast event; keys, exit, checkpoints
  (6.13 saves the minds: state, history, memory, suspicion, each stream's state). Console: `possess <id>` (a world change:
  the keys drive the guard's command record, which the design makes a one-line swap) and `show.mind` (state label,
  suspicion bar, LKP, flood: view). Recipes: `seed 11; restart; replay.play best; step 3600; hash` equals the recorded hash;
  `view.timescale 0.25; step 600; hash` equals the same run at 1 (view never touches it).
- **Traps:** a guard that searches forever; three guards converging on one spot (spread candidates by id); the save that
  forgets a stream.
- **Exercises:** (1) Add a second guard with another route and phase. (2) Make the stone's landing noise louder on metal.
  (3) Beat your ghost's time without being seen.
- **Our angle:** replays and ghosts contain the guard for free, verified by hash; the 9.10 race through the maze reuses
  this guard unchanged.
- **Sources:** MA §14.1, §2.1.
- **Open:** the maze of 9.10 must be navmesh-ready (boxes on a grid, as 7.4 assumes).

---

## Problems found in the curriculum (kept as approved)

1. **7.1's echo is misplaced.** Part 7's "Decided here" calls arrive "the same algebra as the turret's aim in part 1".
   Part 1 has no time, and 2.6's lock-on uses 2.3's first-order factor, which cannot overshoot. The second-order twin is
   5.5's critically damped camera spring.
2. **Generators against determinism.** "Generators as coroutines" (part 7, "Decided here"): a generator's suspended state
   lives inside the JavaScript engine, not in the world data, so it cannot be hashed (2.14), saved (6.13) or snapshotted
   (9.5). Replays still work. The sheets keep the guard's state explicit and teach generators as a "Sutileza".
3. **5.4 and 7.8 overlap.** 5.4 teaches "concurrent and hierarchical machines"; 7.8 needs to start at alarms, history,
   pushdown and suspicion. 5.4's sheet should stop at nesting without history, or 7.8 recalls it in one line.
4. **e^(−*h*/τ) under 2.9's rule.** 2.3's exact factor enters the hash (2.8's velocity, 7.8's suspicion), and `Math.exp` is
   banned there. The curriculum does not say how it is computed: a literal per τ in the tuning data, or a deterministic
   `exp` in `trig.ts`. The same for `atan2` (7.1 avoids it with cross and dot).
5. **Debugging senses before 7.14.** 7.12 needs an overlay; the curriculum gives `show.mind` only in 7.14. The sheets add
   `show.senses` in 7.12.
6. **The command record's name** (2.7, 2.8, 5.2) is used by 7.7 onwards; the sheets call it a command record and wait
   for parts 2 and 5 to fix the name.
7. **6.8 and 7.9 share the sight tests** (cone, ray, light, the brightest body sample); 7.9 must recall them and add the
   knowledge model, the soft cone, the detection rate and the cost order.
8. **Hearing in the hash must be linear.** 6.9 teaches decibels; `Math.log10` is not exactly rounded, so the simulation's
   hearing (6.16, 7.10) must compare linear gains; decibels stay in the audio.
9. **The navmesh needs box levels.** 7.4 builds the mesh by a rectangle sweep, which needs 6.3's format to give floors and
   obstacles as boxes (3.17's maze is). Arbitrary meshes would move ear cutting into 7.4's main path.
