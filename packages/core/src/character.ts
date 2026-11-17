import { quat, sinCosDegrees, vec3, type Quat, type Vec3 } from '@manifold/common';
import { gravityAt } from './gravity';
import { tractionOf } from './materials';
import { CHARACTER_GAP, STANDS_ON } from './physics';
import { STRIDE, stepRadius } from './sound';
import { axisOf, isDown, NO_INPUT, pressed, vectorOf } from './input';
import type { Body, Character, CharacterSpec, CollisionPose, Entity, ModeName, Movement, Shape } from './types';
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
  crouch: { speed: 2, seen: 0.5, heard: 0.5 },
  roll: { speed: 5, time: 0.6 },
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
    crouch: { ...DEFAULT_MOVEMENT.crouch, ...m.crouch },
    roll: { ...DEFAULT_MOVEMENT.roll, ...m.roll },
    turn: m.turn ?? DEFAULT_MOVEMENT.turn,
  };
  return {
    player: spec.player,
    movement,
    // Without capabilities, unless the game gives them (stage 2c).
    can: { doubleJump: false, glide: false, climb: false, crouch: false, roll: false, ...spec.can },
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
 * the game gave one; crouching, if it gave none, its body made lower (`crouchPoseOf`); if not, its
 * body's shape, centered and upright.
 */
export function poseOf(c: Character, body: Pick<Body, 'shape'>): CollisionPose {
  if (c.mode === 'roll') return c.poses?.roll ?? crouchPoseOf(c, body);
  if (c.mode === 'crouch') return crouchPoseOf(c, body);
  return c.poses?.[c.mode] ?? { shape: body.shape, offset: [0, 0, 0], rotation: quat.identity() };
}

/** Whether a mode moves the low body (stage 4b): crouching, and rolling. */
const low = (mode: ModeName) => mode === 'crouch' || mode === 'roll';

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
 * WHETHER A SHAPE FITS WHERE A CHARACTER IS (stage 4b: room to stand up): upright, at its place, it
 * touches nothing but the character itself (a shape swept up by the controller's gap meets nothing).
 */
function fits(world: World, e: Entity, shape: Shape, up: Vec3): boolean {
  return world.castShape(shape, e.transform!.position, e.transform!.rotation, up, CHARACTER_GAP, { skip: e.id }) === null;
}

/**
 * A WAY OF MOVING (stage 2b; decision 0000: "one exclusive locomotion mode plus contributions that
 * add up, resolved in one place"). Exactly one is active at each step. It decides how the velocity
 * along the ground goes towards what the player asks for; and, if it is its business, the velocity up:
 * a mode that holds itself (climbing) sets it, and gravity does not apply; a mode that slows the fall
 * (gliding) says how fast it can fall at most.
 */
interface Mode {
  /**
   * The velocity along the ground at the end of this step, from the one it has, the one asked for and
   * the direction asked; and how much what it stands on lets its feet push (`traction`, 0 to 1).
   */
  steer(c: Character, now: Vec3, wanted: Vec3, move: Vec3, dt: number, traction: number): Vec3;
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
  // On the ground: towards what is asked, quickly (its feet push against the floor), as much as the
  // floor lets them (stage 3b: on ice, it slides).
  walk: { steer: (c, now, wanted, _move, dt, traction) => approach(now, wanted, c.movement.walk.acceleration * traction * dt) },
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
  // Crouching (stage 4b): as walking, slower (running does not hurry it), its body low.
  crouch: {
    steer: (c, now, _wanted, move, dt, traction) =>
      approach(now, vec3.scale(move, c.movement.crouch.speed), c.movement.walk.acceleration * traction * dt),
  },
  // Rolling (stage 4b): the way it rolls, at its speed, whatever it asks, its body low.
  roll: { steer: (c) => vec3.scale(c.rollDirection, c.movement.roll.speed) },
};

/**
 * WHICH MODE, decided here and only here (stage 2b), with what it can do (stage 2c):
 * - rolling (stage 4b): it rolls, until its roll's time is over;
 * - low (crouched, or at the end of a roll) with no room to stand up (stage 4b: under a low gap): it
 *   crouches, whatever it asks;
 * - pushing against a wall it touches, if it can climb: it climbs (from the ground, or going on
 *   climbing, or in the air while it is not going up: just after jumping off a wall, it does not grab
 *   it again before it starts to fall);
 * - standing on something, holding `crouch`, if it can: it crouches;
 * - standing on something: it walks;
 * - falling while it holds the jump, if it can glide: it glides;
 * - otherwise: it is in the air.
 */
const modeFor = (c: Character, move: Vec3, jumping: boolean, vUp: number, crouching: boolean, room: boolean): ModeName => {
  if (c.rolling > 0) return 'roll';
  if (low(c.mode) && !room) return 'crouch';
  if (c.can.climb && vec3.dot(move, c.wall) > 0.5 && (c.grounded || c.mode === 'climb' || vUp <= 0)) return 'climb';
  if (c.grounded && crouching && c.can.crouch) return 'crouch';
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
 * WHERE A CHARACTER AIMS (stage 4b): where it looks, tilted by its pitch towards its "up" (`ahead`, of
 * length 1), and the aim's own up (`above`, square with it): what is thrown a little above the aim
 * goes along both. With our own sine and cosine, so the same bits in every browser. `up` is the
 * character's, of length 1 (`upAt`).
 */
export function aimOf(c: Pick<Character, 'facing' | 'pitch'>, up: Vec3): { ahead: Vec3; above: Vec3 } {
  const [sin, cos] = sinCosDegrees(c.pitch);
  return {
    ahead: vec3.add(vec3.scale(c.facing, cos), vec3.scale(up, sin)),
    above: vec3.sub(vec3.scale(up, cos), vec3.scale(c.facing, sin)),
  };
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
 * stands almost upright, the direction towards it, along the ground and of length 1, and how far along
 * the ray it is; if not, zero. Not with the character controller's collisions: those only exist while
 * it pushes against the wall, and pushing against a wall steeper than what it climbs, the controller
 * does not let it rise along it.
 */
function wallAhead(
  world: World,
  e: Entity,
  from: Vec3,
  direction: Vec3,
  reach: number,
  up: Vec3,
): { wall: Vec3; distance: number } {
  const none = { wall: [0, 0, 0] as Vec3, distance: 0 };
  const hit = world.castRay(from, direction, reach, { skip: e.id, dynamic: false });
  if (!hit) return none;
  const n = hit.normal;
  const along = vec3.dot(n, up);
  if (along < -0.35 || along > 0.35) return none; // a floor, a ceiling, a slope: not a wall
  // The surface's normal points out of it, towards the character: the wall is the other way.
  const flat = vec3.sub(vec3.scale(up, along), n);
  const length = vec3.length(flat);
  return length > 1e-6 ? { wall: vec3.scale(flat, 1 / length), distance: hit.distance } : none;
}

/**
 * HOW FAST A CLIMBING CHARACTER COMES TO ITS WALL (stage 4a), m/s at most. It finds the wall with a ray
 * up to 55 cm ahead, and climbed where it found it: 22 cm off the wall, the hands of the view could not
 * reach it. So it comes in until it is `WALL_GAP` from touching, never into the wall (the controller
 * would not let it rise along something that steep).
 */
const WALL_APPROACH = 2;
const WALL_GAP = 0.01;

/**
 * WHETHER A WALL IT CLIMBED ENDED AT ITS TOP (closing phase 2), and not at a side edge. At the top,
 * the wall's face is still there just below its feet (they have only just passed the edge): a ray
 * towards the wall from 15 cm under them finds it, and says how far it is (a character climbs close to
 * the wall, a centimeter from touching it, since stage 4a; it used to climb where its ray found it, up
 * to 55 cm away, and this ray still looks as far). Then, 10 cm beyond that face, a
 * short ray down from a little above its feet finds the top it can get onto. Past a side edge there
 * is no face in front, at any height. (A first version looked a fixed 40 cm ahead: from 48 cm away,
 * that was in front of the face, it found no top, and the hop did not come.)
 */
function topAhead(world: World, e: Entity, feet: Vec3, wall: Vec3, up: Vec3): boolean {
  if (isZero(wall)) return false;
  const face = world.castRay(vec3.add(feet, vec3.scale(up, -0.15)), wall, 0.65, { skip: e.id, dynamic: false });
  if (!face) return false;
  const above = 0.6;
  const from = vec3.add(vec3.add(feet, vec3.scale(wall, face.distance + 0.1)), vec3.scale(up, above));
  const hit = world.castRay(from, vec3.scale(up, -1), above + 0.3, { skip: e.id, dynamic: false });
  return hit !== null && vec3.dot(hit.normal, up) > 0.7;
}

/**
 * WHAT A CHARACTER STANDS ON (stage 2.5b): its own capsule, a little thinner (90% of its radius,
 * with its bottom where it is, so a wall brushing its sides does not count), moved down from where
 * it is, as far as the controller keeps it on the ground: the first thing it would touch whose
 * surface faces up. The entity, the surface's normal there (stage 3b), how far below its bottom it is
 * (stage 3c), and, if the program moves it (a platform), how it moves. Bodies the
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
): { entity: number; normal: Vec3; distance: number; moves: { linear: Vec3; angular: Vec3; center: Vec3 } | null } | null {
  const shape = e.body!.shape;
  if (shape.kind !== 'capsule') return null;
  const radius = shape.radius * 0.9;
  const thinner = { kind: 'capsule' as const, halfHeight: shape.halfHeight + (shape.radius - radius), radius };
  const down = vec3.scale(up, -1);
  const cast = (capsule: typeof shape) =>
    world.castShape(capsule, e.transform!.position, e.transform!.rotation, down, GROUND_REACH, { skip: e.id, dynamic: false });
  const found = (hit: ReturnType<typeof cast>) => {
    if (!hit || vec3.dot(hit.normal, up) < 0.5) return null;
    const body = world.entities.get(hit.entity)?.body;
    const motion = body ? world.physics.motionOf(body.handle) : null;
    return { entity: hit.entity, normal: hit.normal, distance: hit.distance, moves: motion?.kinematic ? motion : null };
  };
  const thin = found(cast(thinner));
  if (thin?.moves) return thin;
  // What the program moves, also by an edge under its round bottom (stage 3a): with its center past a
  // moving platform's edge, the thinner capsule misses it, and the controller, not given it as fixed,
  // could not get onto it (boarding the ferry as it pulled away, it was dragged along on its edge).
  const edge = found(cast(shape));
  return edge?.moves ? edge : thin;
}

/**
 * HOLDING (stage 3g): how far it reaches to grab (m, from its chest along where it looks), where it holds
 * (in front of it and a little up), how far the held thing may get before it lets go, how hard it can
 * pull (N: a wooden crate of 45 kg comes along; a stone block of a tonne does not leave the ground), and
 * how quickly it brings it to where it holds it (s). It lets go at 2 m: turning to walk, where it holds
 * swings round at once (a crate on the floor in front, a quarter turn: 1.5 m away).
 */
export const HOLD = Object.freeze({ reach: 1.2, distance: 0.95, lift: 0.2, letGo: 2, force: 1200, settle: 0.12 });

/**
 * GRABBING AND HOLDING (stage 3g): `grab`, pressed, takes what the physics moves in front of it (a
 * short sphere swept from its chest along where it looks), or lets go of what it holds. Held, it stays
 * the physics': on every step it is pushed (`World.push`) with the change of velocity that would take it
 * where it is held in `HOLD.settle` seconds, moving as the character moves, gravity's own step taken
 * back; never more than `HOLD.force` can do in a step for its mass, so a heavy thing hangs back. Too far
 * (it fell, it caught on something, it was too heavy to lift), it lets go.
 */
function hold(world: World, e: Entity, c: Character, up: Vec3, dt: number) {
  let held = c.holding ? world.entities.get(c.holding) : undefined;
  if (c.holding && held?.body?.type !== 'dynamic') {
    c.holding = 0;
    held = undefined;
  }
  const position = e.transform!.position;
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  if (pressed(world, c.player, 'grab')) {
    if (held) {
      c.holding = 0;
      return;
    }
    // Low (a crate on the floor) and high (one on a shelf): the nearest the physics moves.
    let found: Entity | undefined;
    let nearest = Infinity;
    for (const height of [-0.35, 0.25]) {
      const from = vec3.add(position, vec3.scale(up, height));
      const hit = world.castShape({ kind: 'ball', radius: 0.3 }, from, quat.identity(), ahead, HOLD.reach, { skip: e.id });
      const thing = hit ? world.entities.get(hit.entity) : undefined;
      if (hit && thing?.body?.type === 'dynamic' && hit.distance < nearest) {
        nearest = hit.distance;
        found = thing;
      }
    }
    if (found) c.holding = found.id;
    return;
  }
  if (!held?.transform || !held.body) return;
  const target = vec3.add(position, vec3.add(vec3.scale(ahead, HOLD.distance), vec3.scale(up, HOLD.lift)));
  const to = vec3.sub(target, held.transform.position);
  if (vec3.length(to) > HOLD.letGo) {
    c.holding = 0;
    return;
  }
  const g = gravityAt(world.gravity, held.transform.position);
  const want = vec3.add(vec3.scale(to, 1 / HOLD.settle), c.velocity);
  let change = vec3.sub(vec3.sub(want, held.body.linearVelocity), vec3.scale(g, dt));
  const most = (HOLD.force * dt) / Math.max(1e-9, world.physics.massOf(held.body.handle));
  const length = vec3.length(change);
  if (length > most) change = vec3.scale(change, most / length);
  world.push(held, change);
}

/**
 * PUSHING (stage 3g): what the physics moves that the character walks into, it pushes along the ground,
 * towards where it is going, as fast as it walks there at most, with a force of `PUSH` newtons at most:
 * the thing's friction on the floor (its mass times g times the friction) has to be less for it to
 * move. The friction is Rapier's: the average of the two surfaces'. A wooden crate of 45 kg on stone
 * (0.5 and 0.6: 0.55, 242 N) slides along; a stone block of 1.2 tonnes (0.6: 7,200 N) does not.
 * (Rapier's own rule pushes with an impulse by the character's mass on every step, which adds up: with
 * a person's 70 kg, the block went along almost as far as the crate, 3.8 m against 4.5 in two seconds.
 * With the mass Rapier gives the engine's capsule, its volume at density 1, 0.4 kg, it moves neither:
 * the crate 0.5 m, the block nothing. Measured with Rapier alone again, after the tutorial's pass.)
 */
export const PUSH = 900;

function push(world: World, e: Entity, touched: readonly number[], wanted: Vec3, up: Vec3, dt: number) {
  if (touched.length === 0) return;
  const speed = vec3.length(wanted);
  if (speed < 1e-6) return;
  const along = vec3.scale(wanted, 1 / speed);
  for (const handle of touched) {
    const thing = [...world.entities.values()].find((x) => x.body?.handle === handle);
    if (!thing?.body || !thing.transform || thing.id === e.character?.holding) continue;
    // Only what is ahead of it, where it is going.
    const toward = vec3.onPlane(vec3.sub(thing.transform.position, e.transform!.position), up);
    if (vec3.dot(toward, along) <= 0) continue;
    const gap = speed - vec3.dot(thing.body.linearVelocity, along);
    if (gap <= 0) continue;
    const mass = world.physics.massOf(handle);
    world.push(thing, vec3.scale(along, Math.min(gap, (PUSH * dt) / Math.max(1e-9, mass))));
  }
}

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
  const pose = low(c.mode) ? crouchPoseOf(c, e.body!) : null;
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

  // 0: what it holds (stage 3g): grabbed or let go, and pulled towards in front of it.
  hold(world, e, c, up, dt);

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
  const climbed = c.wall;
  const feet = vec3.add(e.transform!.position, vec3.scale(up, -0.5));
  let wallDistance = 0;
  if (c.can.climb) {
    const towards = isZero(c.wall) ? (vec3.length(move) > 0.1 ? vec3.normalize(move) : null) : c.wall;
    const found = towards ? wallAhead(world, e, feet, towards, 0.55, up) : null;
    c.wall = found ? found.wall : [0, 0, 0];
    wallDistance = found ? found.distance : 0;
  } else c.wall = [0, 0, 0];
  // What it stands on (stage 2d; with its whole capsule since 2.5b), if it stands: below, what moves
  // carries it; here, its surface's friction decides how much its feet push (stage 3b: the floor's
  // material). On nothing found, or on what the physics moves (a cube), they hold.
  const here = e.transform!.position;
  const wasGrounded = c.grounded;
  const under = c.grounded ? standingOn(world, e, up) : null;
  const floor = under ? world.entities.get(under.entity)?.body : undefined;
  const traction = floor ? tractionOf(floor.friction) : 1;
  const before = c.mode;
  // A roll (stage 4b): pressed on the ground (walking or crouched), it starts, the way it is asked to go
  // (or where it looks), for its time; off the ground, it is over.
  if (!c.grounded) c.rolling = 0;
  else if (c.rolling === 0 && c.can.roll && (before === 'walk' || before === 'crouch') && pressed(world, c.player, 'roll')) {
    c.rolling = Math.max(1, Math.round(c.movement.roll.time / dt));
    c.rollDirection = vec3.length(move) > 0.1 ? vec3.normalize(move) : vec3.normalize(vec3.onPlane(c.facing, up));
  }
  // Low, whether it could stand up where it is (stage 4b): its standing body, there, touching nothing.
  const room = !low(before) || fits(world, e, body.shape, up);
  c.mode = modeFor(c, move, jumping, vUp, isDown(input, 'crouch'), room);
  // Going low or standing up, the controller moves the low body, or the standing one, from then on.
  if (low(before) !== low(c.mode)) {
    const pose = low(c.mode) ? crouchPoseOf(c, body) : { shape: body.shape, offset: [0, 0, 0] as Vec3 };
    world.physics.setCharacterPose(body.handle, pose.shape, pose.offset);
  }
  let mode = MODES[c.mode];
  vH = mode.steer(c, vH, wanted, move, dt, traction);
  // Climbing, it comes to its wall (stage 4a): as far as touching it less `WALL_GAP`, at `WALL_APPROACH`
  // at most (its body's radius from its axis, where the ray went from, and the controller's own gap).
  if (c.mode === 'climb' && body.shape.kind === 'capsule') {
    const off = wallDistance - body.shape.radius - CHARACTER_GAP - WALL_GAP;
    if (off > 0) vH = vec3.add(vH, vec3.scale(c.wall, Math.min(WALL_APPROACH, off / dt)));
  }
  // The top of a wall: it was climbing and the wall ended under its feet. A hop up and over, so it gets
  // onto it: up, and towards the wall it climbed at its climbing speed (closing phase 2: the hop was
  // only up, and with no control in the air nothing took it over the edge; it fell back beside the
  // wall, grabbed it again and hopped, forever). Not when the wall ended at a side (it climbed along
  // it past its edge, stage 2e2 found the hop there too): then it lets go, as when it stops pushing.
  if (before === 'climb' && c.mode !== 'climb' && isZero(c.wall) && topAhead(world, e, feet, climbed, up)) {
    vUp = Math.max(vUp, c.movement.climb.top);
    vH = vec3.add(vH, vec3.scale(climbed, c.movement.climb.speed));
  }

  // What it stands on, if it moves: how it moves in this step. It carries it (after the controller,
  // below), it turns it with it, and a jump keeps its velocity. Stepping from something that moves
  // onto something still, standing all the time (down the 30 cm of the course's ferry), it keeps that
  // velocity, as walking off an edge does: the walk steers it from there (before, it stopped dead).
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
  // (Rolling, it does not jump: a jump asked for is kept as long as ever, `jump.buffer` steps, and if
  // the roll ends before that, it jumps then.)
  if (c.jumpPending > 0 && c.mode === 'roll') c.jumpPending--;
  else if (c.jumpPending > 0) {
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

  // How fast it was coming down (for the landing's sound, stage 3f).
  const fell = Math.max(0, -vec3.dot(c.velocity, up));

  // 4: the contributions. Gravity changes the velocity (unless the mode holds itself; a mode may
  // slow the fall); what carries it only moves it, this step. Not while it stands, without jumping,
  // on ground it does not slide on (flatter than 30°): its floor holds it, and the controller keeps
  // it on it, down a step too (snapping). Pushed into its floor on every step (stage 3b found it), it
  // sank into the thin gap the controller keeps (CHARACTER_GAP); from there, a move along the floor met
  // the floor at once, and it did not move at all for a step or two: 2 to 6 steps in a hundred,
  // walking on a flat floor. On a steeper slope, or a round bottom on an edge, gravity goes on
  // pulling: it is what makes it slide off them. And held so, if it is inside that gap all the same, it
  // comes out of it in this step (`rise`): from a lift at the top onto its ledge, as high to 32 bits
  // but 0.00000004 m higher, it stood a hair inside the ledge's gap, and stuck on the seam for good
  // (stage 3c). Moving out of the gap, the controller does not meet the floor at once.
  let rise = 0;
  if (mode.holds) vUp = mode.holds(c, move);
  else if (c.grounded && !leapt && vUp <= 0 && under && vec3.dot(under.normal, up) >= STANDS_ON) {
    vUp = 0;
    rise = Math.max(0, CHARACTER_GAP - under.distance);
  } else {
    vUp -= gravity * dt;
    const fall = mode.fall?.(c);
    if (fall !== undefined) vUp = Math.max(vUp, -fall);
  }
  const carried: Vec3 = [...c.carry];
  c.carry = [0, 0, 0];

  // 5: what it can really do.
  const desired = vec3.add(vec3.scale(vec3.add(vec3.add(vH, vec3.scale(up, vUp)), carried), dt), vec3.scale(up, rise));
  const platform = under?.moves ? world.entities.get(under.entity)?.body?.handle : undefined;
  const { movement, grounded, ceiling, touched } = world.physics.moveCharacter(body.handle, desired, up, platform);
  // What it ran into that the physics moves, it pushes (stage 3g), towards where it was asked to go.
  push(world, e, touched, vec3.onPlane(wanted, up), up, dt);

  // 6: what it learned. (A ceiling is what the controller says hit its head: rising a little less
  // than asked is not one; that happens brushing a wall, and it used to cut jumps short.)
  if (vUp > 0 && ceiling) vUp = 0;
  if (grounded && vUp < 0) vUp = 0;
  c.grounded = grounded;
  c.stepsInAir = grounded ? 0 : c.stepsInAir + 1;
  // A platform that moves or turns carries it (stage 2d), if it stood on it and did not jump off it:
  // exactly as far as the platform takes the point where it is. After the controller, not through
  // it: the controller saw the platform fixed (physics.ts), and a platform going down would have
  // stopped it from going down with it. But through what is in its way (stage 3a): the carry is swept
  // from where the walk left it, leaving out the platform itself, and what it meets stops it (a beam
  // the platform passes under; before, the carry took it into the beam). If it walked off the edge
  // (it stood, and now it does not, without jumping), it keeps the platform's velocity along the
  // ground, as it would jumping; and from then on, it stands on nothing that moves.
  const walked = vec3.add(world.physics.position(body.handle), movement);
  const riding: Vec3 = ride && !leapt && under ? sweep(world, e, walked, ride.movement, under.entity) : [0, 0, 0];
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
  // Rolling, it looks the way it rolls (stage 4b), whatever it is told; told again after the roll.
  if (c.mode === 'roll') c.facing = [...c.rollDirection];
  else if (toldLooking && vec3.length(toldLooking) > 1e-6) c.facing = vec3.normalize(toldLooking);
  else if (c.mode === 'climb' && !isZero(c.wall)) c.facing = [...c.wall];
  else if (vec3.length(inWorld) > 0.1) c.facing = vec3.normalize(inWorld);
  // And where it aims, above or below that (stage 4b).
  c.pitch = 90 * Math.max(-1, Math.min(1, axisOf(input, 'pitch')));
  // A step of its roll gone (stage 4b).
  if (c.mode === 'roll') c.rolling--;
  const position = vec3.add(walked, riding);
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));

  // What is heard (stage 3f): a step every stride walked on the ground, on what it stands on (by its
  // material), louder running; and a landing, by how fast it came down.
  const floor_ = under ? world.entities.get(under.entity) : undefined;
  const surface = floor_?.body?.material ?? null;
  const feet_ = vec3.add(position, vec3.scale(up, -0.8));
  if (grounded && !wasGrounded && fell > 3)
    world.emit({
      type: 'sound',
      sound: 'land',
      source: e.id,
      at: feet_,
      surface,
      speed: fell,
      energy: 0,
      radius: stepRadius(surface, fell, c.movement.walk.speed),
    });
  const along = vec3.length(vec3.onPlane(movement, up));
  if (grounded && wasGrounded && (c.mode === 'walk' || c.mode === 'crouch') && along > 0) {
    c.stride += along;
    if (c.stride >= STRIDE) {
      c.stride -= STRIDE;
      const speed = along / dt;
      world.emit({
        type: 'sound',
        sound: 'step',
        source: e.id,
        at: feet_,
        surface,
        speed,
        energy: 0,
        // (Crouched, less: stage 4b, its posture.)
        radius: stepRadius(surface, speed, c.movement.walk.speed) * (c.mode === 'crouch' ? c.movement.crouch.heard : 1),
      });
    }
  } else if (!grounded) c.stride = STRIDE / 2;
}
