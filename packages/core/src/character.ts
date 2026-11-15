import { quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { gravityAt } from './gravity';
import { axisOf, isDown, NO_INPUT, vectorOf } from './input';
import type { Body, Character, CharacterSpec, CollisionPose, Entity, ModeName, Movement } from './types';
import type { World } from './world';

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
  turn: 3,
});

export function newCharacter(spec: CharacterSpec): Character {
  const m = spec.movement ?? {};
  const movement: Movement = {
    walk: { ...DEFAULT_MOVEMENT.walk, ...m.walk },
    air: { ...DEFAULT_MOVEMENT.air, ...m.air },
    jump: { ...DEFAULT_MOVEMENT.jump, ...m.jump },
    glide: { ...DEFAULT_MOVEMENT.glide, ...m.glide },
    climb: { ...DEFAULT_MOVEMENT.climb, ...m.climb },
    turn: m.turn ?? DEFAULT_MOVEMENT.turn,
  };
  return {
    player: spec.player,
    movement,
    // Without capabilities, unless the game gives them (stage 2c).
    can: { doubleJump: false, glide: false, climb: false, ...spec.can },
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
    carry: [0, 0, 0],
    ground: { velocity: [0, 0, 0], spin: 0 },
    carriedTurn: quat.identity(),
    ...(spec.poses ? { poses: structuredPoses(spec.poses) } : {}),
  };
}

/** A copy of the poses a character is given (plain data, its own). */
const structuredPoses = (poses: Partial<Record<ModeName, CollisionPose>>): Partial<Record<ModeName, CollisionPose>> =>
  Object.fromEntries(
    Object.entries(poses).map(([mode, p]) => [
      mode,
      { shape: { ...p!.shape }, offset: [...p!.offset], rotation: [...p!.rotation] },
    ]),
  ) as Partial<Record<ModeName, CollisionPose>>;

/**
 * THE SHAPE A CHARACTER'S BODY TAKES NOW (stage 2e, for phase 4): its pose for the mode it is in, if
 * the game gave one; if not, its body's shape, centered and upright.
 */
export function poseOf(c: Character, body: Pick<Body, 'shape'>): CollisionPose {
  return c.poses?.[c.mode] ?? { shape: body.shape, offset: [0, 0, 0], rotation: quat.identity() };
}

/**
 * A WAY OF MOVING (stage 2b; decision 0000: "one exclusive locomotion mode plus contributions that
 * add up, resolved in one place"). Exactly one is active at each step. It decides how the velocity
 * along the ground goes towards what the player asks for; and, if it is its business, the velocity up:
 * a mode that holds itself (climbing) sets it, and gravity does not apply; a mode that slows the fall
 * (gliding) says how fast it can fall at most.
 */
interface Mode {
  /** The velocity along the ground at the end of this step, from the one it has, the one asked for and the direction asked. */
  steer(c: Character, now: Vec3, wanted: Vec3, move: Vec3, dt: number): Vec3;
  /** If it holds itself against gravity: its own velocity up. */
  holds?(c: Character, move: Vec3): number;
  /** If it slows the fall: the fastest it falls, m/s. */
  fall?(c: Character): number;
}

/** Goes from `now` towards `wanted`, changing at most `most` (m/s) in this step. */
const approach = (now: Vec3, wanted: Vec3, most: number): Vec3 => {
  const diff = vec3.sub(wanted, now);
  const away = vec3.length(diff);
  return away <= most ? wanted : vec3.add(now, vec3.scale(diff, most / away));
};
const isZero = (v: Vec3) => v[0] === 0 && v[1] === 0 && v[2] === 0;

const MODES: Record<ModeName, Mode> = {
  // On the ground: towards what is asked, quickly (its feet push against the floor).
  walk: { steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.walk.acceleration * dt) },
  // In the air: the same, but with what the game allows to steer (0: the jump's arc cannot change).
  air: { steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.air.control * dt) },
  // Gliding (stage 2c): it steers more, and it falls slowly.
  glide: {
    steer: (c, now, wanted, _move, dt) => approach(now, wanted, c.movement.glide.control * dt),
    fall: (c) => c.movement.glide.fall,
  },
  // Climbing (stage 2c): along the wall, as much as is asked along it; up, as much as it pushes
  // against it. Not towards it: the controller would not let it rise along something that steep.
  // Gravity does not pull it.
  climb: {
    steer: (c, _now, _wanted, move) => vec3.scale(vec3.onPlane(move, c.wall), c.movement.climb.speed),
    holds: (c, move) => c.movement.climb.speed * Math.max(0, vec3.dot(move, c.wall)),
  },
};

/**
 * WHICH MODE, decided here and only here (stage 2b), with what it can do (stage 2c):
 * - pushing against a wall it touches, if it can climb: it climbs (from the ground, or going on
 *   climbing, or in the air while it is not going up: just after jumping off a wall, it does not grab
 *   it again before it starts to fall);
 * - standing on something: it walks;
 * - falling while it holds the jump, if it can glide: it glides;
 * - otherwise: it is in the air.
 */
const modeFor = (c: Character, move: Vec3, jumping: boolean, vUp: number): ModeName => {
  if (c.can.climb && vec3.dot(move, c.wall) > 0.5 && (c.grounded || c.mode === 'climb' || vUp <= 0)) return 'climb';
  if (c.grounded) return 'walk';
  if (c.can.glide && jumping && vUp < 0) return 'glide';
  return 'air';
};

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

/**
 * A WALL in that direction (stage 2c; with the world's ray since 2.5b): a ray from `from` along
 * `direction` (of length 1), as far as `reach`; if it hits something the physics does not move that
 * stands almost upright, the direction towards it, along the ground and of length 1; if not, zero.
 * Not with the character controller's collisions: those only exist while it pushes against the wall,
 * and pushing against a wall steeper than what it climbs, the controller does not let it rise along it.
 */
function wallAhead(world: World, e: Entity, from: Vec3, direction: Vec3, reach: number, up: Vec3): Vec3 {
  const hit = world.castRay(from, direction, reach, { skip: e.id, dynamic: false });
  if (!hit) return [0, 0, 0];
  const n = hit.normal;
  const along = vec3.dot(n, up);
  if (along < -0.35 || along > 0.35) return [0, 0, 0]; // a floor, a ceiling, a slope: not a wall
  // The surface's normal points out of it, towards the character: the wall is the other way.
  const flat = vec3.sub(vec3.scale(up, along), n);
  const length = vec3.length(flat);
  return length > 1e-6 ? vec3.scale(flat, 1 / length) : [0, 0, 0];
}

/**
 * WHAT A CHARACTER STANDS ON (stage 2.5b): its own capsule, a little thinner (90% of its radius,
 * with its bottom where it is, so a wall brushing its sides does not count), moved down from where
 * it is, as far as the controller keeps it on the ground: the first thing it would touch whose
 * surface faces up. The entity, and, if the program moves it (a platform), how it moves. Bodies the
 * physics moves (a cube) are not platforms: standing on one, it stands on nothing that carries it.
 *
 * Before, a ray from its center: on a platform's edge, with its center already beyond it and the round
 * bottom of its capsule still on it, the ray found nothing (stage 2d left the platform's last velocity
 * there, without carrying it: a fix halfway).
 */
function standingOn(
  world: World,
  e: Entity,
  up: Vec3,
): { entity: number; moves: { linear: Vec3; angular: Vec3; center: Vec3 } | null } | null {
  const shape = e.body!.shape;
  if (shape.kind !== 'capsule') return null;
  const radius = shape.radius * 0.9;
  const thinner = { kind: 'capsule' as const, halfHeight: shape.halfHeight + (shape.radius - radius), radius };
  const down = vec3.scale(up, -1);
  const hit = world.castShape(thinner, e.transform!.position, e.transform!.rotation, down, GROUND_REACH, {
    skip: e.id,
    dynamic: false,
  });
  if (!hit || vec3.dot(hit.normal, up) < 0.5) return null;
  const body = world.entities.get(hit.entity)?.body;
  const motion = body ? world.physics.motionOf(body.handle) : null;
  return { entity: hit.entity, moves: motion?.kinematic ? motion : null };
}

/** How far under its capsule a character looks for what it stands on: what the controller snaps it down (0.3 m), and a little. */
const GROUND_REACH = 0.35;

/**
 * THE CHARACTER SYSTEM, one step of one character (stage 1b; in modes since 2b). All its math is
 * additions, multiplications and square roots (no trigonometry): the same bits in every browser.
 * Everything is resolved here, in this order:
 *
 *   1. it turns on its own axis, if asked to (stage 1c2);
 *   2. THE MODE (only one, chosen in `modeFor`): its velocity splits into "up" (along its up) and
 *      "along the ground" (the rest), and the mode steers the part along the ground;
 *   3. a jump: asked for (pressed, not held), kept a few steps if it was too early, allowed a few
 *      steps after leaving an edge; or from a wall, or one more in the air, if it can (stage 2c);
 *   4. THE CONTRIBUTIONS, whatever the mode: gravity (unless the mode holds itself, as climbing; a mode
 *      may slow the fall, as gliding), what the game makes it carry, and what it stands on, if it
 *      moves (stage 2d): they move it, this step only;
 *   5. the character controller says how much of the desired movement it can really do: it slides
 *      along walls, climbs steps, stays on slopes and on the ground, and pushes what can be pushed;
 *   6. what it learned: whether it stands on something, whether it hit a ceiling, where it looks.
 *
 * The body moves there during the physics step (it is a kinematic body moved by position).
 */
export function moveCharacter(world: World, e: Entity, dt: number) {
  const c = e.character!;
  const body = e.body!;
  const input = world.inputs.get(c.player) ?? NO_INPUT;
  const gravity = vec3.length(gravityAt(world.gravity, e.transform!.position));
  const up = upAt(world, e.transform!.position);

  // 1: turning on its own axis (where it looks may be told instead: that comes first).
  const face = vec3.onPlane(vectorOf(input, 'face'), up);
  const told = vec3.length(face) > 0.1;
  const turn = axisOf(input, 'turn');
  if (!told && turn !== 0) c.facing = turned(c.facing, up, turn, c.movement.turn, dt);

  // 2: what is asked for (in the world, plus forward and to the side by where it looks now); the
  // mode; and the velocity along the ground, as the mode steers it.
  let vUp = vec3.dot(c.velocity, up);
  let vH = vec3.onPlane(c.velocity, up);
  const inWorld = vec3.onPlane(vectorOf(input, 'move'), up);
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  const right = vec3.cross(ahead, up);
  let move = vec3.add(inWorld, vec3.add(vec3.scale(ahead, axisOf(input, 'ahead')), vec3.scale(right, axisOf(input, 'side'))));
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  const wanted = vec3.scale(move, isDown(input, 'run') ? c.movement.walk.run : c.movement.walk.speed);
  const jumping = isDown(input, 'jump');
  // A wall, if it can climb: from its feet, towards the wall it climbs, or towards where it is asked
  // to go (a little beyond its radius). From its feet, so it keeps climbing until they pass the top.
  if (c.can.climb) {
    const towards = isZero(c.wall) ? (vec3.length(move) > 0.1 ? vec3.normalize(move) : null) : c.wall;
    const feet = vec3.add(e.transform!.position, vec3.scale(up, -0.5));
    c.wall = towards ? wallAhead(world, e, feet, towards, 0.55, up) : [0, 0, 0];
  } else c.wall = [0, 0, 0];
  const before = c.mode;
  c.mode = modeFor(c, move, jumping, vUp);
  let mode = MODES[c.mode];
  vH = mode.steer(c, vH, wanted, move, dt);
  // The top of a wall: it was climbing and the wall ended. A hop up, so it gets onto it.
  if (before === 'climb' && c.mode !== 'climb' && isZero(c.wall)) vUp = Math.max(vUp, c.movement.climb.top);

  // What it stands on (stage 2d; with its whole capsule since 2.5b), if it stands: if it moves, how it
  // moves in this step. It carries it (after the controller, below), it turns it with it, and a jump
  // keeps its velocity. Stepping from something that moves onto something still, standing all the
  // time (down the 30 cm of the course's ferry), it keeps that velocity, as walking off an edge does:
  // the walk steers it from there (before, it stopped dead).
  const here = e.transform!.position;
  const wasGrounded = c.grounded;
  const under = c.grounded ? standingOn(world, e, up) : null;
  const ride = under?.moves ? carriedBy(under.moves, here, dt) : null;
  if (under?.moves && ride) c.ground = { velocity: ride.velocity, spin: vec3.dot(under.moves.angular, up) };
  else {
    if (c.grounded && !isZero(c.ground.velocity)) vH = vec3.add(vH, vec3.onPlane(c.ground.velocity, up));
    c.ground = { velocity: [0, 0, 0], spin: 0 };
  }
  if (ride) {
    const looking = vec3.onPlane(quat.rotate(ride.turn, c.facing), up);
    if (vec3.length(looking) > 1e-6) c.facing = vec3.normalize(looking);
    // The turn it carries: where it is told to look turns with it too (`carriedTurn`, and step 6).
    c.carriedTurn = quat.normalize(quat.multiply(ride.turn, c.carriedTurn));
  }
  let leapt = false;

  // 3: the jump: from the ground (or just after leaving it), from a wall, or one more in the air.
  const { jump } = c.movement;
  if (jumping && !c.jumpHeld) c.jumpPending = jump.buffer;
  c.jumpHeld = jumping;
  if (c.grounded || c.mode === 'climb') c.airJumps = jump.air;
  if (c.jumpPending > 0) {
    if (c.mode === 'climb') {
      // Off the wall: up, and away from it.
      vUp = jump.speed;
      vH = vec3.scale(c.wall, -c.movement.climb.off);
      c.mode = 'air';
      mode = MODES.air;
      c.jumpPending = 0;
      c.stepsInAir = jump.coyote + 1;
    } else if (c.grounded || c.stepsInAir <= jump.coyote) {
      // (From a moving platform, it keeps the platform's velocity: it leaves with it.)
      vH = vec3.add(vH, vec3.onPlane(c.ground.velocity, up));
      vUp = jump.speed + Math.max(0, vec3.dot(c.ground.velocity, up));
      leapt = true;
      c.jumpPending = 0;
      c.stepsInAir = jump.coyote + 1; // the coyote time is over: from now on, only a jump in the air
    } else if (c.can.doubleJump && c.airJumps > 0) {
      vUp = jump.speed;
      c.airJumps--;
      c.jumpPending = 0;
    } else c.jumpPending--;
  }

  // 4: the contributions. Gravity changes the velocity (unless the mode holds itself; a mode may
  // slow the fall); what carries it only moves it, this step.
  if (mode.holds) vUp = mode.holds(c, move);
  else {
    vUp -= gravity * dt;
    const fall = mode.fall?.(c);
    if (fall !== undefined) vUp = Math.max(vUp, -fall);
  }
  const carried: Vec3 = [...c.carry];
  c.carry = [0, 0, 0];

  // 5: what it can really do.
  const desired = vec3.scale(vec3.add(vec3.add(vH, vec3.scale(up, vUp)), carried), dt);
  const platform = under?.moves ? world.entities.get(under.entity)?.body?.handle : undefined;
  const { movement, grounded, ceiling } = world.physics.moveCharacter(body.handle, desired, up, platform);

  // 6: what it learned. (A ceiling is what the controller says hit its head: rising a little less
  // than asked is not one; that happens brushing a wall, and it used to cut jumps short.)
  if (vUp > 0 && ceiling) vUp = 0;
  if (grounded && vUp < 0) vUp = 0;
  c.grounded = grounded;
  c.stepsInAir = grounded ? 0 : c.stepsInAir + 1;
  // A platform that moves or turns carries it (stage 2d), if it stood on it and did not jump off it:
  // exactly as far as the platform takes the point where it is. After the controller, not through
  // it: the controller saw the platform fixed (physics.ts), and a platform going down would have
  // stopped it from going down with it. If it walked off the edge (it stood, and now it does not,
  // without jumping), it keeps the platform's velocity along the ground, as it would jumping; and
  // from then on, it stands on nothing that moves.
  const riding: Vec3 = ride && !leapt ? ride.movement : [0, 0, 0];
  if (wasGrounded && !grounded && !leapt) {
    vH = vec3.add(vH, vec3.onPlane(c.ground.velocity, up));
    c.ground = { velocity: [0, 0, 0], spin: 0 };
  }
  c.velocity = vec3.add(vH, vec3.scale(up, vUp));
  // Where it looks: where it is told to, if it is told; if not, where it moves in the world. (Moving
  // by where it looks does not change it: walking back would turn it around, and back again.)
  // Climbing, it looks at its wall. What it is told is read inside the turn the platforms gave it
  // (`carriedTurn`): told the same thing step after step, a turning platform still turns it.
  const toldLooking = told ? vec3.onPlane(quat.rotate(c.carriedTurn, vectorOf(input, 'face')), up) : null;
  if (toldLooking && vec3.length(toldLooking) > 1e-6) c.facing = vec3.normalize(toldLooking);
  else if (c.mode === 'climb' && !isZero(c.wall)) c.facing = [...c.wall];
  else if (vec3.length(inWorld) > 0.1) c.facing = vec3.normalize(inWorld);
  const position = vec3.add(vec3.add(world.physics.position(body.handle), movement), riding);
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));
}
