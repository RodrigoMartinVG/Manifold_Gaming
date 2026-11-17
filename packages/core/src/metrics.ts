import { vec3 } from '@manifold/common';
import { CHARACTER_GAP, CLIMBS_DEGREES, STANDS_DEGREES, STEP_UP } from './physics';
import { CROUCHED, crouchPoseOf } from './character';
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
 */
export interface Metrics {
  /** Its jump: how high its feet rise (m), at which step, and at which step they are back as high as they left. */
  jump: { height: number; continuous: number; top: number; back: number };
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
  /** Its body: how wide, how tall standing and crouched (m), and the gap it keeps from what it touches. */
  width: number;
  tall: number;
  crouched: number;
  gap: number;
}

type Capsule = Extract<Shape, { kind: 'capsule' }>;

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
  const v = movement.jump.speed;
  const g = gravity;
  const height = (n: number) => dt * (n * v - (g * dt * n * (n + 1)) / 2);
  const top = Math.floor(v / (g * dt));
  let back = Math.ceil((2 * v) / (g * dt) - 1);
  // (The closed form can land on a step where the height is a hair above zero: the first one at or below.)
  while (height(back) > 0) back++;
  const tall = 2 * (shape.halfHeight + shape.radius);
  return {
    jump: { height: height(top), continuous: (v * v) / (2 * g), top, back },
    reach: { walk: movement.walk.speed * back * dt, run: movement.walk.run * back * dt },
    step: STEP_UP,
    // (The angles the physics' cosines are made from: 30° and 50°.)
    slope: STANDS_DEGREES,
    climb: CLIMBS_DEGREES,
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
