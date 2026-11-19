import { quat, sinCosDegrees, vec3, type Quat, type Vec3 } from '@manifold/common';
import { gravityAt } from '../gravity';
import type { Character, Movement } from '../types';
import type { World } from '../world';

/** Goes from `now` towards `wanted`, changing at most `most` (m/s) in this step. */
export const approach = (now: Vec3, wanted: Vec3, most: number): Vec3 => {
  const diff = vec3.sub(wanted, now);
  const away = vec3.length(diff);
  return away <= most ? wanted : vec3.add(now, vec3.scale(diff, most / away));
};

export const isZero = (v: Vec3) => v[0] === 0 && v[1] === 0 && v[2] === 0;

/**
 * STEERING WHILE THROWN (stage 5g: an explosion jump, with control in the air). Of the velocity `now`
 * (along the ground), only its part along the way asked, `d` (`wanted` = w d, w its speed), changes: it
 * rises towards w by at most `most` this step, and never past it; the rest is kept. In numbers, with
 * u = now · d, the velocity is now + min(most, max(0, w − u)) d. So it turns what it was given (asked
 * across it, u = 0, it adds up to w across), slows it (asked against it, u < 0), but a way asked along a
 * velocity already past w adds nothing: what a blast gave is not added to without end (until 41, the
 * velocity went towards now + wanted, and asked along it, it grew by `most` every step, for as long as
 * it was in the air).
 */
export function airStrafe(now: Vec3, wanted: Vec3, most: number): Vec3 {
  const w = vec3.length(wanted);
  if (w < 1e-9) return now;
  const d = vec3.scale(wanted, 1 / w);
  const add = Math.min(most, Math.max(0, w - vec3.dot(now, d)));
  return vec3.add(now, vec3.scale(d, add));
}

/**
 * A PLATFORMER'S JUMP, IN STEPS (stage 5c): from its height h and its time to the top t, the gravity
 * g and the jump's speed v that, integrated as the step does (semi-implicit: the velocity first, then
 * the position), bring its feet exactly h up in N = t / Δt steps (rounded, two at least) and no
 * higher. After k steps its velocity up is v − k g Δt, and its height Δt (k v − g Δt k(k+1)/2). Asking
 * the velocity to be 0 at step N, and the height h there:
 *
 *     v = N g Δt,   h = g Δt² N(N − 1) / 2   ⇒   g = 2h / (N(N − 1) Δt²),   v = 2h / ((N − 1) Δt).
 *
 * (Its feet are at h at steps N − 1 and N: the last step up moves them by nothing.) The continuous
 * 2h / t² and 2h / t are a little less: the step loses half a step's rise.
 */
export function arcOf(arc: NonNullable<Movement['arc']>, dt: number): { gravity: number; speed: number; steps: number } {
  const n = Math.max(2, Math.round(arc.time / dt));
  return { gravity: (2 * arc.height) / (n * (n - 1) * dt * dt), speed: (2 * arc.height) / ((n - 1) * dt), steps: n };
}

/**
 * ONE STEP OF A RISE OR A FALL under `pull` (m/s²), the velocity up after it (stage 5.5e: the character's
 * and its metrics', one rule). (Stage 5p, decision 0031: forgiveness) With the arc's `hang` (s), at a
 * jump's top, the jump held: it hangs there, its velocity up 0, for that long (`hung`: the steps it still
 * hangs); let go, it falls at once. `holding`: the jump is held; `leaping`: it rises from a jump.
 */
export function pulled(
  vUp: number,
  pull: number,
  dt: number,
  o: { hang: number | undefined; hung: number; holding: boolean; leaping: boolean },
): { vUp: number; hung: number } {
  if (o.hang && o.hung > 0 && o.holding) return { vUp: 0, hung: o.hung - 1 };
  if (o.hang && o.leaping && o.holding && vUp > 0 && vUp - pull * dt <= 0) return { vUp: 0, hung: Math.round(o.hang / dt) };
  return { vUp: vUp - pull * dt, hung: 0 };
}

/**
 * CIRCLING WHAT IT IS LOCKED ON (stage 4f): what is asked to the side goes round it, at the same distance.
 * Straight to the side, the distance grows at every step (by d² / 2r, d the step's length, r the
 * distance): over a whole circle at 4.5 m/s, 3 m away, 1.5 m. So the step to the side goes along the
 * chord of the arc instead, turned in towards it by half the arc's angle: sin φ = d / 2r. With a square
 * root (the cosine from the sine), the same bits everywhere. What is asked towards it or away stays.
 */
export function circling(move: Vec3, to: Vec3, up: Vec3, speed: number, dt: number): Vec3 {
  const r = vec3.length(to);
  if (r < 0.3) return move;
  const towards = vec3.scale(to, 1 / r);
  const side = vec3.cross(towards, up);
  const radial = vec3.dot(move, towards);
  const across = vec3.dot(move, side);
  const sine = Math.min(0.5, (Math.abs(across) * speed * dt) / (2 * r));
  const cosine = Math.sqrt(1 - sine * sine);
  const sign = across < 0 ? -1 : 1;
  return vec3.add(vec3.scale(towards, radial + Math.abs(across) * sine), vec3.scale(side, sign * Math.abs(across) * cosine));
}

/** "Up" at a point: the opposite of the gravity there (if there is no gravity, +Y). */
export function upAt(world: World, position: Vec3): Vec3 {
  const g = gravityAt(world.gravity, position);
  const length = vec3.length(g);
  return length > 0 ? vec3.scale(g, -1 / length) : [0, 1, 0];
}

/**
 * HOW A PLATFORM CARRIES A POINT in one step (stage 2d). The physics moves a kinematic body by its
 * velocity times the step, and turns it around its center by its angular velocity times the step;
 * a point on it goes where that takes it: its arm (from the center) turned, plus the platform's
 * movement. The turn, with `quat.fromDegrees` (no browser trigonometry), is the physics' own one:
 * the whole angle, not an approximation, so a character on a carousel goes round with it, step
 * after step, without drifting out or falling behind. Also: the platform's velocity at that point.
 */
export function carriedBy(
  platform: { linear: Vec3; angular: Vec3; center: Vec3 },
  point: Vec3,
  dt: number,
): { movement: Vec3; velocity: Vec3; turn: Quat } {
  const speed = vec3.length(platform.angular);
  const turn =
    speed > 0 ? quat.fromDegrees(vec3.scale(platform.angular, 1 / speed), (speed * dt * 180) / Math.PI) : quat.identity();
  const arm = vec3.sub(point, platform.center);
  return {
    movement: vec3.add(vec3.scale(platform.linear, dt), vec3.sub(quat.rotate(turn, arm), arm)),
    velocity: vec3.add(platform.linear, vec3.cross(platform.angular, arm)),
    turn,
  };
}

/**
 * WHAT TO ASK FOR, TO LOOK SOMEWHERE (stage 2d): the `face` input that makes a character look along
 * `direction`, a direction in the world. `face` is read inside the turn the platforms gave the
 * character (`carriedTurn`), so whoever knows where it wants it to look in the world (an aiming
 * camera, a bot) asks for this, not for the direction itself. On no platform yet, it is the same.
 */
export function faceFor(c: Pick<Character, 'carriedTurn'>, direction: Vec3): Vec3 {
  return quat.rotate(quat.conjugate(c.carriedTurn), direction);
}

/**
 * WHERE A CHARACTER AIMS (stage 4b): where it looks, tilted by its pitch towards its "up" (`ahead`, of
 * length 1), and the aim's own up (`above`, square with it): what is thrown a little above the aim
 * goes along both. With our own sine and cosine, so the same bits in every browser. `up` is the
 * character's, of length 1 (`upAt`).
 */
export function aimOf(c: Pick<Character, 'facing' | 'pitch'>, up: Vec3): { ahead: Vec3; above: Vec3 } {
  const [sin, cos] = sinCosDegrees(c.pitch);
  return {
    ahead: vec3.add(vec3.scale(c.facing, cos), vec3.scale(up, sin)),
    above: vec3.sub(vec3.scale(up, cos), vec3.scale(c.facing, sin)),
  };
}

/**
 * Where it looks after turning `turn` (from −1 to 1, + to the right) during one step, WITHOUT
 * TRIGONOMETRY (stage 1c2). Turning an angle takes a sine and a cosine, and the standard lets every
 * JavaScript engine compute them its own way: the last bits can differ, and a replay would end
 * somewhere else in another browser. Instead: a little of its right side is added to where it looks,
 * and the result is brought back to length 1. Additions, multiplications and a square root, which give
 * the same bits everywhere.
 *
 * It turns atan(k) instead of k radians (k = the speed × the step × `turn`): at 3 rad/s and 60 steps
 * per second, k = 0.05, and the difference is less than a thousandth.
 */
export function turned(facing: Vec3, up: Vec3, turn: number, turnSpeed: number, dt: number): Vec3 {
  const ahead = vec3.onPlane(facing, up);
  if (vec3.length(ahead) < 1e-6) return facing; // looking straight up or down: there is no turning
  const right = vec3.cross(ahead, up);
  return vec3.normalize(vec3.add(ahead, vec3.scale(right, turnSpeed * dt * turn)));
}
