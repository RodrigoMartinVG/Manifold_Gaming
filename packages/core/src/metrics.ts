import { vec3 } from '@manifold/common';
import { CHARACTER_GAP, CLIMBS_DEGREES, STANDS_DEGREES, STEP_UP } from './physics';
import { arcOf, CROUCHED, crouchPoseOf, handsOf, pulled } from './character';
import { gravityAt } from './gravity';
import { STEP, type World } from './world';
import type { Entity, Movement, Shape } from './types';

/**
 * WHAT A CHARACTER CAN DO, IN METERS (stage 5a, the metrics gym; decision 0017: levels are designed by
 * measure): from its movement, its shape and the world's gravity, as the step integrates them. The
 * gym (`games/dojo/levels/gym.level`) measures the same in the simulation, and a test holds the two
 * together; a game that changes its character's numbers reads its levels' sizes here.
 *
 * The jump, in steps of Δt: the step adds gravity to the velocity first, and then moves by it (the
 * semi-implicit order), so after k steps the velocity is v − k g Δt and the height
 *
 *     y(n) = Δt Σ_{k=1}^{n} (v − k g Δt) = Δt (n v − g Δt n(n+1)/2),
 *
 * highest at N = ⌊v / (g Δt)⌋ (the last step it still rises), and back where it left at the first n with
 * y(n) ≤ 0, n = ⌈2v / (g Δt) − 1⌉. The continuous v² / 2g is higher by about v Δt / 2.
 *
 * With the platformer's arc (stage 5c, `arcOf`), its own gravity and speed bring its feet exactly its
 * height up in its steps; it falls under a stronger gravity and no faster than its top speed, so the
 * way down is worked out as the step does it, one step after another (the closed form above still
 * holds without the arc, and a test holds the two together). (Stage 5p) With its hang at the top, the
 * jump held: the step where it would start down, and `arc.hang` after it, its velocity up is 0.
 */
export interface Metrics {
  /**
   * Its jump: how high its feet rise (m), at which step, and at which step they are back as high as
   * they left; the continuous v² / 2g (without the arc); and the gravity it rises under and its speed up.
   */
  jump: { height: number; continuous: number; top: number; back: number; gravity: number; speed: number };
  /** How far its center goes in a jump that lands as high as it left, keeping its speed: walking, running (m). */
  reach: { walk: number; run: number };
  /**
   * The highest step it walks up (m): the controller's, which its round foot takes a little past (the
   * gym: 0.4 m). The steepest ground it stands on without sliding, and the steepest it walks up, pushing
   * against the slide (degrees).
   */
  step: number;
  slope: number;
  climb: number;
  /**
   * Off a wall (stage 5c): the fastest it slides down one, and how fast a jump takes it away; and the
   * widest gap between two walls it climbs, leaping from one to the other walking (m): its body from
   * wall to wall, and how far its middle goes before its feet are back as high as they left (the speed
   * off the wall kept for its lock, then the air's steering towards walking's speed, step by step).
   * The highest ledge its hands reach at the top of a jump from standing (m: its jump, its feet's gap,
   * and its hands, 30 cm under the top of its head), and so the highest it grabs.
   */
  wall: { slide: number; off: number; chimney: number };
  ledge: number;
  /** Its body: how wide, how tall standing and crouched (m), and the gap it keeps from what it touches. */
  width: number;
  tall: number;
  crouched: number;
  gap: number;
}

type Capsule = Extract<Shape, { kind: 'capsule' }>;

/**
 * The widest gap between two walls it climbs (stage 5c), walking: off one wall at `wall.off`, which it
 * keeps the step it leaps and the `wall.lock` after it (the steps its lock still counts when it steers:
 * all but the last), then steered towards walking's speed by the air's `control`; as far as its middle
 * goes in the `back` steps its jump takes to come back to its height, and its body from wall to wall
 * (a radius and the controller's gap on each side).
 */
function chimneyOf(movement: Movement, shape: Capsule, back: number, dt: number): number {
  const locked = Math.round(movement.wall.lock / dt);
  let v = movement.wall.off;
  let across = 0;
  for (let n = 1; n <= back; n++) {
    if (n > locked) {
      const most = movement.air.control * dt;
      v = Math.abs(v - movement.walk.speed) <= most ? movement.walk.speed : v + Math.sign(movement.walk.speed - v) * most;
    }
    across += v * dt;
  }
  return across + 2 * (shape.radius + CHARACTER_GAP);
}

/**
 * From a character's numbers: its movement, its standing capsule, the gravity's strength, and its
 * crouched body if its game gives one (the games' character: 1.1 m tall), as the controller moves it.
 */
export function metricsOf(
  movement: Movement,
  shape: Capsule,
  gravity: number,
  o: { crouch?: Capsule; dt?: number } = {},
): Metrics {
  const dt = o.dt ?? STEP;
  const arc = movement.arc;
  const arced = arc ? arcOf(arc, dt) : null;
  const v = arced ? arced.speed : movement.jump.speed;
  const g = arced ? arced.gravity : gravity;
  let top: number;
  let back: number;
  let height: number;
  if (!arc) {
    const at = (n: number) => dt * (n * v - (g * dt * n * (n + 1)) / 2);
    top = Math.floor(v / (g * dt));
    back = Math.ceil((2 * v) / (g * dt) - 1);
    // (The closed form can land on a step where the height is a hair above zero: the first one at or below.)
    while (at(back) > 0) back++;
    height = at(top);
  } else {
    // As the step does it: the velocity first, under the gravity of rising or of falling, no faster down
    // than its top speed; then the height.
    // (The character's own rule, `pulled`: the jump held all the way, its hang at the top too.)
    let up = v;
    let y = 0;
    let hung: number | undefined;
    height = 0;
    top = 0;
    back = 0;
    for (let n = 1; n < 100_000; n++) {
      const next = pulled(up, g * (up > 0 ? 1 : arc.fall), dt, { hang: arc.hang, hung, holding: true, leaping: up > 0 });
      hung = next.hung;
      up = next.hung !== undefined ? next.vUp : Math.max(next.vUp, -arc.terminal);
      y += up * dt;
      if (y > height) {
        height = y;
        top = n;
      }
      if (y <= 0) {
        back = n;
        break;
      }
    }
  }
  const tall = 2 * (shape.halfHeight + shape.radius);
  return {
    jump: { height, continuous: (v * v) / (2 * g), top, back, gravity: g, speed: v },
    reach: { walk: movement.walk.speed * back * dt, run: movement.walk.run * back * dt },
    step: STEP_UP,
    // (The angles the physics' cosines are made from: 30° and 50°.)
    slope: STANDS_DEGREES,
    climb: CLIMBS_DEGREES,
    wall: { slide: movement.wall.slide, off: movement.wall.off, chimney: chimneyOf(movement, shape, back, dt) },
    ledge: height + CHARACTER_GAP + handsOf(shape) + shape.halfHeight + shape.radius,
    width: 2 * shape.radius,
    tall,
    crouched: o.crouch ? 2 * (o.crouch.halfHeight + o.crouch.radius) : Math.max(2 * shape.radius, tall * CROUCHED),
    gap: CHARACTER_GAP,
  };
}

/**
 * A character's, where it is (the console's `metrics`): its movement, its capsule, its crouched body (the
 * one the controller moves crouching) and the gravity's strength at its feet. Null if it is not a
 * character in a capsule, or there is no gravity there (a jump that does not come down has no reach).
 */
export function metricsOfEntity(world: World, e: Entity): Metrics | null {
  const c = e.character;
  const body = e.body;
  if (!c || !body || body.shape.kind !== 'capsule' || !e.transform) return null;
  const g = vec3.length(gravityAt(world.gravity, e.transform.position));
  if (!(g > 0)) return null;
  const low = crouchPoseOf(c, body).shape;
  return metricsOf(c.movement, body.shape, g, { crouch: low.kind === 'capsule' ? low : undefined });
}
