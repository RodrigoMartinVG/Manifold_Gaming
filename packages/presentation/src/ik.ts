import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';

/**
 * ONE SOLVER FOR EVERY LIMB (stage 4a): a two-bone chain (a thigh and its shin, an upper arm and its
 * forearm) turned so that its end (a sole, a hand) reaches a point. Feet on the ground (feet.ts), hands
 * on a wall, a ledge or what is held (hands.ts), and, from 4b, the hands on a weapon. Only the view: the
 * world is not touched, and nothing of a pose reaches the hash (hits are tested against simple shapes).
 *
 * The law of cosines gives where the middle joint goes. Two things make it a body's:
 *
 * - A soft stretch. With bones a and b, the bend at the middle joint for a target at distance d is
 *   β(d) = π − arccos((a² + b² − d²) / 2ab), whose speed dβ/dd = d / (ab sin(π − β)) has no bound as d
 *   reaches a + b: a knee or an elbow snaps straight (the "IK pop"). No solution can both reach every d up
 *   to a + b exactly and keep that speed bounded, since reaching exactly fixes β; one has to give: fall
 *   short, lengthen the bones, or move the root. Here the end falls short, a little: past a distance
 *   d_soft, the chain reaches d' = d_soft + (L − d_soft)(1 − e^(−(d − d_soft)/(L − d_soft))) instead of d
 *   (L = a + b), which matches d and its slope at d_soft and tends to L without ever arriving. How
 *   short it falls at full reach is (L − d_soft)/e: each limb says how much it may (`slack`), and that
 *   gives its d_soft.
 * - Joint limits by swing and twist. A bone's turn q is split into a twist about the bone's own axis and
 *   a swing that tilts that axis: q = swing ⊗ twist. The swing is limited by where the axis points (a
 *   cone around a direction of the parent's: a hip, a shoulder), the twist by its angle. (Euler angles
 *   would do it worse: their limits depend on their order, and they lock at 90°.) Each of the solver's
 *   turns is the least one that takes a bone where it must point, about an axis across the bone, never
 *   about it; and still the twist drifts, because swings do not compose into swings: two in a row also
 *   twist, by the area of the triangle they make on the sphere of directions (the holonomy of parallel
 *   transport). So the twist is clamped too, measured from the cone's center: from there, every swing
 *   the cone allows is less than a half turn, where the split is defined (from a bone's rest, an arm
 *   raised overhead is a half turn, and its twist is not).
 */

/** Where the soft stretch puts the end, for a target at `d` from the root: d itself up to `soft`, then towards `reach` without arriving. */
export function softDistance(d: number, reach: number, soft: number): number {
  if (d <= soft || soft >= reach) return Math.min(d, reach);
  const band = reach - soft;
  return soft + band * (1 - Math.exp(-(d - soft) / band));
}

/** The bend at the middle joint (radians; 0 is straight) of bones `a` and `b` whose ends are `d` apart. */
export function bendOf(a: number, b: number, d: number): number {
  const cos = (a * a + b * b - d * d) / (2 * a * b);
  return Math.PI - Math.acos(Math.min(1, Math.max(-1, cos)));
}

/** How far apart the ends of bones `a` and `b` are when the middle joint bends `bend` radians. */
export function spanOf(a: number, b: number, bend: number): number {
  return Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos(bend)));
}

/**
 * The twist of `q` about the unit `axis` (radians, from −π to π): the turn about the axis left when the
 * axis's own tilt (the swing) is taken away, so that q = swing ⊗ twist. Undefined when the swing is a
 * half turn (the axis turned to point backwards): then 0.
 */
export function twistOf(q: THREE.Quaternion, axis: THREE.Vector3): number {
  const p = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  if (p * p + q.w * q.w < 1e-12) return 0;
  let angle = 2 * Math.atan2(p, q.w);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle <= -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/** Splits `q` into `swing` and `twist` about the unit `axis` (q = swing ⊗ twist), writing them into the two given. */
export function swingTwist(q: THREE.Quaternion, axis: THREE.Vector3, swing: THREE.Quaternion, twist: THREE.Quaternion): void {
  twist.setFromAxisAngle(axis, twistOf(q, axis));
  swing.copy(q).multiply(twist.clone().invert());
}

/**
 * How far a joint may turn: a cone for its axis, and, if it says so, a range for its twist about it,
 * measured from a turn of its own (a twist measured from a swing of a half turn is not defined: from a
 * reference whose axis is the cone's center, every swing the cone allows is less than that).
 */
export interface JointLimit {
  /** The cone's center: where the bone may point, in its parent's frame (unit). */
  center: THREE.Vector3;
  /** The cone's half angle (radians). */
  cone: number;
  /** The twist's least and most (radians), and the turn (in the parent's frame) it is measured from. */
  twist?: { range: readonly [number, number]; from: THREE.Quaternion };
}

/** A bone's own axis, from its head to its tail (glTF and Blender: +Y). */
export const BONE_AXIS: Readonly<THREE.Vector3> = new THREE.Vector3(0, 1, 0);

const dir = new THREE.Vector3();
const edge = new THREE.Vector3();
const across = new THREE.Vector3();
const arc = new THREE.Quaternion();
const rel = new THREE.Quaternion();
const sw = new THREE.Quaternion();
const tw = new THREE.Quaternion();
const inverse = new THREE.Quaternion();

/**
 * Keeps a bone's turn (its `quaternion`, in its parent's frame) within `limit`. The swing: if its axis
 * points outside the cone, it is brought to the cone's edge by the least turn, along the great circle
 * through the center, which leaves its twist from the center as it was (its three directions on one
 * circle enclose no area). The twist, if the limit has a range: clamped to it, the swing kept. Returns
 * whether it had to.
 */
export function limitJoint(quaternion: THREE.Quaternion, limit: JointLimit): boolean {
  let bound = false;
  dir.copy(BONE_AXIS).applyQuaternion(quaternion);
  const angle = dir.angleTo(limit.center);
  if (angle > limit.cone) {
    across.crossVectors(limit.center, dir);
    // Pointing straight away from the center: any side will do.
    if (across.lengthSq() < 1e-12) across.set(1, 0, 0).cross(limit.center);
    if (across.lengthSq() < 1e-12) across.set(0, 0, 1).cross(limit.center);
    edge.copy(limit.center).applyAxisAngle(across.normalize(), limit.cone);
    quaternion.premultiply(arc.setFromUnitVectors(dir, edge));
    bound = true;
  }
  if (limit.twist) {
    const { range, from } = limit.twist;
    rel.copy(inverse.copy(from).invert()).multiply(quaternion);
    const twist = twistOf(rel, BONE_AXIS);
    const clamped = Math.min(range[1], Math.max(range[0], twist));
    if (clamped !== twist) {
      swingTwist(rel, BONE_AXIS, sw, tw);
      tw.setFromAxisAngle(BONE_AXIS, clamped);
      quaternion.copy(from).multiply(sw.multiply(tw));
      bound = true;
    }
  }
  return bound;
}

/** A limb as a model describes it, by its bones' names. */
export interface LimbSpec {
  /** The upper bone (a thigh, an upper arm) and the lower one (a shin, a forearm), by name. */
  upper: string;
  lower: string;
  /** Where its end (a sole, a hand) is in the lower bone's frame. */
  end: Vec3;
  /** How far short of a target at full reach its end may stay (m): how soft its stretch is. */
  slack: number;
  /** The most its middle joint bends (radians). */
  bend: number;
  /** Where the middle joint goes when the pose gives no side (the limb straight), in the model's frame: forward for a knee, back for an elbow. */
  pole: Vec3;
  /**
   * Its upper bone's limits: the cone's center in the model's frame at rest, its half angle, and the
   * twist's least and most, measured from the bone at rest swung to the cone's center (radians).
   */
  limit: { center: Vec3; cone: number; twist: readonly [number, number] };
}

/** A limb of one copy of a model: its bones, and what the solver needs of them. */
export interface Limb {
  readonly spec: LimbSpec;
  readonly upper: THREE.Object3D;
  readonly lower: THREE.Object3D;
  readonly end: THREE.Vector3;
  /** Its two bones' lengths (from the upper's joint to the lower's, and from that to the end). */
  readonly a: number;
  readonly b: number;
  /** Where its stretch starts to give: the reach less e times the slack. */
  readonly soft: number;
  /** Its upper bone's limits, in its parent's frame. */
  readonly limit: JointLimit;
}

/**
 * A copy's limb, from its bones at rest (right after the copy is made, before any animation). Null if the
 * model does not have those bones.
 */
export function limbOf(object: THREE.Object3D, spec: LimbSpec): Limb | null {
  const upper = object.getObjectByName(spec.upper);
  const lower = object.getObjectByName(spec.lower);
  if (!upper?.parent || !lower) return null;
  object.updateMatrixWorld(true);
  const root = upper.getWorldPosition(new THREE.Vector3());
  const middle = lower.getWorldPosition(new THREE.Vector3());
  const tip = lower.localToWorld(new THREE.Vector3(...spec.end));
  const a = root.distanceTo(middle);
  const b = middle.distanceTo(tip);
  // The cone's center, from the model's frame to the parent's (both at rest).
  const parent = upper.parent.getWorldQuaternion(new THREE.Quaternion());
  const model = object.getWorldQuaternion(new THREE.Quaternion());
  const center = new THREE.Vector3(...spec.limit.center).normalize().applyQuaternion(model).applyQuaternion(parent.invert());
  // Where its twist is measured from: its rest, swung (the least turn) so that its axis is the center.
  const axis = BONE_AXIS.clone().applyQuaternion(upper.quaternion);
  const from = new THREE.Quaternion().setFromUnitVectors(axis, center).multiply(upper.quaternion);
  return {
    spec,
    upper,
    lower,
    end: new THREE.Vector3(...spec.end),
    a,
    b,
    soft: a + b - Math.E * spec.slack,
    limit: { center, cone: spec.limit.cone, twist: { range: spec.limit.twist, from } },
  };
}

/** What the solver did for a limb, for the tests and the `show.ik` view. */
export interface Reached {
  /** How far the target was from the root, over the limb's reach (1: at full reach). */
  ratio: number;
  /** The bend it gave the middle joint (radians). */
  bend: number;
  /** How far its end stayed from the target (m): what the soft stretch, the limits and the weight left. */
  missed: number;
  /** Whether a joint's limit held it. */
  limited: boolean;
}

const root = new THREE.Vector3();
const middle = new THREE.Vector3();
const tip = new THREE.Vector3();
const toward = new THREE.Vector3();
const line = new THREE.Vector3();
const side = new THREE.Vector3();
const joint = new THREE.Vector3();
const aim = new THREE.Vector3();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const upperBefore = new THREE.Quaternion();
const lowerBefore = new THREE.Quaternion();

/**
 * Turns a limb so that its end reaches `target` (the world's), as far as its stretch and its limits let
 * it, mixed with the pose it had by `weight` (0, the animation's; 1, the solver's). The middle joint goes
 * on the side the pose bends it (the animation's knee, the animation's elbow), or the limb's pole when
 * the pose is straight. The object's matrices must be the frame's (its place, its animations).
 */
export function reach(object: THREE.Object3D, limb: Limb, target: THREE.Vector3, weight = 1): Reached {
  const { upper, lower, a, b } = limb;
  upper.getWorldPosition(root);
  lower.getWorldPosition(middle);
  lower.localToWorld(tip.copy(limb.end));
  const full = a + b;
  toward.subVectors(target, root);
  const d = toward.length();
  if (weight <= 0 || d < 1e-9)
    return { ratio: d / full, bend: bendOf(a, b, root.distanceTo(tip)), missed: tip.distanceTo(target), limited: false };
  upperBefore.copy(upper.quaternion);
  lowerBefore.copy(lower.quaternion);
  // How far the end goes: softly towards full reach, and not so close that the joint bends past its most.
  const span = Math.min(
    Math.max(softDistance(d, full, limb.soft), spanOf(a, b, limb.spec.bend), Math.abs(a - b) + 1e-6),
    full - 1e-9,
  );
  toward.divideScalar(d);
  // The middle joint away from the line from the root to the end, as the pose has it; then square with the
  // new line.
  line.subVectors(tip, root).normalize();
  side.subVectors(middle, root);
  side.addScaledVector(line, -side.dot(line));
  side.addScaledVector(toward, -side.dot(toward));
  if (side.lengthSq() < 1e-10) {
    side.set(...limb.spec.pole).transformDirection(object.matrixWorld);
    side.addScaledVector(toward, -side.dot(toward));
  }
  side.normalize();
  const cos = (a * a + span * span - b * b) / (2 * a * span);
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  joint
    .copy(root)
    .addScaledVector(toward, a * cos)
    .addScaledVector(side, a * sin);
  turn(upper, from.subVectors(middle, root), to.subVectors(joint, root));
  // The upper bone's limits; if they held it, the lower bone aims from where the joint really is.
  const limited = limitJoint(upper.quaternion, limb.limit);
  upper.updateMatrixWorld(true);
  lower.getWorldPosition(middle);
  lower.localToWorld(tip.copy(limb.end));
  aim.copy(root).addScaledVector(toward, span);
  turn(lower, from.subVectors(tip, middle), to.subVectors(aim, middle));
  if (weight < 1) {
    upper.quaternion.slerpQuaternions(upperBefore, upper.quaternion.clone(), weight);
    lower.quaternion.slerpQuaternions(lowerBefore, lower.quaternion.clone(), weight);
    upper.updateMatrixWorld(true);
  }
  lower.getWorldPosition(middle);
  lower.localToWorld(tip.copy(limb.end));
  return { ratio: d / full, bend: bendOf(a, b, root.distanceTo(tip)), missed: tip.distanceTo(target), limited };
}

/** Where a limb's root is (the world's): its upper bone's joint, a hip or a shoulder. */
export const rootOf = (limb: Limb, out: THREE.Vector3): THREE.Vector3 => limb.upper.getWorldPosition(out);

/** Where a limb's end is (the world's): a sole, a hand. */
export const endOf = (limb: Limb, out: THREE.Vector3): THREE.Vector3 => limb.lower.localToWorld(out.copy(limb.end));

const delta = new THREE.Quaternion();
const worldTurn = new THREE.Quaternion();
const parentTurn = new THREE.Quaternion();

/** Turns a bone (in the world) by the least turn that takes the direction `a` to `b` (`a` along the bone: a turn across it, never about it). */
export function turn(bone: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  delta.setFromUnitVectors(a.normalize(), b.normalize());
  bone.getWorldQuaternion(worldTurn);
  bone.parent!.getWorldQuaternion(parentTurn);
  bone.quaternion.copy(parentTurn.invert().multiply(delta.multiply(worldTurn)));
  bone.updateMatrixWorld(true);
}
