import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import type { Entity, World } from '@manifold/core';
import { rootOf, type Limb } from './ik';

/**
 * WHAT A CHARACTER CARRIES, DRAWN (stage 4c): a game says what each character has in its hands (a
 * `Tool`: its look, a box; where the hands go on it; a strike under way), and the view holds it in front
 * of the chest, along the aim as it is drawn (models.ts: `aimBody`), the arms brought to it by the IK
 * (hands.ts: the right hand first, the left one further along it). A strike turns it about the body's up
 * as the world sweeps it; at rest it points where it aims, raised by its `lift`. Only the view: the
 * world keeps what it carries in the game's own component, and never sees this.
 */
export interface Tool {
  /** Its look: a box this size (m: across, up, along), this color. */
  size: Vec3;
  color: number;
  /** Where the hands hold it, from its back end along it (m): the right hand, then the left one, if any. */
  grips: readonly number[];
  /** At rest, how far it points above the aim (degrees: a stick held up). */
  lift: number;
  /** A strike under way: its turn about the body's up from straight ahead (degrees, + to its right); at rest, null. */
  sweep: number | null;
  /** Blocking (stage 4f): held across in front of the chest, level, to take what comes. */
  block?: boolean;
  /**
   * (Stage 5g) Its model, by the name the game gives the presentation (`arms.dart`), drawn instead of the
   * box once it loaded: made to fit the box (`size`, centered on its origin, along it its +Z).
   */
  model?: string;
}

/** What each character carries, as a game says it (mount's `tools`). */
export type Tools = (world: World, e: Entity) => Tool | null;

/** Where a tool is drawn in a frame: its box, its far end (where a shot leaves it), where each hand goes. */
export interface ToolPose {
  center: THREE.Vector3;
  rotation: THREE.Quaternion;
  size: Vec3;
  color: number;
  /** Its model's name, if it has one (stage 5g). */
  model?: string;
  muzzle: THREE.Vector3;
  grips: { R: THREE.Vector3; L: THREE.Vector3 | null };
}

/** What a model remembers of its tool from one frame to the next: where it was drawn, its sweep and lift as drawn. */
export interface Holding {
  pose: ToolPose | null;
  sweep: number;
  lift: number;
  /**
   * First person (stage 4g): the tool is not drawn in the world (the camera draws it, with a field of view
   * of its own), and a tracer starts where the camera draws its tip.
   */
  inView: boolean;
  viewMuzzle: THREE.Vector3 | null;
  /** (Stage 5k) How far the walk's sway moves it in the view (m: right, up, back; sway.ts). */
  viewSway: THREE.Vector3;
  /** (Stage 5l) How far it is raised out of a wall in front of it, as drawn (degrees), and drawn back (m). */
  clear: number;
  drawnBack: number;
}
export const newHolding = (): Holding => ({
  pose: null,
  sweep: 0,
  lift: 0,
  clear: 0,
  drawnBack: 0,
  inView: false,
  viewMuzzle: null,
  viewSway: new THREE.Vector3(),
});

/**
 * Where the right hand holds a tool, from the middle between the shoulders, in the body's frame turned
 * by the aim: forward, to its right, up (m). Within both arms' reach (0.56 m) with the left hand up to
 * 0.15 m further along it.
 */
export const HOLD: Vec3 = [0.32, 0.05, -0.2];
/**
 * How fast the drawn sweep follows the world's (°/s: a strike sweeps 600); and the lift: down into a
 * strike at once (in three frames), back up after it slowly.
 */
const SWEEP_RATE = 1500;
const LOWER_RATE = 1000;
const RAISE_RATE = 300;
/**
 * (Stage 5l) Out of a wall: tried in steps of this many degrees up to the most, let down slowly (°/s: it
 * goes up at once, as if it glanced off); how near a wall its end may come (m).
 */
const CLEAR = { step: 10, most: 80, down: 240, gap: 0.04 };

const deg = THREE.MathUtils.degToRad;
const upward = new THREE.Vector3();
const right = new THREE.Vector3();
const forward = new THREE.Vector3();
const left = new THREE.Vector3();
const mid = new THREE.Vector3();
const offset = new THREE.Vector3();
const turn = new THREE.Quaternion();
const aimTurn = new THREE.Quaternion();
const basis = new THREE.Matrix4();
const x = new THREE.Vector3();
const y = new THREE.Vector3();

/** Moves `value` towards `wanted` by at most `rate · dt`. */
const towards = (value: number, wanted: number, step: number) => value + Math.max(-step, Math.min(step, wanted - value));

/**
 * After the aim is drawn and before the hands (models.ts: `animate`): where `tool` is drawn this frame, if
 * the character carries one (null, none), for a body drawn as `object` with its `arms`, aiming at
 * `pitch` degrees as drawn, its "up" `up`. Remembered in `holding`.
 *
 * (Stage 5l: the author saw weapons go through walls, facing one.) With `ray` (the surroundings' rays, the
 * level's surfaces), it does not go into a wall: where the line from its grip to its end would meet one, it
 * is raised about its own right as a person lifts a long thing in front of a wall, the least that clears
 * it (in steps of 10°, at most 80°), at once, and let down slowly once there is room; if even raised it
 * does not clear, it is drawn back towards the chest. Only the drawing: what it hits is the world's.
 */
export function holdTool(
  object: THREE.Object3D,
  arms: Readonly<Record<'L' | 'R', Limb>> | null,
  holding: Holding,
  tool: Tool | null,
  pitch: number,
  up: Vec3,
  dt: number,
  ray?: (from: THREE.Vector3, direction: THREE.Vector3, reach: number) => { point: THREE.Vector3 } | null,
): ToolPose | null {
  if (!tool || !arms) return (holding.pose = null);
  const sweep = tool.sweep ?? 0;
  const lift = tool.sweep === null ? tool.lift : 0;
  // Taken now: where it is wanted, at once; held, it follows.
  if (!holding.pose) {
    holding.sweep = sweep;
    holding.lift = lift;
  } else if (dt > 0) {
    holding.sweep = towards(holding.sweep, sweep, SWEEP_RATE * dt);
    holding.lift = towards(holding.lift, lift, (lift < holding.lift ? LOWER_RATE : RAISE_RATE) * dt);
  }
  object.updateMatrixWorld(true);
  upward.set(...up).normalize();
  right.set(1, 0, 0).transformDirection(object.matrixWorld);
  right.addScaledVector(upward, -right.dot(upward)).normalize();
  // (The body faces −Z: its forward is up × right.)
  forward.crossVectors(upward, right);
  mid.addVectors(rootOf(arms.L, left), rootOf(arms.R, offset)).multiplyScalar(0.5);
  aimTurn.setFromAxisAngle(right, deg(Number.isFinite(pitch) ? pitch : 0));
  turn.setFromAxisAngle(upward, -deg(holding.sweep));
  // The right hand: in front of the chest, turned with the aim, then with the sweep.
  offset
    .copy(forward)
    .multiplyScalar(HOLD[0])
    .addScaledVector(right, HOLD[1])
    .addScaledVector(upward, HOLD[2])
    .applyQuaternion(aimTurn)
    .applyQuaternion(turn);
  const gripR = mid.clone().add(offset);
  // Where it points: the aim, swept, and raised by the lift about its own right; blocking, across in
  // front (to its left), the right hand a little to its right and higher.
  const swungRight = right.clone().applyQuaternion(turn);
  const direction = tool.block
    ? right.clone().negate()
    : forward.clone().applyQuaternion(aimTurn).applyQuaternion(turn).applyAxisAngle(swungRight, deg(holding.lift));
  if (tool.block) gripR.copy(mid).addScaledVector(forward, 0.32).addScaledVector(right, 0.22).addScaledVector(upward, -0.05);
  // (Stage 5l) Out of a wall in front of it.
  if (ray && !tool.block) {
    const length = tool.size[2] - (tool.grips[0] ?? 0) + CLEAR.gap;
    const freeAlong = (from: THREE.Vector3, d: THREE.Vector3, reach: number) =>
      ray(from, d, reach)?.point.distanceTo(from) ?? reach;
    // The hand itself, out of the wall: drawn back along where it reaches from the chest.
    const toGrip = gripR.clone().sub(mid);
    const gripFar = toGrip.length();
    const gripFree =
      gripFar > 1e-6 ? freeAlong(mid, toGrip.clone().divideScalar(gripFar), gripFar + CLEAR.gap) : gripFar + CLEAR.gap;
    const back = Math.max(0, gripFar + CLEAR.gap - gripFree);
    let wanted = CLEAR.most;
    for (let a = 0; a <= CLEAR.most; a += CLEAR.step)
      if (
        freeAlong(
          gripR.clone().addScaledVector(toGrip, -back / Math.max(1e-6, gripFar)),
          direction.clone().applyAxisAngle(swungRight, deg(a)),
          length,
        ) >= length
      ) {
        wanted = a;
        break;
      }
    // Raised at once, let down slowly; and, raised all it can, drawn back by what is still in the way.
    holding.clear = wanted >= holding.clear || dt <= 0 ? wanted : towards(holding.clear, wanted, CLEAR.down * dt);
    direction.applyAxisAngle(swungRight, deg(holding.clear));
    const stillIn = length - freeAlong(gripR, direction, length);
    holding.drawnBack = back + (holding.clear >= CLEAR.most - 1e-6 ? Math.max(0, stillIn) : 0);
    if (holding.drawnBack > 0 && gripFar > 1e-6) gripR.addScaledVector(toGrip, -Math.min(gripFar, holding.drawnBack) / gripFar);
  }
  const back = gripR.clone().addScaledVector(direction, -(tool.grips[0] ?? 0));
  const second = tool.grips[1];
  // Its box: along it, its +Z; across it, as level as it can be (its +X square to "up").
  x.crossVectors(upward, direction);
  if (x.lengthSq() < 1e-8) x.copy(swungRight);
  x.normalize();
  y.crossVectors(direction, x);
  basis.makeBasis(x, y, direction);
  return (holding.pose = {
    center: back.clone().addScaledVector(direction, tool.size[2] / 2),
    rotation: new THREE.Quaternion().setFromRotationMatrix(basis),
    size: tool.size,
    color: tool.color,
    ...(tool.model ? { model: tool.model } : {}),
    muzzle: back.clone().addScaledVector(direction, tool.size[2]),
    grips: { R: gripR, L: second === undefined ? null : back.clone().addScaledVector(direction, second) },
  });
}
