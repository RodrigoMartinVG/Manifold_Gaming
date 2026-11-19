import type { Quat, Vec3 } from '@manifold/common';
import type { LevelPiece } from './level';

/** The number that names an entity. Unique within ITS world (not in the whole program). */
export type EntityId = number;

/**
 * An ENTITY is an id and its COMPONENTS: plain data, no methods. An entity with `transform` is
 * somewhere; with `spin`, it also spins; with `body`, the physics moves it and makes it collide;
 * with `appearance`, the presentation knows how to draw it. No component holds Three.js or Rapier
 * objects: that is why a world can be copied, compared and snapshotted (decision 0004).
 *
 * (Stage 0 brought the first three; stage 1a, `body`. Every engine stage adds its own.)
 */
export interface Entity {
  readonly id: EntityId;
  /**
   * Its name (stage 3b), if it has one: one word (`door_north`), the only one with it in its world.
   * What the console finds it by (`inspect door_north`), and what signals will join (3c).
   */
  name?: string;
  transform?: Transform;
  spin?: Spin;
  body?: Body;
  character?: Character;
  appearance?: Appearance;
  sensor?: Sensor;
  game?: GameComponents;
  mover?: Mover;
  mechanism?: Mechanism;
  lamp?: Lamp;
  watcher?: Watcher;
  breakable?: Breakable;
  health?: Health;
  projectile?: Projectile;
  /** A route (stage 4d, level format 8): points a guard patrols, there and back or round. Nothing else in it. */
  route?: Route;
  /** An objective (stage 4f, level format 8): what it says, the signal that completes it, the one after it, and how it stands. */
  objective?: Objective;
  /** A short scene (stage 4f, level format 8): its lines (who says which key), the signal that plays it, and whether it played. */
  scene?: Scene;
  /** What it is for, as its level says (stage 4d, decision 0024: cover, something to throw…): data the brains read. */
  affords?: Affordance[];
  /**
   * A bot's brain (stage 4e, decision 0023): which of its game's brains thinks for this character, and
   * the route it keeps to, if any. World data, so any host knows which brains to run; the brain itself
   * runs on the host, out of the hash.
   */
  brain?: BrainOf;
  /**
   * The level's line that built it (stage 3j), as data: what `level.export` writes back. Set when a
   * level builds it, or the console adds it; kept up to date by `set`. Characters, balls, fragments,
   * what a game makes on its own, have none: they are not the level's.
   */
  source?: LevelPiece;
}

/**
 * WHAT BREAKS (stage 3e), in layers. Here, in the core and in the hash: whether it is broken, and the
 * energy a hit needs to break it (`threshold`, in joules: half the mass times the speed squared of
 * what the physics moves, as it came against it); and, broken, a few large pieces the physics moves.
 * The break is an event with a seed from the world's randomness (`broke`): the presentation makes its
 * fragments from it, in a physics of its own that nobody hashes. Broken, a lamp gives no light, and
 * what it was stops colliding.
 */
export interface Breakable {
  threshold: number;
  broken: boolean;
}

/**
 * A LAMP (stage 3d): the light is the simulation's. It lights what it sees (a ray from it, the same in
 * Node), within its `radius`, falling linearly from `intensity` at its center to 0 there, and less
 * through what attenuates (a zone with an `opacity` per meter). On while its signal is on (stage 3c),
 * or always, without one: `on` is what it was at the last step. The drawing reads the same data.
 */
export interface Lamp {
  radius: number;
  intensity: number;
  signal: string | null;
  on: boolean;
  /** Put out by a hand (stage 5e), and lit again by one: meanwhile it gives no light, whatever its signal. */
  out?: boolean;
}

/**
 * A WATCHER (stage 3d): an eye, fixed where its transform puts it, looking along its −Z. It sees a
 * character within its `range` and its field of view (`cone`: the cosine of half of it), with nothing
 * in between, as lit as `threshold` at least, as it looks from there (its light, attenuated by what is
 * in between). No decisions: phase 4's guard takes its eyes. `sees`: who it sees now, in the order it
 * saw them; a change is an event (`seen`, `lost`).
 */
/**
 * HEALTH (stage 4c): what hits take, and whether it is down. Its points, its most, and the step it
 * went down at (−1: standing). Plain data, in the hash. The engine takes the points (`World.hurt`,
 * through the game's filter) and says when it goes down; when and where it comes back is the game's
 * (`World.revive`): mechanism in the engine, policy in each game (decision 0000).
 */
export interface Health {
  points: number;
  most: number;
  down: number;
}

/**
 * A PROJECTILE (stage 4c): something thrown or shot that the physics does not move; the simulation
 * moves it, a segment of ray each step (so it crosses nothing between two steps), swept with its
 * radius, and it hurts what it strikes (a part of a character as it is now, or whatever has health)
 * and is gone. Who shot it, how fast it goes, how thick it is, what it takes, of what kind, whether
 * gravity bends it, and how many steps it has left.
 */
export interface Projectile {
  from: EntityId | null;
  velocity: Vec3;
  radius: number;
  damage: number;
  kind: string;
  gravity: boolean;
  life: number;
}

/** A hit to be taken (stage 4c), as the game's filter sees it: on whom, by whom, where, of what kind, how much. */
export interface Damage {
  target: EntityId;
  from: EntityId | null;
  /** The hit part (`head`, `body`…: decision 0022), if it was a hit on one. */
  part: string | null;
  /** What did it: `impact`, `shot`, `strike`… (the game's words). */
  kind: string;
  amount: number;
}

export interface Watcher {
  range: number;
  cone: number;
  threshold: number;
  sees: EntityId[];
}

/**
 * A SIGNAL (stage 3c, decision 0018): a named number in the world, 0 off and anything else on,
 * computed once per step, at its end, in the order the level declares them, from what it reads:
 * - `input`: nothing; the game or the console sets it (`World.setSignal`);
 * - `zone`: how many characters and bodies the physics moves are in the zone named in `reads`;
 * - `used`: how many characters pressed `use` in that zone, at this step;
 * - `seen`: how many characters the watcher named in `reads` sees (stage 3d);
 * - `any`, `all`, `not`: on while one, every one, or none of the signals it reads is on;
 * - `toggle`: flips each time the signal it reads turns on;
 * - `latch`: on when the first it reads is on, off when the second is (the first wins), and as it
 *   was otherwise.
 * `memory` is what it keeps from one step to the next besides its value: a toggle's, whether what it
 * reads was on; an input's, the value it was set to, which it takes at the step's end.
 */
export type SignalOp = 'input' | 'zone' | 'used' | 'seen' | 'any' | 'all' | 'not' | 'toggle' | 'latch';
export interface Signal {
  name: string;
  op: SignalOp;
  reads: string[];
  value: number;
  memory: number;
}

/**
 * A MECHANISM (stage 3c, decision 0018): a kinematic body that goes between two places, closed (0)
 * and open (1), in `seconds`, while its signal says: open while it is on. A door turns `degrees`
 * around an axis through its hinge; a lift moves `by`. Where it is, at any step, is a function of
 * which way it goes (`toward`), since which step (`since`) and from where (`from`, 0 to 1): it does
 * not drift, and it rewinds, as a moving platform (stage 2d).
 */
export interface Mechanism {
  signal: string;
  seconds: number;
  /** Where it is, closed (as it was created). */
  closed: Transform;
  door?: { hinge: Vec3; axis: Vec3; degrees: number };
  lift?: { by: Vec3 };
  toward: 0 | 1;
  since: number;
  from: number;
}

/**
 * A ROUTE (stage 4d, decision 0024): points, in the order a guard goes through them; round (`loop`),
 * back to the first from the last, or there and back. The engine does nothing with it: brains read it.
 */
export interface Route {
  points: Vec3[];
  loop: boolean;
}

/**
 * AN OBJECTIVE (stage 4f): a key of the game's words that says it, the signal that completes it (on),
 * and the objective after it, if any: they chain. `state`: waiting (not yet), active (the one to do),
 * done. A level's first objective that no other one leads to starts active.
 */
export interface Objective {
  say: string;
  when: string;
  then: string | null;
  state: 'waiting' | 'active' | 'done';
}

/** A SHORT SCENE (stage 4f, decision 0017 leaves longer ones out): who says which key, in order; the signal that plays it, once. */
export interface Scene {
  lines: { who: string; say: string }[];
  when: string;
  played: boolean;
}

/** Which brain thinks for a character (stage 4e), and the route it keeps to (a route's name), if any. */
export interface BrainOf {
  name: string;
  route: string | null;
}

/** A word that belongs to a game or a package of the library, with its owner: `arms.ready`, `forest.perch` (stage 5.5e). */
export type NamespacedWord = `${string}.${string}`;

/** The sounds the engine itself makes (stage 3f; the rest are a game's, namespaced: stage 5.5e). */
export type EngineSound = 'step' | 'land' | 'hit' | 'door' | 'lift' | 'break' | 'blast';

/**
 * What a level says a thing is for (stage 4d, decision 0024): to hide behind, to throw, to kick, a weak point;
 * or a game's own, with its owner (stage 5.5e: `forest.perch`, `forest.swing`).
 */
export const AFFORDANCES = ['cover', 'throw', 'kick', 'weak'] as const;
export type Affordance = (typeof AFFORDANCES)[number] | NamespacedWord;

/**
 * A BODY THAT GOES BACK AND FORTH (stage 2d): a moving platform. Its place is a function of the time
 * (the step), not of where it was: from `from` to `to` in `seconds`, and back, again and again. On
 * every step its kinematic body gets exactly the velocity that takes it there, so it never drifts.
 */
export interface Mover {
  from: Vec3;
  to: Vec3;
  /** How long one way takes. */
  seconds: number;
}

/**
 * A ZONE THAT NOTICES WHO ENTERS (stage 2a): a box, turned with its transform. On every step the
 * world checks which moving bodies have their center inside it, and says who came in and who left
 * (`sensorEntered`, `sensorLeft`). It does not push: it only notices. What it means (a checkpoint, a
 * goal, the void under a level) is the game's: the engine does not read `kind`.
 */
export interface Sensor {
  kind: string;
  /** Half its size along each of its axes. */
  half: Vec3;
  /** Who is inside now, by id, in the order they came in. */
  inside: EntityId[];
  /**
   * What it carries besides its kind (stage 3b), by name, each a list of numbers: a current's `flow`
   * (m/s, x y z), a medium's `density`, a fog's opacity per meter. A river, a fog bank or a jet of
   * steam is a zone with data, not a new kind of thing. Like `kind`, the game's to read.
   */
  params: Record<string, number[]>;
}

/**
 * PLAIN DATA, as deep as needed (decision 0004): numbers, texts, yes or no, and lists and records of
 * them. What every component is made of: it is copied, compared, hashed and sent as it is.
 */
export type PlainData = number | string | boolean | PlainData[] | { [key: string]: PlainData };

/**
 * A GAME'S OWN COMPONENTS on an entity (stage 2a; by name and nested since 2.5b): each one named
 * with its game, `<game>.<component>` (`dojo.runner`, and one day `dojo.inventory`), and made of
 * plain data as deep as it needs (an inventory: a list of records). Like every component they are
 * copied, compared and hashed with the rest of the world, so they travel in snapshots and replays
 * play them the same. The engine never reads them; a game reads its own with `component`.
 *
 * Before, one flat record of loose values per entity: no list fitted (no inventory), and two games,
 * or two parts of one, could step on each other's names.
 */
export type GameComponents = Record<string, { [key: string]: PlainData }>;

export interface Transform {
  position: Vec3;
  rotation: Quat;
}

/**
 * Spins at a constant rate: `angularVelocity` is the axis times the speed (rad/s). On an entity with
 * a kinematic body, the physics turns it (and what it touches feels it); without a body, the world.
 */
export interface Spin {
  angularVelocity: Vec3;
}

/**
 * A collider's shape, in meters: a ball by its radius, a box by its half sizes, a capsule (a
 * cylinder with half spheres at its ends, standing along its "up") by the half height of its
 * cylinder and its radius.
 */
export type Shape =
  | { kind: 'ball'; radius: number }
  | { kind: 'box'; halfExtents: Vec3 }
  | { kind: 'capsule'; halfHeight: number; radius: number }
  /**
   * Several boxes as one body (stage 4a): a map's floor, so what rolls or slides across where two of its
   * slabs meet does not hop or trip. For fixed bodies. With `cell`, the boxes cover whole cells of that
   * size, counted from the lowest corner of all of them, and the physics makes them Rapier's voxels, made
   * for grids: no seam between two cells at all.
   */
  | { kind: 'compound'; parts: CompoundPart[]; cell?: Vec3 };

/** One part of a compound shape: a box, centered `offset` from the body's center, turned `rotation` there (stage 4.5e: a kit's ramp). */
export interface CompoundPart {
  offset: Vec3;
  halfExtents: Vec3;
  rotation?: Quat;
}

/**
 * A BODY: the physics moves it (`dynamic`), the game moves it and it pushes (`kinematic`), it never
 * moves (`fixed`, like the floor), or it is a character's (`character`: it walks, climbs steps and
 * stops at walls, moved by the character controller, see `Character`). Its velocities are read back from the physics after every
 * step: they are part of the world's state, and of its hash.
 *
 * The real body lives in the physics (Rapier); the entity keeps only its `handle`, the number that
 * finds it (decision 0004): never the body itself, which a snapshot would leave pointing at an old world.
 */
export interface Body {
  type: 'dynamic' | 'kinematic' | 'fixed' | 'character';
  shape: Shape;
  /** How much it bounces: 0 (none) to 1 (it keeps all its speed). */
  restitution: number;
  friction: number;
  /**
   * How fast it loses its speed by itself, per second (0: never). Rapier has no rolling resistance:
   * without angular damping, a ball rolls on a flat floor almost forever.
   */
  linearDamping: number;
  angularDamping: number;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  /** Which bodies it meets (stage 2.5b); without it, all of them. */
  groups?: CollisionGroups;
  /**
   * What it is made of (stage 2.5b): `wood`, `metal`, `glass`… One of its world's materials (stage
   * 3b: `World.materials`), whose friction and bounce it takes when it is created, unless they are
   * given; and a name the game reads (the sound of steps and hits, what breaks how).
   */
  material?: string;
  /**
   * What it weighs for its size (stage 3g), kg/m³: its material's, if it has one (a wooden crate, a
   * stone block); without it, the physics' own (1). Its mass is that times its volume.
   */
  density?: number;
  /** Given by the world when the entity is created. */
  handle: number;
}

/**
 * WHICH BODIES MEET (stage 2.5b): a body is a member of some groups (`member`: 16 bits, one per
 * group) and meets the groups of `filter`. Two bodies collide when each one's member is in the
 * other's filter; a query sees what its own groups meet. Without groups: a member of all, meeting all.
 */
export interface CollisionGroups {
  member: number;
  filter: number;
}

/** A body as it is asked for: the shape and the type; the rest has defaults. */
export type BodySpec = Pick<Body, 'type' | 'shape'> &
  Partial<
    Pick<
      Body,
      | 'restitution'
      | 'friction'
      | 'linearDamping'
      | 'angularDamping'
      | 'linearVelocity'
      | 'angularVelocity'
      | 'groups'
      | 'material'
      | 'density'
    >
  >;

/**
 * HOW A CHARACTER MOVES (stage 2b): the numbers of each of its MODES, as data. A game decides them
 * (a platformer's feel is not a shooter's), and being data, they can change at a step (`dojo.air`),
 * travel in snapshots and play the same in replays.
 */
export interface Movement {
  /** Walking, on the ground: its speeds (m/s, walking and running) and how fast it reaches them (m/s²). */
  walk: { speed: number; run: number; acceleration: number };
  /**
   * In the air: how much it can still steer (m/s²). Real physics says 0: once in the air, there is
   * nothing to push against. Platformers cheat on purpose, because a jump that cannot be steered
   * feels stiff; how much is each game's choice.
   */
  air: { control: number };
  /**
   * The jump: its speed up (m/s: it rises v² / 2g, 6.5 m/s on Earth is about 2.15 m); how many steps
   * after leaving an edge it still counts ("coyote time"); how many steps before landing it is kept
   * ("jump buffering"); and how many more jumps it has in the air, if it can (`can.doubleJump`).
   */
  jump: { speed: number; coyote: number; buffer: number; air: number };
  /** Gliding (stage 2c): the fastest it falls (m/s), and how much it can steer (m/s²). */
  glide: { fall: number; control: number };
  /**
   * Climbing a wall (stage 2c): how fast it climbs (m/s); the hop up when the wall ends at its top
   * (m/s up), so it gets onto it; and how fast a jump from the wall takes it away from it (m/s).
   */
  climb: { speed: number; top: number; off: number };
  /**
   * Crouching (stage 4b): how fast it goes (m/s), and how much of it a watcher sees and how far its
   * steps are heard, as parts of standing's (posture, decision 0000's stealth).
   */
  crouch: { speed: number; seen: number; heard: number };
  /** Rolling (stage 4b): how fast (m/s) and for how long (s): a dodge of speed × time meters. */
  roll: { speed: number; time: number };
  /** Blocking (stage 4f): how fast it goes while it guards itself (m/s). What a block saves is each game's (its filter). */
  block: { speed: number };
  /** How fast it turns on its own axis when asked to (`turn` at 1), radians per second. */
  turn: number;
  /**
   * On a wall (stage 5c, `can.wallJump`): the fastest it slides down it while it pushes against it
   * (m/s), how fast a jump from it takes it away (m/s), and for how long after that jump (s) it cannot
   * steer back towards the wall it left (or it would be back on it at once). (Stage 5p, decision 0031:
   * forgiveness, as Celeste's) How far off its body a wall may be for a jump to leap off it, whichever
   * way it is asked to go (m; without it, only the one it pushes against, 25 cm off).
   */
  wall: { slide: number; off: number; lock: number; reach?: number };
  /**
   * THE PLATFORMER'S JUMP (stage 5c), if its game gives one: how high its feet rise (m) and how long
   * they take to get there (s), from which its own gravity and its jump's speed follow (`arcOf`); how
   * many times stronger that gravity is when the jump is let go while it rises (a short hop) and while
   * it falls (it comes down sooner than it went up); the fastest it falls (m/s); and how far (m) it is
   * nudged round a corner its head clips while it rises. Without it, the world's gravity and
   * `jump.speed`, as always. (Stage 5p, decision 0031: forgiveness) And for how long (s) it hangs at its
   * top while the jump is held, if it does: a moment to aim the landing, its height the same.
   */
  arc?: { height: number; time: number; release: number; fall: number; terminal: number; corner: number; hang?: number };
}

/** The ways of moving (stage 2b): exactly one at each step. Gliding and climbing came with stage 2c; crouching and rolling with 4b. */
export type ModeName = 'walk' | 'air' | 'glide' | 'climb' | 'crouch' | 'roll' | 'block' | 'slide' | 'hang';

/**
 * WHAT A CHARACTER CAN DO besides walking and jumping (stage 2c): each one, on or off, and it can
 * change at a step (the Dojo's `dojo.climb on`). Data, like the rest: in the hash, in snapshots, in
 * replays.
 */
export interface Capabilities {
  /** One more jump in the air (as many as `movement.jump.air`). */
  doubleJump: boolean;
  /** Holding the jump while falling, it falls slowly and steers more. */
  glide: boolean;
  /** Pushing against a wall, it climbs it; jumping from it, it leaps off. */
  climb: boolean;
  /** Holding `crouch` on the ground, it goes low (stage 4b): slower, under what it could not stand under, seen and heard less. */
  crouch: boolean;
  /** Pressing `roll` on the ground, it rolls (stage 4b): a dodge, low, for its time, the way it was asked to go. */
  roll: boolean;
  /** Holding `block` on the ground, it guards itself (stage 4f): slower; what a hit from the front takes then is its game's. */
  block: boolean;
  /** Pushing against a wall in the air, it slides down it slowly, and a jump takes it up and off it (stage 5c). */
  wallJump: boolean;
  /** Falling past a ledge in front of it, it grabs it and hangs; pushing on, it climbs onto it (stage 5c). */
  ledge: boolean;
}

/**
 * A CHARACTER (stage 1b): something a player drives. Its body is a `character` body, a capsule; this
 * is the rest of its state, all data, part of the hash:
 * - how it moves (its modes' numbers), the mode it is in, and the velocity it has now;
 * - whether it stands on something, and how many steps it has been in the air;
 * - a jump asked for a little before landing, kept a few steps, so it is not lost;
 * - where it looks;
 * - what the game makes it carry this step (`carry`).
 *
 * Its "up" is not stored: it is the opposite of the gravity where it stands (decision 0012). Today
 * that is always +Y; on the planets of phase 7 it will change from place to place.
 */
export interface Character {
  /** The player who drives it (the inputs carry this number). */
  player: number;
  movement: Movement;
  /** What it can do besides walking and jumping (stage 2c). */
  can: Capabilities;
  /** Jumps it still has in the air (stage 2c), until it touches the ground again. */
  airJumps: number;
  /** The wall it touched at the last step: the direction towards it, along the ground (zero: none). */
  wall: Vec3;
  /** The mode it moved in at the last step. */
  mode: ModeName;
  velocity: Vec3;
  grounded: boolean;
  stepsInAir: number;
  /** Steps left to jump when it touches the ground (0: no jump pending). */
  jumpPending: number;
  /** Whether the jump input was held at the previous step: a jump starts when it is pressed, not while held. */
  jumpHeld: boolean;
  /** Where it looks: a unit vector perpendicular to its "up". */
  facing: Vec3;
  /**
   * Where it aims, above (+) or below (−) where it looks, in degrees from −90 to 90 (stage 4b): its
   * body faces along the ground, its aim tilts (`aimOf`). From the `pitch` input, a quarter turn per
   * unit, at every step: asked nothing, it aims level.
   */
  pitch: number;
  /** What it holds (stage 3g), by id; 0, nothing. Held by a pull towards in front of it, it stays the physics'. */
  holding: EntityId;
  /** Rolling (stage 4b): the steps of its roll still to come (0: not rolling), and which way it goes (flat, of length 1). */
  rolling: number;
  rollDirection: Vec3;
  /**
   * Locked on (stage 4f): the character it faces and circles, by id, chosen with `lock` (the nearest in
   * front, within `LOCK_RANGE`); null, none. Its moves to the side go round it, at the same distance.
   */
  lock: EntityId | null;
  /** Thrown by a blast (stage 4f), until it lands: in the air, what it was given stays (it steers only with what it asks). */
  thrown: boolean;
  /**
   * How lit it is (stage 3d), at its center: the world's ambient light, plus what every lamp that sees
   * it gives, at the end of the last step. What a watcher compares with its threshold (and, one day, a
   * thief's light gem).
   */
  light: number;
  /** How far it has walked on the ground since its last step was heard (stage 3f), in meters. */
  stride: number;
  /**
   * What the game makes it carry at the next step, m/s (stage 2b): the wind, a conveyor belt… It moves
   * it, whatever its mode, and it is emptied after the step: the game says it again on every step it
   * applies.
   */
  carry: Vec3;
  /**
   * What it stands on, if it moves (stage 2d): its velocity under the character (m/s), and how fast it
   * turns around the character's up (rad/s). The engine finds it on every step; it carries the
   * character, and a jump keeps it.
   */
  ground: { velocity: Vec3; spin: number };
  /** Whether it is rising from a jump it made (stage 5c): let go of the jump then, its arc's gravity pulls harder. */
  leaping: boolean;
  /** The wall it jumped off (stage 5c, away from it), and for how many more steps it cannot steer back towards it. */
  offWall: Vec3;
  offSteps: number;
  /**
   * The ledge it hangs from (stage 5c): where its hands hold (on the edge, at the top's height), the
   * wall's way, for how many steps it has hung, and, climbing onto it, how many steps of that are left.
   */
  ledge: { at: Vec3; wall: Vec3; steps: number; climb: number } | null;
  /** For how many more steps it does not grab a ledge again (having let one go). */
  regrab: number;
  /**
   * (Stage 5p, decision 0031: forgiveness, for whoever jumps off walls) The last wall it was against in
   * the air, and how many steps ago: for as long as a jump off the ground may come late (`jump.coyote`), a
   * jump off it may too. Only while it matters (none on the ground, nor long after).
   */
  nearWall?: { wall: Vec3; since: number };
  /** (Stage 5p) While it hangs at a jump's top (`arc.hang`), how many more steps it may. */
  hung?: number;
  /**
   * How much the platforms it stood on have turned it, all of it put together (stage 2d), as a
   * rotation. Where it is told to look (the `face` input) is read INSIDE this turn: so a character
   * told to look somewhere goes on being turned by the platform under it, step by step, exactly as
   * one told nothing, even if what it is told does not change (Quake III does the same with its
   * "delta angles"). Whoever knows where it wants it to look, in the world (an aiming camera, a
   * bot), asks for `faceFor(character, direction)`.
   */
  carriedTurn: Quat;
  /**
   * The shape its body takes in each way of moving (stage 2e), where it differs from its body's: what
   * a shot or a blow will hit (phase 4), not what the controller moves (that is always its body).
   * Only when the game gives them; for a mode without one, its body (`poseOf`).
   */
  poses?: Partial<Record<ModeName, CollisionPose>>;
  /**
   * What a hit can find of it in each way of moving (stage 4c, decision 0022): two or three named
   * parts (a head, a body, legs), when the game gives them; for a mode without them, one part, `body`,
   * its pose (`hitPartsOf`).
   */
  hits?: Partial<Record<ModeName, HitPart[]>>;
  /**
   * Its last poses (stage 4c, decision 0022): one for the end of each of its last `HISTORY` steps,
   * the oldest first. What a shot looks back at, as far as its shooter saw.
   */
  history: Pose[];
}

/**
 * A PART A HIT CAN FIND (stage 4c, decision 0022): its name (`head`, `body`, `legs`…), its shape (a
 * ball or a capsule), where it is from the character's center and how it is turned, in the
 * character's own frame (forward −Z, up +Y).
 */
export interface HitPart {
  name: string;
  shape: Extract<Shape, { kind: 'ball' | 'capsule' }>;
  offset: Vec3;
  rotation: Quat;
}

/**
 * A CHARACTER'S POSE at the end of a step (stage 4c, decision 0022): where it is, its body's turn
 * (where it looks, flat about its up), where it aims above or below that, and its way of moving.
 * Everything a hit needs comes from it, without the models.
 */
export interface Pose {
  position: Vec3;
  rotation: Quat;
  pitch: number;
  mode: ModeName;
}

/**
 * A COLLISION POSE (stage 2e, for phase 4): a shape, where it is from the character's center, and how
 * it is turned, in the character's own frame (forward −Z, up +Y). A character crouched in the air is
 * shorter; one gliding lies almost flat.
 */
export interface CollisionPose {
  shape: Shape;
  offset: Vec3;
  rotation: Quat;
}

/** A character as it is asked for: its player; the rest has defaults (any of its movement's numbers too). */
export type CharacterSpec = Pick<Character, 'player'> & {
  facing?: Vec3;
  movement?: {
    walk?: Partial<Movement['walk']>;
    air?: Partial<Movement['air']>;
    jump?: Partial<Movement['jump']>;
    glide?: Partial<Movement['glide']>;
    climb?: Partial<Movement['climb']>;
    crouch?: Partial<Movement['crouch']>;
    roll?: Partial<Movement['roll']>;
    block?: Partial<Movement['block']>;
    turn?: number;
    wall?: Partial<Movement['wall']>;
    arc?: Movement['arc'];
  };
  can?: Partial<Capabilities>;
  poses?: Partial<Record<ModeName, CollisionPose>>;
  hits?: Partial<Record<ModeName, HitPart[]>>;
};

/**
 * WHAT A PLAYER ASKS FOR at a step: values with a name. It enters the world through the session, at a
 * concrete step, like any world change.
 *
 * The names are ACTIONS that somebody declared (stage 1d): the core declares what the character reads
 * (`move`, `ahead`, `side`, `turn`, `face`, `jump`, `run`: see `CHARACTER_ACTIONS` in input.ts), and
 * each game declares its own, with its namespace (`dojo.throw`). A button is `true` while it is held;
 * an axis, an amount from −1 to 1; a vector, three numbers. What is not there is zero, or not held.
 *
 *   { move: [0, 0, -1], jump: true }       forward in the world (by the camera), and jumping
 *   { ahead: 1, turn: -1 }                  forward where the character looks, turning left (tank)
 *   { 'dojo.throw': true }                  a game's button
 *
 * Before (stages 1b to 1c2) it was a fixed list of fields: every new action would have changed the
 * replays' format and taught the core a game's actions.
 */
export type InputValue = number | Vec3 | boolean;
export type PlayerInput = Readonly<Record<string, InputValue>>;

/** How it looks, as DATA (the presentation decides which material, depending on quality). */
export interface Appearance {
  /**
   * A box of `size`, a sphere whose diameter is `size` (all three the same), a capsule `size[1]`
   * tall and `size[0]` wide, or (stage 3b) a grid: lines a meter apart over the top of a box of
   * `size`, as the Dojo's floor is drawn (its color, the lines').
   */
  shape: 'box' | 'sphere' | 'capsule' | 'grid' | 'boxes';
  size: Vec3;
  /** For `boxes` (stage 4a: a compound body, as a map's floor): each box's center, from the entity's, and its size. */
  parts?: { offset: Vec3; size: Vec3 }[];
  /** 0xRRGGBB */
  color: number;
  /**
   * A model, by the name the game gives the presentation (stage 2e; `character.mannequin` since 4a, the games' character): drawn instead
   * of the shape, once it loaded. Only for the eyes: nothing of a model enters the simulation.
   */
  model?: string;
  /** How much it hides what is behind it, from 0 to 1, if it is translucent (stage 3d: a fog bank). */
  opacity?: number;
}

/** The components an entity is created with (everything but the id, which the world gives; a body and a character as they are asked for). */
export type Components = Omit<
  Entity,
  'id' | 'body' | 'character' | 'sensor' | 'mechanism' | 'lamp' | 'watcher' | 'breakable' | 'health'
> & {
  /** Health (stage 4c): its most points (it starts with all of them, standing). */
  health?: Pick<Health, 'most'>;
  /** What breaks it: the energy of a hit, in joules (it starts whole). */
  breakable?: Pick<Breakable, 'threshold'>;
  /** A lamp: how far it reaches, how bright, and the signal it follows (on: from its first step). */
  lamp?: Pick<Lamp, 'radius' | 'intensity' | 'signal'>;
  /** A watcher: how far it sees, the cosine of half its field of view, and how lit it needs things. */
  watcher?: Pick<Watcher, 'range' | 'cone' | 'threshold'>;
  /** A mechanism: its signal, its time, and a door's hinge or a lift's way (closed: where it is created). */
  mechanism?: Pick<Mechanism, 'signal' | 'seconds' | 'door' | 'lift'>;
  body?: BodySpec;
  character?: CharacterSpec;
  /** A zone: what it is for, half its size, and what it carries (who is inside starts empty). */
  sensor?: Pick<Sensor, 'kind' | 'half'> & { params?: Sensor['params'] };
};

/**
 * GRAVITY, as data (decision 0012): a field that says, at every point, where "down" is and how
 * strong. The classic games use the uniform one, "down" everywhere; the planets of phase 7 will add
 * other kinds. Being data, it is copied, compared and hashed with the rest of the world.
 */
export type GravityField = { kind: 'uniform'; vector: Vec3 };

/** What HAPPENED in a step, as data (for the presentation, the game, the network). */
export type Event =
  | { type: 'entityCreated'; id: EntityId }
  | { type: 'entityRemoved'; id: EntityId }
  /** A moving body's center came into a zone (stage 2a), or left it. */
  | { type: 'sensorEntered'; sensor: EntityId; entity: EntityId }
  | { type: 'sensorLeft'; sensor: EntityId; entity: EntityId }
  /**
   * Something the game wants the players to know ("checkpoint", "the goal in 23.4 s"), as a key of its
   * words and the numbers it needs (stage 3i, decision 0019: the world carries no sentence; the page
   * says it in the player's language). For one player, or (without `player`) for everybody.
   */
  | { type: 'notice'; say: string; values?: readonly number[]; player?: number }
  /**
   * A game's own happening (stage 5.5e), by a name with its owner (`forest.owl`), about an entity if it is one,
   * with numbers if it carries any: what a game tells its view, or another rule of its own, without an edit
   * to the core. (Events are not in the hash: what they say is read, not kept.)
   */
  | { type: 'game'; name: NamespacedWord; entity?: EntityId; values?: readonly number[] }
  /** A signal changed its value (stage 3c), at the end of the step: what it is now, and what it was. */
  | { type: 'signalChanged'; signal: string; value: number; was: number }
  /** A watcher began to see a character (stage 3d), or lost it. */
  /** An objective (stage 4f) became the one to do, or was done: its entity's name and its words' key. */
  | { type: 'objective'; name: string; say: string; state: 'active' | 'done' }
  /** A scene (stage 4f) plays: its lines, who says which key. */
  | { type: 'scene'; name: string; lines: { who: string; say: string }[] }
  /** A blast (stage 4f: `World.explode`): where, how far it pushed, and whose it was. */
  | { type: 'blast'; at: Vec3; radius: number; by: EntityId | null }
  | { type: 'seen'; watcher: EntityId; entity: EntityId }
  | { type: 'lost'; watcher: EntityId; entity: EntityId }
  /**
   * Something broke (stage 3e): what, where, what hit it, with how much energy, and a seed from the
   * world's randomness, for whoever makes fragments of it (the presentation: the same ones in every
   * copy of the match, and none of them in the world).
   */
  | { type: 'broke'; entity: EntityId; at: Vec3; by: EntityId; energy: number; seed: number }
  /**
   * A sound (stage 3f): what made it, where, what kind, on what surface (a material's name, if there is
   * one), how fast it went (a step, a landing) or how hard (a hit, a break: energy, J), and how far it
   * is heard (`radius`, m: for phase 4's bots). The presentation synthesizes it from these numbers.
   */
  | {
      type: 'sound';
      // The engine's own sounds, or a game's (stage 5.5e: by a name with its owner, `arms.ready`, `wall.horn`;
      // before, every game's sound was a word of this list, and a new one an edit to the core).
      sound: EngineSound | NamespacedWord;
      source: EntityId;
      at: Vec3;
      surface: string | null;
      speed: number;
      energy: number;
      radius: number;
      /** A hit's: what it struck, if it was an entity (stage 4c: what a thrown ball hurts). */
      against?: EntityId | null;
    }
  /** A hit taken (stage 4c): on whom, by whom, where, of what kind, how much the game's filter left. */
  | ({ type: 'hurt' } & Damage)
  /** It went down (stage 4c): its points ran out. */
  | { type: 'down'; target: EntityId; from: EntityId | null }
  /** It came back (stage 4c), with all its points. */
  | { type: 'revived'; target: EntityId }
  /** A shot went (stage 4c: hitscan, for its tracer): from whom, from where to where it stopped, what it hit. */
  | { type: 'shot'; from: EntityId; start: Vec3; end: Vec3; hit: EntityId | null; kind: string }
  /** A projectile struck something (stage 4c) and is gone: where, what; (stage 5g) which way it went, and who fired it. */
  | { type: 'impact'; projectile: EntityId; at: Vec3; hit: EntityId | null; kind: string; velocity: Vec3; from: EntityId | null }
  /**
   * A weapon used (stage 5g): by whom, from where (its eyes, or its chest for what is thrown), which way,
   * of what kind (the game's words: `dart`, `shotgun`…). For the eyes and the ears (a flash, a kick, its
   * sound); the world's own effects are the other events (`shot`, a projectile, a blast).
   */
  | { type: 'fired'; from: EntityId; at: Vec3; direction: Vec3; kind: string };
