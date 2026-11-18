# Parte 10. Mundos extraños: the lesson sheets

The design each lesson's writer follows, under the approved [curriculum](../tutorial-curriculum.md) (part 10) and
[decision 0021](../decisions/0021-a-new-tutorial.md). The tutorial's destination, ahead of the engine (the roadmap's
phase 7), and the mathematician's part: led by **our own** derivations, with L1. Manifold Lab's block 5 is raw
material: its figures are good, but its pages describe a `packages/manifold` and a `Surfaced` component that do not
exist, so none of its "En Manifold" text is reused. The concept sheets run longer than the others: their mathematics
is the part.

## The part sheet

**At the end the reader can** describe a curved surface by parameters and measure lengths and areas on it; describe a
shape by its signed distance and use its gradient as normal and as "down"; give a world a gravity field and make a
character stand, walk and jump on a small planet; carry a frame along a path without turning it, and predict how much
it comes back turned; prove that a surface has one side; glue a space to itself, measure distances in it and find
paths across its seams; and play on a world that is small, curved and glued.

**The closing game, _un nivel sobre un planeta chico_.** A planet of radius 10 m built as a signed distance (a sphere
joined with towers and an arch), with a mirrored portal: two arches glued by a reflection.

- **Coins:** 16, placed from the seed without trigonometry (10.1). Four are "zurdas", shaped like an asymmetric glyph:
  they can be picked only while the player's chirality is −1, after an odd number of passes through the portal.
- **The guard** of part 7 walks the planet with its own "up" (the same character components, 10.4) and plans with A\*
  on a geodesic graph, with the great-circle heuristic and the portal as an edge.
- **The HUD compass** is carried by parallel transport, not by a field: after a loop it comes back turned (10.5).
- **Win and lose:** all 16 coins before 3 minutes; three catches lose. A dash faster than √(_g_₀_R_) ≈ 9,9 m/s goes
  into orbit: an escape with a price, since you land where the planet decides. Restart, a ghost of the best run
  (2.15), the replay's hash.
- **It exercises** every lesson of the part, part 7's mind, and determinism (everything hashed uses + − × ÷ √ and
  `trig.ts`).

**How the code grows.**

- **10.4:** `sdf.ts` (`Sdf`, `sdSphere`, `sdBox`, `sdUnion`, `gradient`); `gravity.ts`, whose `gravityAt(p)` keeps its
  name and meaning ("the gravity here") and now reads `surfaceField(sdf, g0)`; `quat.ts` grows `fromTo(a, b,
fallback)`; `character/` gains `up` (hashed) and `alignUp`, keeps the velocity tangent and carries the camera's up.
  Rapier's world gravity goes to zero; each body gets its field. Console: `level planet`, `show.gravity`, `show.up`,
  `char.up`, `teleport`.
- **10.8:** `glue.ts` (`Gluing`; `Space` with `wrap`, `displacement`, `distance`, `crossSeam`, `castRay`);
  `character/` gains `chirality` (±1, hashed); the room drawn as instanced copies (8.15); the mind's heuristic becomes
  `space.distance`; the level format gains `glue` lines. Console: `show.copies`, `show.seams`, `char.chirality`.
- **10.9:** `trig.ts` grows `acos`; `sampleSurface(sdf, stream)`; `nav/sphere.ts`; the portal as a mirrored `Gluing`;
  the compass (view).

**Lab kit:** a surface viewer (the parameter grid on the surface; **R**_u gold, **R**_v blue, **n̂** turquoise;
runners); a 2D field viewer (isolines, sign as colour, gradient arrows, a probe with its closest point,
sphere-tracing circles); gravity arrows; a carried arrow with its trail; a loop tool on a sphere with an area readout;
a chirality glyph (a red right hand); a universal-cover view (3 × 3 copies of a fundamental domain, seams lit); part
7's A\* overlay on a wrapped grid.

---

### 10.1 Superficies dadas por parámetros (C)

- **Question:** ¿Cómo se describe una superficie curva, y cómo se miden distancias sobre ella?
- **Before:** 3.2 (normals), 1.6 (the cross product as area); also 5.9 (a curve's tangent, arc length) and 2.2 (the
  derivative as a rate). The tutorial's first calculus in two variables.
- **Leads:** ours, with L1 3.2. **Also:** G2 §11.3.5 (analytic, parametric, meshed); RTR 22.2 and its environment maps
  as atlases (latitude–longitude; the cube map, six charts with seams); E §3.8 (the 2-manifold); MF §20.2 (reduced
  against maximal coordinates); Crane.
- **Approach:** the closing game puts coins on a planet and a runner at 4 m/s on it. The naive version steps the
  parameters at a constant rate and samples them uniformly: the runner speeds up on a torus's outer ring, and coins
  crowd the inner ring and the poles. A surface is a sheet of the plane bent into space; its tangents are partial
  derivatives, and their dot products (1.5) measure everything. The word **variedad**, the engine's name, arrives:
  near each point a surface is a piece of plane, a chart.
- **The mathematics:**
  1. **R**: _U_ ⊂ ℝ² → ℝ³, _U_ open and the partial derivatives continuous; **R**_u, **R**_v are the velocities of its
     coordinate curves (5.9's tangent, one parameter held). Linear approximation **R** + **R**_u d*u* + **R**_v d*v*;
     along _γ_(_t_) = **R**(_u_(_t_), _v_(_t_)), _γ_′ = **R**_u _u_′ + **R**_v _v_′ (the chain rule; its proof in a
     "Más a fondo").
  2. **Regular:** **R**_u × **R**_v ≠ **0**; normalized it is **n̂**, and the order picks the side.
  3. **First fundamental form:** |_γ_′|² = _E u_′² + 2_F u_′_v_′ + _G v_′², _E_ = **R**_u·**R**_u, _F_ =
     **R**_u·**R**_v, _G_ = **R**_v·**R**_v. Length is ∫|_γ_′|d*t*; constant speed _s_ along **d** = (d*u*, d*v*) is
     (_u_′, _v_′) = _s_ **d**/√(**d**ᵀ**g d**).
  4. **Area:** |**R**_u × **R**_v| = √(_EG_ − _F_²), by Lagrange's identity |**a** × **b**|² = |**a**|²|**b**|² −
     (**a**·**b**)² (1.5's cosine, 1.6's sine). Its integral is the same in every regular chart (change of variables,
     stated).
  5. **The torus** in our axes, _a_ = 3 m, _b_ = 1 m: **R** = ((_a_ + _b_ cos _v_) cos _u_, _b_ sin _v_, (_a_ + _b_
     cos _v_) sin _u_); _E_ = (_a_ + _b_ cos _v_)², _F_ = 0, _G_ = _b_²; **R**_v × **R**_u points out. At 2 m/s, the
     naive *u*′ = *s*/*a* gives 2,67 m/s outside (*v* = 0) and 1,33 inside (*v* = π); the correct *u*′ = *s*/(*a* +
     *b* cos *v*) is 0,5 and 1 rad/s. Area 4π²_ab_ ≈ 118,4 m².
  6. **The sphere** in (θ, _y_), ρ = √(_R_² − _y_²): _E_ = ρ², _F_ = 0, _G_ = _R_²/ρ², so √(_EG_) = _R_, constant:
     Archimedes' hat-box theorem (a band's area depends only on its height).
  7. **Charts:** latitude–longitude degenerates at the poles (_E_ = 0), though the sphere is smooth there. No single
     chart (one-to-one and regular, with a continuous inverse) covers it (a "Más a fondo": compact against open, three
     lines); an atlas does (the cube map: each face's central projection works on the open hemisphere around it, so
     the six charts overlap).
- **Depth:** Proved: the normal, the first fundamental form, constant-speed stepping, the area element by Lagrange's
  identity, the torus's and the sphere's metrics, the hat-box theorem, area-uniform sampling (rejection on the torus,
  the ball's directions on the sphere); in "Más a fondo", the chain rule and that no chart covers the sphere. Stated:
  area does not depend on the chart (proof in Spivak, _Calculus on Manifolds_, ch. 3). Named: the variedad in general,
  abstract and of any dimension (do Carmo §5-10).
- **The live figure:** the torus (a sphere toggle) with its grid and the frame at a draggable point; two runners on a
  parallel set by a slider, naive and metric; a coin sampler, uniform (_u_, _v_) against area-uniform (seeded
  rejection with acceptance (_a_ + _b_ cos _v_)/(_a_ + _b_)). Panel: _E_, _F_, _G_, both speeds, area, coins per m²
  in the inner and outer halves. Test: 2,667 and 2,000 at _v_ = 0; 1,333 and 2,000 at _v_ = π; 118,44 m²; naive
  density ratio near (3π + 2)/(3π − 2) ≈ 1,54, correct near 1.
- **Traps:** the chart is not the surface (Manifold Lab 5.1 clamps √*E* at the pole: a patch; change charts); the
  cross product's order decides the side.
- **Exercises:** (1) the cylinder's _E_, _G_ are constant and _F_ = 0: it unrolls without stretching. (2) Prove
  Lagrange's identity from components. (3) Uniform on the sphere without trigonometry: uniform in the cube, rejected
  outside the ball, normalized (uniform by rotational symmetry; to prove it, the cone from the centre over a patch of
  area _A_ of the unit sphere has volume _A_/3; accepted with probability π/6 ≈ 0,52). 10.9 uses it.
- **Our angle:** what the project hashes never steps a surface by sines: the planet is a signed distance (10.2) and
  coins are placed without trigonometry; the metric gives the vocabulary. "En Manifold": todavía no lo tiene.
- **Sources:** L1 3.2; G2 §11.3.5; RTR 22.2; E §3.8; [Crane](https://www.cs.cmu.edu/~kmcrane/Projects/DDG/); do Carmo
  ch. 2 (for the author).
- **Reuses:** Manifold Lab 5.1 (the race, the _E_, _F_, _G_ panel, the area element), in our axes.
- **Open:** whether 5.9 taught the integral as the limit of a polyline's length; if not, 10.1 does.

### 10.2 Distancias con signo (C)

- **Question:** ¿Cómo se describe una forma por la distancia a ella, y para qué sirve su gradiente?
- **Before:** 10.1, 3.7 (the closest point), 8.2 (shaders); 1.4–1.5 (triangle inequality, Cauchy–Schwarz); 3.4 (the
  plane's **n**·_P_ + _d_, already a signed distance).
- **Leads:** Quilez (distance functions, ray marching); Hart (sphere tracing). **Also:** L1 3.2.1 (an implicit
  surface's normal is its gradient); L2 §10.8 (voxel fields, marching cubes); G2 §12.5.13.1.
- **Approach:** the game's planet has towers and an arch. "Where is the ground" and "where is down" for any shape: one
  function answers both, and 3.4's plane was the first. The naive version: a bumpy shape whose "distance" was scaled
  by eye, and sphere tracing steps through it.
- **The mathematics:**
  1. **Definition:** _d_(_x_) = dist(_x_, ∂Ω) outside, −dist inside. The sphere |_x_ − _c_| − _r_; the box from 3.7's
     closest point (**q** = |_p_| − **b** per component, _d_ = |max(**q**, 0)| + min(max(_q_x, _q_y, _q_z), 0)); the
     torus √((√(_x_² + _z_²) − _a_)² + _y_²) − _b_ (exact for _b_ < _a_), square roots only.
  2. **1-Lipschitz:** |_d_(_x_) − _d_(_y_)| ≤ |_x_ − _y_|, from the triangle inequality (with the crossing case).
  3. **Gradient:** the directional derivative of a differentiable _f_ is ∇*f*·**û**, largest along ∇*f* by
     Cauchy–Schwarz: ∇*f* points uphill.
  4. **Eikonal theorem:** where _d_ is differentiable, off the surface, ∇*d*(_x_) = (_x_ − _p_(_x_))/_d_(_x_), a unit
     vector. Proof: towards the closest point _d_ falls at rate exactly 1, and Lipschitz caps every directional
     derivative at 1. So _p_(_x_) = _x_ − *d*∇*d* (3.7 as a formula), and where two closest points tie _d_ is not
     differentiable (each would give its own gradient). Near a smooth (_C_²) piece of surface _d_ is smooth on both
     sides (stated), so ∇*d* = **n̂** on it (3.2).
  5. **Combining:** union min, intersection max, subtraction max(_d_₁, −*d*₂), all 1-Lipschitz; min is exact outside
     the union, the rest are bounds.
  6. **Sphere tracing:** the ball of radius |_d_(_x_)| misses the surface, so _t_ ← _t_ + _d_ is safe (step _f_/_L_
     for a bound with constant _L_). Near a hit at angle α to the normal, each step multiplies the distance by about
     1 − cos α: grazing rays crawl. Worked: unit circle, ray from (−3; 0,5) along +_x_: _d_ = 2,041; 0,081; 0,0099;
     0,0013… (factor 1 − cos 30° = 0,134), hit at _t_ = 2,1340.
- **Depth:** Proved: the three distances, 1-Lipschitz, the gradient uphill, the eikonal theorem where _d_ is
  differentiable (and that ties are not), the combinations, sphere tracing's safety and its factor 1 − cos α at a
  plane; in "Más a fondo", the class counts by Burnside. Stated: _d_ is smooth near a _C_² surface, so ∇*d* = **n̂**
  there (proof in Gilbarg and Trudinger, _Elliptic PDE of Second Order_, Lemma 14.16). Named: marching squares and
  cubes as algorithms (L2 §10.8).
- **The live figure:** a 2D field in a fragment shader (8.2): primitives with union and smooth union, isolines like a
  map, the sign as colour; a probe showing _d_, ∇*d*, _p_; a ray sphere-traced with its circles. "Una perilla, dos
  fallas": the step factor on a field with _L_ ≈ 1,6 (tunnelling above 1/_L_; many steps below). Panel: _d_, |∇*d*|,
  steps, overshoots. Test: unit circle, probe (2, 0): _d_ = 1, ∇*d* = (1, 0), _p_ = (1, 0); box of half-sizes (1;
  0,5), probe (2, 2): 1,803; the ray hits at 2,1340.
- **Traps:** where two closest points tie (a sphere's centre, inside corners) _d_ is not differentiable and numerical
  gradients are garbage: play stays outside the planet's centre. Cap a march's iterations.
- **"Más a fondo":** marching squares, then cubes, counted by symmetry: 16 squares give 4 classes under the square's
  symmetries and complement; 256 cubes give 23 under the 24 rotations, 15 with complement (Lorensen and Cline), 22
  with reflections, 14 with both (checked by Burnside). Orbit sizes divide 24 (orbit–stabilizer). L2 §10.8, Ex. 10.7.
- **Exercises:** (1) the box's distance from the closest point on a box. (2) min(_d_₁, _d_₂) is exact outside the
  union. (3) Prove sphere tracing's factor 1 − cos α near a plane.
- **Our angle:** + − × ÷ √, min, max and abs only: inside 2.9's rule, so ground and gravity can be hashed. "Se reduce
  a…": 3.7's closest point became a field. "En Manifold": todavía no; phase 7's gravity "from attractors (a sphere, a
  cylinder or a curve, any mesh)" is this.
- **Sources:** [Quilez](https://iquilezles.org/articles/distfunctions/),
  [ray marching](https://iquilezles.org/articles/raymarchingdf/); Hart (1996); L1 3.2.1; L2 §10.8.
- **Reuses:** nothing archived; Manifold Lab 5.4's seeded noise could bump the planet, but the curriculum places no
  noise.
- **Open:** L2's "18 classes with preferred polarity" against the verified counts; analytic or central-difference
  gradients in the project.

### 10.3 La gravedad que cambia de lugar en lugar (C)

- **Question:** ¿Hacia dónde es "abajo" en un planeta chico, y cómo se para alguien ahí?
- **Before:** 10.2, 4.1 (force generators), 1.15; also 1.16 (the shortest arc), 2.2, 5.1.
- **Leads:** ours, with L1 1.6 and Ex. 2.14; Catlike Coding, _Custom Gravity_ and _Complex Gravity_. **Also:** G2
  §14.4.9 (one global gravity; a planet needs a force per body); MF §5.2, Ex. 5.3–5.4 (attraction, inverse square).
- **Approach:** part 2's ball on a planet with gravity (0, −9,81, 0) falls off the southern half. Gravity was always a
  field (§2); now it varies. Two questions, kept apart: where is down (the field), and how a character stands (its
  frame follows "up" by the smallest turn). Physics against design: Newton's inverse square, and the game's field of
  constant strength towards the surface ("doblar las reglas").
- **The mathematics:**
  1. Newton: **g** = −*GM* **x**/|**x**|³. Ours: **g** = −*g*₀∇*d*, conservative with potential Φ = _g_₀_d_ where _d_
     is differentiable (off 10.2's ties): the energy _m g_₀ _d_ is the height above the ground for any shape (4.1's
     work).
  2. **Up:** **û** = −**g**/|**g**| = ∇*d*.
  3. **Standing:** carry up from **a** to **b** by the smallest rotation, about **a** × **b**. From cos(θ/2) = √((1 +
     cos θ)/2) and sin θ = 2 sin(θ/2) cos(θ/2): (1 + **a**·**b**, **a** × **b**) = 2 cos(θ/2)(cos θ/2, sin θ/2 **n̂**),
     so _q_ is that pair normalized, with + × √ only. When **b** = −**a**, take the character's forward as the axis
     (V1's bug, decision 0000).
  4. **Tangent velocity:** **v** ← **v** − (**v**·**û**)**û** on the ground ("el mismo movimiento").
  5. **Worked,** _R_ = 10 m: at 4 m/s up turns _vh_/_R_ = 0,38° a step; a 5 m/s jump flies 1,02 s and lands 4,08 m
     away, 23,4° around (by the flat-ground formulas: the curving ground makes the true flight longer). Uniform
     circular motion needs _v_²/_R_ = _g_₀ (derived in one line), so √(_g_₀_R_) ≈ 9,90 m/s: a faster dash leaves the
     ground (and comes back down: a field of constant strength lets nothing escape).
- **Depth:** Proved: up is ∇*d*, with potential _g_₀_d_; the shortest arc as (1 + **a**·**b**, **a** × **b**)
  normalized, and that it is the least turn (1.16); the tangent projection; the orbit speed √(_g_₀_R_); the tunnel's
  period. Stated: Newton's shell theorem, for the field inside a uniform ball (proof in Feynman, _Lectures on
  Physics_ vol. I, §13-4).
- **The live figure:** a cut through a planet of any shape (10.2), field arrows, a character to drag and walk.
  Toggles: "up = +Y" against ∇*d*; a frame rebuilt from a fixed world reference (it flips where up meets it) against
  the shortest-arc carry. Perturbation: a teleport to the antipode. Panel: |**g**|, up, angle turned this step,
  tangential speed, √(_g_₀_R_), height _d_. Test: 0,382° a step at 4 m/s; at 10 m/s the height grows.
- **Traps:** the centre has no down. Rapier's gravity is one vector: zero it, and give each body its field. Adhesion is
  not gravity. "Rigor numérico": renormalize up and the quaternion each step (1.15's projection).
- **Exercises:** (1) corregí al autor: MA's eq. 3.11 drops the half angle; build the shortest arc with the full angle
  and see what turns wrong. (2) Inside a uniform ball **g** = −*g*₀**x**/_R_ (Newton's shell theorem, stated): a
  tunnel through the centre is simple harmonic, period 2π√(_R_/_g_₀): 6,3 s here, 84 min for the Earth. (3) Carry a
  frame by shortest arcs **x** → **y** → **z** → **x**: it returns turned 90° (10.5 in three steps).
- **Our angle:** trig-free, so the same everywhere. Manifold has had gravity as a field from day 0 (0000, rule 4):
  `gravityAt`, `upAt`, a character tested walking a wall with gravity along −Z (1b), `show.gravity` (1f). "Dónde
  Manifold eligió otra cosa": walking on walls is adhesion, not gravity (phase 7): gravity is the space's, adhesion
  the contact's.
- **Sources:** [Catlike Coding](https://catlikecoding.com/unity/tutorials/movement/custom-gravity/),
  [complex](https://catlikecoding.com/unity/tutorials/movement/complex-gravity/); L1 1.6, Ex. 2.14; G2 §14.4.9.
- **Reuses:** Manifold Lab block 5's opening hook; 0000's correction (plan the still case and the opposite up).
- **Open:** whether Rapier's `addForce` persists until `resetForces` (then use an impulse _m_**g**_h_ a step).

### 10.4 Caminar sobre un planeta chico (P)

- **Question:** ¿Cómo camina el personaje alrededor de un mundo redondo?
- **Before:** 10.3; 5.6 (the character, its jump, modes and camera); 4.11 (Rapier's boundary, the step's order); 2.7.
- **Leads:** the part's lessons. **Also:** Catlike Coding (an orbit camera under custom gravity); Rapier's character
  controller (its up direction).
- **Approach:** part 5's character on a planet, a rung at a time, each fixing what the last broke: gravity off and the
  field on (boxes fall to the planet, the character does not); its own up, aligned every step; keys read on the
  tangent plane through the camera; tangent velocity on the ground; the camera carried along.
- **The project:** `sdf.ts` (10.2's primitives); `gravity.ts` (`gravityAt(p)` reads `surfaceField(sdf, g0)`);
  `quat.ts` (`fromTo`); `character/body.ts` (`up` in the state, `alignUp`, the controller's up set each step);
  `character/motor.ts` (input from the camera's forward projected on the tangent plane, jump along up, 5.6's stronger
  fall along −up, tangent velocity); `character/camera.ts` (its up carried by `fromTo`, view only); `physics/` (world
  gravity zero, each body's field before the step, in 4.11's order); `level/` (`planet` and its shapes). Playable:
  walk around a 10 m planet, jump, watch thrown boxes fall to it.
- **Depth:** Proved: nothing new; it applies 10.2's gradient and 10.3's shortest arc and tangent projection. The
  equator check rests on 10.5: along a great circle a carried facing keeps its angle to the path.
- **Console check:** `level planet; restart; show.gravity; show.up`. `teleport 0 -10.5 0`, then `char.up` gives
  `0 -1 0`. `autopilot equator; step 9425` (ten laps at 4 m/s): `char.facing` equals the start's to 10⁻⁹.
  `seed 7; restart; step 600; hash`: one value in the three browsers.
- **Traps:** naive frames flip at the poles; an opposite up in one step needs the fallback. 5.6's spring in world space
  lags around the curve: spring in the character's frame. "Rendimiento en el navegador": one force per body per step
  crosses into WebAssembly per body; measure.
- **Exercises:** (1) does a box roll "to the bottom"? (Every point is the bottom.) (2) Keep the camera's world up and
  walk to the south pole: the view rolls, the controls invert. (3) Two planets, "the nearest surface wins": find the
  seam of down and jump it.
- **Our angle:** phase 7 in miniature. Manifold's character already takes its up from gravity (1b), and its plan
  carries facing and camera "without trigonometry, also standing still and with an opposite up" (0000). The guard
  drives the same components and walks the planet for free (10.9).
- **Sources:** [Catlike Coding](https://catlikecoding.com/unity/tutorials/movement/); Rapier's character controller
  guide; G2 §14.4.9.
- **Reuses:** part 5's character and camera (from archived 1-02, 1-03); Manifold Lab 5.2's carried chase camera.
- **Open:** that parts 2 and 4 name gravity `gravityAt(p)` from 2.8, or this lesson renames it, announced (0021);
  Rapier's controller up setter in JavaScript; the hash constants, measured.
- **Para quien ya sabe** (curriculum §4.3): `gravityAt(p)` has been a field since 2.8, though constant until now: README decision 1.

### 10.5 Llevar un marco a lo largo de una curva (C)

- **Question:** ¿Cómo se lleva una dirección por una superficie sin girarla, y por qué vuelve cambiada?
- **Before:** 10.1, 5.9 (its "Más a fondo" on a frame along a curve); also 10.3–10.4 (the per-step shortest arc),
  1.16.
- **Leads:** ours, with L1 1.6 (Gram–Schmidt); Hanson and Ma (transport frames against Frenet's); Crane (holonomy,
  discrete Gauss–Bonnet). **Also:** Wang et al. (double reflection); G2 §14.4.6.5 (renormalizing as projection onto
  the 3-sphere); RTR 4.3.2 (slerp is a geodesic: the first curved space met).
- **Approach:** the character walks a loop on the planet, and 10.4's camera comes back turned though nobody turned it.
  Not a bug: curvature, and the angle is predictable. Along a space curve, Frenet's frame flips at an inflection and
  the rotation-minimizing one does not (5.9's thread). On a surface, the naive toggle keeps a vector's chart components
  fixed and spins wildly near the pole: the chart is not the geometry.
- **The mathematics:**
  1. **Parallel:** a tangent field **V** along _γ_ whose derivative has no tangent part: it changes only as much as
     staying tangent requires. Two parallel fields keep their lengths and angle ((**V**·**W**)′ = 0, each derivative
     being normal); one exists from every start (a linear differential equation, stated).
  2. **Discrete:** **V**ₖ₊₁ = normalize(**V**ₖ − (**V**ₖ·**n**ₖ₊₁)**n**ₖ₊₁), a Gram–Schmidt step ("el mismo
     movimiento"), or `fromTo`(**n**ₖ, **n**ₖ₊₁) (10.3), which along a great-circle arc is exactly the transport.
  3. **Girard, by lunes:** a lune of angle α has area 2α*R*²; the three pairs of lunes at a triangle's corners cover
     the sphere, with the triangle and its antipode three times, so 4π*R*² + 4*A* = 4*R*²(α + β + γ): _A_ = _R_²(α +
     β + γ − π).
  4. **Holonomy theorem:** around a convex geodesic polygon enclosing _A_, a vector returns turned by _A_/_R_² (modulo
     360°, as every turn). Proof: on each edge it keeps its angle to the edge; at a corner the edge turns by the
     exterior angle and the vector does not; the edge's direction comes back to itself; so the vector turned Σα*i* −
     (_n_ − 2)π = _A_/_R_² (Girard, on the triangles fanned from one corner). Around any simple loop on the sphere,
     geodesic or not, the turn is still _A_/_R_² (stated: Gauss–Bonnet with the loop's geodesic curvature).
  5. **Worked:** the octant (three right angles): π/2 = 90°, and _A_ = 4π*R*²/8. A latitude circle at colatitude φ₀
     (not a geodesic; item 4's stated case, which the "Más a fondo" generalizes): 2π(1 − cos φ₀); at 60° the arrow
     returns reversed.
  6. **Curvature** as holonomy per area: _K_ = 1/_R_² on the sphere (on any surface, the turn per area of small loops
     tends to the Gaussian curvature: named). "Más a fondo": Gauss–Bonnet; on the torus _K_ = cos _v_/(_b_(_a_
     \+ _b_ cos _v_)), and with 10.1's d*A* = _b_(_a_ + _b_ cos _v_) d*u* d*v*, ∫∫*K* d*A* = ∫∫cos _v_ d*u* d*v* = 0 =
     2πχ.
- **Depth:** Proved: parallel fields keep lengths and angles; the discrete step, exact along great-circle arcs; Girard
  by lunes; the turn _A_/_R_² around a convex geodesic polygon (the octant's 90°). Stated: the same turn around any
  simple loop on the sphere, used by the latitude circle and the free loop (proof in do Carmo §4-5); parallel fields
  exist (do Carmo §4-4) and the discrete steps converge to them (the order is this sheet's open item). Named:
  curvature on any surface as holonomy per area, Gauss–Bonnet and the torus's ∫∫*K* d*A* = 2πχ, connections (Crane).
- **The live figure:** a sphere of 10 m with presets (the octant, a latitude circle with a φ₀ slider, a free loop
  dragged) and a carried arrow with its trail; a torus toggle; "en la carta" against "transporte paralelo"; a second
  tab, Frenet against rotation-minimizing on a curve with an inflection. Panel: enclosed area, _A_/_R_² in degrees, the
  measured turn, their difference; with renormalization off, |**V**| drifting over 1000 loops. Test: the octant reads
  90,000° (to 10⁻⁹); the 60° circle 180° within the discretization.
- **Traps:** the sign convention (counterclockwise seen from outside); turning in place must not need transport (0000:
  V1 limited transport by distance, so standing still it never turned); opposite normals in one step need the
  fallback.
- **Exercises:** (1) a geodesic triangle of 90°, 90°, 60°: the turn is 60°. (2) Prove Girard with the lunes drawn.
  (3) Show by symmetry that the torus's outer equator is a geodesic, and an arrow returns from it unturned.
- **Our angle:** "el mismo movimiento" again; drift is the same in every browser (accuracy, not desync: renormalize);
  10.9's holonomy compass. "En Manifold": todavía no; phase 7 carries facing and camera without trigonometry,
  correcting the draft's transport "limited by the distance travelled" (0000).
- **Sources:** Hanson and Ma, TR425 (1995); Wang et al. (2008);
  [Crane](https://www.cs.cmu.edu/~kmcrane/Projects/DDG/); L1 1.6; G2 §14.4.6.5; Bishop (1975).
- **Reuses:** Manifold Lab 5.2's "Más a fondo" on Bishop frames (rewritten: its formula is left unfinished); 5.9's
  "Más a fondo".
- **Open:** the accuracy order Wang et al. prove; the sign convention, fixed by the figure's test; what 5.9 already
  shows of Frenet's flip.

### 10.6 Orientación: la cinta de Möbius (C)

- **Question:** ¿Cómo puede un mundo devolverte al revés?
- **Before:** 10.5 (carrying the normal), 1.8 (the determinant's sign), 3.1 (consistent winding), 1.6 (handedness).
- **Leads:** ours, with L1 1.7.2, 2.1.2, 3.2.2; Weeks (orientability, played). **Also:** RTR 16.3.2 (a Möbius mesh
  cannot be oriented by flood fill), 4.1.3; E §12.6 (Euler–Poincaré); G §5.2.4.9 (pseudovectors flip in a mirror).
- **Approach:** after one lap the player hangs from the "other side" of the road; after two, back on top. A precision
  the question invites: in ℝ³ nothing is mirrored (a carried frame is a rotation, det +1); what reverses is the
  relation with the surface. The normal comes back negated, and a flat being living in the strip comes back mirrored.
  Mirroring a 3D player needs a glued space (10.7). Naive toggles: a fixed-world-up camera (it rolls badly); crossing
  the seam without _v_ → −*v* (a jump across the band).
- **The mathematics:**
  1. **Orientation** of a basis is its determinant's sign (1.8); of a surface, a continuous unit normal field.
  2. **The strip** in our axes: **R** = ((_a_ + _v_ cos(_u_/2)) cos _u_, _v_ sin(_u_/2), (_a_ + _v_ cos(_u_/2)) sin
     _u_), 0 ≤ _u_ ≤ 2π, |_v_| ≤ _w_, with the seam **R**(2π, _v_) = **R**(0, −*v*). Worked (_a_ = 3): **n**(0, 0) =
     (0, 1, 0), **n**(2π, 0) = (0, −1, 0).
  3. **Theorem:** the strip is not orientable. A continuous normal along the centre circle is _s_(_u_)·**n**(_u_, 0),
     _s_ continuous with values ±1, hence constant (intermediate values); at the seam it must agree with itself, but
     **n** flipped.
  4. **Discrete proof:** orient one triangle of a meshed strip and flood-fill across shared edges (3.1: shared edges
     run opposite); back at the start, the orientation is reversed. And _V_ − _E_ + _F_ = 0.
  5. **No signed distance:** a surface bounding a solid has an outward normal, so it is orientable. The strip bounds
     nothing: its distance cannot be signed, and its down cannot be −∇*d* (10.3) of a signed distance. That is all
     this proves: the unsigned distance still pulls towards the strip from either face, and a thick ribbon bounds a
     solid, so it has one. Down from the contact, adhesion, is phase 7's decision, which this makes natural, not forced.
  6. **The double cover:** the cylinder 0 ≤ _u_ ≤ 4π covers the strip twice; the state (_u_, _v_, χ), χ = ±1 the side,
     is Manifold Lab 5.2's.
- **Depth:** Proved: the strip is not orientable (along the centre circle by intermediate values; by flood fill on a
  mesh); _k_ half-twists are orientable exactly when _k_ is even; a frame carried in ℝ³ keeps det +1; a surface
  bounding a solid is orientable, so the strip has no signed distance; the cylinder covers it twice. Stated:
  orientability does not depend on the chart, so it tells the strip from the cylinder (proof in do Carmo §2-6).
  Named: the Euler characteristic as an invariant, the same for every mesh (E §12.6).
- **The live figure:** the strip, a walker with a red right hand, the chase camera with a carried up (10.4); W and S
  along, A and D across. Toggles: naive camera, naive seam, a flat being drawn in the surface (it returns mirrored), a
  mesh whose flood fill ends in conflict. Panel: laps, **n**·**n**₀, the signed lane _v_, det[right, up, back] in ℝ³
  (always +1) and in the strip's chart (±1), χ. Test: one lap gives **n**·**n**₀ = −1, two give +1; the ℝ³ determinant
  stays +1.
- **Traps:** a one-sheet strip with smooth normals draws a black seam: draw the double cover offset by ±ε (Manifold Lab
  5.2) or shade flat; back-face culling and `DoubleSide`.
- **Exercises:** (1) _k_ half-twists: orientable exactly when _k_ is even. (2) A strip and a cylinder both have _V_ −
  _E_ + _F_ = 0: orientability tells them apart. (3) Corregí al borrador: V1's Möbius car (0000). On a convex stretch
  with gravity outward, _N_ = _m g_c + (_k_ − _m_/ρ)_v_²; with 900 kg and ρ = 8 m it needs _k_ > 112 kg/m (a Formula
  1 car has about 3): "with the throttle wide open" cannot work.
- **Our angle:** the engine's name (0006: the Möbius strip as the normal case); V1's Möbius track and its measured
  condition (0000). "En Manifold": todavía no.
- **Sources:** L1 1.7.2, 2.1.2, 3.2.2; Weeks, _The Shape of Space_; [Geometry Games](https://www.geometrygames.org/);
  RTR 16.3.2; E §12.6.
- **Reuses:** Manifold Lab 5.2 (walker, seam rule (_u_, _v_, χ) ↦ (_u_ − 2π, −*v*, −χ), double cover, lighting
  Sutileza, its twist exercises), without its "En Manifold".
- **Open:** a 3D character on a thick ribbon or a flat being: both proposed, as a toggle.

### 10.7 Espacios pegados a sí mismos (C)

- **Question:** ¿Qué pasa al salir por un borde y entrar por el otro?
- **Before:** 10.6, 7.3 (A\*, admissible and consistent heuristics), 8.14 (culling); also 1.10, 3.12, 8.15.
- **Leads:** ours, with Weeks (_The Shape of Space_, Torus Games). **Also:** L1 2.6 (the projective plane); L2 §6.4 (a
  mirror's camera), §9.7 (portals); RTR 19.5 (portal culling, a mirror as a portal); MA §4.3; E §7.1.3 (a wrapping
  grid); 6.5's ring (indices modulo _n_).
- **Approach:** the arcade screen-wrap in a 3D room breaks three ways at once: the guard's A\* takes the long way, its
  ray cannot see across the edge, and the room shows a wall where it should go on. The mathematics: a quotient by a
  group of isometries, distance as a minimum over translates, drawing as copies.
- **The mathematics:**
  1. **The flat torus:** the room [0, _L_)² (× [0, _H_]) with (_x_, _z_) ~ (_x_ + _iL_, _z_ + _jL_); the group Γ; a
     point is an orbit; the fundamental domain. Gluing maps are isometries [**M** | **t**] (1.10): translations (det
     +1) or a glide reflection, the Klein bottle (det −1).
  2. **Theorem:** d([_p_], [_q_]) = min over γ ∈ Γ of |_p_ − γ*q*|. Proof: a segment from _p_ to γ*q* projects to a
     path of its length (≤); a path in the quotient lifts to one from _p_ to some γ*q*, of equal length (path lifting,
     stated: Γ moves no point to itself and no orbit piles up, so the plane covers the room) (≥). **Lemma:** in the
     square torus, wrap each difference to Δ − _L_ round(Δ/_L_). The Klein bottle needs a finite set of group
     elements, reflections included.
  3. **A\*:** the quotient distance is admissible and consistent (its triangle inequality, each edge costing at least
     the distance it spans); the naive distance in the domain is not admissible. Worked, a 20 × 20 torus grid, start
     (1, 10), goal (18, 10): naive _h_ = 17, truth 3; every node of the long way has _f_ = 17 and the first past the
     seam 19, so naive A\* returns 17 steps.
  4. **Drawing:** copies γ·room for γ near the identity (3 × 3): you see yourself from behind; copies culled by
     translated bounds (8.14); a mirrored copy has det < 0 and flipped winding.
- **Depth:** Proved: the distance as a minimum over translates (given path lifting), the wrap lemma, the wrapped
  heuristic admissible and consistent and the naive one not (17 against 3), a mirrored copy's flipped winding.
  Stated: path lifting, the plane covering the torus or the Klein bottle (proof in Hatcher, _Algebraic Topology_,
  §1.3). Named: covering spaces and the fundamental group; the projective plane, the rotations as the 3-sphere with
  antipodes glued and the belt trick; portal rendering (L2 §6.4, §9.7).
- **"Más a fondo":** (1) the projective plane as the sphere with antipodes glued, and the rotations as the 3-sphere with
  antipodes glued (_q_ ≡ −*q*, 1.15): a 360° turn lifts to a path from 1 to −1, not closed, so it cannot shrink (by
  homotopy lifting, named); 720° lifts to a closed loop on the simply connected 3-sphere, which shrinks. The belt
  trick: 1.15 paid back. (2) Portals drawn with a virtual camera and an oblique near plane (L2 §6.4, §9.7).
- **The live figure:** a torus room from above in the universal-cover view (3 × 3 copies shaded, the domain lit), the
  player and the guard; A\* with the naive and the wrapped heuristic; a ray crossing seams; a Klein toggle (one seam
  mirrored: the copy across is reflected, the hand glyph flips). Panel: _h_ at the start against the truth, path
  length, nodes expanded, the minimal displacement, χ. Test: naive 17, wrapped 3; χ = −1 after one mirrored crossing.
- **Traps:** the minimum needs enough copies (the lemma covers a square lattice, not a sheared one); a ray across a
  mirrored seam is reflected; three.js flips winding for an object with det < 0, not for a camera built by hand.
- **Exercises:** (1) prove the wrap lemma. (2) The minimum of two consistent heuristics is consistent (10.9's portal).
  (3) In a Klein-bottle room, which hand holds the lamp after one mirrored crossing, and after two?
- **Our angle:** phase 7's gluing system: spaces that wrap or come back mirrored, physics, drawing and networking
  across seams, queries that cross, a mirrored seam that flips handedness; truly hyperbolic geometry stays out (0012).
  "En Manifold": todavía no.
- **Sources:** Weeks; [Torus Games](https://www.geometrygames.org/TorusGames/); L2 §6.4, §9.7; RTR 19.5; MA §4.3;
  [Red Blob Games](https://www.redblobgames.com/).
- **Reuses:** Manifold Lab 5.2's χ; the MA reader's figure (A\* on a torus, naive against wrapped).
- **Open:** none beyond scope: copies in the main path, portals in the "Más a fondo".

### 10.8 Un cuarto pegado a sí mismo (P)

- **Question:** ¿Cómo se juega en un cuarto que se continúa en sí mismo?
- **Before:** 10.7; 7.14 (the guard); 3.14 (`collide.ts`), 4.11, 8.15.
- **Leads:** the part's lessons. **Also:** Torus Games as the model of play.
- **Approach:** 6.16's stealth room wraps along _x_ and comes back mirrored along _z_. The ladder: wrap positions (a
  wall pops at the seam); draw copies (seamless); copy walls near each seam as static colliders (collisions cross);
  the guard's wrapped heuristic and edges across seams; rays that cross; then the mirror (χ flips, the mesh drawn
  reflected, right stays right on screen).
- **The project:** `glue.ts`: `Gluing` (axis, period, mirror); `Space` with `wrap(p)` (back into the domain, and
  which gluing was crossed), `displacement(p, q)` (minimal over translates), `distance`, `crossSeam(entity)`
  (position, velocity, facing and up through the gluing; `chirality` flips when det < 0) and `castRay(origin, dir,
max)`. `character/body.ts` gains `chirality: 1 | -1` (hashed). `mind/`: heuristic `space.distance`, edges across
  seams. Static colliders copied in a margin (Rapier knows nothing of seams). Instanced copies for the 3 × 3
  neighbourhood, mirrored ones with det −1, culled. `level/`: `glue x 16`, `glue z 16 mirror x`. Playable: hide from a
  guard who can come from both sides; after the mirror, the lamp in your right hand is in your left.
- **Depth:** Proved: nothing new; it applies 10.7's minimum over translates and wrap lemma, and the flip of winding
  when det < 0 (1.8, 3.1). Stated: wrapping by `Math.round` is exact for a power-of-two period (Sterbenz's lemma;
  proof in Goldberg).
- **Console check:** `level glued; restart; show.copies 1; show.seams`. `teleport 15.9 1 8; walk +x; step 30;
char.position`: _x_ near 0,1. Across the _z_ seam `char.chirality` gives `-1`, across again `1`. `seed 7; restart;
step 600; hash`: the same in the three browsers and in the replay.
- **Traps:** drawing between two states across a seam must use the displacement, or 2.4's α flies the ball across the
  room; the camera's leash crosses by the displacement too. Dynamic bodies cannot cross (Rapier): stopped, or moved
  whole with a visible pop, named. For the mirror, reflect the scene's root rather than the camera (three.js flips
  winding by each object's determinant).
- **Exercises:** (1) wrap _y_ too and fall forever: what speed does drag settle at (4.1)? (2) Find where the guard sees
  you only through the seam. (3) Draw 5 × 5 copies and measure the frame (3.13), instanced and not.
- **Our angle:** phase 7's gluing in miniature; wrapping uses `Math.round` and subtraction (exact for a power-of-two
  period such as 16: the division is exact, and so is the subtraction, by Sterbenz's lemma) and keeps coordinates
  near the origin, where floats are dense (G §5.3.11.2).
- **Sources:** Weeks; L2 §6.4, §9.7; RTR 19.5; MA §4.3.
- **Reuses:** 6.16's room, 7.14's guard; Manifold Lab 5.5's wrapped torus, as an idea.
- **Open:** the mirrored view (scene-root reflection, controls that keep right on screen), checked in three.js; the
  scope for dynamic bodies.

### 10.9 El juego: un nivel sobre un planeta chico (P)

- **Question:** ¿Cómo se juega un nivel en un mundo chico, curvo y pegado?
- **Before:** 10.4, 10.8; 7.14; 2.15.
- **Leads:** the part's lessons. **Also:** MA §4.4.4 (navigation meshes on walls and ceilings).
- **Approach:** everything the part built, in one level (the part sheet's game), each mechanic checked against the
  lesson that taught it, the frame bar under budget.
- **The project:**
  - `level/`: the planet (a 10 m sphere ∪ towers ∪ an arch) and the portal.
  - `sampleSurface(sdf, stream)`: uniform in the cube, rejected outside the ball, moved to the surface by _p_ −
    *d*∇*d*. Uniform on a sphere (10.1, Ex. 3); with towers, not exactly by area (said).
  - `nav/sphere.ts`: an icosahedron subdivided three times (642 vertices, about 1,4 m apart) on the surface.
  - The guard's heuristic _r_ eff·`trig.acos`(**x̂**·**ĝ**). Projection onto a ball is 1-Lipschitz and a great-circle
    arc is the shortest path on a sphere (a page of calculus, the start at the pole), so a path outside radius _r_ is
    at least _r_ times its angle. Edges are chords, and a chord between points at radius ≥ _r_ subtending θ stays
    outside _r_ cos(θ/2), so _r_ eff = _r_ cos(θ_max/2), 9,95 m here. The portal enters as min(direct, via the
    portal), consistent (10.7).
  - `trig.ts` grows `acos` from + − × ÷ √; chirality coins; the HUD compass carried by `fromTo` (view).
- **Depth:** Proved: the heuristic is admissible and consistent (projection onto a ball is 1-Lipschitz, a great-circle
  arc is shortest on a sphere, the chord lemma, whose written proof is open; the portal's minimum, 10.7, Ex. 2);
  sampling is uniform on the sphere (10.1, Ex. 3).
- **Console check:** `level planet-race; seed 7; restart; show.nav; show.gravity`; `possess guard; show.mind` (7.14);
  after the portal `char.chirality` gives `-1`; `step 3600; hash`, the same in three browsers and in the replay;
  `ghost` races the best run.
- **Traps:** `Math.acos` would break the hash (the guard's mind is hashed: 2.9, 7.13). Without _r_ eff, the
  great-circle heuristic overestimates chord edges by about θ²/24 each (0,08 % here): inadmissible by a hair. Tangent
  steering vanishes at the antipode (Manifold Lab 5.3; waypoints are near). Orbiting players need a soft ceiling
  ("doblar las reglas").
- **Exercises:** (1) use |_x_ − _g_| as the heuristic (admissible too) and count A\*'s extra nodes. (2) Put the arches
  at antipodes: when does the guard take the portal? (3) Beat your ghost.
- **Our angle:** the destination: phase 7's demonstration ("two games of the second wave") and 0012's "a platformer
  level on a small planet", built in the tutorial first, every hashed number inside 2.9's rule.
- **Sources:** the part's lessons; MA §4.3, §4.4.4.
- **Reuses:** 10.4's planet, 10.8's `glue.ts`, part 7's mind, 2.15's ghost; Manifold Lab 5.3's tangent steering.
- **Open:** whether the portal shows the view through it (a virtual camera, L2) or only a surface; the chord lemma
  (checked numerically) needs its written proof, in the plane through the centre and the chord.

---

## Problems found in the curriculum (part 10)

The sheets keep the approved plan; these are for the author.

1. **10.1 is the tutorial's first calculus in two variables** (partial derivatives, the chain rule along a curve,
   integrals of length and area). Its Antes should add 5.9 and 2.2; the rest is taught in place.
2. **The shortest arc is 1.16's, not 1.15's:** 10.3 should list 1.16; 10.5 should list 10.3 and 1.16 (each step's
   shortest arc is the discrete transport).
3. **Gravity must be named a field from part 2.** If 2.8, 4.1, 4.6 or 4.11 name it a constant, 10.4 must rename it
   (0021). Those sheets should use `gravityAt(p)` from the start, as Manifold does.
4. **10.9's great-circle heuristic needs an arccosine,** outside 2.9's rule, in a hashed mind (7.13): `trig.ts` must grow
   `acos`, or the heuristic falls back to the straight line. Its chord edges also need the reduced radius
   _r_ cos(θ_max/2) to keep it admissible.
5. **Rapier knows nothing of seams:** dynamic bodies across a seam need ghost copies with two-way coupling, which no
   lesson places. 10.8 limits crossing to characters, rays and static copies.
6. **Minor prerequisites:** 10.7 uses 8.15, 3.12 and 1.10; 10.3's orbit speed uses circular motion's acceleration
   (derived in place if part 4 lacks it).
7. **Marching-cubes classes:** L2's "18 with preferred polarity" must be checked against the standard counts (23
   under rotations, 15 with complement, 22 with reflections, 14 with both; verified by Burnside's lemma).
8. **Portal rendering has no lesson:** the view through a glued portal (virtual camera, oblique near plane, stencil) is
   only L2's suggestion; the sheets make it a "Más a fondo" of 10.7 and let 10.9 draw the portal as a surface.

### Depth review (2026-11-18)

Each sheet now has its **Depth:** line (curriculum §4.6). What the rule could not settle alone:

1. **10.6 called adhesion proved.** The theorem shows that the strip bounds nothing, so it has no signed distance. It
   does not force adhesion: −∇ of the unsigned distance pulls towards the strip from either face, and a thick ribbon
   bounds a solid whose signed distance works. Item 5 now says so. Should the lesson prove something adhesion does
   that a field cannot (any wall, with no distance to build), or keep it as phase 7's design choice?
2. **10.3's jump uses flat-ground formulas.** In the planet's field (constant strength, radial, _R_ = 10 m) a 5 m/s
   jump at 4 m/s flies about 1,16 s and lands about 3,88 m (22,3°) away, against the sheet's 1,02 s, 4,08 m and
   23,4°, which are kept and labelled. Replace them, or make the gap a point of the lesson? "Leaves the planet" became
   "leaves the ground": a field of constant strength lets nothing escape.
3. **10.5's latitude circle can be proved, not only stated.** Against the east–north frame a parallel vector turns
   at rate cos φ₀ per radian of longitude (a linear equation with constant coefficients), so a lap turns it by
   −2π cos φ₀, which is 2π(1 − cos φ₀) modulo 360°. Prove it in the main path and leave only the free loop at level 2?
4. **The hairy ball theorem is behind 10.3's and 10.4's trap** (a frame rebuilt from a fixed reference flips): the
   sphere has no continuous tangent field without zeros, so every frame computed from the position alone fails
   somewhere, and a carried frame must depend on the path. A level-2 statement in 10.4 (Milnor's proof by calculus,
   1978), or a name in a "Más a fondo"?
5. **10.2 says where _d_ is not differentiable (ties), not where it is.** The converse (off the surface, a single
   closest point gives a gradient) is what lets play trust ∇*d* everywhere else; it is level 2 and needs a source in
   nonsmooth analysis. State it, or keep "where _d_ is differentiable" as a hypothesis the figure checks?
6. **10.9's admissibility assumes the exact arccosine.** The longest edge of the subdivided icosahedron subtends
   9,44°, so the chords need _r_ eff ≤ 9,966 m; 9,95 m leaves about 0,16 %, which `trig.acos` must not overshoot.
   Its error bound belongs in `trig.ts`'s test.
7. **10.9's chord lemma has a three-line proof (level 1).** If the foot _P_ of the perpendicular from the centre lies
   inside the chord _AB_, it splits θ into α + β, and |_P_| = |_A_| cos α = |_B_| cos β ≥ _r_ cos min(α, β) ≥
   _r_ cos(θ/2); otherwise the nearest point is an end, at radius ≥ _r_. It can close the sheet's open item.
