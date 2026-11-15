import * as THREE from 'three';

/** The ways of moving. Exactly one is active at each step. */
export type ModeName = 'walk' | 'air' | 'glide' | 'climb';

/** THE NUMBERS OF EACH MODE: data, not code (the panel changes them while it runs). */
export const movement = {
  walk: { speed: 4.5, acceleration: 50 },
  air: { control: 14 },
  glide: { control: 20, fall: 1.5 },
  climb: { speed: 2.5, top: 4 },
  jump: { speed: 6.5 },
};

/** What a mode is told at each step. The vectors are along the ground (their y is 0). */
export interface Ask {
  /** The direction asked for, of length 0 to 1. */
  move: THREE.Vector3;
  /** The velocity asked for: `move` times the walking speed. */
  wanted: THREE.Vector3;
  /** Towards the wall it touches (of length 1), or zero. */
  wall: THREE.Vector3;
  dt: number;
}

/**
 * A WAY OF MOVING: how it steers the velocity along the ground towards the one asked for; and, if it
 * is its business, a rule for the velocity up.
 */
export interface Mode {
  /** The velocity along the ground at the end of this step, from the one it has now. */
  steer(now: THREE.Vector3, ask: Ask): THREE.Vector3;
  /** If it holds itself against gravity: its own velocity up (and gravity does not pull it). */
  holds?(ask: Ask): number;
  /** If it slows the fall: the fastest it can fall, in m/s. */
  fall?(): number;
}

/** Goes from `now` towards `wanted`, changing at most `most` (m/s) in this step. */
export function approach(now: THREE.Vector3, wanted: THREE.Vector3, most: number): THREE.Vector3 {
  const diff = wanted.clone().sub(now);
  const away = diff.length();
  return away <= most ? wanted.clone() : now.clone().addScaledVector(diff, most / away);
}

/** The part of `v` along the wall: without what goes into it. */
const alongWall = (v: THREE.Vector3, wall: THREE.Vector3) =>
  v.clone().addScaledVector(wall, -v.dot(wall));

/** THE TABLE OF MODES: one entry each. Nothing else in the program knows how each one moves. */
export const MODES: Record<ModeName, Mode> = {
  // On the ground: towards what is asked, quickly (its feet push against the floor).
  walk: { steer: (now, a) => approach(now, a.wanted, movement.walk.acceleration * a.dt) },
  // In the air: the same, but with what the game allows to steer (0: the jump's arc cannot change).
  air: { steer: (now, a) => approach(now, a.wanted, movement.air.control * a.dt) },
  // Gliding: it steers more, and it falls slowly.
  glide: {
    steer: (now, a) => approach(now, a.wanted, movement.glide.control * a.dt),
    fall: () => movement.glide.fall,
  },
  // Climbing: along the wall, as much as is asked along it; up, as much as it pushes against it. Not
  // towards it: the controller would not let it rise along something that steep. Gravity does not pull it.
  climb: {
    steer: (_now, a) => alongWall(a.move, a.wall).multiplyScalar(movement.climb.speed),
    holds: (a) => movement.climb.speed * Math.max(0, a.move.dot(a.wall)),
  },
};

/** What the decision looks at: what the character was doing in the step before. */
export interface Doing {
  mode: ModeName;
  grounded: boolean;
  /** Its velocity up, m/s. */
  vy: number;
}

/**
 * WHICH MODE, decided here and only here:
 * - pushing against a wall it touches: it climbs (from the ground, or going on climbing, or in the
 *   air while it is not going up);
 * - standing on something: it walks;
 * - falling while it holds the jump: it glides;
 * - otherwise: it is in the air.
 */
export function decide(c: Doing, ask: Ask, jumpHeld: boolean): ModeName {
  if (ask.move.dot(ask.wall) > 0.5 && (c.grounded || c.mode === 'climb' || c.vy <= 0))
    return 'climb';
  if (c.grounded) return 'walk';
  if (jumpHeld && c.vy < 0) return 'glide';
  return 'air';
}
