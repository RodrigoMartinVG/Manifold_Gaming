import { quat, vec3, type Vec3 } from '@manifold/common';
import { CHARACTER_GAP, STANDS_ON } from '../physics';
import type { Character, Entity } from '../types';
import type { World } from '../world';
import { crouchPoseOf } from './body';
import { MODES, type Motion, type Senses } from './modes';
import { pulled } from './steer';

/**
 * WHAT ADDS TO A CHARACTER'S MOTION besides its mode (decision 0000: "contributions that add up, resolved
 * in one place"; a list since stage 5.5e, S1), in this order. Before the controller, what changes the
 * velocity it keeps (`velocity`: gravity, and the forest's buoyancy and drag to come), then what moves it
 * this step only (`carry`: what the game makes it carry); after the controller, what moves it besides,
 * from where its walk left it (`after`: what it stands on, if that moves).
 */
interface Contribution {
  velocity?(c: Character, s: Senses, m: Motion, dt: number): void;
  carry?(c: Character): Vec3;
  after?(world: World, e: Entity, s: Senses, m: Motion, walked: Vec3): Vec3;
}

/**
 * GRAVITY (stage 1b). It changes the velocity, unless the mode holds itself; a mode may slow the fall.
 * Not while it stands, without jumping, on ground it does not slide on (flatter than 30°): its floor
 * holds it, and the controller keeps it on it, down a step too (snapping). Pushed into its floor on
 * every step (stage 3b found it), it sank into the thin gap the controller keeps (CHARACTER_GAP); from
 * there, a move along the floor met the floor at once, and it did not move at all for a step or two: 2
 * to 6 steps in a hundred, walking on a flat floor. On a steeper slope, or a round bottom on an edge,
 * gravity goes on pulling: it is what makes it slide off them. And held so, if it is inside that gap all
 * the same, it comes out of it in this step (`rise`): from a lift at the top onto its ledge, as high to
 * 32 bits but 0.00000004 m higher, it stood a hair inside the ledge's gap, and stuck on the seam for
 * good (stage 3c). Moving out of the gap, the controller does not meet the floor at once.
 */
const GRAVITY: Contribution = {
  velocity(c, s, m, dt) {
    const mode = MODES[c.mode];
    const { under, up } = s;
    if (mode.holds) m.vUp = mode.holds(c, s.move);
    else if (c.grounded && !m.leapt && m.vUp <= 0 && under && (vec3.dot(under.normal, up) >= STANDS_ON || s.held)) {
      m.vUp = 0;
      m.rise = Math.max(0, CHARACTER_GAP - under.distance);
    } else {
      // (Stage 5c: the arc's gravity, stronger once the jump is let go rising, and falling; and its top speed down.)
      const { arc } = c.movement;
      const arced = s.arced;
      const pull =
        arced && arc ? arced.gravity * (m.vUp > 0 ? (c.jump.rising && !s.jumping ? arc.release : 1) : arc.fall) : s.gravity;
      const next = pulled(m.vUp, pull, dt, { hang: arc?.hang, hung: c.jump.hung, holding: s.jumping, leaping: c.jump.rising });
      m.vUp = next.vUp;
      c.jump.hung = next.hung;
      const fall = mode.fall?.(c);
      if (fall !== undefined) m.vUp = Math.max(m.vUp, -fall);
      if (arc) m.vUp = Math.max(m.vUp, -arc.terminal);
    }
  },
};

/** WHAT THE GAME MAKES IT CARRY (stage 2d: `carry`), a velocity for this step only. */
const CARRY: Contribution = {
  carry(c) {
    const carried: Vec3 = [...c.carry];
    c.carry = [0, 0, 0];
    return carried;
  },
};

/**
 * WHAT IT STANDS ON, IF THAT MOVES OR TURNS (stage 2d), if it stood on it and did not jump off it: exactly
 * as far as the platform takes the point where it is. After the controller, not through it: the
 * controller saw the platform fixed (physics.ts), and a platform going down would have stopped it from
 * going down with it. But through what is in its way (stage 3a): the carry is swept from where the walk
 * left it, leaving out the platform itself, and what it meets stops it (a beam the platform passes under;
 * before, the carry took it into the beam).
 */
const PLATFORM: Contribution = {
  after: (world, e, s, m, walked) =>
    m.ride && !m.leapt && s.under ? sweep(world, e, walked, m.ride.movement, s.under.entity) : [0, 0, 0],
};

export const CONTRIBUTIONS: readonly Contribution[] = [GRAVITY, CARRY, PLATFORM];

/**
 * A CHARACTER CARRIED THROUGH WHAT IS IN ITS WAY (stage 3a): its capsule swept from `from` along `by`
 * (how its platform moves the point where it is), leaving out the platform itself and what the physics
 * moves (a cube riding along is pushed by the physics). It stops at the first thing it meets, keeping
 * the controller's gap, and what is left of the carry goes once along that surface, as the controller
 * slides along a wall. How far it really goes.
 */
function sweep(world: World, e: Entity, from: Vec3, by: Vec3, platform: number): Vec3 {
  // The body the controller moves: crouched, the low one (stage 4b), where it is from the center.
  const c = e.character!;
  const rotation = e.transform!.rotation;
  const pose = MODES[c.mode].low ? crouchPoseOf(c, e.body!) : null;
  const shape = pose ? pose.shape : e.body!.shape;
  if (pose) from = vec3.add(from, quat.rotate(rotation, pose.offset));
  let moved: Vec3 = [0, 0, 0];
  let rest = by;
  for (let i = 0; i < 2; i++) {
    const length = vec3.length(rest);
    if (length < 1e-9) break;
    const direction = vec3.scale(rest, 1 / length);
    const hit = world.castShape(shape, vec3.add(from, moved), rotation, direction, length + CHARACTER_GAP, {
      skip: e.id,
      besides: platform,
      dynamic: false,
    });
    if (!hit) return vec3.add(moved, rest);
    const free = Math.max(0, Math.min(length, hit.distance - CHARACTER_GAP));
    moved = vec3.add(moved, vec3.scale(direction, free));
    const left = vec3.scale(direction, length - free);
    rest = vec3.sub(left, vec3.scale(hit.normal, vec3.dot(left, hit.normal)));
  }
  return moved;
}
