import { quat, vec3, type Vec3 } from '@manifold/common';
import { CHARACTER_GAP } from '../physics';
import type { Body, Character, CollisionPose, Entity, HitPart, ModeName, PlayerInput } from '../types';
import type { World } from '../world';
import { type Standing, topAhead, WALL_APPROACH, WALL_GAP } from './around';
import { crouchPoseOf, frameOf } from './body';
import { airStrafe, approach, arcOf, carriedBy, isZero } from './steer';

/**
 * WHAT A CHARACTER SENSES at its step's start (stage 5.5e, S1): read once, in the order it always was
 * (holding, turning and locking on come first, and what it finds may change them), and then what its
 * mode, its jump and the contributions read. Before, about thirty variables of one function of 500
 * lines, which every branch read as it pleased.
 */
export interface Senses {
  /** Down (stage 4c: its points ran out): it asks for nothing until it comes back. */
  readonly down: boolean;
  readonly input: PlayerInput;
  /** Gravity's strength where it is, and its up. */
  readonly gravity: number;
  readonly up: Vec3;
  /** Whether it is told where to look; towards what it is locked on, on the ground's plane. */
  readonly told: boolean;
  readonly toLocked: Vec3 | null;
  /** What is asked for: in the world; all of it (length 1 at most); as a velocity; and the buttons held. */
  readonly inWorld: Vec3;
  readonly move: Vec3;
  readonly wanted: Vec3;
  readonly jumping: boolean;
  readonly crouching: boolean;
  readonly blocking: boolean;
  /** Its body's frame (stage 5.5e), its feet (where its round bottom begins), its radius and its hands. */
  readonly frame: ReturnType<typeof frameOf>;
  readonly feet: Vec3;
  readonly radius: number;
  readonly hands: number;
  /** The wall it climbed (before this step), and how far the one it climbs now is. */
  readonly climbed: Vec3;
  readonly wallDistance: number;
  /** Where it is, whether it stood, what it stands on (its body), and how much its feet push there (stage 3b). */
  readonly here: Vec3;
  readonly wasGrounded: boolean;
  readonly under: Standing | null;
  readonly floor: Body | undefined;
  readonly traction: number;
  /** The mode it was in, and, low, whether it could stand up where it is (stage 4b). */
  readonly before: ModeName;
  readonly room: boolean;
  /** Where it looks and where it pushes, on the ground's plane (stage 5c). */
  readonly lookingWay: Vec3;
  readonly pushingWay: Vec3 | null;
  /** A wall beside it in the air; whether it just left it; whether it slides down it; whether it pushes against it. */
  readonly beside: Vec3 | null;
  readonly backOn: boolean;
  readonly sliding: boolean;
  readonly againstWall: boolean;
  /**
   * Ground too steep to stand on (stage 4.5b): the face under its middle, if it is steeper than it stands
   * on; the floor's grip, its cosine; whether the grip holds it all the same (μ ≥ tan θ), and the slope it
   * slides down if not.
   */
  readonly grip: number;
  readonly cos: number;
  readonly held: boolean;
  readonly slope: Vec3 | null;
  /** Its jump's arc in steps (stage 5c), if it has one, and its jump's speed. */
  readonly arced: ReturnType<typeof arcOf> | null;
  readonly jumpSpeed: number;
}

/**
 * WHAT A CHARACTER DOES IN ITS STEP (stage 5.5e, S1), as its mode, its jump and the contributions make
 * it: its velocity along the ground and up, whether it jumped off the ground, a motion of its own (a
 * mode's, as hanging's), how far it comes out of its floor's gap, and how what it stands on moves it.
 */
export interface Motion {
  vH: Vec3;
  vUp: number;
  leapt: boolean;
  own: Vec3 | null;
  rise: number;
  ride: ReturnType<typeof carriedBy> | null;
}

/**
 * A WAY OF MOVING (stage 2b; decision 0000: "one exclusive locomotion mode plus contributions that
 * add up, resolved in one place"; a record since stage 5.5e, S1). Exactly one is active at each step.
 * It says when it applies (in `CHOICE`'s order), how the velocity along the ground goes towards what the
 * player asks for, and, if it is its business, the velocity up: a mode that holds itself (climbing) sets
 * it, and gravity does not apply; a mode that slows the fall (gliding) says how fast it can fall at most.
 * And what only it does: its posture, its jump, where it looks, a motion of its own, what leaving it does.
 * A way of moving the forest adds (swimming, a rope, riding) is one record here.
 */
interface Mode {
  /** Whether it applies now, in its turn in `CHOICE`. */
  applies(c: Character, s: Senses, m: Motion): boolean;
  /**
   * The velocity along the ground at the end of this step, from the one it has, the one asked for and
   * the direction asked; and how much what it stands on lets its feet push (`traction`, 0 to 1).
   */
  steer(c: Character, now: Vec3, wanted: Vec3, move: Vec3, dt: number, traction: number): Vec3;
  /** If it holds itself against gravity: its own velocity up. */
  holds?(c: Character, move: Vec3): number;
  /** If it slows the fall: the fastest it falls, m/s. */
  fall?(c: Character): number;
  /**
   * ITS POSTURE (stage 4b): its body low (the crouched pose, if its game gives no pose of its own); how
   * much of the light it is seen by (stage 3d's watchers); whether its feet make steps on the ground, and
   * how far those are heard, of a step's reach.
   */
  low?: true;
  seen?(c: Character): number;
  steps?: true;
  heard?(c: Character): number;
  /** Its feet on the ground: down a slope too steep, they cannot hold it (stage 4.5b). */
  feet?: true;
  /** It goes its own way: down a slope too steep it does not slide (rolling, climbing). */
  ownWay?: true;
  /** It holds onto something: its jumps in the air come back (climbing, sliding down a wall, hanging). */
  holdsOn?: true;
  /** What it adds to how it steers along the ground, towards what it holds (climbing: its wall). */
  toward?(c: Character, s: Senses, body: Body, dt: number): Vec3 | null;
  /** What leaving it does, the step it leaves (climbing: the hop over a wall's top). */
  leave?(world: World, e: Entity, c: Character, s: Senses, m: Motion): void;
  /** What it keeps that goes while the character is in another mode (hanging: its ledge). */
  outside?(c: Character): void;
  /** What of it stops when the character is put somewhere else (`stopMotion`: a roll ends, a ledge is let go). */
  reset?(c: Character): void;
  /** Its own motion this step (`m.own`), if it moves itself (hanging: on the ledge, up onto it); it may leave itself. */
  own?(c: Character, s: Senses, m: Motion, dt: number): void;
  /** Its own answer to a jump asked for (rolling: kept for later; climbing: off its wall). */
  jump?(c: Character, s: Senses, m: Motion): void;
  /** Where it looks: whatever it is told (`firm`, rolling), or unless it is told (climbing, hanging); null: as any. */
  facing?: { firm?: true; way(c: Character): Vec3 | null };
}

export const MODES: Record<ModeName, Mode> = {
  // On the ground: towards what is asked, quickly (its feet push against the floor), as much as the
  // floor lets them (stage 3b: on ice, it slides).
  walk: {
    applies: (c) => c.grounded,
    steer: (c, now, wanted, _move, dt, traction) => approach(now, wanted, c.movement.walk.acceleration * traction * dt),
    feet: true,
    steps: true,
  },
  // In the air: the same, but with what the game allows to steer (0: the jump's arc cannot change).
  // (Thrown by a blast, stage 4f: what it was given stays, until it lands; it steers only with what it
  // asks, `airStrafe`: stage 5g, an explosion jump with control in the air.)
  air: {
    applies: () => true,
    steer: (c, now, wanted, move, dt) =>
      c.thrown
        ? vec3.length(move) < 0.1
          ? now
          : airStrafe(now, wanted, c.movement.air.control * dt)
        : approach(now, wanted, c.movement.air.control * dt),
  },
  // Gliding (stage 2c): falling while it holds the jump, if it can; it steers more, and it falls slowly.
  glide: {
    applies: (c, s, m) => c.can.glide && s.jumping && m.vUp < 0,
    steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.glide.control * dt),
    fall: (c) => c.movement.glide.fall,
  },
  // Climbing (stage 2c): pushing against a wall it touches, if it can (from the ground, or going on
  // climbing, or in the air while it is not going up: just after jumping off a wall, it does not grab it
  // again before it starts to fall). Along the wall, as much as is asked along it; up, as much as it
  // pushes against it. Not towards it: the controller would not let it rise along something that steep.
  // Gravity does not pull it.
  climb: {
    applies: (c, s, m) => c.can.climb && vec3.dot(s.move, c.climb.wall) > 0.5 && (c.grounded || c.mode === 'climb' || m.vUp <= 0),
    steer: (c, _now, _wanted, move) => vec3.scale(vec3.onPlane(move, c.climb.wall), c.movement.climb.speed),
    holds: (c, move) => c.movement.climb.speed * Math.max(0, vec3.dot(move, c.climb.wall)),
    ownWay: true,
    holdsOn: true,
    // It comes to its wall (stage 4a): as far as touching it less `WALL_GAP`, at `WALL_APPROACH` at most
    // (its body's radius from its axis, where the ray went from, and the controller's own gap).
    toward(c, s, body, dt) {
      if (body.shape.kind !== 'capsule') return null;
      const off = s.wallDistance - body.shape.radius - CHARACTER_GAP - WALL_GAP;
      return off > 0 ? vec3.scale(c.climb.wall, Math.min(WALL_APPROACH, off / dt)) : null;
    },
    // The top of a wall: it was climbing and the wall ended under its feet. A hop up and over, so it gets
    // onto it: up, and towards the wall it climbed at its climbing speed (closing phase 2: the hop was
    // only up, and with no control in the air nothing took it over the edge; it fell back beside the
    // wall, grabbed it again and hopped, forever). Not when the wall ended at a side (it climbed along
    // it past its edge, stage 2e2 found the hop there too): then it lets go, as when it stops pushing.
    leave(world, e, c, s, m) {
      if (isZero(c.climb.wall) && topAhead(world, e, s.feet, s.climbed, s.up)) {
        m.vUp = Math.max(m.vUp, c.movement.climb.top);
        m.vH = vec3.add(m.vH, vec3.scale(s.climbed, c.movement.climb.speed));
      }
    },
    // Off the wall: up, and away from it.
    jump(c, s, m) {
      m.vUp = s.jumpSpeed;
      m.vH = vec3.scale(c.climb.wall, -c.movement.climb.off);
      c.mode = 'air';
      c.jump.pending = 0;
      c.jump.inAir = c.movement.jump.coyote + 1;
    },
    // It looks at its wall.
    facing: { way: (c) => (isZero(c.climb.wall) ? null : [...c.climb.wall]) },
    reset: (c) => void (c.climb.wall = [0, 0, 0]),
  },
  // Crouching (stage 4b): standing on something, holding `crouch`, if it can; as walking, slower (running
  // does not hurry it), its body low, less seen and heard.
  crouch: {
    applies: (c, s) => c.grounded && s.crouching && c.can.crouch,
    steer: (c, now, _wanted, move, dt, traction) =>
      approach(now, vec3.scale(move, c.movement.crouch.speed), c.movement.walk.acceleration * traction * dt),
    low: true,
    seen: (c) => c.movement.crouch.seen,
    steps: true,
    heard: (c) => c.movement.crouch.heard,
    feet: true,
  },
  // Blocking (stage 4f): standing on something, holding `block`, if it can; as walking, slower (running
  // does not hurry it), guarding itself.
  block: {
    applies: (c, s) => c.grounded && s.blocking && c.can.block,
    steer: (c, now, _wanted, move, dt, traction) =>
      approach(now, vec3.scale(move, c.movement.block.speed), c.movement.walk.acceleration * traction * dt),
    feet: true,
  },
  // Rolling (stage 4b): until its roll's time is over, the way it rolls, at its speed, whatever it asks,
  // its body low, looking the way it rolls. It does not jump: a jump asked for is kept as long as ever,
  // `jump.buffer` steps, and if the roll ends before that, it jumps then.
  roll: {
    applies: (c) => c.roll.steps > 0,
    steer: (c) => vec3.scale(c.roll.way, c.movement.roll.speed),
    low: true,
    ownWay: true,
    jump: (c) => void c.jump.pending--,
    facing: { firm: true, way: (c) => [...c.roll.way] },
    reset: (c) => void (c.roll.steps = 0),
  },
  // Down a wall it pushes against in the air (stage 5c): it steers as in the air, and slides no faster than `wall.slide`.
  slide: {
    applies: (_c, s) => s.sliding,
    steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.air.control * dt),
    fall: (c) => c.movement.wall.slide,
    holdsOn: true,
  },
  // Hanging from a ledge it grabbed (stage 5c): still, its hands on it; gravity does not pull it. It looks
  // at the wall under the ledge; in another mode, it holds no ledge.
  hang: {
    applies: (c) => c.hang.ledge !== null,
    steer: () => [0, 0, 0],
    holds: () => 0,
    holdsOn: true,
    outside: (c) => void (c.hang.ledge = null),
    reset: (c) => void (c.hang = { ledge: null, regrab: 0 }),
    own: hangOn,
    facing: { way: (c) => (c.hang.ledge ? [...c.hang.ledge.wall] : null) },
  },
};

/** The ways of moving there are (stage 5.5e: what a ghost's file may say). */
export const MODE_NAMES = Object.keys(MODES) as readonly ModeName[];

/**
 * A CHARACTER PUT SOMEWHERE ELSE (stage 5.5f, the audit's W6): what it was doing stops, as each way of
 * moving says (a roll ends, a ledge is let go, the wall it climbed is no longer there), and so does its
 * motion: no velocity, in the air, born there (no coyote time), no jump kept, rising or hanging at a top,
 * no wall to leap off, nothing it was thrown with, carried or carried by; its jumps in the air back.
 * Before, `place` reset five of these: one sent back to a checkpoint mid-roll kept rolling, and within the
 * coyote time of a wall it could leap off that wall from the checkpoint.
 */
export function stopMotion(c: Character) {
  c.velocity = [0, 0, 0];
  c.grounded = false;
  c.thrown = false;
  c.carry = [0, 0, 0];
  c.ground = { velocity: [0, 0, 0], spin: 0 };
  c.jump = { ...c.jump, pending: 0, air: c.movement.jump.air, inAir: c.movement.jump.coyote + 1, rising: false, hung: 0 };
  c.wallJump = { off: [0, 0, 0], lock: 0, near: null };
  for (const name of MODE_NAMES) MODES[name].reset?.(c);
}

/** How much of the light a character is seen by, in its posture (stage 4b: crouched, less). */
export const seenOf = (c: Character): number => MODES[c.mode].seen?.(c) ?? 1;

/**
 * WHICH MODE (stage 2b), decided here and only here: the first that applies, in this order. Crouching
 * comes twice: right after rolling, a low body with no room to stand up (stage 4b: under a low gap)
 * stays low, crouched, whatever it asks; and in its own turn, asked for.
 */
const CHOICE: readonly (readonly [ModeName, Mode['applies']])[] = [
  ['roll', MODES.roll.applies],
  ['crouch', (c, s) => MODES[c.mode].low === true && !s.room],
  ['climb', MODES.climb.applies],
  ['hang', MODES.hang.applies],
  ['crouch', MODES.crouch.applies],
  ['block', MODES.block.applies],
  ['walk', MODES.walk.applies],
  ['slide', MODES.slide.applies],
  ['glide', MODES.glide.applies],
  ['air', MODES.air.applies],
];

export const modeFor = (c: Character, s: Senses, m: Motion): ModeName => CHOICE.find(([, applies]) => applies(c, s, m))![0];

/** How long climbing onto a ledge takes (stage 5c), up and then on, each (s). */
const CLIMB_UP = 0.15;

/**
 * HANGING FROM A LEDGE (stage 5c), its own motion. Jumping, or pushing on once it has hung a fifth of a
 * second (it came pushing towards the wall: it does not climb in the step it grabs), it climbs onto it:
 * up until its feet clear the top, then onto it, `CLIMB_UP` each, its hands on the edge until it is up (a
 * motion of its own, through what is in the way: a hop with gravity lost its way forward against the
 * wall, which takes the velocity into it). Jumping pushing away, it leaps off, as from a wall; pushing
 * away, or crouching, it lets go (and does not grab again for a fifth of a second). Else it stays, its
 * hands on the edge, its body a gap off the wall.
 */
function hangOn(c: Character, s: Senses, m: Motion, dt: number) {
  if (!c.hang.ledge) return;
  const L = c.hang.ledge;
  const { at, wall } = L;
  const { up, here, radius } = s;
  const toward = vec3.dot(s.move, wall);
  const half = Math.max(1, Math.round(CLIMB_UP / dt));
  const tall = s.frame.bottom;
  const climbUp = L.climb === 0 && ((c.jump.pending > 0 && toward > -0.5) || (toward > 0.5 && L.steps >= Math.round(0.2 / dt)));
  if (climbUp) {
    L.climb = 2 * half;
    c.jump.pending = 0;
  }
  m.vUp = 0;
  m.vH = [0, 0, 0];
  if (L.climb > 0) {
    // Up, as far as its feet must go to stand on the top; then on, until its middle is over the top.
    const rise = vec3.dot(vec3.sub(at, here), up) + tall + CHARACTER_GAP + 0.02;
    const on = vec3.dot(vec3.sub(at, here), wall) + radius - 0.05;
    m.own = L.climb > half ? vec3.scale(up, rise / (L.climb - half)) : vec3.scale(wall, on / L.climb);
    L.climb--;
    if (L.climb === 0) {
      c.hang.ledge = null;
      c.hang.regrab = Math.round(0.2 / dt);
    }
  } else if ((c.jump.pending > 0 && toward <= -0.5) || toward < -0.5 || s.crouching) {
    c.hang.ledge = null;
    c.mode = 'air';
    c.hang.regrab = Math.round(0.2 / dt);
    if (c.jump.pending > 0) {
      m.vUp = s.jumpSpeed;
      m.vH = vec3.scale(wall, -c.movement.wall.off);
      c.wallJump.off = [...wall];
      c.wallJump.lock = Math.round(c.movement.wall.lock / dt);
      c.jump.rising = true;
    } else m.vH = vec3.scale(wall, -1);
    c.jump.pending = 0;
  } else {
    L.steps++;
    m.own = vec3.sub(
      vec3.sub(vec3.sub(at, vec3.scale(wall, 0.1 + radius + CHARACTER_GAP + WALL_GAP)), vec3.scale(up, s.hands)),
      here,
    );
  }
}

/**
 * THE SHAPE A CHARACTER'S BODY TAKES NOW (stage 2e, for phase 4): its pose for the mode it is in, if
 * the game gave one; crouching, if it gave none, its body made lower (`crouchPoseOf`); if not, its
 * body's shape, centered and upright.
 */
export function poseOf(c: Character, body: Pick<Body, 'shape'>, mode: ModeName = c.mode): CollisionPose {
  // (A low mode, stage 4b: crouching, rolling, its own pose or the crouched one.)
  if (MODES[mode].low) return c.poses?.[mode] ?? crouchPoseOf(c, body);
  return c.poses?.[mode] ?? { shape: body.shape, offset: [0, 0, 0], rotation: quat.identity() };
}

/**
 * WHAT A HIT CAN FIND OF A CHARACTER in a way of moving (stage 4c, decision 0022): the parts the game
 * gives for it; if none, one part, `body`, its pose for that mode (a body that is not a ball or a
 * capsule, as the ball around it).
 */
export function hitPartsOf(c: Character, body: Pick<Body, 'shape'>, mode: ModeName = c.mode): HitPart[] {
  const given = c.hits?.[mode];
  if (given) return given;
  const pose = poseOf(c, body, mode);
  const s = pose.shape;
  const shape: HitPart['shape'] =
    s.kind === 'ball' || s.kind === 'capsule' ? s : { kind: 'ball', radius: s.kind === 'box' ? vec3.length(s.halfExtents) : 0.5 };
  return [{ name: 'body', shape, offset: pose.offset, rotation: pose.rotation }];
}

/**
 * WHERE A CHARACTER'S EYES ARE, above its center (stage 4.5a): its head's height in the way it moves
 * now (its hit part named `head`: 0.62 m standing, 0.12 m crouched for the games' character); with no
 * head, the top of what a hit finds less 18 cm (the standing head's place below its top: rolling, a
 * ball). Only the height: the eyes stay over the center (a crouch's head leans 40 cm ahead, and a
 * first-person camera there would go into the wall a crouching body touches). What a first-person
 * camera is drawn from; the author found it did not come down crouching.
 */
export function eyeHeightOf(c: Character, body: Pick<Body, 'shape'>, mode: ModeName = c.mode): number {
  const parts = hitPartsOf(c, body, mode);
  const head = parts.find((p) => p.name === 'head');
  if (head) return head.offset[1];
  const top = (p: HitPart) =>
    p.offset[1] +
    (p.shape.kind === 'ball' ? p.shape.radius : p.shape.kind === 'capsule' ? p.shape.halfHeight + p.shape.radius : 0);
  return Math.max(...parts.map(top)) - 0.18;
}
