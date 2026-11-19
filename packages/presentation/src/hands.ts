import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import type { Character, Entity, EntityId, Shape, World } from '@manifold/core';
import { endOf, reach, rootOf, type Limb, type LimbSpec } from './ik';
import type { Tool, ToolPose } from './tools';

/**
 * HANDS THAT HOLD ON (stage 4a): the climbing animations move the arms as if a wall were 16 cm in front of
 * the chest, and it is 30 (the capsule's radius); nothing touched it. Now each hand takes a hold on what
 * is there, found by rays against the world: the wall in front, or, where the wall has ended, its top (a
 * ledge). A hold is a contact that persists: taken where the hand would go, when it is within 0.85 of the
 * arm's reach, and kept there, in the world, while the body climbs past it, until it is beyond 1.05 of
 * the reach (that gap is what keeps a hand from taking and letting go in turns at one distance). Each hand
 * takes one hold in its half of the climbing cycle (the left one in the second half: the animation's left
 * hand reaches in the first), both while the body is still on the wall, and both on a ledge, a hand
 * on the wall going to the edge as soon as the edge is within reach (in 0.15 s, not at once). Held, the
 * arms reach for what they hold. The solver's weight comes and goes smoothly, so taking and letting go
 * are not jumps. Only the view: the world is not touched (its rays are queries).
 */

const deg = THREE.MathUtils.degToRad;

/**
 * A mannequin's arm (art/mannequin.py: 0.28 m to the elbow, 0.28 more to the hand's socket), as the solver
 * takes it (ik.ts). Its stretch gives 1 cm at full reach (a hand a centimeter off a wall reads as on it;
 * an elbow that snaps does not). The elbow bends at most 150°, back when the arm is straight; the upper
 * arm points within 120° of forward (up and down, out to the side, and up to 30° behind), and twists at
 * most 90° either way (its animations, 85° at most: gliding, the arms spread).
 */
const arm = (side: 'L' | 'R'): LimbSpec => ({
  upper: `upper_arm_${side}`,
  lower: `forearm_${side}`,
  end: [0, 0.28, 0],
  slack: 0.01,
  bend: deg(150),
  pole: [0, 0, 1],
  limit: { center: [0, 0, -1], cone: deg(120), twist: [deg(-90), deg(90)] },
});
export const ARMS: Readonly<Record<'L' | 'R', LimbSpec>> = { L: arm('L'), R: arm('R') };

/** A hold is taken within this much of the arm's reach, and let go beyond `LET_GO`. */
export const TAKE = 0.85;
export const LET_GO = 1.05;
/** How long the solver's weight takes to come, and to go (s). */
const FADE_IN = 0.1;
const FADE_OUT = 0.12;
/** How far from a surface a hand's socket is when the hand is on it (m). */
const PALM = 0.03;
/** Slower than this on the wall (m/s), the body is still: both hands hold. */
const STILL = 0.1;
/** How long a hand takes to go from one hold to the next while the solver weighs it (s). */
const SHIFT = 0.15;

/** What a hand holds, if anything: a wall, its edge, something carried (a crate), a tool (stage 4c: tools.ts). */
export type HoldKind = 'wall' | 'ledge' | 'held' | 'tool';

/** What the view remembers of a hand from one frame to the next. */
export interface Hand {
  /** Where it holds (the world's), while it holds; for what is held, where it reaches. */
  contact: THREE.Vector3 | null;
  kind: HoldKind | null;
  /** Let go: where it held, while its weight goes. */
  leaving: THREE.Vector3 | null;
  /** Gone from one hold to another (from the wall to its edge): how far from the new one it still is, fading. */
  shift: { offset: THREE.Vector3; left: number } | null;
  /** How much the solver weighs, 0 to 1 (eased when it is applied). */
  weight: number;
  /** It took its hold in this half of the climbing cycle (one per half). */
  took: boolean;
  /** What the solver did, the last frame (for `show.ik`). */
  ratio: number;
  missed: number;
}
export type Hands = Record<'L' | 'R', Hand>;

const newHand = (): Hand => ({
  contact: null,
  kind: null,
  leaving: null,
  shift: null,
  weight: 0,
  took: false,
  ratio: 0,
  missed: 0,
});
export const newHands = (): Hands => ({ L: newHand(), R: newHand() });

/** What a hand can find around the body: surfaces by rays, and what it holds. */
export interface Surroundings {
  /** The first surface that does not move by the physics along a ray (the character left out). */
  ray(from: THREE.Vector3, direction: THREE.Vector3, reach: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null;
  /** (Stage 5l) The same, the level's surfaces only (no character): what a tool it holds keeps out of. */
  wall?(from: THREE.Vector3, direction: THREE.Vector3, reach: number): { point: THREE.Vector3 } | null;
  /** What it holds, as drawn: where it is, how it is turned, its shape. */
  held: { center: THREE.Vector3; rotation: THREE.Quaternion; shape: Shape } | null;
  /** What it carries in its hands, as its game says (stage 4c: tools.ts), if anything. */
  tool?: Tool | null;
}

/**
 * A character's surroundings in a world: rays against what the physics does not move, and what it holds,
 * where it is drawn (`drawn`, if it is) or where the world has it.
 */
export function surroundingsOf(
  world: World,
  e: Entity,
  drawn?: (id: EntityId) => THREE.Object3D | undefined,
  tool: Tool | null = null,
): Surroundings {
  const holding = e.character?.holding ? world.entities.get(e.character.holding) : undefined;
  const mesh = holding && drawn?.(holding.id);
  const t = holding?.transform;
  return {
    ray(from, direction, length) {
      const hit = world.castRay(from.toArray(), direction.toArray(), length, { skip: e.id, dynamic: false });
      return hit && { point: new THREE.Vector3(...hit.point), normal: new THREE.Vector3(...hit.normal) };
    },
    wall(from, direction, length) {
      const hit = world.castRay(from.toArray(), direction.toArray(), length, { skip: e.id, dynamic: false, characters: false });
      return hit && { point: new THREE.Vector3(...hit.point) };
    },
    held:
      holding?.body && t
        ? {
            center: mesh ? mesh.position.clone() : new THREE.Vector3(...t.position),
            rotation: mesh ? mesh.quaternion.clone() : new THREE.Quaternion(...t.rotation),
            shape: holding.body.shape,
          }
        : null,
    tool,
  };
}

/** How far a shape, turned by `rotation`, reaches from its center along the unit `axis`. */
export function halfAcross(shape: Shape, rotation: THREE.Quaternion, axis: THREE.Vector3): number {
  if (shape.kind === 'ball') return shape.radius;
  if (shape.kind === 'capsule')
    return shape.radius + shape.halfHeight * Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).dot(axis));
  if (shape.kind === 'box')
    return [0, 1, 2].reduce((sum, k) => {
      const e = new THREE.Vector3().setComponent(k, 1).applyQuaternion(rotation);
      return sum + shape.halfExtents[k]! * Math.abs(e.dot(axis));
    }, 0);
  return 0.2;
}

const shoulder = new THREE.Vector3();
const hand = new THREE.Vector3();
const center = new THREE.Vector3();
const toWall = new THREE.Vector3();
const out = new THREE.Vector3();
const upward = new THREE.Vector3();
const right = new THREE.Vector3();
const offset = new THREE.Vector3();
const spot = new THREE.Vector3();

/**
 * Where a hand could hold on a wall it climbs, if anywhere: the wall found by a ray from the body's
 * center towards it (`wall`, the character's, along the ground); on it, where the animation puts the
 * hand, brought within `TAKE` of the reach; and if the wall is not there at that height, the top it ends
 * in (a ledge), if one is under the hand.
 */
function wallHold(limb: Limb, around: Surroundings, wall: Vec3): { at: THREE.Vector3; kind: 'wall' | 'ledge' } | null {
  const face = around.ray(center, toWall.set(...wall), 1);
  if (!face || face.normal.lengthSq() === 0) return null;
  out.copy(face.normal);
  const distance = (p: THREE.Vector3) => offset.subVectors(p, face.point).dot(out);
  rootOf(limb, shoulder);
  endOf(limb, hand);
  const full = limb.a + limb.b;
  const off = distance(shoulder) - PALM;
  const most = TAKE * full * 0.97;
  if (off >= most) return null;
  // On the wall's plane: from in front of the shoulder to in front of the hand, within reach.
  spot.copy(hand).addScaledVector(out, -distance(hand));
  const base = shoulder.clone().addScaledVector(out, -distance(shoulder));
  const along = new THREE.Vector3().subVectors(spot, base);
  const room = Math.sqrt(most * most - off * off);
  if (along.length() > room) along.setLength(room);
  spot.copy(base).add(along);
  const there = around.ray(spot.clone().addScaledVector(out, 0.3), out.clone().negate(), 0.4);
  if (there && there.normal.dot(out) > 0.9) return { at: there.point.addScaledVector(out, PALM), kind: 'wall' };
  // The wall has ended below the hand: its top, if there is one under it.
  const top = around.ray(spot.clone().addScaledVector(out, -0.05).addScaledVector(upward, 0.5), upward.clone().negate(), 1);
  if (top && top.normal.dot(upward) > 0.7)
    return { at: top.point.addScaledVector(out, PALM).addScaledVector(upward, PALM), kind: 'ledge' };
  return null;
}

/** Where the solver takes a hand now: its hold (or the one it let go), less what is left of a shift. */
function aimOfHand(h: Hand, out: THREE.Vector3): THREE.Vector3 | null {
  const at = h.contact ?? h.leaving;
  if (!at) return null;
  out.copy(at);
  if (h.shift) out.addScaledVector(h.shift.offset, h.shift.left / SHIFT);
  return out;
}

const was = new THREE.Vector3();

/** A hand takes a hold: if the solver still weighs it, from where it was going, smoothly (`SHIFT`). */
function take(h: Hand, at: THREE.Vector3, kind: HoldKind) {
  const from = h.weight > 0 ? aimOfHand(h, was) : null;
  h.shift = from ? { offset: from.clone().sub(at), left: SHIFT } : null;
  h.contact = at;
  h.kind = kind;
  h.leaving = null;
}

/** Each hand's half of the climbing cycle, by its phase: the left hand holds in the second half. */
const holdsNow = (side: 'L' | 'R', phase: number) => (side === 'L' ? phase >= 0.5 : phase < 0.5);
/** A weight eased in and out (smoothstep): no jump in speed where it starts or ends. */
const eased = (w: number) => w * w * (3 - 2 * w);

/**
 * After the animations and the feet (models.ts: `animate`): each hand takes, keeps or lets go of its hold,
 * and the arms reach for it. `climbPhase`, where the climbing cycle is; `moved`, how fast the body really
 * moved (m/s); `dt`, the world's time (paused, nothing changes); `tool`, where a tool it carries is
 * drawn (stage 4c: its grips, the right hand's and the left one's), if it carries one and something
 * carried (a crate) does not take its hands.
 */
export function grip(
  object: THREE.Object3D,
  arms: Readonly<Record<'L' | 'R', Limb>> | null,
  hands: Hands,
  c: Character,
  around: Surroundings | undefined,
  climbPhase: number,
  moved: Vec3,
  up: Vec3,
  dt: number,
  tool: ToolPose | null = null,
) {
  if (!arms) return;
  object.updateMatrixWorld(true);
  object.getWorldPosition(center);
  upward.set(...up).normalize();
  right.set(1, 0, 0).transformDirection(object.matrixWorld);
  const climbing =
    c.mode === 'climb' && (c.climb.wall[0] !== 0 || c.climb.wall[1] !== 0 || c.climb.wall[2] !== 0) && around !== undefined;
  // Hanging from a ledge (stage 5c): both hands on its edge (8 cm short of where the simulation says
  // they hold, which is 10 cm past it), a shoulder's width apart.
  const ledge = c.mode === 'hang' ? c.hang.ledge : null;
  const edge = ledge ? new THREE.Vector3(...ledge.at).addScaledVector(new THREE.Vector3(...ledge.wall), -0.08) : null;
  const still = Math.hypot(...moved) < STILL;
  for (const side of ['L', 'R'] as const) {
    const h = hands[side];
    const limb = arms[side];
    const full = limb.a + limb.b;
    rootOf(limb, shoulder);
    const window = holdsNow(side, climbPhase);
    if (!window) h.took = false;
    // What is held: the arms reach for its sides, wherever it is (not a hold: it is not within reach).
    // Or, if nothing is, a tool's grips.
    const held = around?.held;
    let reachFor: THREE.Vector3 | null = null;
    let carried: 'held' | 'tool' | null = null;
    if (held) {
      const sign = side === 'L' ? -1 : 1;
      reachFor = held.center.clone().addScaledVector(right, sign * (halfAcross(held.shape, held.rotation, right) + PALM));
      carried = 'held';
    } else if (tool?.grips[side]) {
      reachFor = tool.grips[side]!.clone();
      carried = 'tool';
    }
    // Keep or let go.
    if (h.contact) {
      const far = shoulder.distanceTo(h.contact) > LET_GO * full;
      const holdsCarried = h.kind === 'held' || h.kind === 'tool';
      const over = holdsCarried
        ? h.kind !== carried
        : edge
          ? h.kind !== 'ledge'
          : !climbing || far || (h.kind === 'wall' && !window && !still);
      if (over) {
        h.leaving = aimOfHand(h, new THREE.Vector3());
        h.contact = null;
        h.kind = null;
        h.shift = null;
      } else if (holdsCarried) h.contact = reachFor;
      else if (h.kind === 'wall' && dt > 0) {
        // Holding the wall when its edge comes within reach: to the edge (both hands end there).
        const top = wallHold(limb, around!, c.climb.wall);
        if (top?.kind === 'ledge' && shoulder.distanceTo(top.at) <= TAKE * full) take(h, top.at, 'ledge');
      }
    }
    // Take.
    if (!h.contact && reachFor && carried) take(h, reachFor, carried);
    else if (!h.contact && edge) take(h, edge.clone().addScaledVector(right, (side === 'L' ? -1 : 1) * 0.18), 'ledge');
    else if (!h.contact && climbing && dt > 0) {
      const hold = wallHold(limb, around, c.climb.wall);
      const may = hold && (hold.kind === 'ledge' || ((window || still) && !h.took));
      if (hold && may && shoulder.distanceTo(hold.at) <= TAKE * full) {
        take(h, hold.at, hold.kind);
        if (hold.kind === 'wall') h.took = true;
      }
    }
    if (dt > 0) {
      h.weight = h.contact ? Math.min(1, h.weight + dt / FADE_IN) : Math.max(0, h.weight - dt / FADE_OUT);
      if (h.shift && (h.shift.left -= dt) <= 0) h.shift = null;
    }
    if (h.weight === 0) h.leaving = null;
    const target = aimOfHand(h, spot);
    if (target && h.weight > 0) {
      const done = reach(object, limb, target, eased(h.weight));
      h.ratio = done.ratio;
      h.missed = done.missed;
    } else {
      h.ratio = shoulder.distanceTo(endOf(limb, hand)) / full;
      h.missed = 0;
    }
  }
}
