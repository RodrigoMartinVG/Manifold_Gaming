# Parte 2. El tiempo: the lesson sheets

The design of every lesson of part 2, under the approved [curriculum](../tutorial-curriculum.md) and
[decision 0021](../decisions/0021-a-new-tutorial.md). Abbreviations as in the curriculum's §2; "kit" is the shared lab
kit for concept figures (curriculum §4.2), at `site/src/lessons/kit/` as proposed in [part 1's sheets](parte-01.md).
Numbers in the worked examples were computed for these sheets; the figure must show the same ones.

---

## Part sheet

**What the reader can do at the end.** Describe a game as a state and a step; integrate a motion in steps and say how
wrong it is; approach a value equally at any frame rate; run a fixed-step loop and draw between two states; pause, slow
down and single-step a game without touching the loop; turn keys into per-step actions with their edges; know which
arithmetic gives the same bits in every browser; deal chance from a seed, one stream per system; order many things in a
step; write rules as a state machine with events; and record a game so that it replays identically, checked by a hash.

**The architecture this part sets, for all the others.** The state is plain data (1.3); the step is a function of the
state and the step's actions, `stepWorld(world)`, called at a fixed _h_ = 1/60 s by a loop that owns no game logic; game
time is the integer step count; the drawing reads two states and interpolates (never extrapolates); input enters as
records with their step; every random number comes from a seeded stream; what is hashed uses only + − × ÷ √ and our own
trigonometry (2.9's rule); and the project's console has three kinds of option, startup, world and view, the last never
touching the hash (decision 0010). Every later part builds on these; their names are stable from here on.

**The closing games.**

- **_Juntar las monedas_ (2.13).** A new mode of the same world. The ball (moved by actions, 2.8) must collect eight
  coins placed from the seed on the floor around the turret (between 2 and 7 m from it, at least 1,5 m apart) before
  60 s run out (3600 steps). The turret of part 1 is the antagonist: it tracks the ball with the timed lock-on (time
  constant τ = 0,4 s, so a fast sideways run escapes its cone), and when the ball stays inside its cone (half-angle 6°,
  range 8 m) for 30 consecutive steps (the barrel glows while charging) it fires; a hit costs 5 s; then it rests 60
  steps. Win: all coins in time; lose: time out. Score: time left. Restart, and the console's `seed`. It exercises
  the state and the step, the semi-implicit jump, exact smoothing (the ball's velocity and the turret's aim), the loop,
  the step-counting timer, input edges, seeded placement, update order, and the rules as a machine. All design numbers
  are to be tuned in play.
- **_Tu fantasma_ (2.15).** After a win, race your best run: a second world, born from the same seed and settings, is
  fed the recorded actions by step and drawn translucent, with its own coins and its own turret (which, being part of
  the simulation, is in the replay for free). The hash of every step is compared with the recorded one; the console
  reports the first divergent step if any.

**How the code evolves** (each name keeps its meaning once taught, 0021):

| Lesson | Files                                      | Public names                                                                                                                  |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 2.6    | `loop.ts`, `clock.ts`                      | `createLoop({ h, maxSteps, step, draw })`; `Clock` with `step`, `paused`, `timescale`, `requestSteps`, `time`                 |
| 2.6    | `console.ts`, `freecam.ts`                 | `createConsole`, `registerVar`, `registerCommand`, `run`; kinds `'startup' \| 'world' \| 'view'`; `createFreeCamera`          |
| 2.6    | `world.ts`, `quat.ts`, `turret.ts`         | `stepWorld`, `posesOf`; `quat.nlerp`, `quat.canonical`; `trackStep` (replaces the press-based `lockStep`, announced)          |
| 2.8    | `input.ts`, `ball.ts`, `autopilot.ts`      | `isDown`, `pressed`, `released`, `sampleStep`, the record `{ step, down }` (`onPress` stays); `Ball`, `moveBall`; `autopilot` |
| 2.13   | `rng.ts`, `trig.ts`, `game.ts`, `coins.ts` | `createRng`, `streams`; `sinCos`, `expNeg`; the machine (`STATES`, `transition`, `emit`, `on`); `placeCoins`                  |
| 2.15   | `record.ts`, `hash.ts`, `ghost.ts`         | `Recording`, `record`, `toText`, `fromText`; `stateHash`; `createGhost`, `firstDivergence`                                    |

The world becomes `{ step, rng, ball, turret, coins, game, inputs }`, all data. The part-1 turret game stays as a mode.

**Kit pieces the part needs** (beyond part 1's): `time` (play, pause, single step, slow motion, for a figure's own
fixed-step simulation); `screen` (a simulated display: frames per second, jitter, a spike, a hidden tab, an expensive
step); `timeline` (real ticks over simulated ticks, the lag bar, the α marker); `plot` (several curves against time; a
small table of error against step size); `bits` (a bit-field editor for float32 and float64); `numberline` (the floats
near a value, with their spacing); `keys` (one row per step: down, previous, changed, pressed, released); `histogram`;
`seed` (a seed box and a hash readout); `diagram` (a state diagram whose current state lights up); `scrubber` (drag a step
marker and the figure re-simulates to it).

**Console recipes start here.** From 2.6 every project lesson's "Probalo" ends with a recipe and its expected output
(curriculum §4.4).

---

### 2.1 Un juego es una simulación (C)

- **Question:** ¿Qué es un juego para la computadora: un estado y un paso?
- **Before:** 1.4.
- **Leads:** **G** §1.1.1 (soft real-time interactive agent-based simulation, word by word; analytic against numerical
  models), ch. 8 intro; **also:** MF §1.2, §3.1–3.2 (the minimal state (_x_, _v_); acceleration recomputed, never
  stored; setting a position directly makes things jump), GPP ch. 9 (batch, turn-taking, event loop, game loop: the
  world keeps moving when you do nothing), MA §3.1 (a mind outputs a request; the simulation integrates it), G2 §16.1.1
  (the game state is every dynamic element's state together).
- **Approach:** GPP's short history of programs, with the reader's own part-1 game as the turn-taking case: nothing
  happened between presses. Now the world must move while nobody touches it, so it needs a loop, and a definition (G).
  The hook: a ball thrown up has a formula for all time, until a kick changes it; input breaks every closed form into
  pieces, and stepping is what is left.
- **The mathematics:** rate of change, taught since 0021 assumes only secondary school: average velocity Δ_x_/Δ_t_, the
  instantaneous one as its limit, acceleration likewise (MF's two cars with the same average). Constant acceleration:
  _v_(_t_) = _v_₀ + _a_ _t_; the displacement is the area under the velocity graph, a trapezoid, so
  _x_(_t_) = _x_₀ + _v_₀ _t_ + ½ _a_ _t_². The state _S_ = (_x_, _v_) (what one must know to continue) and the step
  _S_ₙ₊₁ = _F_(_S_ₙ, inputₙ); the differential equation as "a rule for how the state changes", **ẋ** = **v**,
  **v̇** = **a**. A step that is a function (same state and input, same result) is the root of determinism. Frame (a drawing) against step (an
  advance). Worked example: _y_₀ = 1 m, _v_₀ = 5 m/s up, _g_ = 9,81 m/s²: apex at 0,5097 s and 2,2742 m; floor at
  1,1906 s. A kick at 0,8 s that sets _v_ = 4 m/s up: _y_(0,8) = 1,8608 m and the formula restarts from there.
- **The live figure:** the ball under gravity: the analytic parabola and stepped dots with an _h_ slider (1/60 to
  1/5 s); drag the start height and the initial-velocity arrow's tip; a "kick" button at any moment: the analytic curve
  must be restarted piecewise, the stepped one simply goes on. A second panel: the velocity graph with the trapezoid
  shaded up to a draggable time marker; its area equals the displacement. Kit `time` (pause, step). Panel rows: "state
  (y, v)", "step n", "t = n·h (s)", "analytic y(t)", "stepped y", "area under v". Test: with no kick, the apex row
  reads 2.2742 within the step's error; the area equals _y_(_t_) − _y_₀ to 1e−9.
- **Traps:** frame and step are different words; acceleration as state (MF); several natural rates (physics at 60 Hz,
  a mind a few times a second, the screen at its own); a step tests positions, not motions, so a fast thing can pass
  through a wall between two steps (E §2.4.3), named here, solved in 3.15.
- **Exercises:** (1) when does the ball reach the floor, by the quadratic and by stepping (the step where _y_ changes
  sign, and its overshoot)? (2) GPP's classification: a calculator, a chat, chess with a clock, a platformer.
  (3) List the project's systems with their natural rates.
- **Our angle:** the state as data (decision 0004) is what 2.15 will hash; "Dónde Manifold eligió otra cosa": its
  `World` advances by phases in a fixed order (`PHASES` in `core/src/world.ts`), and events have two readers at two
  rates (the game once per step, the presentation once per frame).
- **Sources:** G §1.1.1, ch. 8 intro; MF §1.2, §3.1–3.2; GPP ch. 9; MA §3.1; G2 §16.1.1; Witkin and Baraff,
  "Differential Equation Basics" ([cs.cmu.edu/~baraff/sigcourse](https://www.cs.cmu.edu/~baraff/sigcourse/)).
- **Reuses:** archived 0-05 (`simulation.ts` with no imports, `view.ts` that only reads, two worlds simulated without a
  screen and their equal summaries): its figure becomes a "Probalo" ("simulate 600 steps without drawing").
- **Open:** whether the derivative gets a "Más a fondo" with the limit made rigorous, or stays at the picture.

### 2.2 Integrar a pasos (C)

- **Question:** ¿Cómo se calcula un movimiento de a pasos, y cuánto se equivoca?
- **Before:** 2.1.
- **Leads:** **MF** §2.2, §3.3, §10.4 (corrected); **also:** G2 §14.4.3–14.4.4 (Euler's error by Taylor; Verlet; the
  three properties: convergence, order, stability), G §8.5.2 (speeds per frame and the turbo button), Witkin and Baraff,
  Fiedler (_Integration Basics_).
- **Approach:** integration as solving an ordinary differential equation (curriculum §5): Euler's step follows the
  tangent; explicit and semi-implicit side by side; their error derived exactly for constant acceleration by a sum,
  which needs no Taylor series (G2's Taylor argument goes to "Más a fondo"). MF is corrected in place: it drops ½_a_Δ_t_²
  "because it is small" and switches between explicit (particles) and semi-implicit (rigid bodies) without saying so.
  The hook (G): speeds written per frame run 2,4 times faster at 144 Hz than at 60; and with metres per second the
  speed is fixed but the result still depends on the step.
- **The mathematics:** explicit: _x_ₙ₊₁ = _x_ₙ + _h_ _v_ₙ, _v_ₙ₊₁ = _v_ₙ + _h_ _a_; semi-implicit: velocity first,
  then position with the new one. For constant _a_, _v_ₖ = _v_₀ + _k_ _h_ _a_, and the position is a sum: explicit,
  _x_ₙ = _x_₀ + _v_₀ _t_ + _a_ _h_² · _n_(_n_ − 1)/2 = exact − ½ _a_ _t_ _h_; semi-implicit, exact + ½ _a_ _t_ _h_;
  both from 1 + 2 + … + _n_ = _n_(_n_ + 1)/2. The error ½ |_a_| _t_ _h_ is first order (halve the step, halve the
  error) and grows with time, against MF's "small". The local error per step, ½ _a_ _h_², times _t_/_h_ steps gives the
  same count. The jump's apex: semi-implicit lands about _v_₀ _h_/2 low, explicit as much high. Worked example:
  _y_₀ = 1, _v_₀ = 5, _a_ = −9,81, _t_ = 1 s: exact 1,0950; with _h_ = 0,1 explicit 1,5855 and semi-implicit 0,6045
  (±0,4905 = ½ · 9,81 · 1 · 0,1); with _h_ = 1/60, 1,1768 and 1,0133 (±0,0818).
- **The live figure:** the thrown ball: exact parabola, explicit dots (red), semi-implicit dots (green), an _h_ slider
  from 1/120 to 1/5 s, the error at _t_ = 1 s drawn as a segment; drag the initial velocity's tip. A small table (kit
  `plot`): error against _h_ for four halvings, each error half the previous. The "turbo" strip (kit `screen` at 30,
  60, 144 fps): per-frame speed against per-second speed. Naive against correct: built in (per frame, explicit,
  semi-implicit). Panel rows: "h (s)", "steps n", "exact y(t)", "explicit y", "semi-implicit y", "error explicit (m)",
  "error semi-implicit (m)", "½ |a| t h (m)". Test: at _h_ = 0,1 the values above; both errors equal ±½|_a_|_th_ to
  1e−12.
- **Traps:** MF's dropped term; an unannounced switch of order; speeds per frame; the step size is part of the physics,
  so it is a game constant (it never changes with the screen, 2.4, nor with slow motion, 2.5).
- **Exercises:** (1) "Corregí al autor": MF's argument for dropping ½_a_Δ_t_²; show the position error after 5 s at
  _h_ = 1/30 (½ · 9,81 · 5 / 30 ≈ 0,82 m). (2) For a jump at 5 m/s, which step keeps the apex within 1 cm? About
  _h_ = 1/250 s (2 · 0,01/5). (3) Average the explicit and semi-implicit positions and prove it is exact for constant
  _a_.
- **Our angle:** "Más a fondo" (curriculum): why the project takes semi-implicit, Rapier's choice: on a spring,
  explicit Euler's step is a matrix of determinant 1 + ω²_h_² that inflates phase-space area, semi-implicit's has
  determinant exactly 1; proved in 4.2. Second "Más a fondo": the order by Taylor and Verlet (G2). "En Manifold":
  `STEP = 1/60` in `core/src/world.ts`; the characters integrate semi-implicitly.
- **Sources:** MF §2.2, §3.3, §10.4; G2 §14.4.3–14.4.4; G §8.5.2; Witkin and Baraff; Fiedler,
  [_Integration Basics_](https://gafferongames.com/post/integration_basics/); Catto, _Numerical Integration_ (GDC
  2009).
- **Reuses:** archived 0-03's "Más a fondo" on the step's error (first order), now the main path with its proof.
- **Open:** none.

### 2.3 Acercarse sin pasarse (C) ◇

- **Question:** ¿Cómo se acerca algo a un valor igual a 30 cuadros por segundo que a 144?
- **Before:** 2.2.
- **Leads:** **G** §9.5.3 (the low-pass filter, which is the backward-Euler step); **also:** MF §3.3.1 (damping
  _d_^Δ*t*), §16.2.1, MA §3.1.3 (velocity matching with τ; the stability of 1 − _h_/τ), L2 §8.5.1 (fog's exponential:
  a fraction _F_ kept per unit, _F_^_d_ after _d_ units), Driscoll, Holmér, Holden (half-life).
- **Approach:** G's "second equation": first-order relaxation, **ẋ** = (**x**\* − **x**)/τ. Three discretizations
  side by side and the naive per-frame lerp (the archived tutorial's trap, and MA's "turn halfway each frame"), so the
  exact factor arrives as a theorem. The exponential is derived without calculus, as the limit of ever smaller Euler
  steps (the compound-interest limit), so the reader sees where _e_ comes from. The hook: part 1's lock-on jumped a
  quarter of the way per press; in time, "a tenth per frame" is a different speed on every screen.
- **The mathematics:** forward Euler: _x_ₙ₊₁ − _x_\* = (1 − _h_/τ)(_x_ₙ − _x_\*): monotone if _h_ < τ, oscillating
  if τ < _h_ < 2τ, divergent if _h_ > 2τ. Backward Euler (G's): factor _h_/(τ + _h_), always stable, not exactly
  independent of the rate. Exact: _n_ Euler steps over a time _t_ give (1 − _t_/(_n_ τ))ⁿ → _e_^(−*t*/τ); so
  _x_ₙ₊₁ = _x_\* + (_x_ₙ − _x_\*) _e_^(−*h*/τ), a lerp with factor 1 − _e_^(−*h*/τ). Independence of the rate:
  _e_^(−_h_₁/τ) · _e_^(−_h_₂/τ) = _e_^(−(_h_₁ + _h_₂)/τ) (the factors form a semigroup). The half-life is τ ln 2. Worked
  example: τ = 0,15 s. At _h_ = 1/60: kept per step exact 0,8948, forward 0,8889, backward 0,9000. At 1/30: exact 0,8007
  (= 0,8948²). Naive "keep 0,9 per frame": time constant 0,158 s at 60 Hz, 0,066 s at 144 Hz; the 60 Hz exact factor
  used per frame at 30 Hz behaves as τ = 0,30 s. At _h_ = 0,4 s, forward Euler's factor is −1,667: it diverges.
  After 0,1 s, 0,5134 of the distance remains whether in 6 steps or 3.
- **The live figure:** drag a target point on the floor; four followers chase it (naive per frame, forward, backward,
  exact), each with its trail; kit `screen` switches 30, 60, 144 fps and injects a 100 ms spike; kit `plot` overlays
  the distance against time at the three rates: the exact curves coincide, the naive ones fan out. "One knob, two
  failures" (curriculum §4.2): τ, too small and forward Euler oscillates or explodes (and anything feels instant), too
  large and it feels sluggish. Panel rows: "τ (s)", "h (s)", "exact factor 1 − e^(−h/τ)", "forward factor h/τ",
  "naive time constant (s)", "remaining after 0.1 s". Test: at τ = 0,15, the factors above; "remaining after 0.1 s" is
  0.5134 at 60 and at 30 fps for the exact follower.
- **Traps:** a constant lerp factor per frame; forward Euler past _h_ = τ (a spike does it); the factor must be
  recomputed if _h_ changes, which on a fixed step it never does; `Math.exp` is not exactly rounded (2.9), so in the
  hashed simulation the factor is a constant computed once, by `trig.ts`'s `expNeg` from 2.13.
- **Exercises:** (1) the exact follower at 60 Hz and at 30 Hz after 0,1 s: both 0,5134 of the distance left.
  (2) For τ = 0,15, where does forward Euler start to oscillate, and to diverge? (0,15 s and 0,30 s.) (3) "Halfway in
  0,2 s": τ = 0,2/ln 2 ≈ 0,2885 s.
- **Our angle:** the old tutorial's trap made a theorem; the same exponential returns in fog (8.16) and, second order,
  in the camera's critically damped spring (5.5, Holden). "Dónde Manifold eligió otra cosa": its characters approach the
  wanted velocity by a constant acceleration (a maximum change per step, `approach` in `core/src/character.ts`), which
  arrives in finite time and needs no exponential; the project takes the exponential because it is this lesson.
- **Sources:** G §9.5.3; MF §3.3.1, §16.2.1; MA §3.1.3; L2 §8.5.1; Driscoll,
  [_Frame Rate Independent Damping using Lerp_](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/);
  Holmér, _Lerp smoothing is broken_ (2024); Holden, [_Spring-It-On_](https://theorangeduck.com/page/spring-roll-call).
- **Reuses:** none (new); the archived tutorial's smoothing trap becomes the naive follower.
- **Open:** if folded (◇), it becomes a section of 2.2 ("una segunda ecuación") keeping the four followers.

### 2.4 El bucle: el paso fijo y el dibujo entre dos estados (C)

- **Question:** ¿Cómo se mueve igual en una computadora rápida y en una lenta?
- **Before:** 2.2.
- **Leads:** **GPP** ch. 9 (the ladder of loops; the accumulator; a cap on catching up), **G** §8.2–8.3, §8.5.1–8.5.2.5
  (Pong's loop; the frame callback as a framework; measuring Δ*t*; the vicious circle; v-sync; the breakpoint rule);
  **also:** MF §3.3, §6.3.1, §7.2.3 (three physical reasons for a fixed step: reproducibility, a resting box that jumps
  after a long frame, springs that explode at 10 Hz), G2 §14.5.2.2, §17.6.3.4 (keep the previous and the current state),
  E §2.4.2 (the budget; worst case over average), Fiedler (_Fix Your Timestep!_).
- **Approach:** GPP's ladder, each rung a loop someone ships, each failing on screen: as fast as possible; one step of
  the measured Δ*t* per frame (the jump's apex differs at 20 and at 144 fps); fixed steps from an accumulator (stutter
  when the rates do not divide); draw between the last two states with α. GPP's extrapolation is rejected: it guesses,
  and draws the ball inside a wall; interpolation shows a state that really happened, one step late. G's breakpoint
  rule becomes the clamp after a hidden tab, his vicious circle the cap, and record and playback the third reason for a
  fixed step.
- **The mathematics:** each frame `lag += elapsed`; while `lag ≥ h`: step, `lag −= h`; then draw with α = `lag`/_h_.
  Invariant 0 ≤ `lag` < _h_ (by the loop's condition, from `lag` ≥ 0); steps per frame = ⌊(`lag` + elapsed)/_h_⌋. The
  vicious circle, ours and exact: with a step costing _c_ and a drawing _r_, a frame's duration follows
  _T_ₖ₊₁ = (_c_/_h_) _T_ₖ + _r_ (a correction: the growth is geometric, not linear); it recovers from a spike iff
  _c_ < _h_, settling at _r_/(1 − _c_/_h_); otherwise the cap _M_ bounds it and the game slows. The order within a step
  (G Fig. 8.4): actions, rules, physics, what follows physics (the camera), then the drawing. Worked example: _h_ =
  1/60, frames at 144 Hz: α runs 0,417, 0,833, then a step and 0,250, …; 7 of every 12 frames take no step. At 30 Hz,
  two steps per frame. _h_ = 16,7 ms, _r_ = 2 ms, a 20 ms spike: with _c_ = 4 ms the frames go 6,8, 3,6, 2,9, 2,7 ms
  towards 2,63; with _c_ = 20 ms, 26,0, 33,2, 41,8, 52,2 ms, growing by 1,2 each time.
- **The live figure:** kit `timeline`: irregular frame ticks (kit `screen`: fps, jitter) over regular steps (an _h_
  slider), the lag bar, the α marker. A fast ball bouncing off a draggable wall, drawn raw (stutters), extrapolated
  (into the wall) and interpolated (smooth, one step late). A rung selector (1 to 5) running the same jump: the apex
  differs between screens for rungs 1–2 and is identical, to the bit, for 3–5. Perturbations: a 200 ms spike, a 5 s
  hidden tab, 15 fps, an "expensive step" _c_ with the cap on or off. "One knob, two failures": _h_, too large and the
  motion is wrong and tunnels, too small and a step costs more than it simulates. Panel rows: "frame (ms)", "steps this
  frame", "lag (ms)", "α", "apex (m)", "frame debt (ms)". Test: at 144 fps and _h_ = 1/60, "steps this frame" is always
  0 or 1; the apex is equal at 30, 60 and 144 fps for rungs 3–5.
- **Traps:** the frame callback is not the step (the browser owns the loop, G §8.3.2); the first frame's Δ*t*; a hidden
  tab gets no frame callbacks (MDN), so Δ*t* is huge afterwards; a variable Δ*t* "just for this object"; a camera updated
  before physics lags one step; the drawn frame is a sampling of the simulation (returns in 8.9).
- **Exercises:** (1) prove the invariant. (2) At _h_ = 1/60 and 144 Hz, how many of 12 frames take no step? (7.)
  (3) With _c_ = 20 ms and _r_ = 2 ms from a 20 ms frame: the next three (26,0, 33,2, 41,8 ms), and where the cap _M_ = 5
  stops the growth.
- **Our angle:** the determinism thread starts in earnest: the same actions at the same step indices give the same bits
  on every machine. "Dónde Manifold eligió otra cosa": `Clock` (`core/src/clock.ts`) takes at most 5 steps per frame
  and then drops the remaining time instead of slowing the game; the presentation interpolates everything.
- **Sources:** GPP ch. 9 (free at [gameprogrammingpatterns.com](https://gameprogrammingpatterns.com/game-loop.html));
  G §8.2–8.3, §8.5.1–8.5.2.5; MF §3.3, §6.3.1, §7.2.3; G2 §14.5.2.2, §17.6.3.4; E §2.4.2; Fiedler,
  [_Fix Your Timestep!_](https://gafferongames.com/post/fix_your_timestep/); MDN, `requestAnimationFrame`.
- **Reuses:** archived 0-03 (red per-frame and green fixed-step balls, the slow fake screen, the "interpolate" toggle)
  and 0-05's loop.
- **Open:** rung 2's failure can be the jump's apex (a number) or MF's resting box that hops after a spike (more vivid).

### 2.5 El reloj del juego (C)

- **Question:** ¿Cómo se pausa, se frena o se avanza un paso sin tocar el bucle?
- **Before:** 2.4.
- **Leads:** **G** §8.4 (timelines: real, game, local; pause, slow motion, single step), §8.5.3–8.5.4 (clock
  representations: integer counters, subtract large timestamps first, integer units), §10.5 (the debug camera on another
  clock); **also:** G2 §13.4.1–13.4.3 (a clip's local time, clamped or wrapped), GPP ch. 9 (two clocks: a turn-based game
  whose animations keep going).
- **Approach:** G's timelines as affine maps between number lines (our framing of his figures). Smoothing is not here
  (it has 2.3). The canonical game time is the integer step count _n_, with _t_ = _nh_ computed when needed, so the
  float clock becomes 2.9's problem, not a hidden bug. The hook: the turret now moves by itself; to look at a moment, the
  game must stop while the camera keeps flying.
- **The mathematics:** a timeline map _g_(τ) = _s_(τ − τ₀) + _g_₀, piecewise; pause is _s_ = 0 (constant, not
  invertible: why real time cannot be recovered from game time); slow motion scales the time fed to the accumulator,
  never _h_ (changing _h_ changes the trajectory, 2.2); single step: while paused, exactly one step per request; a local
  clip time _t_ = _R_(τ − τ_start), wrapped modulo its period, _R_ < 0 plays backwards; composing two maps multiplies the
  rates. Timers count steps, never `setTimeout`. Worked example: 10 real seconds: play 0–3 s (180 steps), pause 3–5,
  slow motion at 0,25 from 5 to 9 (60 steps), play 9–10 (60 steps): _n_ = 300, game time 5 s. A coin spinning with a
  period of 2 s at _R_ = 1,5 from game time 1 s: at game time 5 s its clip time is 6 s, wrapped to 0.
- **The live figure:** three stacked number lines (real, game, clip) with draggable segments: drag on the real line to
  lay a pause or a slow-motion stretch, and the game line follows; the graph of game time against real time (slope =
  timescale, flat = pause); a coin spinning on its own clip timeline with an _R_ slider, negative allowed; buttons pause,
  step, and a timescale slider; a decorative flag on the real clock keeps waving while the game is paused. Panel rows:
  "real time (s)", "game step n", "game time n·h (s)", "timescale", "clip time (s)", "paused". Test: with timescale
  0,25 for 4 real seconds "game step n" grows by 60 (±1); one step while paused grows it by exactly 1.
- **Traps:** `setTimeout` and `setInterval` run on real time and ignore pause and slow motion; slow motion by changing
  _h_; a float seconds clock; single-step is not a debugger breakpoint (the loop keeps running).
- **Exercises:** (1) prove that composing two timeline maps gives the product of their rates. (2) Rewrite a power-up
  that lasts `setTimeout(5000)` as "expires at step _n_ + 300", and say what pause does to each. (3) A clip with period
  2 s at _R_ = −1 from game time 0: its clip time at game time 0,5 s (1,5 s).
- **Our angle:** `view.timescale` is a view option (decision 0010): on a fixed step slow motion does not change the
  physics, only how fast it is shown, so it never touches the hash. "En Manifold": the world's clock is an integer
  (`tick`), and the Dojo's console has `pause`, `step` and `view.timescale`.
- **Sources:** G §8.4, §8.5.3–8.5.4, §10.5; G2 §13.4.1–13.4.3; GPP ch. 9.
- **Reuses:** none directly; archived 0-03's "Dónde Manifold eligió otra cosa" (the integer `tick`) is its "En Manifold".
- **Open:** none.

### 2.6 El reloj del proyecto (P)

- **Question:** ¿Cómo se lleva el paso fijo al proyecto, con pausa, cámara libre y consola?
- **Before:** 1.17, 2.3, 2.5.
- **Leads:** G §10.3–10.5 (in-game menus, a console, the debug camera and pause); decision 0010 (a registry of variables
  and commands, three kinds of option, recipes).
- **Approach:** the hook: part 1's lock-on jumped a quarter turn per press; now it must turn in time, and the moment
  something moves by itself the project needs G's tools: pause, step, look around, change a value without editing code.
  The console is built here (it also teaches how a console works, the author's answer 5), modelled on Manifold's.
- **The mathematics:** recalled: the accumulator (2.4), the exact factor (2.3), step counting (2.5). New: the timed
  lock-on approaches the aim along its great circle by nlerp of directions, **f** ← normalize(**f** + _c_(**f**\* −
  **f**)) with _c_ = 1 − _e_^(−*h*/τ) (a lerp of two unit vectors stays in their plane, so the path is 1.16's arc; only
  the speed within a step differs slightly from slerp), and the joints follow from the aim as in 1.16. Why nlerp: it
  needs only + − × ÷ √, which 2.9 will make a rule for what is hashed. The drawing slerps each joint by α between the
  previous and the current state (the view may use `Math`). Worked example (1.16's target (3; 2,5; −4), τ = 0,15 s,
  _c_ = 0,105161): after 6 steps 21,06° remain (slerp would leave 20,53°), after 30 steps 1,48° (slerp 1,43°).
- **The project:** `loop.ts` (new: `createLoop`, taking _h_, `maxSteps`, `step` and `draw`, on top of `view.onFrame`:
  Δ*t* clamped to 0,25 s after a hidden tab and scaled by the timescale; steps from the accumulator up to `maxSteps` = 5,
  the rest dropped; `draw(α)` once per frame); `clock.ts` (new: `Clock` with `step`, the count, `paused`, `timescale`,
  `requestSteps`, `time`); `world.ts` (`stepWorld`; `posesOf` copies what is drawn, so the loop keeps the previous
  poses); `quat.ts` (`nlerp`, `canonical`); `turret.ts` (`trackStep` replaces the press-based `lockStep`, announced: the
  lock now has time); `freecam.ts` (new: a free camera on the real clock; while on, the keys belong to it, G's
  ownership); `console.ts` (new: `createConsole`; `registerVar` with a name, a kind, a type, a range, a default and a
  description; `registerCommand`; `run` for a line with `;`; opened with Backquote; `help` and `vars`). Declared here:
  `pause`, `step`, `view.timescale`, `view.freecam`, `show.axes`, `log.turret`, `lock`, `turret`. World changes queue for
  the next step, like a key; view changes apply at once and never reach the state. Playable: part 1's game in real time,
  pausable and inspectable.
- **Console check:**
  - `pause; step` → "step 1"; then `step 59` → "step 60".
  - `view.timescale 0.25` → `vars clock.` shows 15 steps per real second.
  - `lock 3; step 30; turret` → "angle to target 1.48°".
  - `show.axes on` → `vars turret.` unchanged.
- **Traps:** nlerp between opposite directions does not move (**f** + _c_(−**f** − **f**) is parallel to **f**): near
  **f**·**f**\* = −1, turn about +Y first; the clamp hides a long frame but never a step; a free camera that writes into
  the world; console values arrive as text (validate, and say what was expected, decision 0010).
- **Exercises:** (1) add `turret.tau` as a startup option and check that 0,3 s doubles the angle's half-life (from
  0,104 s to 0,208 s). (2) Add a `log.loop` channel printing steps per frame, and read it at 144 Hz (0 or 1).
  (3) Declare `show.cone` as a view option and check that toggling it does not change `vars turret.`.
- **Our angle:** "Patrón": Game Loop (GPP: you do not own the browser's loop; what the pattern costs). "Dónde Manifold
  eligió otra cosa": its console is a registry in `packages/commands` (`Registry`), its debug views declare themselves
  (`presentation/src/views.ts`), and its world changes enter at a concrete step through the same channel as a player's
  keys; the Dojo's recipes are what "Probalo" imitates.
- **Sources:** G §10.3–10.5; decision 0010; GPP ch. 9; lil-gui and stats.js for comparison.
- **Reuses:** the pilot's `view.ts` (its `onFrame` and its 0,25 s clamp); archived 0-03's accumulator.
- **Open:** the factor _c_ uses `Math.exp` here, computed once; 2.13 moves it to `trig.ts`'s `expNeg` (see the problems
  at the end). Whether the console's on-screen piece is the project's own (as the author decided) or a stripped copy of
  Manifold's: the sheet assumes its own, about 200 lines.

### 2.7 Entradas: estado, bordes, acciones (C)

- **Question:** ¿Qué pasó con las teclas en este paso, y qué quiere decir cada una?
- **Before:** 2.3, 2.4.
- **Leads:** **G** §9.2–9.5 (polling against interrupts; digital, analog and relative inputs; dead zones; filtering;
  edges by XOR and AND; chords and sequences; remapping by classes; context; disabling with fail-safes); **GPP** ch. 2
  (Command: a reified call; the actor as a parameter; a stream of commands); **also:** MA §14.2.1 (a bot uses the
  player's controls).
- **Approach:** from part 1's `onPress`, right for a turn-based game, to a fixed step: events arrive between steps, at
  any time, so the step needs the state of each action in this step and its edges, computed by comparing with the
  previous step. GPP's Command is adapted: an action is plain data with its step, never a closure (a closure cannot be
  hashed, saved in a replay or sent to a server). The hook: at 3 fps a quick tap between two frames vanishes, and with
  two steps in one frame a press must reach only the first.
- **The mathematics:** actions as bits of one integer per step; changed = current XOR previous, pressed = changed AND
  current, released = changed AND NOT current; proof: a bit is pressed iff it is 1 now and 0 before. Quick taps: record
  the transitions from the events; a press and release between two steps enters as pressed in the next step and released
  in the one after (Manifold's stage 2a fix). Normalization classes (G): digital, one-way axis [0, 1], two-way [−1, 1],
  relative. "A mind drives the same actions as the player" (curriculum §5, MA). Worked example: jump = bit 0, fire = 1,
  left = 2; previous 0101₂ (jump, left), current 0110₂ (fire, left): changed 0011₂, pressed 0010₂ (fire), released 0001₂
  (jump).
- **The live figure:** kit `keys`: one row per step (down, previous, changed, pressed, released) filling as the reader
  presses keys or on-screen buttons; kit `screen` down to 3 fps with a toggle "keep quick taps" (off: taps lost, counted;
  on: none lost); GPP's tube: producers (keyboard, autopilot, a replay file) feeding per-step records into a ball that
  cannot tell them apart; a remap table showing `KeyboardEvent.code` against `key` on a Spanish and an AZERTY layout.
  Panel rows: "step", "down (bits)", "pressed", "released", "jumps counted", "taps lost". Test: the worked example
  through the figure's input box; at 3 fps with the toggle on, "taps lost" stays 0.
- **Traps:** reacting to DOM events inside the simulation (off the step grid); auto-repeat as new presses; keys held
  forever after the window loses focus (clear them, G's fail-safe); a moving average over _N_ frames is another window
  at each rate (count steps); a square dead zone biases diagonals; a chord that also fires its single actions.
- **Exercises:** (1) prove the three edge identities. (2) Rebind W A S D to I J K L touching only the table (GPP).
  (3) G's sequence: detect jump-fire-jump within 60 steps, resetting on a wrong action.
- **Our angle:** Command made hashable is the root of replays (2.14), minds (7.7) and networking (9.3). "Más a fondo":
  chords and sequences, and dead zones (radial, rescaled so the output does not jump from 0 to δ). "Dónde Manifold
  eligió otra cosa": in commercial engines actions live outside the simulation; in Manifold they are part of the world
  and of its hash, with the previous step's, and `pressed` is computed inside (`core/src/input.ts`, `normalizeInput`
  rounds directions to whole degrees; `session.ts` queues each input for its step).
- **Sources:** G §9.2–9.5; GPP ch. 2; MA §14.2.1; MDN, `KeyboardEvent.code` and Gamepad API.
- **Reuses:** archived 1-04 (two players on one keyboard, the list of input changes with their step, the 3 fps "keep
  quick taps" toggle, `BINDINGS` and the bot that produces an input) as the figure's base.
- **Open:** none.

### 2.8 Moverse (P)

- **Question:** ¿Cómo se mueve algo a la misma velocidad hacia cualquier lado, a pasos fijos?
- **Before:** 2.6, 2.7.
- **Leads:** MA §3.3.6 (velocity matching: a wanted velocity from the input, approached with a time constant); G §8.5.2
  (speeds in metres per second).
- **Approach:** the pilot's lesson, now after input (G, curriculum §7.1.6): "Moverse" uses actions from its first line.
  The hook is the pilot's: two keys at once go 41 % faster unless the direction is normalized; and a velocity set
  instantly feels like a switch, so it is approached (2.3) and integrated at the fixed step (2.2). The ball is added to
  the same world as the turret.
- **The mathematics:** recalled: the direction **d** = (_i_x_, 0, _i_z_), |**d**| = √2 on a diagonal; **v**\* = _s_ **d̂**;
  the exact approach **v** ← **v**\* + (**v** − **v**\*) _e_^(−*h*/τ_v_) on the floor's components; the jump: a press
  on the floor sets _v_y_ = _v_jump_, gravity _v_y_ ← _v_y_ − _gh_, then the position with the new velocity
  (semi-implicit); the floor as a clamp (if _y_ < _r_, _y_ = _r_ and _v_y_ = 0), not yet a collision (part 3). The jump
  speed from its height, _v_jump_ = √(2_gH_). Worked example: _s_ = 3 m/s, τ_v_ = 0,1 s, D held for 48 steps from rest:
  speed 2,999 m/s and 2,124 m covered (an instant start would cover 2,4). _H_ = 1 m: _v_jump_ = 4,4294 m/s; the apex is
  at step 27, 0,9632 m up (semi-implicit, about _v_₀ _h_/2 low); it lands at step 54.
- **The project:** `input.ts` grows `sampleStep` (turns the queued transitions into this step's record, a step and a
  bitmask), and `isDown`, `pressed`, `released`; `onPress` stays, for phases and menus. `ball.ts` (new: `Ball`, with a
  position, a velocity and `onFloor`; `moveBall`). `autopilot.ts` (new: the pilot's square and
  diamond, now producing the same records by step). `world.ts` gains the ball; `stepWorld` samples the input and moves
  the ball. Console: `ball.speed` (world), `autopilot` (world), `press jump` (world: one press at the next step).
  Playable: the ball on the floor, around the turret.
- **Console check:**
  - `restart; autopilot on; step 48; ball` → "speed 3.00 m/s, x 2.124 m".
  - `restart; press jump; step 27; ball` → "y − r 0.963 m"; then `step 27; ball` → "on the floor".
- **Traps:** normalizing zero (`NaN` spreads); a joystick is clamped, not normalized (the pilot's "Más a fondo");
  reading keys in the step instead of the record; the camera updated before the ball lags one step.
- **Exercises:** (1) with _normalize_ off, the diagonal reads 4,24 m/s (the pilot's). (2) Swap the exact approach for
  forward Euler: with τ_v_ = 0,01 s the speed shakes (τ < _h_ < 2τ), with 0,005 s it explodes (_h_ > 2τ). (3) A jump
  of 2 m: its speed (6,26 m/s) and the step of its apex.
- **Our angle:** "a mind drives the same actions": the autopilot is the first. "Dónde Manifold eligió otra cosa": its
  characters approach the wanted velocity by a constant acceleration (`approach`), and its directions are clamped, not
  normalized, and rounded to whole degrees so a replay stores them in a few characters (`normalizeInput`).
- **Sources:** MA §3.3.6; G §8.5.2.
- **Reuses:** pilot 05 and `course/parte-1/02-moverse/main.ts` (the direction, normalize, the 41 %, the autopilot, the
  speed readouts, the clamp "Más a fondo"); its `vec.ts` arrived in 1.7.
- **Open:** whether the ball's velocity approach uses its own τ_v_ (as here) or Manifold's constant acceleration as a
  console option for comparison.

### 2.9 Números que no son exactos (C)

- **Question:** ¿Por qué 0,1 + 0,2 no da 0,3, y qué cuentas dan lo mismo en todos los navegadores?
- **Before:** 2.5.
- **Leads:** **G** §3.3.1 (from the bits up; the magnitude–precision trade-off; ULP; machine epsilon; the float
  clock, corrected), §8.5.4.3–4, §5.3.11.2; **E** §11.1–11.3.1 (precision and degeneracy; non-associativity;
  catastrophic cancellation; absolute, relative and combined tolerances; tolerance-equality is not transitive);
  **also:** L1 1.6, 2.7.2, 3.3.2–3.3.3 (drift; the largest component; determinant thresholds), L2 §6.3.3 (floats are
  densest near zero), MF §16.1.5 (mixed scales; Rapier in float32), Goldberg, Dawson, ECMA-262.
- **Approach:** it opens with G's broken float clock, with our corrected numbers, as a playable "El problema", and the
  reason the project counts steps. Then the representation from the bits up, then the consequences, then the project's
  rule. GPP's argument (a variable step does a different number of roundings) closes the loop with 2.4.
- **The mathematics:** _x_ = (−1)^_s_ · 2^(_e_ − bias) · (1 + _f_/2^_p_) with _p_ = 23 (float32) or 52 (float64); the
  spacing at magnitude [2^_k_, 2^(_k_+1)) is 2^(_k_ − _p_); 0,1 is not representable; every operation rounds to nearest
  (even on ties). The float32 clock adding 1/60 per step: in [2^14, 2^15) s (from 4,6 h) it runs 5,5 % fast (8,53 ULPs
  round to 9), in [2^15, 2^18) (9,1 h to 3,0 days) 6,25 % slow (1/64 per step), in [2^18, 2^19) at 1,875 times (rounds up
  to 1/32), and from 2^19 s (6,1 days) it stops (less than half an ULP). Non-associativity; cancellation (_b_² − 4_ac_
  near a double root, returning in 3.9); tolerances |_x_ − _y_| ≤ ε max(|_x_|, |_y_|, 1). **The project's rule**
  (curriculum §5): ECMA-262 makes + − × ÷ and √ exactly rounded binary64 in every engine, while `Math.sin`, `cos`,
  `exp`, `pow`, `atan2` and `hypot` are implementation-approximated; so what is hashed uses only the first group, plus
  our own sine and cosine (2.13); JavaScript never reorders float operations, which helps. Worked example: 0,1 + 0,2 =
  0,30000000000000004; (0,1 + 0,2) + 0,3 = 0,6000000000000001 but 0,1 + (0,2 + 0,3) = 0,6; `Math.fround(0.1)` =
  0,10000000149011612; the float32 spacing at 1 km is 0,06 mm, at 1000 km 6,25 cm.
- **The live figure:** (a) kit `bits`: click bits, read the value, float32 and float64 side by side; (b) kit
  `numberline`: drag a marker and see the spacing double at each power of two; (c) the float clock fast-forwarded (a
  rate readout against true time, the ranges above lit as it passes them); (d) an object at 10^_k_ m with a following
  camera, float32 against float64 (kit `perturb`); (e) (_a_ + _b_) + _c_ against _a_ + (_b_ + _c_) with the reader's
  numbers. Naive against correct: `==` against a tolerance; the float clock against the step counter. "One knob, two
  failures": the tolerance ε, too small and equal things differ, too large and distinct things merge. Panel rows: "value",
  "bits", "spacing here", "clock rate", "sum left first", "sum right first". Test: the sums above; the clock rate reads
  0.9375 at 2^16 s and 1.875 at 2^18,5 s.
- **Traps:** "JavaScript has no float32" (the GPU and Rapier do); `x/10` is not `x*0.1`; −0 has other bits than +0
  (Manifold writes `0 - x`); summation order changes results; a shader's time uniform degrades like the clock.
- **Exercises:** (1) decode 0,15625 by hand (1,25 · 2⁻³; bits 0 01111100 0100…0). (2) Find _x_ where 1 − cos _x_ in
  float32 is 0 but 2 sin²(_x_/2) is not (_x_ = 10⁻⁴: 0 against 5 · 10⁻⁹). (3) Three numbers that make tolerance-equality
  non-transitive with ε = 0,01 (1,000, 1,008, 1,016).
- **Our angle:** "Rigor numérico" capsule; the determinism rule set here governs every later part. "Dónde Manifold
  eligió otra cosa": a lint rule forbids `Math.sin`, `cos`, `atan2`, `exp`, `pow` and `**` in the core (added in stage
  1f, when trigonometry was found hidden in a step); `approx.ts` keeps them for tests and views; its levels are small, so
  it never moves the origin; "La misma huella" plays reference replays in the reader's browser.
- **Sources:** G §3.3.1, §8.5.4.3–4, §5.3.11.2; E §11.1–11.3.1; L1 1.6, 2.7.2, 3.3.2–3.3.3; L2 §6.3.3; MF §16.1.5;
  Goldberg, [_What Every Computer Scientist Should Know About Floating-Point Arithmetic_](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html);
  Dawson, [_Comparing Floating Point Numbers_](https://randomascii.wordpress.com/2012/02/25/comparing-floating-point-numbers-2012-edition/);
  [ECMA-262, `Math`](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sin); MDN, `Math.fround`.
- **Reuses:** archived 0-06 (`bits.ts`, the two balls far from the origin, float64 against `Math.fround`, the console
  print of 0,1's bits) for (a) and (d).
- **Open:** the curriculum's §3 numbers for the clock are right but incomplete: it is already 5,5 % fast from 2^14 s
  (about 4,6 h), before it turns slow at 9 h. The sheet uses the full table.

### 2.10 El azar con semilla (C)

- **Question:** ¿Cómo se reparte algo al azar, y siempre igual para la misma partida?
- **Before:** 2.9.
- **Leads:** **G** §5.7 (a catalogue: LCG, Mersenne Twister, xorshift, PCG; implement your own; the seed for playback);
  **MA** §8.1–8.1.4 (a mixing function; one master seed seeding per-system generators in a fixed order; Halton, Poisson
  disc), §3.2.2 (random() − random() is triangular, not binomial), §5.2.9 (decisions that flicker); **also:** O'Neill
  (PCG), Vigna (xoshiro), Eiserloh (random numbers as a hash of seed and index).
- **Approach:** a generator is a state and a mixing step; the same seed gives the same sequence; `Math.random` cannot be
  seeded and differs between engines. The LCG first, because its flaws are visible (the archived lesson used it), then
  the generator the project keeps: SFC32, the one Manifold uses (32-bit additions, shifts and rotations, seeded by
  splitmix32), chosen over PCG32, whose 64-bit multiply is awkward in JavaScript. MA's one stream per system is the
  lesson's design point. The hook: 2.13 needs coins placed by chance, the same for the same game.
- **The mathematics:** _x_′ = (_ax_ + _c_) mod 2³²; with _a_ and _c_ odd its lowest bit alternates (proof by parity),
  and the low _k_ bits have period 2^_k_; full period by Hull–Dobell (stated, in "Más a fondo"). Integer arithmetic is
  exact (ECMA-262 specifies bitwise operations), so generators are deterministic by nature; floats as `u / 2³²` (a
  division by a power of two, exact). Distributions: integers in [0, _n_) and the modulo bias (2³² mod 6 = 4: four
  outcomes one count more likely in 7 · 10⁸); a uniform point in a disc needs _r_ = *R*√*u* (area argument:
  P(_r_ ≤ ρ) = ρ²/_R_²); Fisher–Yates shuffles; the sum of two uniforms is triangular (MA corrected; density 1 − |_x_|
  from the area on the unit square). Streams: per-system seeds derived from the master in a fixed order. Worked example:
  SFC32 with seed 1 begins 0,184526, 0,748632, 0,037307, 0,267998, 0,463435; the LCG (1664525, 1013904223) from 0 gives
  1013904223, 1196435762, 3519870697, with low bits 1, 0, 1, 0 and low two bits 3, 2, 1, 0.
- **The live figure:** (a) pairs (_x_ₙ, _x_ₙ₊₁) of a small LCG on few lines next to SFC32's cloud, and the LCG's
  alternating low bit; (b) streams: a "combat" system whose number of draws is a slider; with one shared generator the
  coin layout changes, with one stream per system it does not (naive against correct); (c) kit `seed`: same seed, same
  layout; (d) a histogram of random() − random() growing into a triangle; (e) disc sampling, _r_ = _Ru_ (clumped at the
  centre) against *R*√*u* (naive against correct), with a draggable radius. Panel rows: "seed", "first numbers", "layout
  hash", "combat draws", "coins unchanged", "points within R/2". Test: seed 1's first five as above; with per-system
  streams "coins unchanged" stays yes for every combat count; naive disc puts half the points within _R_/2, the correct
  one a quarter.
- **Traps:** an unseeded generator; random calls in frame-rate-dependent code (the count then depends on the screen);
  one generator shared by all systems; floats inside the generator; a decision re-rolled every step flickers (MA:
  keep the choice until the situation changes); modulo bias for large _n_.
- **Exercises:** (1) prove the LCG's low bit alternates when _a_ and _c_ are odd. (2) "Corregí al autor": derive the
  density of random() − random() (triangular; P(|_x_| < ½) = ¾). (3) Over many seeds, check that Fisher–Yates gives all
  six orders of three equally often.
- **Our angle:** chance with a seed is the first half of a replay; Eiserloh's noise as a hash of (seed, index) is the
  random access a level generator wants (6.14). "Dónde Manifold eligió otra cosa": each world has its own `Random`
  (`common/src/random.ts`), whose state is inside the world (in the hash and in every snapshot), because a shared
  generator once let a replay and a live game on one page steal each other's numbers; `Math.random` is forbidden in the
  simulation by a lint rule. The Dojo's `seed 2`.
- **Sources:** G §5.7; MA §8.1–8.1.4, §3.2.2, §5.2.9; O'Neill, [PCG](https://www.pcg-random.org/paper.html); Vigna,
  [xoshiro](https://prng.di.unimi.it/); Eiserloh, _Noise-Based RNG_ (GDC 2017); MDN, `Math.random`.
- **Reuses:** archived 0-04 (`random.ts`'s LCG, the 60-cube level from a seed, the "use Math.random" toggle) for (a) and
  (c).
- **Open:** whether to show Halton and Poisson-disc sets (MA §8.1.2–8.1.4) here or leave them to 6.14; 2.13's coins use
  simple rejection with a minimum distance.

### 2.11 Muchas cosas a la vez (C) ◇

- **Question:** ¿En qué orden avanzan muchas cosas en un paso, y qué pasa si una aparece o desaparece?
- **Before:** 2.4.
- **Leads:** **GPP** ch. 10 (Update Method: sequential, not simultaneous; adding and removing while iterating; dormant
  objects), ch. 8 (Double Buffer: the slapstick ring); **also:** G2 §17.6.3 (update phases; the consistency rule: read
  the previous state), E §2.4.2 (sequential against simultaneous motion).
- **Approach:** GPP's, with determinism made explicit: the order of the list is part of the simulation, so it must be
  stable (by id, never by insertion accident or object identity). Then the order-independent alternative, double
  buffering, as a theorem. The platforms' update order (5.8) is seeded by a paragraph. The hook: two coins touched in
  the same step, and which one counts depends on where they sit in an array.
- **The mathematics:** updates as functions that do not commute, _F_A ∘ _F_B ≠ _F_B ∘ _F_A; with double buffering each
  new state is a function of the previous state only, so the step is one simultaneous map _S_′ = _F_(_S_), the same for
  any iteration order (proof: every write goes to the next buffer, every read comes from the previous one). Removal while
  iterating forward skips the next element (index arithmetic); three fixes (iterate backwards, mark and sweep after,
  or cache the count). A thing spawned during the step acts from the next step (decided, and why). Worked example:
  GPP's ring A → B → C → A, each slapping the next if it was slapped; A starts slapped. Single buffer in order A, B, C:
  the whole ring is slapped in one step; in order C, B, A only B. Double buffer: B in step 1, C in step 2, A in step 3,
  in any order.
- **The live figure:** (a) GPP's removal figure: an array with an index arrow; remove the middle element while the
  arrow is on it: the next one is skipped, in red; buttons for the three fixes. (b) The ring, with its order changed by
  dragging the items (touch), single or double buffer. (c) E's two balls moving towards each other one at a time against
  together. Panel rows: "order", "slapped this step", "skipped", "buffer". Test: the worked example in both orders and
  both buffers.
- **Traps:** order dependence hidden in "simultaneous" code; mutating a list while iterating it; observers that depend
  on each other's order; ids reused after removal.
- **Exercises:** (1) remove coins while iterating forward and find which coin's spin freezes for a step; fix it three
  ways. (2) A coin spawns a sparkle: does the sparkle move in its first step? Decide and justify. (3) Show that in E's
  case, moving one ball and then the other can invent a collision that moving both together does not.
- **Our angle:** iteration in a fixed order is checklist item 5 (curriculum §4.5). "Patrón" boxes: Update Method and
  Double Buffer, each with when it pays and what it costs (two copies of the state). "En Manifold": the hash visits
  entities in id order and their keys in a fixed order (`core/src/hash.ts`); the step runs fixed phases; signals are
  read at the next step (decision 0018).
- **Sources:** GPP ch. 10, ch. 8 (free at [gameprogrammingpatterns.com](https://gameprogrammingpatterns.com/update-method.html));
  G2 §17.6.3; E §2.4.2.
- **Reuses:** none (new).
- **Open:** if folded (◇), the removal figure goes to 2.12's "Sutilezas" and the ring to 6.6, where double-buffered
  signals return.

### 2.12 Reglas: el estado del juego (C)

- **Question:** ¿Cómo se dice cuándo se juega, se gana, se pierde y se vuelve a empezar?
- **Before:** 2.11.
- **Leads:** **GPP** ch. 7 (State: entry and exit actions), ch. 4 (Observer: who, not when; the lapsed listener);
  **also:** MA §5.3 (the vocabulary: states with entry, active and exit actions; transitions with conditions; triggering
  against firing; hard-coded against data-driven), G §1.5.15 (events in the gameplay layer), G2 §17.10 (game flow:
  objectives with success and failure).
- **Approach:** from 1.17's enumeration and switch to a machine whose transitions are data, with MA's vocabulary so that
  7.8 can start at hierarchy (curriculum §5). Events decouple "a coin was taken" from the score, the text and the sound.
  Restart is re-entering the initial state, whose entry action rebuilds the world from data, which also removes the
  lapsed listener. The hook: the coin game needs a countdown, a pause, a win and a loss, and with flags it already has
  sixteen combinations of which five mean something.
- **The mathematics:** a machine (states _Q_, events Σ, a transition function δ: _Q_ × Σ → _Q_, an initial state, entry
  and exit actions); conditions (polled every step) against events (fired once); _k_ flags give 2^_k_ combinations;
  events delivered at the end of the step in a fixed order, and observers inside the simulation change nothing outside
  that phase (G2's consistency rule, seeded in 2.11). Worked example: states ready, playing, paused, won, lost; events
  start, coinTaken, timeUp, pause, resume, restart; ready —start→ playing (entry: timer 3600 steps, score 0);
  playing —coinTaken with none left→ won; playing —timeUp→ lost; won or lost —restart→ ready. Flags playing, won, lost,
  paused: 16 combinations, 5 meaningful.
- **The live figure:** kit `diagram`: the machine drawn beside a miniature coin game (a dot, three coins, a timer); the
  current state lights up, each transition flashes with the event that fired it; buttons inject events; the transition
  table is editable with drop-downs (touch). The lapsed-listener demo: restart five times with "rebuild on restart" off
  and one coin plays its sound six times (a counter of registered listeners). Panel rows: "state", "last event",
  "listeners", "timer (steps)". Test: the worked example's sequence; with rebuild off, "listeners" reads 6 after five
  restarts.
- **Traps:** flags for phases; timers in `setTimeout`; listeners registered on every start; an observer that moves the
  world mid-step; order-dependent observers.
- **Exercises:** (1) add a 3-second countdown state before playing, by editing only the table. (2) Make registration
  return an unsubscribe and use it, then compare with rebuilding on restart. (3) Where must the timer stop when paused,
  and why does counting steps make that free?
- **Our angle:** "Patrón": State (the machine) and Observer, with when each pays. "Dónde Manifold eligió otra cosa":
  each game's rules are a cartridge that hooks around the engine's step, never inside (`Cartridge.beforeStep` and
  `onStep` in `core/src/world.ts`), and reads the step's events, which have two readers (the rules per step, the
  presentation per frame).
- **Sources:** GPP ch. 7, ch. 4; MA §5.3; G §1.5.15; G2 §17.10.
- **Reuses:** none (new); 1.17's `game.ts` is the starting point.
- **Open:** none.

### 2.13 El juego: juntar las monedas (P)

- **Question:** ¿Qué le falta a la pelota para tener un juego contra el reloj?
- **Before:** 2.8, 2.10, 2.12.
- **Leads:** GPP ch. 4 (Observer); GPP ch. 1 (architecture as ease of change; coupling) for the part's first "Patrón"
  box on how the code is organized.
- **Approach:** the hook: the ball moves, the turret tracks, but nothing is at stake; and every piece the game needs has
  just been taught: seeds (2.10), rules (2.12), order (2.11), clocks (2.5). The turret of part 1 becomes the antagonist.
  The rule of 2.9 arrives in the project: what is hashed (soon, 2.15) must not call `Math.sin`.
- **The mathematics:** recalled only: coin placement by rejection with a minimum distance, in an annulus with
  _r_ = √(_r_min² + _u_(_r_max² − _r_min²)) (2.10's area argument); the pickup by squared distances
  |**b** − **c**|² ≤ (_r_b_ + _r_c_)²; the cone and the range (1.5); the tracking factor (2.3); our own sine and cosine
  by reduction to a quarter turn and a Horner series (Manifold's `sinCosDegrees`), and `expNeg` for the factors' constant
  the same way.
- **The project:** `rng.ts` (new: `createRng(seed)`, SFC32; `streams(master)` gives `coins`, `turret`, `autopilot` in a
  fixed order); `trig.ts` (new: `sinCos(degrees)` and `expNeg(x)`, with + − × ÷ only; tests compare them with `Math`);
  `coins.ts` (new: `placeCoins(rng, n)`); `game.ts` (the phases become 2.12's machine, with events `coinTaken`, `hit`,
  `timeUp`; the timer counts steps); `turret.ts` (tracks the ball with `trackStep`, charges 30 steps inside the cone,
  fires, rests 60; the hit event costs 300 steps); a text overlay (time left, coins, messages); coins spin on a local
  clip timeline (view only); restart rebuilds the world from the seed. Console: `seed` (startup: restarts), `restart`,
  `game` (prints phase, time left, coins). A "Patrón" box: the modules and their arrows (input → world ← rules; view
  reads world), and why `trig.ts` and `rng.ts` are where they are. Playable: the whole game.
- **Console check:**
  - `seed 7; restart; coins` → a list of eight positions; `seed 8; restart; coins` → another.
  - `seed 7; restart; coins` → the first list again, identical, and the same in every browser.
  - `seed 7; restart; step 600; game` → a phase, a time left and a coin count, fixed by the reference run and pinned by
    the test.
- **Traps:** the coin spin or the HUD reading the rng (view must not draw from the simulation's streams); a coin placed
  inside the turret; nlerp's antipodal case when the ball starts exactly behind the turret (2.6); a timer in seconds;
  `trig.ts`'s argument reduction at large angles.
- **Exercises:** (1) make the turret's cone 10° and tune τ until the game is still winnable; report both numbers.
  (2) Add a "combat" stream that draws on every hit, and show the coin layout does not change. (3) Replace one `Math.sin`
  in the placement with `sinCos` and check with `seed 7` that the layout's numbers change in the last digits only.
- **Our angle:** one world that accumulates (curriculum §1): the turret from part 1 is the antagonist, and will be a
  sentry in part 3. "En Manifold": the Dojo's `seed` and `restart`; `Random` per world; `sinCosDegrees` in
  `common/src/math.ts`.
- **Sources:** GPP ch. 1, ch. 4.
- **Reuses:** none from the pilots; archived 0-04's level-from-a-seed idea.
- **Open:** all design numbers (eight coins, 60 s, τ = 0,4 s, 6°, 8 m, 30 and 60 steps, 5 s) are first guesses to tune
  in play; the reference values for the console check are recorded when the lesson is written.

### 2.14 Repeticiones: lo mismo, otra vez (C)

- **Question:** ¿Qué hay que guardar para que una partida se repita idéntica?
- **Before:** 2.9, 2.10, 2.13.
- **Leads:** **G** §8.5.2.4 (record and playback; drift when timing varies); **also:** GPP ch. 2 (a recorded command
  stream; undo; three ways back in time), E §2.7.1 (a ring of the last queries, to replay a collision bug), G2
  §14.1.3.2, §17.8.9.1 (every system must be deterministic; events at the same time ordered by a rule), L1 2.7.2 (the
  canonical sign _w_ ≥ 0), MA §9.3.1 (Zobrist hashing), Fiedler (_Deterministic Lockstep_), Rapier's determinism page.
- **Approach:** two ways to keep a game, states or inputs, as the bridge to part 9 (snapshots against lockstep).
  G's record by timestamp is refined by everything part 2 built: record by step index, record logical actions, record
  only changes, and check with a hash every step. The hook: replay the coin game and watch it drift because of one
  unseeded call, then find the step where it started.
- **The mathematics:** a replay = version + seed + settings + the actions with their steps. What breaks determinism, as
  a checklist: unseeded chance, clock reads, a variable step, approximated functions, iteration order, asynchronous
  callbacks (a load finishing in another order), state outside the recording, lossy printing. The hash: a function from
  states to 32 bits (FNV-1a over the bytes of every number, entities in id order); equal hashes mean "almost surely the
  same state", different ones "surely different"; the birthday bound (about 77 000 states for even odds of a
  collision). Quaternions hashed in canonical sign, since _q_ ≡ −*q* (an equal orientation with two byte patterns),
  and −0 normalized. The first divergent step by scanning the two hash sequences, or by bisection in O(log _n_)
  re-simulations when only the start is kept. GPP's three ways back: inverses, snapshots, re-simulation. Worked example:
  60 s is 3600 steps; about 180 input changes at a few bytes each make a replay of about 1,5 KB, against 7,5 MB for the
  states of 20 things (13 numbers of 8 bytes per step). The canonical form of (0; −0,7071; 0; −0,7071) is
  (0; 0,7071; 0; 0,7071).
- **The live figure:** two runs side by side with a hash timeline under them (kit `seed`, two rows of coloured cells,
  the first mismatch highlighted); the recorded actions as a table; toggles that break determinism on purpose:
  `Math.random` in a spawn, a variable step, a random call in the drawing, the ghost one step late, and "skip canonical
  sign" (the worlds are identical, the hashes differ: naive against correct). Kit `scrubber`: drag a step marker and the
  world re-simulates to it from the start. Panel rows: "input changes", "steps checked", "different hash", "first
  divergent step", "replay size (bytes)", "states size (bytes)". Test: with nothing broken, "different hash" is 0 over
  3600 steps; with "one step late", "first divergent step" equals the step after the first input change.
- **Traps:** recording DOM events; actions that refer to objects instead of ids; floats printed with too few digits
  (use exact text or bytes); a physics engine that is not deterministic (G2); ties between events without a rule.
- **Exercises:** (1) record a run and replay it; compare the last hash. (2) Alter one action and find the first
  divergent step by bisection; count the re-simulations (about log₂ 3600 ≈ 12). (3) The birthday bound for a 32-bit hash:
  √(2 ln 2 · 2³²) ≈ 77 163.
- **Our angle:** determinism paid back. "Dónde Manifold eligió otra cosa": its replays are text (the version, the game,
  its settings as console lines, one input per line with its step, the last step and its hash) and fit in a link; each
  phase leaves a reference replay that the tests play in Chromium, Firefox, WebKit and Node; `stateHash` is FNV-1a over
  `Float64` bytes and cost 1,8 ms for 200 bodies after a measured optimization (`core/src/hash.ts`).
- **Sources:** G §8.5.2.4; GPP ch. 2; E §2.7.1; G2 §14.1.3.2, §17.8.9.1; L1 2.7.2; MA §9.3.1; Fiedler,
  [_Deterministic Lockstep_](https://gafferongames.com/post/deterministic_lockstep/);
  [Rapier, _Determinism_](https://rapier.rs/docs/user_guides/javascript/determinism).
- **Reuses:** archived 1-05 (the ghost, the hash per step, "steps checked", "different hash", the "one step late" toggle,
  `hash.ts`) as the figure's base.
- **Open:** none.

### 2.15 Tu fantasma (P)

- **Question:** ¿Cómo se corre contra la propia mejor vuelta?
- **Before:** 2.14.
- **Leads:** GPP ch. 2 (once commands take their actor as a parameter, the player can control any actor: the recorded
  stream played on a second one).
- **Approach:** the hook: a coin game is a race, and racing against your own best run is the oldest feature of racing
  games; with 2.14's determinism it costs a second world and a list. The ghost is not an animation of positions but the
  same simulation fed the same actions; its turret fires at its ball, and nobody wrote a line for that.
- **The mathematics:** recalled only (2.14): canonical quaternions; the first divergent step; replay as text.
- **The project:** `record.ts` (new: `Recording`, with the version, the seed, the settings, the actions with their
  steps and the hashes; `record`, `toText`, `fromText`); `hash.ts` (new: `stateHash`, FNV-1a over the bytes of every
  number, things in id order, quaternions through `quat.canonical`, the rng's state and the step count included);
  `ghost.ts` (new: `createGhost` builds a second world from the same seed and settings and feeds it the actions by step;
  `firstDivergence`). The view draws the ghost translucent; the best run is kept in memory and, as a per-viewer
  convenience, in `localStorage`. Console: `hash`, `record`, `ghost`, `replay export`, `replay check`, `ghost.late`
  (startup: feeds the ghost one step late). Playable: win, then race your best.
- **Console check:**
  - `seed 7; restart; record on`, play to the end, `replay export` → a text that starts with the version and the seed.
  - `replay check` → "same hash at step N", for the run's last step.
  - `ghost.late 1; ghost` → "first divergent step: k", with _k_ the step after the first recorded action.
- **Traps:** hashing three.js objects or anything from the view; a recording without its version (an old replay on new
  code); the ghost reading the player's live input; storing positions instead of actions "to be safe" (it hides
  determinism bugs instead of finding them).
- **Exercises:** (1) export a replay, edit one action by hand, and find where it diverges. (2) Show that the ghost's
  turret hits its ball at the same steps as in the original run. (3) Measure the replay's size for a full game and
  compare with 2.14's estimate.
- **Our angle:** the first payoff of the determinism thread: the guard of part 7 will be in every replay the same way.
  "En Manifold": the Dojo's `ghost`, `replay export` (a link that replays and checks the hash in the reader's browser),
  and the reference replays of "La misma huella".
- **Sources:** GPP ch. 2.
- **Reuses:** archived 1-05 (race your ghost, hashes per step, `createWorld` from a seed) and its "Más a fondo" on what
  breaks determinism.
- **Open:** whether the best run persists across visits (`localStorage`, per viewer) or only within the page.

---

## Problems found in the curriculum

1. **The timed lock-on cannot use slerp in the hashed simulation.** Slerp with a parameter other than _k_/2^_m_ needs
   `acos` and `sin`; 2.9's rule bars them, and `trig.ts` (2.13) only adds sine and cosine. The sheets approach the aim
   by nlerp of directions with the exact factor (same great-circle path, + − × ÷ √ only) and keep "slerp by α" in the
   view (2.6). The curriculum's "with 2.3's exact factor" holds; "slerp" applies to the drawing.
2. **The exact factor needs an exponential.** 1 − _e_^(−*h*/τ) is computed with `Math.exp`, which 2.9's rule also bars
   from what is hashed; it is a constant, but it enters the state. `trig.ts` needs an `expNeg` (Horner, like the sine),
   or the factors must be literals checked by a test. Affects 2.6, 2.8 and 2.13.
3. **The float clock's numbers in §3 are incomplete.** Simulating the float32 clock at 60 Hz: 5,5 % fast from 2^14 s
   (about 4,6 h), 6,25 % slow from 2^15 s (9,1 h), 1,875 times from 2^18 s (3,0 days), stopped from 2^19 s (6,1 days).
   The "6 % slow after about 9 hours" is right but misses the earlier error.
4. **The vicious circle grows geometrically, not linearly** (the GPP reader's note says linear): a frame's duration
   follows _T_ₖ₊₁ = (_c_/_h_) _T_ₖ + _r_. 2.4 uses the correct statement.
5. **nlerp between opposite directions does not move.** Any timed lock-on that starts exactly opposite its target
   (the coin game's ball starting behind the turret) needs a turn about +Y first; noted in 2.6 and 2.13.
6. **`lockStep` (1.16, press-based) cannot keep its meaning once the lock has time.** 2.6 replaces it with `trackStep`,
   announced as 0021 asks; the curriculum's "the lock-on now turns in time" implies it without naming the change.
