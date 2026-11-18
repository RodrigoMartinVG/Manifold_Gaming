import { quat, type Vec3 } from '@manifold/common';
import type { Appearance, BodySpec, CharacterSpec, CollisionPose, HitPart, ModeName } from '@manifold/core';

/**
 * THE GAMES' CHARACTER (stage 4a): one body for every game, so the guards of phase 4 and each game's
 * player are the same mannequin, and a new way of moving gets its animations once. This part is the
 * rules': plain data, the same in Node and in every browser, no screen (decision 0003). The model's
 * address, for the presentation, is in `@manifold/character/models`.
 */

/** The mannequin's name, the one an appearance gives and the presentation loads (art/mannequin.py made it). */
export const MANNEQUIN = 'character.mannequin';

/** The character's body: a capsule 1.6 m tall, 0.6 m wide. */
export const CHARACTER_SHAPE = { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } as const;

/**
 * THE PLATFORMER'S CHARACTER (stage 5c, decision 0029: the tower): the same body, moving as a platformer
 * asks. Its jump by its height and its time to the top (2 m in 0.42 s: its own gravity, 24 m/s², and
 * speed, 10 m/s, from `arcOf`), half as strong again falling and 2.5 times let go rising (a short hop),
 * no faster down than 16 m/s, and nudged up to 25 cm round a corner its head clips; down a wall no
 * faster than 2.5 m/s, and off it at 6 m/s; and ledges grabbed. The metrics gym measures it
 * (`dojo.arc`, `dojo.walljump`, `dojo.ledge`).
 */
export const PLATFORMER = {
  movement: {
    arc: { height: 2, time: 0.42, release: 2.5, fall: 1.5, terminal: 16, corner: 0.25 },
    wall: { slide: 2.5, off: 6, lock: 0.25 },
  },
  can: { wallJump: true, ledge: true },
} as const satisfies Pick<CharacterSpec, 'movement' | 'can'>;

/**
 * What the mannequin's body is in each way of moving where it is not the standing capsule (stage 2e,
 * for phase 4's blows), from its animations: crouched in the air, its knees up; gliding, tilted 55°
 * forward; crouching. (The controller moves the standing capsule, except crouching: stage 4b.)
 */
export const POSES: Partial<Record<ModeName, CollisionPose>> = {
  air: { shape: { kind: 'capsule', halfHeight: 0.35, radius: 0.3 }, offset: [0, 0.1, 0], rotation: quat.identity() },
  // Crouched (stage 4b): 1.1 m tall, its feet where they were, the mannequin's crouch inside it (its
  // head, 1.09 m up at most: its back bent 55°). The controller moves this one while it crouches: it
  // passes under a gap of 1.12 m (the controller keeps 2 cm).
  crouch: { shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.3 }, offset: [0, -0.25, 0], rotation: quat.identity() },
  glide: {
    shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 },
    offset: [0, 0, 0],
    rotation: quat.fromDegrees([1, 0, 0], -55),
  },
};

/** A part a hit can find: a ball or an upright capsule, where it is from the character's center. */
const ball = (name: string, radius: number, offset: [number, number, number]): HitPart => ({
  name,
  shape: { kind: 'ball', radius },
  offset,
  rotation: quat.identity(),
});
const capsule = (name: string, halfHeight: number, radius: number, offset: [number, number, number], tilt = 0): HitPart => ({
  name,
  shape: { kind: 'capsule', halfHeight, radius },
  offset,
  rotation: quat.fromDegrees([1, 0, 0], tilt),
});
/** Parts turned with the body (gliding: tilted forward): their places and their turns. */
const tilted = (parts: HitPart[], degrees: number): HitPart[] => {
  const turn = quat.fromDegrees([1, 0, 0], degrees);
  return parts.map((p) => ({ ...p, offset: quat.rotate(turn, p.offset), rotation: quat.multiply(turn, p.rotation) }));
};

const STANDING: HitPart[] = [
  ball('head', 0.16, [0, 0.62, 0]),
  capsule('body', 0.16, 0.24, [0, 0.2, 0]),
  capsule('legs', 0.2, 0.2, [0, -0.44, 0]),
];

/**
 * WHAT A HIT CAN FIND OF THE MANNEQUIN in each way of moving (stage 4c, decision 0022), from its
 * animations: standing (walking, climbing), its head, its body and its legs; crouched, its head ahead
 * and low, its back bent 55°, its legs folded; in the air, its knees up; gliding, all of it tilted 55°
 * forward; rolling, tucked into one ball. Simple shapes, computed in Node without the model.
 */
export const HITS: Partial<Record<ModeName, HitPart[]>> = {
  walk: STANDING,
  climb: STANDING,
  // Blocking (stage 4f): standing, guarding itself.
  block: STANDING,
  crouch: [
    ball('head', 0.16, [0, 0.12, -0.4]),
    capsule('body', 0.16, 0.24, [0, -0.15, -0.18], -55),
    capsule('legs', 0.1, 0.22, [0, -0.6, 0]),
  ],
  air: [
    ball('head', 0.16, [0, 0.62, 0]),
    capsule('body', 0.16, 0.24, [0, 0.2, 0]),
    capsule('legs', 0.12, 0.2, [0, -0.25, -0.12]),
  ],
  glide: tilted(STANDING, -55),
  roll: [ball('body', 0.45, [0, -0.35, 0])],
};

/**
 * A CHARACTER'S PARTS, for a game's `createEntity`: its body, its character (the player who drives it,
 * where it looks, its poses) and its appearance (the mannequin, once it loaded; the capsule meanwhile, in
 * its color). A game adds what is its own: a name, a position, its components, what it can do.
 */
export function characterParts(o: { player: number; facing: Vec3; color: number }): {
  body: BodySpec;
  character: CharacterSpec;
  appearance: Appearance;
} {
  return {
    body: { type: 'character', shape: { ...CHARACTER_SHAPE } },
    // It can crouch and roll (stage 4b): every game's character does; a game may take it away.
    character: {
      player: o.player,
      facing: [...o.facing],
      poses: POSES,
      hits: HITS,
      can: { crouch: true, roll: true, block: true },
    },
    appearance: { shape: 'capsule', size: [0.6, 1.6, 0.6], color: o.color, model: MANNEQUIN },
  };
}
