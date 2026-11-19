import { quat } from '@manifold/common';
import { CHARACTER_SETTINGS } from '../physics';
import type { Body, Character, CharacterSpec, CollisionPose, HitPart, ModeName, Movement, Shape } from '../types';

/**
 * A platformer's feel (the one the Dojo had until stage 2b): quick on the ground, a little steering
 * in the air, a jump of about 2 m, 0.1 s of coyote time and of jump buffering.
 */
export const DEFAULT_MOVEMENT: Readonly<Movement> = Object.freeze({
  walk: { speed: 4.5, run: 7.5, acceleration: 50 },
  air: { control: 14 },
  jump: { speed: 6.5, coyote: 6, buffer: 6, air: 1 },
  glide: { fall: 1.5, control: 20 },
  climb: { speed: 2.5, top: 4, off: 4 },
  crouch: { speed: 2, seen: 0.5, heard: 0.5 },
  roll: { speed: 5, time: 0.6 },
  block: { speed: 2 },
  turn: 3,
  wall: { slide: 2.5, off: 6, lock: 0.25 },
});

export function newCharacter(spec: CharacterSpec): Character {
  const m = spec.movement ?? {};
  const movement: Movement = {
    walk: { ...DEFAULT_MOVEMENT.walk, ...m.walk },
    air: { ...DEFAULT_MOVEMENT.air, ...m.air },
    jump: { ...DEFAULT_MOVEMENT.jump, ...m.jump },
    glide: { ...DEFAULT_MOVEMENT.glide, ...m.glide },
    climb: { ...DEFAULT_MOVEMENT.climb, ...m.climb },
    crouch: { ...DEFAULT_MOVEMENT.crouch, ...m.crouch },
    roll: { ...DEFAULT_MOVEMENT.roll, ...m.roll },
    block: { ...DEFAULT_MOVEMENT.block, ...m.block },
    turn: m.turn ?? DEFAULT_MOVEMENT.turn,
    wall: { ...DEFAULT_MOVEMENT.wall, ...m.wall },
    // (The platformer's jump, stage 5c: only if its game gives one.)
    ...(m.arc ? { arc: { ...m.arc } } : {}),
  };
  return {
    player: spec.player,
    movement,
    // Without capabilities, unless the game gives them (stage 2c).
    can: {
      doubleJump: false,
      glide: false,
      climb: false,
      crouch: false,
      roll: false,
      block: false,
      wallJump: false,
      ledge: false,
      ...spec.can,
    },
    airJumps: movement.jump.air,
    wall: [0, 0, 0],
    mode: 'air',
    velocity: [0, 0, 0],
    grounded: false,
    // Born in the air: no coyote time until it has stood on something.
    stepsInAir: movement.jump.coyote + 1,
    jumpPending: 0,
    jumpHeld: false,
    facing: [...(spec.facing ?? [0, 0, -1])],
    pitch: 0,
    light: 0,
    stride: 0,
    holding: 0,
    rolling: 0,
    rollDirection: [0, 0, 0],
    lock: null,
    thrown: false,
    carry: [0, 0, 0],
    ground: { velocity: [0, 0, 0], spin: 0 },
    leaping: false,
    offWall: [0, 0, 0],
    offSteps: 0,
    ledge: null,
    regrab: 0,
    carriedTurn: quat.identity(),
    ...(spec.poses ? { poses: structuredPoses(spec.poses) } : {}),
    ...(spec.hits ? { hits: structuredHits(spec.hits) } : {}),
    // (Stage 5.5e) Only when its game says: absent, the mannequin's, and every hash as it was.
    ...(spec.controller ? { controller: { ...CHARACTER_SETTINGS, ...spec.controller } } : {}),
    ...(spec.mass !== undefined ? { mass: spec.mass } : {}),
    history: [],
  };
}

/** A copy of the hit parts a character is given (plain data, its own). */
const structuredHits = (hits: Partial<Record<ModeName, HitPart[]>>): Partial<Record<ModeName, HitPart[]>> =>
  Object.fromEntries(
    Object.entries(hits).map(([mode, parts]) => [
      mode,
      parts!.map((p) => ({ name: p.name, shape: { ...p.shape }, offset: [...p.offset], rotation: [...p.rotation] })),
    ]),
  ) as Partial<Record<ModeName, HitPart[]>>;

/** A copy of the poses a character is given (plain data, its own). */
const structuredPoses = (poses: Partial<Record<ModeName, CollisionPose>>): Partial<Record<ModeName, CollisionPose>> =>
  Object.fromEntries(
    Object.entries(poses).map(([mode, p]) => [
      mode,
      { shape: { ...p!.shape }, offset: [...p!.offset], rotation: [...p!.rotation] },
    ]),
  ) as Partial<Record<ModeName, CollisionPose>>;

/** How many steps of poses a character keeps (decision 0022): this one and 15 before, a quarter of a second. */
export const HISTORY = 16;

/** How tall a crouched body is, of the standing one, when the game gives no pose for it (1.6 m: 1 m). */
export const CROUCHED = 0.625;

/**
 * A CROUCHED BODY (stage 4b): the pose the game gives for crouching; if none, its capsule as tall as
 * `CROUCHED` of the standing one, its bottom where the standing one's is. The controller moves it while
 * the character crouches, so it passes under what the standing one could not.
 */
export function crouchPoseOf(c: Character, body: Pick<Body, 'shape'>): CollisionPose {
  const given = c.poses?.crouch;
  if (given) return given;
  const s = body.shape;
  if (s.kind !== 'capsule') return { shape: s, offset: [0, 0, 0], rotation: quat.identity() };
  const tall = 2 * (s.halfHeight + s.radius);
  const low = Math.max(2 * s.radius, tall * CROUCHED);
  return {
    shape: { kind: 'capsule', halfHeight: low / 2 - s.radius, radius: s.radius },
    offset: [0, (low - tall) / 2, 0],
    rotation: quat.identity(),
  };
}

/**
 * A BODY'S FRAME (stage 5.5e): what the engine reads of a character's size, from its body's shape and not
 * from the mannequin's numbers: from its center down to where its round bottom begins (`waist`: a capsule's
 * half height), down to its lowest point (`bottom`), and across (`radius`). For the mannequin's capsule,
 * exactly the numbers that were written (0.5, 0.8, 0.3); a compound, those, until a body needs its own.
 */
export function frameOf(shape: Shape): { waist: number; bottom: number; radius: number } {
  switch (shape.kind) {
    case 'capsule':
      return { waist: shape.halfHeight, bottom: shape.halfHeight + shape.radius, radius: shape.radius };
    case 'ball':
      return { waist: 0, bottom: shape.radius, radius: shape.radius };
    case 'box':
      return {
        waist: shape.halfExtents[1],
        bottom: shape.halfExtents[1],
        radius: Math.max(shape.halfExtents[0], shape.halfExtents[2]),
      };
    default:
      return { waist: 0.5, bottom: 0.8, radius: 0.3 };
  }
}

/** Where a character's hands are, above its center (stage 5c): 30 cm under the top of its head (its frame's, stage 5.5e). */
export const handsOf = (shape: Shape): number => frameOf(shape).bottom - 0.3;
