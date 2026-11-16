# The lesson sheets

One design sheet per lesson of the new tutorial, under the approved [curriculum](../tutorial-curriculum.md) and
[decision 0021](../decisions/0021-a-new-tutorial.md). A writer follows a lesson's sheet to write it: its question,
what it needs before, the sources that lead, the approach and what it rejects, the mathematics with a worked example
whose numbers were computed for the sheet, the live figure with its panel rows and its browser test, the traps, the
exercises with their answers, the project's change (in a project lesson), and what it reuses from the pilot and the
archived tutorial.

| File                       | Part                  | Lessons                                                                   |
| -------------------------- | --------------------- | ------------------------------------------------------------------------- |
| [parte-01.md](parte-01.md) | El espacio            | the pages before part 1 (Presentación, TypeScript, La notación); 1.1–1.17 |
| [parte-02.md](parte-02.md) | El tiempo             | 2.1–2.15, and the architecture every later part inherits                  |
| [parte-03.md](parte-03.md) | Formas y choques      | 3.1–3.17                                                                  |
| [parte-04.md](parte-04.md) | La física             | 4.1–4.15                                                                  |
| [parte-05.md](parte-05.md) | Un personaje          | 5.1–5.16                                                                  |
| [parte-06.md](parte-06.md) | Un mundo que responde | 6.1–6.16                                                                  |
| [parte-07.md](parte-07.md) | Mentes                | 7.1–7.14                                                                  |
| [parte-08.md](parte-08.md) | El dibujo             | 8.1–8.17                                                                  |
| [parte-09.md](parte-09.md) | Jugar con otros       | 9.1–9.10                                                                  |
| [parte-10.md](parte-10.md) | Mundos extraños       | 10.1–10.9                                                                 |

Each file opens with its part sheet (what the reader can do at the end, the closing game's rules, how the code grows
with its stable names, the lab-kit pieces it needs) and ends with **the problems its writer found in the curriculum**,
each resolved in the sheets or marked open. Five writers wrote them in parallel (2026-11-16); a cross-part review read
them together afterwards, and what only that review could see is below. The lab kit the sheets call "kit" lives at
`site/src/lab/` and is imported as `'lab'` (parts 1–2 propose `site/src/lessons/kit/`: read it as the former).

## Decisions across parts

Choices that span several parts' sheets, found by the cross-part review. Each had a recommendation; **the author took
all eight as recommended (2026-11-16)**, and the sheets are amended when each part is written, not before. An
experienced reader may find some of them odd, so **each lesson where one appears carries a "Para quien ya sabe" note**
(curriculum §4.3) with its reason, given here under **Why** and **Note in**.

1. **Gravity as a field from the start.** No lesson creates `gravityAt(p)`, which 10.4 says "keeps its name"; 2.8
   writes _v_y −= _gh_ inside `moveBall`, 4.6 has `gravity(g)`, 4.11 `createPhysics(gravity, h)`. Recommended:
   `gravity.ts` with `gravityAt(p)` in 2.8, a uniform field stored as data; 4.6's force reads it, 4.11 sets Rapier's
   gravity from it, 5.2 and 5.6 scale it. (Alternative: 10.4 renames, announced.)
   **Why:** it is one function returning a constant vector, so it costs nothing; it keeps 0021's rule (a name keeps its
   meaning: part 10 does not rename anything), and it plants early that "down" is a datum of the world, as the notation
   page says. **Note in:** 2.8, recalled in 10.4.
2. **`trig.ts`, the determinism rule's own functions** (2.9's rule: what is hashed uses + − × ÷ √ only). The hashed code
   of the ten parts needs exactly: `sinCos(deg)` for any real number of degrees (1.12's `mat.ts` and 1.16's
   `quat.fromAxisAngle` once the turret is hashed in 2.13, 5.2, 5.11, 6.3, 6.8), `expNeg(x)` for the exact factor
   1 − e^(−h/τ) (2.6, 2.8, 2.13, 4.1, 4.6, 7.8, 7.12), and `acos` only for 10.9's great-circle heuristic. No `atan2`
   (see 3). Recommended: these three, born in 2.13 (`acos` in 10.9), each tested against `Math`; degrees as the unit,
   Manifold's (whole-degree data, an exact quarter-turn reduction), stated as an exception to the notation's radians;
   factors computed at load by `expNeg`, never written as literals (parts 4 and 7 change), since 2.6 makes τ an option.
   2.13 moves `mat.ts` and `quat.ts` onto it, announced.
   **Why degrees:** not determinism as such (any fixed sequence of exactly rounded operations is deterministic, in
   radians too) but exactness where it matters: π is not representable, so a quarter turn in radians is never exact
   (`Math.cos(Math.PI / 2)` is 6.1 · 10⁻¹⁷), while 90 is; reducing by 360 and by quadrants is an exact subtraction, so
   every multiple of 90° reduces to exactly 0 and its sine and cosine are exactly 0 or ±1: a turret turned a quarter is
   aligned, a symmetric layout stays symmetric. (Other angles, such as 30°, are within a rounding of the true value,
   as in radians.) The data are in degrees (15° steps, "rotate 90"), and Manifold does the same. Only the interface and the
   reduction are in degrees: the reduced angle, in [−45°, 45°], is converted to radians and the polynomial is the usual
   Taylor series, so the mathematics stays in radians. **Note in:** 2.13, and on the notation page.
3. **The input record.** 3.5's action `point` carries a world point, 5.2's `Intent` a heading, 7.7's mind "returns
   the keyboard's record". Recommended: the recorded record grows a payload (a world point, a quantized direction on
   the floor), announced with a version bump; `Intent` is what the character reads each step, built from the record or
   emitted by the autopilot and by `think`. A quantized direction keeps `atan2` out of minds. (Alternative: a
   whole-degree heading, with `atan2Deg` in `trig.ts`.)
   **Why not whole degrees, as Manifold:** Manifold's commands come from people, and the stick's vector becomes an angle
   outside the simulation; part 7's minds think inside it, and would need a deterministic `atan2`. A vector on a fixed
   grid is as small in a replay, and normalizing it needs only + − × ÷ √. **Note in:** 3.5, 5.2 and 7.7 ("Dónde Manifold
   eligió otra cosa" says it too).
4. **One console grammar.** Today: `press` / `act` / `walk` to inject an action; `place` / `teleport` to move a
   thing; `level.load` / `level`; five spellings of replays. Recommended: `press <action>`, `place <thing> <where>`,
   `level.load <name>`, one `replay export|check|play|save` family; dotted names for variables, spaced subcommands for
   commands; 2.8 retires 1.17's `act` explicitly.
5. **Regions.** 4.11 turns coins and the exit into Rapier sensors, 6.4 and 6.7 bring their own zones, 5.16 uses
   spheres. Recommended: 6.4's zones for every enter and leave; 4.11 teaches Rapier's sensors as a concept, with their
   one-step lag as the reason not to adopt them; 5.16's spheres are announced as replaced in 6.4.
   **Why not Rapier's sensors:** Rapier reports them after its step, and a body just placed is missing from its queries
   for one step (one of the engine findings the tutorial made): the rules would learn a step late; and it reports in its
   own order, while a replay needs ours (by id, in the same step). A zone of our own is "the centre, in the zone's space,
   is inside a box" (1.11's idea), a few multiplications, with no physical body: it works for the kinematic character and
   for what is not Rapier's. **Note in:** 4.11 (which teaches the sensors and measures their lag) and 6.4.
6. **Effects.** 4.11 keeps the toy engine "for effects", hashed; 6.11, 8.16 and 8.17 make sparks, glass and dust
   view-only. Recommended: view-only effects; the toy engine survives as `physics.engine toy`.
   **Why:** effects can still be born from a seed taken from the event that causes them, so a replay looks the same; they
   are only not part of the simulated state. In the hash, changing the number of sparks would break every recorded
   replay and two tabs' agreement over a cosmetic choice, and thousands of particles would weigh on every hash and every
   snapshot sent over the network. The same principle as the console's kinds (decision 0010): what is only seen never
   touches the hash. **Note in:** 6.11 and 8.16.
7. **The motor.** 5.2's `moveToward` approaches at a constant acceleration (Manifold's measured choice); 7.1 analyses
   "5.2's motor" as the exponential e^(−h/τ), and its damping ratio does not hold for the other. Recommended: keep 5.2's
   motor and rewrite 7.1, with the exponential motor as its toggle; 2.3's and 2.8's "Dónde Manifold eligió otra cosa"
   say so.
   **Why:** the exponential never reaches the wanted speed (it approaches forever, and "skates" at the end); constant
   acceleration reaches it in a finite time, _v_/_a_, and stops in a fixed distance, _v_²/2_a_, the two numbers a
   designer tunes ("half a second to full speed, a metre to stop"); Manifold chose it after measuring, and in the hash it
   needs only + − × ÷ and a clamp. The analysis is not lost: 7.1 keeps the exponential motor behind a toggle, and its
   lesson becomes what the linear model predicts (ζ) against what the saturating motor does: linearizing, and where it
   stops holding. The exponential stays in 2.3, where it belongs (smoothing values and the camera). **Note in:** 5.2 and
   7.1.
8. **A module map, fixed now.** One `view/` folder for all drawing code (1.3's `view.ts` becomes `view/view.ts`);
   `stepWorld` stays in `world.ts` (4.11 moves it); one `physics/rapier.ts`, its force, impulse, controller and joint
   functions named in the lessons that create them (4.13, 4.14, 5.2, 5.11, 10.4 use them unnamed); 8.13's drawing
   `materials.ts` renamed (4.6 has the physical one); 6.16 reuses `toScreen` under another name for its edge marker;
   10.4's `fromTo` extends 1.16's `shortestArc`; `nav/` inside `mind/`; the camera stays in `view/camera.ts`; one state
   machine module (2.13's, grown with parents and history in 7.12, used by 5.6's modes); `falloff`, `spotFactor` and
   `show.senses` born in 6.16.

## Fixes with an obvious answer

These need no decision and are applied when each part is written:

- Watchers (6.16) keep 1.16's quaternions, not yaw and pitch.
- 7.9's visibility _V_ is 6.8's illuminance in lux against its threshold _T_, not a pure number.
- `Noise` carries a loudness from 6.10 (7.10 and 7.12 use it), and hearing uses a linear gain.
- The logic's fog (6.8's "Más a fondo") moves into 6.8's main path: 8.17 depends on it.
- 9.4's racers are characters (5.2), not balls.
- Missing prerequisites: 7.1 ← 5.2; 7.10 ← 6.10; 6.16 ← 2.6 (`trackStep`); 10.4 ← the lesson that creates
  `gravityAt` and 4.11's force functions.
- 5.4 owns the ladder of state machines up to superstates; 7.8 owns history, pushdown, interruption and suspicion.
- 6.8 owns the light meter and the four sight tests; 7.9 recalls them and adds the knowledge model; 7.12's `see` calls
  6.16's `sees`.
- 3.17's `wallsOf` and 6.3's `mergeRectangles` are one function; 6.7's `Lift` is a kind of 5.11's `Platform`;
  `show.vision` and `show.senses` are one overlay.
- New random streams (3.17, 4.14, 7.14, 9.10) take seeds from a hash of the master seed and the system's name (2.10),
  so a new stream never shifts the earlier ones.
- The TypeScript page cites the console's `Variable<T>`; 2.6 has `registerVar`: they agree when 2.6 is written.
