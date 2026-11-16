import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import { reach, rootOf, type Limb, type LimbSpec } from './ik';
import { FAMILIES, type Footing } from './locomotion';

/**
 * FEET THAT STAY WHERE THEY STAND (after the tutorial's pass). The cycles are made so that a foot on the
 * ground goes back under the hips exactly as fast as the body goes on (art/mannequin.py), and the presentation plays
 * them by the distance travelled, one cycle per stride (locomotion.ts): walking straight in any of the
 * four directions, the foot down stays put by itself. But between two directions the cycles are mixed,
 * and the mixer mixes the bones' turns, not where the feet are: two legs reaching out at a slant, mixed,
 * make a leg that points between them and is too long for it. Half forward and half to a side, the foot
 * went 3 cm into the floor at the ends of its time down, came down early while still swinging, and slid
 * a meter a second.
 *
 * So the feet are mixed where they are, not by their bones' turns: each cycle's path of each foot is read
 * once from the model (`footPaths`), and the view puts each foot where the cycles' feet are, mixed with
 * the cycles' weights (`mixedFeet`), turning its leg to reach it (two bones, the knee bending as the
 * animation bends it: ik.ts). That is the mix the strides assume, so a foot down already stays put; and
 * a foot that is down is also kept where it came down (a change of speed or of direction moves the mix a
 * little), until it lifts, or until the body has gone too far from it (stage 4a: beyond 1.05 of the
 * leg's reach, it lets go). Only the view: the world is not touched.
 */

const deg = THREE.MathUtils.degToRad;

/**
 * A mannequin's leg (art/mannequin.py: two bones of 0.36 m, the sole at the end of the shin), as the
 * solver takes it (ik.ts). Its stretch gives 1 mm at full reach: a third of the frames walking straight
 * have the leg down at its full reach or past it (measured, stage 4a), and a foot on the floor that
 * stayed a centimeter short would float. The knee bends at most 150°, forward when the leg is straight;
 * the thigh points within 100° of down and a little forward (the ground's animations, within 50°), and
 * twists at most 45° either way.
 */
const leg = (side: 'L' | 'R'): LimbSpec => ({
  upper: `thigh_${side}`,
  lower: `shin_${side}`,
  end: [0, 0.36, 0],
  slack: 0.001,
  bend: deg(150),
  pole: [0, 0, -1],
  limit: { center: [0, -1, -0.35], cone: deg(100), twist: [deg(-45), deg(45)] },
});
export const LEGS: Readonly<Record<'L' | 'R', LimbSpec>> = { L: leg('L'), R: leg('R') };

/** How far from a foot that is down its hip may go before the foot lets go, over the leg's reach. */
export const LET_GO = 1.05;

/** Where the soles are when the model stands, along its up (its origin is the capsule's center). */
export const SOLE_HEIGHT = -0.8;

/** The animations whose feet are mixed where they are: the ones on the ground (the others' feet are theirs). */
export const GROUND_CLIPS: readonly string[] = ['idle', 'turn', ...FAMILIES.walk, ...FAMILIES.run];

/** How many points of each cycle a foot's path keeps (the cycles have 32 keys). */
const SAMPLES = 128;

/** How close to the floor a foot that is lifting must still be to stay where it stood (m). */
const TOUCH = 0.003;

/** How long a foot that lifts takes to go from where it stood back to the mix (s). */
const RELEASE = 0.12;

/** Each ground animation's feet over its cycle (the model's own frame): left x y z, right x y z, per point. */
export type FootPaths = ReadonlyMap<string, Float32Array>;

const SIDES = ['L', 'R'] as const;

/**
 * Reads each ground animation's foot paths from a copy of the model (`object` standing at the origin,
 * its `actions` playing at no speed): every animation alone, at `SAMPLES` points of its length. Leaves
 * them as a new copy has them (quiet, at 0 s).
 */
export function footPaths(
  object: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  actions: ReadonlyMap<string, THREE.AnimationAction>,
): FootPaths {
  const paths = new Map<string, Float32Array>();
  const shins = SIDES.map((side) => object.getObjectByName(LEGS[side].lower));
  if (shins.some((s) => !s)) return paths;
  const at = new THREE.Vector3();
  for (const name of GROUND_CLIPS) {
    const action = actions.get(name);
    if (!action) continue;
    for (const a of actions.values()) a.setEffectiveWeight(a === action ? 1 : 0);
    const path = new Float32Array(SAMPLES * 6);
    for (let i = 0; i < SAMPLES; i++) {
      action.time = (i / SAMPLES) * action.getClip().duration;
      mixer.update(0);
      object.updateMatrixWorld(true);
      SIDES.forEach((side, k) => {
        object.worldToLocal(shins[k]!.localToWorld(at.set(...LEGS[side].end)));
        path.set([at.x, at.y, at.z], i * 6 + k * 3);
      });
    }
    paths.set(name, path);
  }
  for (const a of actions.values()) {
    a.time = 0;
    a.setEffectiveWeight(a.getClip().name === 'idle' ? 1 : 0);
  }
  mixer.update(0);
  return paths;
}

/**
 * Where the feet are in the mix the actions play now (the model's frame): each ground animation's foot,
 * at its time, weighed as it plays; the rest of the weight, where the mixer put the foot (`animated`).
 */
export function mixedFeet(
  paths: FootPaths,
  actions: ReadonlyMap<string, THREE.AnimationAction>,
  animated: Readonly<Record<'L' | 'R', THREE.Vector3>>,
): Record<'L' | 'R', THREE.Vector3> {
  const out = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  let weighed = 0;
  for (const [name, path] of paths) {
    const action = actions.get(name)!;
    const w = action.getEffectiveWeight();
    if (w <= 0) continue;
    weighed += w;
    const u = ((((action.time / action.getClip().duration) % 1) + 1) % 1) * SAMPLES;
    const i = Math.floor(u) % SAMPLES;
    const j = (i + 1) % SAMPLES;
    const f = u - Math.floor(u);
    const point = (n: number) => w * (path[i * 6 + n]! * (1 - f) + path[j * 6 + n]! * f);
    out.L.x += point(0);
    out.L.y += point(1);
    out.L.z += point(2);
    out.R.x += point(3);
    out.R.y += point(4);
    out.R.z += point(5);
  }
  const rest = Math.max(0, 1 - weighed);
  out.L.addScaledVector(animated.L, rest);
  out.R.addScaledVector(animated.R, rest);
  return out;
}

/** What the view remembers of a foot from one frame to the next. */
export interface Foot {
  /** Where it stands (the world's coordinates), while it is down. */
  planted: THREE.Vector3 | null;
  /** Lifting: how far its leg's goal is from the mix's foot (the world's), fading to nothing. */
  leaving: { offset: THREE.Vector3; left: number } | null;
  /**
   * How far, the last frame, the view held it from where the cycles' feet, mixed, have it (m): while it is
   * down, how far the mix has gone from where it stands (what the tests read: with the right strides,
   * next to nothing).
   */
  held: number;
  /** Let go, the body too far from where it stood: it is not taken again until it lifts. */
  gone: boolean;
  /** Where the solver took it, the last frame (the world's), and what it did (for `show.ik`). */
  target: THREE.Vector3;
  ratio: number;
  missed: number;
}
export type Feet = Record<'L' | 'R', Foot>;

const newFoot = (): Foot => ({
  planted: null,
  leaving: null,
  held: 0,
  gone: false,
  target: new THREE.Vector3(),
  ratio: 0,
  missed: 0,
});
export const newFeet = (): Feet => ({ L: newFoot(), R: newFoot() });

const floor = new THREE.Vector3();
const upward = new THREE.Vector3();
const scratch = new THREE.Vector3();
const aim = new THREE.Vector3();
const hip = new THREE.Vector3();

/**
 * After the animations are applied to `object` (its place and turn already the frame's): each foot goes
 * where the cycles' feet are, mixed (`paths`, from `footPaths`); one that is down stays where it came
 * down, while its hip is within `LET_GO` of the leg's reach; one that lifts goes from there back to the
 * mix; and none goes under the floor plane. A foot is down in its time down (`where`: locomotion's
 * `footing`), and, lifting, while the mix still has it on the floor. (`dt`: the world's time; paused,
 * nothing changes, and the legs are turned as they were.)
 */
export function plant(
  object: THREE.Object3D,
  legs: Readonly<Record<'L' | 'R', Limb>> | null,
  paths: FootPaths,
  actions: ReadonlyMap<string, THREE.AnimationAction>,
  feet: Feet,
  where: Readonly<Record<'L' | 'R', Footing>>,
  up: Vec3,
  dt: number,
) {
  if (paths.size === 0 || !legs) return;
  object.updateMatrixWorld(true);
  // Where the mixer put each foot (the model's frame), and where the cycles' feet are, mixed (the world's).
  const animated = {
    L: object.worldToLocal(legs.L.lower.localToWorld(legs.L.end.clone())),
    R: object.worldToLocal(legs.R.lower.localToWorld(legs.R.end.clone())),
  };
  const mixed = mixedFeet(paths, actions, animated);
  object.localToWorld(mixed.L);
  object.localToWorld(mixed.R);
  object.localToWorld(floor.set(0, SOLE_HEIGHT, 0));
  upward.set(...up).normalize();
  /** How far a point is above the floor plane. */
  const above = (p: THREE.Vector3) => scratch.subVectors(p, floor).dot(upward);
  for (const side of SIDES) {
    const foot = feet[side];
    const limb = legs[side];
    const mix = mixed[side];
    const touching = above(mix) < TOUCH;
    const down = where[side] === 'down' || (where[side] === 'lifting' && touching && foot.planted !== null);
    if (where[side] === 'up') foot.gone = false;
    // The body too far from where the foot stood (carried off, pushed): it lets go until it lifts.
    if (foot.planted && rootOf(limb, hip).distanceTo(foot.planted) > LET_GO * (limb.a + limb.b)) foot.gone = true;
    let target: THREE.Vector3;
    if (down && !foot.gone) {
      foot.planted ??= mix.clone().addScaledVector(upward, -above(mix));
      foot.leaving = null;
      target = foot.planted;
    } else {
      if (foot.planted) foot.leaving = { offset: foot.planted.clone().sub(mix), left: RELEASE };
      foot.planted = null;
      if (foot.leaving && dt > 0) foot.leaving.left -= dt;
      if (foot.leaving && foot.leaving.left <= 0) foot.leaving = null;
      target = foot.leaving ? aim.copy(mix).addScaledVector(foot.leaving.offset, foot.leaving.left / RELEASE) : mix;
      // Never under the floor.
      const low = above(target);
      if (low < 0) target = aim.copy(target).addScaledVector(upward, -low);
    }
    foot.held = target.distanceTo(mix);
    foot.target.copy(target);
    const done = reach(object, limb, target);
    foot.ratio = done.ratio;
    foot.missed = done.missed;
  }
}
