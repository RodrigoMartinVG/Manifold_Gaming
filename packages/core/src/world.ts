import { Random, quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { moveCharacter, stopMotion } from './character';

import { COMPONENT_NAME, MAKERS } from './components';
import { withoutDefaults } from './defaults';
import { EARTH, gravityAt } from './gravity';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from './materials';

import { bodyMass, PHYSICS, type PhysicsBackend, type PhysicsHit } from './physics';

import { VERIFIED, type Profile } from './profile';
import type { Cartridge } from './cartridge';
import type { KitPieces } from './level';
import type {
  CollisionGroups,
  ComponentSpecs,
  Components,
  Damage,
  Entity,
  Event,
  EntityId,
  GravityField,
  Mechanism,
  PlayerInput,
  Shape,
  Signal,
  SignalOp,
} from './types';
import { SIMULATION_VERSION } from './version';
import { spin, move } from './systems/kinematics';
import { readBack } from './systems/readback';
import { remember } from './systems/history';
import { fly } from './systems/projectiles';
import { shatter, breakApart } from './systems/breaks';
import { lightAt, transmission, illuminate } from './systems/light';
import { compute } from './systems/signals';
import { sense } from './systems/zones';
import { tell } from './systems/story';
import { signalReadsProblem, WORD } from './words';

/** A body's mass, from its density (the physics' own, 1, without one) and its shape's volume: what Rapier gives it. */
export const massOf = bodyMass;

/** What a query through the world hit (stage 2.5b): which entity, how far, where, and the surface's normal there. */
export interface Hit {
  entity: EntityId;
  distance: number;
  point: Vec3;
  /** The normal of the surface hit, pointing out of it (zero for a ray that starts inside what it hit: no surface). */
  normal: Vec3;
}

/** What a query through the world leaves out, or counts. */
export interface Query {
  /** An entity left out (the one asking). */
  skip?: EntityId;
  /** Another entity left out besides it (stage 3a: the platform a character's carry is swept through). */
  besides?: EntityId;
  /** Whether the bodies the physics moves (dynamic) count: yes, unless false. */
  dynamic?: boolean;
  /**
   * Whether the bodies a program moves count (kinematic: moving platforms, doors, lifts, and the
   * characters): yes, unless false (stage 4d: the navigation samples what never moves).
   */
  moving?: boolean;
  /** Only the bodies these groups meet. */
  groups?: CollisionGroups;
  /** Whether characters count: yes, unless false (stage 3h: the camera goes through people, not walls). */
  characters?: boolean;
}

/**
 * How long the segment from `a` to `b` is inside a box (its center, its turn, half its size): both
 * points turned into the box's axes, and the part of the segment between its faces on every axis (the
 * slabs). Additions, multiplications and divisions.
 */
export function insideLength(center: Vec3, rotation: Quat, half: Vec3, a: Vec3, b: Vec3): number {
  const back = quat.conjugate(rotation);
  const p = quat.rotate(back, vec3.sub(a, center));
  const q = quat.rotate(back, vec3.sub(b, center));
  const d = vec3.sub(q, p);
  let enter = 0;
  let exit = 1;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-12) {
      if (Math.abs(p[k]!) > half[k]!) return 0;
      continue;
    }
    let t1 = (-half[k]! - p[k]!) / d[k]!;
    let t2 = (half[k]! - p[k]!) / d[k]!;
    if (t1 > t2) [t1, t2] = [t2, t1];
    enter = Math.max(enter, t1);
    exit = Math.min(exit, t2);
    if (exit <= enter) return 0;
  }
  return (exit - enter) * vec3.length(d);
}

/** How far a mechanism is from closed (0) to open (1) at a step: from where it last turned, at its speed. */
export function progressOf(m: Mechanism, tick: number): number {
  const moved = ((tick - m.since) * STEP) / m.seconds;
  return Math.max(0, Math.min(1, m.toward ? m.from + moved : m.from - moved));
}

/**
 * Where a mechanism is when it is so far open: a lift, along its way; a door, turned around its hinge
 * (its center goes round it, and it turns as much), with our own sine and cosine (`quat.fromDegrees`).
 */
export function mechanismAt(m: Mechanism, progress: number): { position: Vec3; rotation: Quat } {
  if (m.lift) return { position: vec3.add(m.closed.position, vec3.scale(m.lift.by, progress)), rotation: [...m.closed.rotation] };
  const door = m.door!;
  const turn = quat.fromDegrees(door.axis, door.degrees * progress);
  return {
    position: vec3.add(door.hinge, quat.rotate(turn, vec3.sub(m.closed.position, door.hinge))),
    rotation: quat.normalize(quat.multiply(turn, m.closed.rotation)),
  };
}

/** An entity's name (stage 3b): one word, lowercase, digits and _ (`door_north`, `cube`). */
export const ENTITY_NAME = WORD;

/** What a character weighs for a blast's push (stage 4f, kg): it has no mass of its own (its body moves only as its controller says). */
export const CHARACTER_MASS = 80;

/**
 * How far from the origin what the physics moves may go before it is gone (m, stage 4.5b): farther than
 * anything of a level. A ball that leaves a level without a void below it takes about ten seconds to
 * fall that far.
 */
export const FARTHEST = 500;

/** The fixed step: the simulation always advances 1/60 of a second, whatever the frame rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  /** The seed of its randomness: the same world with the same seed does exactly the same. */
  seed: number;
  /** Its gravity (the Earth's, if not said). */
  gravity?: GravityField;
  /** A snapshot of its physics to start from, instead of an empty one (`World.restore` uses it). */
  physics?: Uint8Array;
  /** How it runs (stage 2.5b): its physics, and who verifies it. Without it, `VERIFIED`. */
  profile?: Profile;
  /** Its materials (stage 3b): without them, the engine's (`MATERIALS`). */
  materials?: Record<string, Material>;
  /**
   * How far from the origin what the physics moves may go before it is gone (m; stage 5.5e: the world's
   * own, `FARTHEST` if not said). A valley of 500 × 500 m with its origin at a corner reaches 707 m.
   */
  edge?: number;
}

/**
 * A SNAPSHOT OF A WORLD (stage 1d, as decision 0004 defined it): everything it is, at the end of a
 * step. Its clock and its id counter, its randomness's state, its gravity, its materials (stage 3b),
 * its signals (stage 3c), its players' inputs (and
 * the previous step's), its entities (plain data: copied as they are), and Rapier's own snapshot of
 * its physics, which also keeps what is not in the entities: the contacts, and what the solver
 * carries from one step to the next. Restored, it goes on exactly as the original would have
 * (measured before this stage: the same bits 300 steps later).
 */
export interface WorldSnapshot {
  /** The simulation's version it was taken with: only that one restores it. */
  readonly version: number;
  /** The profile it ran with (stage 2.5b): it is restored with the same one. */
  readonly profile: Profile;
  readonly tick: number;
  readonly lastId: number;
  readonly random: readonly [number, number, number, number];
  /** The seed it was born with (stage 4c: a shot's own dice start from it). */
  readonly seed?: number;
  /** Its edge (stage 5.5e), if it is not `FARTHEST`. */
  readonly edge?: number;
  readonly gravity: GravityField;
  readonly ambient: number;
  /** The level it was built from (stage 3j). */
  readonly origin: Origin | null;
  readonly materials: Readonly<Record<string, Material>>;
  readonly signals: readonly Signal[];
  readonly inputs: readonly [number, PlayerInput][];
  readonly lastInputs: readonly [number, PlayerInput][];
  readonly players: readonly number[];
  readonly entities: readonly Entity[];
  /** Rapier's snapshot: its bodies, colliders, contacts and solver, as bytes. */
  readonly physics: Uint8Array;
}

/** A world's ambient light when nothing says otherwise: the light every room had before stage 3d. */
export const DEFAULT_AMBIENT = 1;

/** The level a world was built from (stage 3j): its title, where its players start, and the ambient it said. */
export interface Origin {
  title: string;
  spawn: Vec3;
  facing: Vec3;
  ambient: number | null;
  /** The hour its sky shows (format 10), if its level says: only for the drawing. */
  sky?: number;
}

/**
 * A copy of plain data (numbers, texts, booleans, arrays and objects of them: what the state is made
 * of, decision 0004), all the way down. Not with JSON: it would turn −0 into 0 (different bits:
 * another hash) and NaN into null. Nor with `structuredClone`, which is the browser's and Node's,
 * not JavaScript's: the core runs on the language alone.
 */
export function copyData<T>(x: T): T {
  if (Array.isArray(x)) return x.map(copyData) as T;
  // Bytes (Rapier's snapshot): copied as bytes, not as an object with numbered keys.
  if (ArrayBuffer.isView(x)) return (x as unknown as Uint8Array).slice() as T;
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) out[k] = copyData(v);
    return out as T;
  }
  return x;
}

/**
 * A WORLD: the whole state of a simulation, and nothing outside it.
 *
 * Lesson from V1 (decision 0000): an id counter or a "program-wide" random generator makes two
 * worlds in the same process (a server with two rooms, a match and its replay, a test with a
 * server and a client) steal numbers from each other. Here every world has ITS clock, ITS id
 * counter and ITS randomness. A hundred worlds can be created at once without noticing each other.
 */
/**
 * THE STEP'S PHASES (stage 2.5b): what is the engine's, in the order it always runs.
 *
 *   1. spin: what spins without a body turns here;
 *   2. kinematics: every kinematic body gets the velocity of this step (a moving platform, the one
 *      that takes it where it has to be at its end, stage 2d);
 *   3. characters: each one decides where it can go, with what its player asks for (character.ts);
 *   4. physics: Rapier advances one step (gravity, collisions, bounces; the characters move);
 *   4b. breaks: what a hit with enough energy touched breaks (stage 3e), read with the velocities the
 *      bodies came with, before the next phase reads the ones the hit left;
 *   5. readBack: every moving body's pose and velocities go to its components;
 *   5b. history: every character's pose, as it ends this step, at the end of its history (stage 4c,
 *      decision 0022): what a shot looks back at;
 *   5c. projectiles: each one a segment of ray on, and what it strikes it hurts (stage 4c);
 *   6. zones: who came into each zone, and who left (stage 2a);
 *   7. light: every lamp on or off as its signal was, how lit every character is, and who every watcher
 *      sees (stage 3d);
 *   8. signals: every signal, from what the zones noticed and the watchers saw, in the order declared
 *      (stage 3c, decision 0018); mechanisms and lamps read them at the next step.
 *   9. story: an active objective whose signal is on is done, and the one after it becomes active; a
 *      scene whose signal is on plays, once (stage 4f).
 *
 * Each phase is a system of its own (stage 5.5e: `systems/`, a function of the world; they were private methods
 * of a world of 1,350 lines): `kinematics.ts` (spin, move), `readback.ts`, `history.ts`, `projectiles.ts`,
 * `breaks.ts`, `light.ts`, `signals.ts`, `zones.ts`, `story.ts`; the characters' is `character.ts`. A new
 * phase (buoyancy, a rope) is a new module and a line in `PHASES`.
 *
 * A game hooks in around them, never inside (mechanism and policy, decision 0000): before
 * (`Cartridge.beforeStep`: what these phases will use at this step: a bot's inputs, a mechanism's
 * target, what a character carries) and after (`Cartridge.onStep`: its rules, on the step's events).
 */
export const PHASES = [
  'spin',
  'kinematics',
  'characters',
  'physics',
  'breaks',
  'readBack',
  'history',
  'projectiles',
  'zones',
  'light',
  'signals',
  'story',
] as const;
export type Phase = (typeof PHASES)[number];

export class World {
  /** How many steps it took. */
  tick = 0;
  readonly random: Random;
  readonly entities = new Map<EntityId, Entity>();
  /**
   * EACH BODY'S ENTITY, by the physics' handle, and the characters' bodies (stage 4.5f): what a query
   * hit, and which bodies one that leaves characters out leaves, found at once. Both went through every
   * entity, every query: in the citadel, 357 entities and 200 queries a step of the navigation's build.
   * Kept where bodies come and go (an entity made, removed, broken; a world restored); never in a
   * snapshot (they follow from the entities).
   */
  private readonly byHandle = new Map<number, EntityId>();
  private readonly characterBodies = new Set<number>();
  private characterList: number[] | null = null;
  /**
   * EACH NAME'S ENTITY (stage 5.5e): `named` went through every entity, for every zone, used and seen signal
   * on every step. Kept where entities come, go or are renamed (`rename`); never in a snapshot.
   */
  private readonly byName = new Map<string, EntityId>();

  /** The entity whose body has this physics handle, if any. */
  entityOfHandle(handle: number): Entity | undefined {
    const id = this.byHandle.get(handle);
    return id === undefined ? undefined : this.entities.get(id);
  }

  private indexBody(e: Entity) {
    if (e.name !== undefined) this.byName.set(e.name, e.id);
    if (!e.body) return;
    this.byHandle.set(e.body.handle, e.id);
    if (e.character) {
      this.characterBodies.add(e.body.handle);
      this.characterList = null;
    }
  }

  /** A body's entity forgotten by the indexes (its body removed, broken: `systems/breaks.ts`). The systems' own. */
  forgetBody(e: Entity) {
    if (!e.body) return;
    this.byHandle.delete(e.body.handle);
    if (this.characterBodies.delete(e.body.handle)) this.characterList = null;
  }
  /** Its game's kit of level pieces (stage 4.5e, decision 0026), by name: a level's `kit` lines build with it. */
  kit: KitPieces = {};
  private lastId = 0;
  /**
   * Events have TWO readers, at two rates:
   * - the game (the cartridge), once per STEP: `stepEvents`, emptied at the start of every step;
   * - the presentation, once per screen FRAME: `takeEvents()`. Those are NOT emptied on every
   *   step: if two steps happen in one frame, the presentation must see the events of both
   *   (V1's lesson, which the architecture proposal forgot).
   */
  stepEvents: Event[] = [];
  private pending: Event[] = [];
  /**
   * What each player asks for now (stage 1b), by player number: it enters through the session, at a
   * concrete step, and it is part of the state (and of the hash), like everything else.
   */
  readonly inputs = new Map<number, PlayerInput>();
  /**
   * What each player asked for at the PREVIOUS step (stage 1d): a button is pressed when it is held
   * now and was not then (`pressed` in input.ts). Also part of the state.
   */
  readonly lastInputs = new Map<number, PlayerInput>();
  /**
   * Who is in the match (stage 1e): the server says it, with `players.join` and `players.leave`, at a
   * concrete step. The game decides what that means (in the Dojo's course, a character for each one).
   */
  readonly players = new Set<number>();
  /** Its gravity field: data, like the rest of its state (decision 0012). */
  private field: GravityField;
  /**
   * ITS AMBIENT LIGHT (stage 3d): how lit everything is with no lamp, from 0 (dark) to 1 (the light
   * every room had before: a room says less). Data, like the rest: hashed, and in snapshots.
   */
  ambient = DEFAULT_AMBIENT;
  /**
   * THE LEVEL IT WAS BUILT FROM (stage 3j): its title, where its players start, and the ambient it
   * said (null: none), to write the world back as a level (`levelOfWorld`). Null if no level built it.
   */
  origin: Origin | null = null;
  /**
   * WHAT ITS THINGS CAN BE MADE OF (stage 3b), by name: the engine's (`MATERIALS`) and those a level
   * declares (`addMaterial`). Data, like the rest: hashed, and in snapshots. A body names one
   * (`body.material`) and takes its friction and bounce when it is created.
   */
  private readonly table: Record<string, Material>;
  /**
   * ITS SIGNALS (stage 3c, decision 0018), in the order they are computed: the order declared. Data,
   * like the rest: hashed, and in snapshots, values and what each keeps.
   */
  /** The signals, in their order (stage 3c): the world's and its signals system's (`systems/signals.ts`). */
  readonly wires: Signal[] = [];
  /** How it runs (stage 2.5b, decision 0014): its physics, and who verifies it. */
  readonly profile: Profile;
  /**
   * ITS physics, the one its profile names (Rapier's deterministic build, behind the boundary of
   * physics.ts): every world has its own, like its randomness. The entities keep only their bodies'
   * handles (decision 0004).
   */
  readonly physics: PhysicsBackend;

  /** The seed it was born with (stage 4c, decision 0022): a shot's dice are made from it, the step, the player and the shot. */
  readonly seed: number;
  /** How far from the origin what the physics moves may go before it is gone (stage 5.5e; `FARTHEST` unless said). */
  readonly edge: number;

  constructor(o: WorldOptions) {
    this.seed = o.seed;
    this.edge = o.edge ?? FARTHEST;
    if (!(this.edge > 0)) throw new Error(`a world's edge is a distance above 0 (m), not ${o.edge}`);
    this.random = new Random(o.seed);
    this.field = o.gravity ?? EARTH;
    this.table = copyData(o.materials ?? (MATERIALS as Record<string, Material>));
    this.profile = o.profile ?? VERIFIED;
    this.physics = PHYSICS[this.profile.physics](this.uniformGravity(), STEP, o.physics);
  }

  /** The last id given (the next entity gets the following one): part of the state. */
  get lastEntityId(): number {
    return this.lastId;
  }

  /**
   * The inputs for the next step: the current ones become the previous step's, and the changes enter.
   * The session calls it before EVERY step, even without changes.
   */
  applyInputs(changes: ReadonlyMap<number, PlayerInput>) {
    this.lastInputs.clear();
    for (const [player, input] of this.inputs) this.lastInputs.set(player, input);
    for (const [player, input] of changes) this.inputs.set(player, input);
  }

  /** A snapshot of this moment: copies, so it does not change when the world goes on. */
  snapshot(): WorldSnapshot {
    return {
      version: SIMULATION_VERSION,
      profile: this.profile,
      tick: this.tick,
      lastId: this.lastId,
      random: [...this.random.state],
      seed: this.seed,
      ...(this.edge !== FARTHEST ? { edge: this.edge } : {}),
      gravity: copyData(this.field),
      ambient: this.ambient,
      origin: copyData(this.origin),
      materials: copyData(this.table),
      signals: copyData(this.wires),
      inputs: copyData([...this.inputs]),
      lastInputs: copyData([...this.lastInputs]),
      players: [...this.players],
      // (Each without what equals its default, stage 5.5f: defaults.ts.)
      entities: [...this.entities.values()].map((e) => withoutDefaults(copyData(e))),
      physics: this.physics.snapshot(),
    };
  }

  /**
   * A NEW world from a snapshot, the same as the one that took it. It emits no events: its entities
   * were already there (whoever draws it reads them from `entities`).
   */
  static restore(s: WorldSnapshot): World {
    if (s.version !== SIMULATION_VERSION)
      throw new Error(`A snapshot of version ${s.version}, and this engine is version ${SIMULATION_VERSION}.`);
    const world = new World({
      seed: s.seed ?? 0,
      ...(s.edge !== undefined ? { edge: s.edge } : {}),
      gravity: copyData(s.gravity),
      materials: copyData(s.materials) as Record<string, Material>,
      physics: s.physics,
      profile: s.profile,
    });
    world.tick = s.tick;
    world.lastId = s.lastId;
    world.ambient = s.ambient;
    world.origin = copyData(s.origin);
    for (const signal of copyData(s.signals)) world.wires.push(signal);
    world.random.restore(s.random);
    for (const [player, input] of copyData(s.inputs)) world.inputs.set(player, input);
    for (const [player, input] of copyData(s.lastInputs)) world.lastInputs.set(player, input);
    for (const player of s.players) world.players.add(player);
    for (const e of copyData(s.entities)) {
      world.entities.set(e.id, e);
      world.indexBody(e);
    }
    return world;
  }

  get gravity(): GravityField {
    return this.field;
  }

  set gravity(field: GravityField) {
    this.field = field;
    this.physics.setGravity(this.uniformGravity());
  }

  /** Its materials, by name (read only: `addMaterial` adds one). */
  get materials(): Readonly<Record<string, Readonly<Material>>> {
    return this.table;
  }

  /**
   * A material more (stage 3b: those a level declares). A name it already has, with other numbers, is
   * an error: the bodies made of it took the old ones, and would not agree with the new.
   */
  addMaterial(name: string, m: Material) {
    if (!MATERIAL_NAME.test(name)) throw new Error(`"${name}" is not a material's name: one word in lowercase, like \`ice\``);
    const problem = materialProblem(m);
    if (problem) throw new Error(`the material "${name}": ${problem}`);
    const had = this.table[name];
    if (had && (had.friction !== m.friction || had.bounce !== m.bounce || had.density !== m.density || had.drag !== m.drag))
      throw new Error(`the material "${name}" is already this world's, with other numbers`);
    this.table[name] = { friction: m.friction, bounce: m.bounce, density: m.density, drag: m.drag };
  }

  /** Its signals, in the order they are computed (read only: `addSignal` and `setSignal` change them). */
  get signals(): readonly Readonly<Signal>[] {
    return this.wires;
  }

  /**
   * A signal more (stage 3c), computed after those already there: it reads only zones (by their
   * names, already in the world) and signals added before it, so a cycle cannot be made. Its value
   * starts at 0.
   */
  addSignal(name: string, op: SignalOp, reads: readonly string[]) {
    const fail = (why: string): never => {
      throw new Error(`the signal "${name}": ${why}`);
    };
    if (!ENTITY_NAME.test(name)) fail('its name is one word, lowercase, digits and _');
    if (this.wires.some((w) => w.name === name)) fail('there is one already');
    const problem = signalReadsProblem(op, reads.length);
    if (problem) fail(problem);
    for (const r of reads) {
      if (op === 'zone' || op === 'used') {
        if (!this.named(r)?.sensor) fail(`no zone named "${r}"`);
      } else if (op === 'seen') {
        if (!this.named(r)?.watcher) fail(`no watcher named "${r}"`);
      } else if (!this.wires.some((w) => w.name === r)) fail(`it reads "${r}", which is not a signal added before it`);
    }
    this.wires.push({ name, op, reads: [...reads], value: 0, memory: 0 });
  }

  /**
   * Pushes what the physics moves (stage 3g: a game, a grab, a current): changes its velocity by
   * `change`, with the impulse that takes for its mass (so a heavy thing is as easy to push as a light
   * one by this; how hard a push may be is the caller's), waking it if it sleeps. Its velocity as the
   * world knows it changes with it (stage 4.5's close): what changed its velocity after the push is
   * what it ran into. Without that, a held crate, pushed every step towards where it is held, was heard
   * as a hit every step (the author heard it), and in the Dojo a hit hurts what it is on.
   */
  push(e: Entity, change: Vec3) {
    if (e.body?.type !== 'dynamic') return;
    this.physics.push(e.body.handle, vec3.scale(change, this.physics.massOf(e.body.handle)));
    e.body.linearVelocity = vec3.add(e.body.linearVelocity, change);
  }

  /**
   * A BLAST (stage 4f, the explosion's push of the plan): from `at`, what the physics moves and the
   * characters within `radius` are pushed away from it, by `strength` (an impulse, N·s) at its center,
   * less with the distance (all of it at 0, none at the radius), unless something that does not move
   * stands between. A body takes it as an impulse; a character, as a change of its velocity, by its own
   * weight (its `mass` since stage 5.5e, `CHARACTER_MASS` if not said; a push up lifts it off the
   * ground). It is heard (a `blast` sound, as far as a hit of its strength) and said (`blast`). Returns
   * what it pushed, and how much of the blast each one took (0 to 1): what that does to them (their
   * health) is each game's.
   */
  explode(at: Vec3, radius: number, strength: number, by: EntityId | null = null): { entity: EntityId; share: number }[] {
    const pushed: { entity: EntityId; share: number }[] = [];
    for (const e of this.entities.values()) {
      const b = e.body;
      if (!b || !e.transform || (b.type !== 'dynamic' && !e.character)) continue;
      const to = vec3.sub(e.transform.position, at);
      const d = vec3.length(to);
      if (d >= radius) continue;
      const away: Vec3 = d > 1e-6 ? vec3.scale(to, 1 / d) : [0, 1, 0];
      // Behind something that does not move, sheltered.
      if (d > 1e-6) {
        const wall = this.castRay(at, away, d, { besides: e.id, dynamic: false, characters: false });
        if (wall && wall.distance < d - 1e-6) continue;
      }
      const share = 1 - d / radius;
      if (e.character) {
        // Off the ground from this step on, and thrown until it lands.
        e.character.velocity = vec3.add(
          e.character.velocity,
          vec3.scale(away, (strength * share) / (e.character.mass ?? CHARACTER_MASS)),
        );
        e.character.grounded = false;
        e.character.thrown = true;
      } else this.physics.push(b.handle, vec3.scale(away, strength * share));
      pushed.push({ entity: e.id, share });
    }
    this.emit({ type: 'blast', at: [...at], radius, by });
    this.emit({
      type: 'sound',
      sound: 'blast',
      source: by ?? 0,
      at: [...at],
      surface: null,
      speed: 0,
      energy: strength,
      radius: Math.min(40, 2 + 8 * Math.sqrt(strength)),
    });
    return pushed;
  }

  /** A signal's value: what it was at the end of the last step. */
  signal(name: string): number {
    const w = this.wires.find((x) => x.name === name);
    if (!w) throw new Error(`no signal "${name}" in this world`);
    return w.value;
  }

  /**
   * Sets an input signal (stage 3c): the game, in its hooks, or the console. It takes the value at the
   * end of this step (if set before the engine's phases), and mechanisms see it at the next. A signal
   * that is computed cannot be set: it would be computed again, and the setting silently lost.
   */
  setSignal(name: string, value: number) {
    const w = this.wires.find((x) => x.name === name);
    if (!w) throw new Error(`no signal "${name}" in this world`);
    if (w.op !== 'input') throw new Error(`the signal "${name}" is computed (${w.op} ${w.reads.join(' ')}): set what it reads`);
    if (!Number.isFinite(value)) throw new Error(`a signal's value is a number, not ${value}`);
    w.memory = value;
  }

  /** The entity with this name, if there is one (stage 3b). */
  named(name: string): Entity | undefined {
    const id = this.byName.get(name);
    return id === undefined ? undefined : this.entities.get(id);
  }

  /** Gives an entity another name (stage 5.5e: through here, so `named` finds it at once). Unique, checked by whoever asks. */
  rename(e: Entity, name: string) {
    if (e.name !== undefined && this.byName.get(e.name) === e.id) this.byName.delete(e.name);
    e.name = name;
    this.byName.set(name, e.id);
  }

  /**
   * The uniform field is handed to the physics as is (the planets of phase 7 will push each body instead).
   * The world's and its systems' (`systems/readback.ts`).
   */
  uniformGravity() {
    return gravityAt(this.field, [0, 0, 0]);
  }

  createEntity(components: Components): Entity {
    for (const name of Object.keys(components.game ?? {}))
      if (!COMPONENT_NAME.test(name))
        throw new Error(
          `"${name}" is not a game component's name: it goes with its game, \`<game>.<component>\`, like \`dojo.runner\``,
        );
    // A name names one entity in its world (stage 3b): two with one name, and `inspect` or a signal
    // would find either.
    if (components.name !== undefined) {
      if (!ENTITY_NAME.test(components.name))
        throw new Error(`"${components.name}" is not a name: one word, like \`door_north\``);
      if (this.named(components.name)) throw new Error(`"${components.name}" is already another entity's name`);
    }
    // Made of a material it does not know, its friction would be a guess (stage 3b).
    const material = components.body?.material;
    if (material !== undefined && !this.table[material])
      throw new Error(`no material "${material}" in this world (${Object.keys(this.table).join(', ')})`);
    // What is kept as it is given; then what the world makes from what is asked for, in its makers' order (stage 5.5e).
    const entity: Entity = {
      id: ++this.lastId,
      ...(Object.fromEntries(Object.entries(components).filter(([k]) => !(k in MAKERS))) as Omit<Entity, 'id'>),
    };
    for (const [k, make] of Object.entries(MAKERS) as [keyof ComponentSpecs, (spec: unknown, e: Entity, w: World) => unknown][]) {
      const spec = components[k];
      if (spec) (entity as unknown as Record<string, unknown>)[k] = make(spec, entity, this);
    }
    this.entities.set(entity.id, entity);
    this.indexBody(entity);
    this.emit({ type: 'entityCreated', id: entity.id });
    return entity;
  }

  removeEntity(id: EntityId) {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.forgetBody(entity);
    if (entity.name !== undefined && this.byName.get(entity.name) === id) this.byName.delete(entity.name);
    if (entity.body) this.physics.removeBody(entity.body.handle);
    this.entities.delete(id);
    this.emit({ type: 'entityRemoved', id });
  }

  // ---------- Spatial queries (stage 2.5b) ----------
  //
  // WHAT IS THERE, asked to the world and answered by entity (not by the physics' handles): a ray
  // (what is seen from a point, a bot's eyes, a hitscan shot), a shape moved along a line (what a
  // character stands on, the camera against a wall) and the shortest way between two points. Every
  // system and every game asks here, not to Rapier: phase 7's glued spaces will make these cross
  // their seams, in one place. A body created or put somewhere between two steps, or before the first,
  // is in them at once, where it is: Rapier's own queries see it only from its next step, and until
  // then physics.ts asks it on its own (measured; `RapierPhysics.unseen`).

  /** The first entity a ray from `from` along `direction` (length 1) hits, as far as `reach`. */
  castRay(from: Vec3, direction: Vec3, reach: number, o: Query = {}): Hit | null {
    return this.hitOf(this.physics.castRay(from, direction, reach, this.physicsQuery(o)));
  }

  /** The first entity a shape moved along `direction` (length 1) from `position`, turned by `rotation`, would touch, as far as `reach`. */
  castShape(shape: Shape, position: Vec3, rotation: Quat, direction: Vec3, reach: number, o: Query = {}): Hit | null {
    return this.hitOf(this.physics.castShape(shape, position, rotation, direction, reach, this.physicsQuery(o)));
  }

  /**
   * The shortest way from one point to another: today, straight (`to − from`); in phase 7, across the
   * seams of a glued space, where the nearest copy of `to` may be on the other side.
   */
  shortestDelta(from: Vec3, to: Vec3): Vec3 {
    return vec3.sub(to, from);
  }

  private physicsQuery(o: Query) {
    const skip = o.skip === undefined ? undefined : this.entities.get(o.skip)?.body?.handle;
    const besides = o.besides === undefined ? undefined : this.entities.get(o.besides)?.body?.handle;
    return {
      ...(skip === undefined ? {} : { skip }),
      ...(besides === undefined ? {} : { besides }),
      ...(o.dynamic === undefined ? {} : { dynamic: o.dynamic }),
      ...(o.moving === undefined ? {} : { kinematic: o.moving }),
      ...(o.groups ? { groups: o.groups } : {}),
      ...(o.characters === false ? { leave: (this.characterList ??= [...this.characterBodies]) } : {}),
    };
  }

  /** A physics hit as an entity's (the entity whose body it is). */
  private hitOf(hit: PhysicsHit | null): Hit | null {
    if (!hit) return null;
    const entity = this.byHandle.get(hit.handle);
    return entity === undefined ? null : { entity, distance: hit.distance, point: hit.point, normal: hit.normal };
  }

  /**
   * The game's damage filter (stage 4c: `Cartridge.filterDamage`), which the session puts: how much of
   * a hit is taken. Without one, all of it.
   */
  filterDamage: ((world: World, damage: Damage) => number) | null = null;

  /**
   * WHAT A WORLD TAKES FROM ITS GAME (stage 5.5a): its damage filter and its kit, set in one place for
   * every world a game is in: born with the session, loaded from a save or a match joined, born again to
   * compare (`level.diff`). Before, each of those set what it remembered: a loaded world lost its kit
   * (and refused the host's `add kit`), and `level.diff`'s world was born without one (and threw).
   */
  attach(cartridge: Pick<Cartridge, 'filterDamage' | 'kit'>): this {
    this.filterDamage = cartridge.filterDamage?.bind(cartridge) ?? null;
    this.kit = cartridge.kit ?? {};
    return this;
  }

  /**
   * A HIT TAKEN (stage 4c): through the game's filter, it takes points from what has health and is
   * standing, and says so (`hurt`); out of points, it goes down (`down`): a character down asks for
   * nothing. Returns what it took (0: nothing had to). Mechanism in the engine; how much a weapon
   * takes, and the filter, are each game's.
   */
  hurt(target: EntityId, amount: number, o: { from?: EntityId | null; part?: string | null; kind?: string } = {}): number {
    const e = this.entities.get(target);
    const h = e?.health;
    if (!h || h.down >= 0 || !(amount > 0)) return 0;
    const damage: Damage = { target, from: o.from ?? null, part: o.part ?? null, kind: o.kind ?? 'hit', amount };
    const filtered = this.filterDamage ? this.filterDamage(this, damage) : amount;
    const taken = Math.min(h.points, Math.max(0, Number.isFinite(filtered) ? filtered : 0));
    if (taken <= 0) return 0;
    h.points -= taken;
    this.emit({ type: 'hurt', ...damage, amount: taken });
    if (h.points <= 0) {
      h.points = 0;
      h.down = this.tick;
      if (e.character) e.character.holding = 0;
      this.emit({ type: 'down', target, from: damage.from });
    }
    return taken;
  }

  /** IT COMES BACK (stage 4c): with all its points, standing; where, if the game says (`at`), or where it is. */
  revive(target: EntityId, at?: Vec3) {
    const e = this.entities.get(target);
    if (!e?.health) return;
    e.health.points = e.health.most;
    e.health.down = -1;
    if (at) this.place(e, at);
    this.emit({ type: 'revived', target });
  }

  /**
   * One fixed step: THE ENGINE'S PHASES (`PHASES`), always in the same order, and entities visited in
   * creation order (a `Map` keeps insertion order): the order is part of determinism. Around them,
   * the game (the session calls it: `Cartridge.beforeStep` before, `onStep` after).
   */
  step() {
    this.stepEvents = [];
    this.tick++;
    for (const phase of PHASES) this.phases[phase]();
  }

  /** What each phase does (see `PHASES`). */
  private readonly phases: Record<Phase, () => void> = {
    spin: () => spin(this),
    kinematics: () => move(this),
    characters: () => {
      for (const e of this.entities.values()) if (e.character && e.body?.type === 'character') moveCharacter(this, e, STEP);
    },
    physics: () => this.physics.step(),
    breaks: () => shatter(this),
    readBack: () => readBack(this),
    history: () => remember(this),
    projectiles: () => fly(this),
    zones: () => sense(this),
    light: () => illuminate(this),
    signals: () => compute(this),
    story: () => tell(this),
  };

  /**
   * Breaks something (stage 3e; the console or a game may, too): it is broken (a lamp gives no light),
   * its body goes (it stops colliding), a few large pieces the physics moves fly from where it was
   * (in the hash: they are the world's), and the break is an event with a seed for the fragments. The
   * pieces: as many as its size asks for (one per 0.2 m of its largest side, 2 at least, 6 at most), a
   * cube a third of its smallest side, out at 1 to 3 m/s from the world's randomness.
   */
  breakApart(e: Entity, by: EntityId, energy: number) {
    breakApart(this, e, by, energy);
  }

  /**
   * HOW LIT A POINT IS (stage 3d): the ambient light, plus, from every lamp on that reaches it and sees
   * it (a ray from the lamp: nothing in between, the lamp and `skip`, the one lit, left out), its intensity falling
   * linearly to its radius, times what gets through the zones in between (`transmission`). Additions,
   * multiplications, a division and a square root: the same in every browser and in Node.
   */
  lightAt(point: Vec3, skip?: EntityId): number {
    return lightAt(this, point, skip);
  }

  /**
   * WHAT GETS THROUGH from one point to another (stage 3d), from 1 (all) towards 0: each zone with an
   * `opacity` (per meter) the segment crosses takes its length inside it times its opacity, and what
   * gets through is 1 / (1 + their sum): a rational falloff, not the browsers' exponential (no `exp`),
   * the same everywhere. Light and sight both cross it: a watcher sees no more through a fog bank than
   * the player does.
   */
  transmission(from: Vec3, to: Vec3): number {
    return transmission(this, from, to);
  }

  /**
   * Puts an entity somewhere at once (stage 2a: a character back to its checkpoint), and stops it:
   * its body, if it has one, goes there too, without moving through what is in between.
   */
  place(e: Entity, position: Vec3) {
    if (!e.transform) return;
    e.transform.position = [...position];
    if (e.body) {
      this.physics.place(e.body.handle, position, e.transform.rotation);
      e.body.linearVelocity = [0, 0, 0];
      e.body.angularVelocity = [0, 0, 0];
    }
    // (A character stops what it was doing, as its ways of moving say: stage 5.5f.)
    if (e.character) stopMotion(e.character);
  }

  /** Frees its physics. A world that is no longer used must be disposed (WebAssembly's memory is not collected). */
  dispose() {
    this.physics.dispose();
  }

  /** Record that something happened (for both readers). */
  emit(event: Event) {
    this.stepEvents.push(event);
    this.pending.push(event);
  }

  /** For the presentation: the events since the last time it asked (and forgets them). */
  takeEvents(): Event[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}

/**
 * Half the size, along the world's axes, of the box that holds a box of half size `half` turned by
 * `rotation`: each of its own axes, turned, contributes its length along each of the world's axes.
 */
export function holdingBox(rotation: Quat, half: Vec3): Vec3 {
  const x = quat.rotate(rotation, [half[0], 0, 0]);
  const y = quat.rotate(rotation, [0, half[1], 0]);
  const z = quat.rotate(rotation, [0, 0, half[2]]);
  return [
    Math.abs(x[0]) + Math.abs(y[0]) + Math.abs(z[0]),
    Math.abs(x[1]) + Math.abs(y[1]) + Math.abs(z[1]),
    Math.abs(x[2]) + Math.abs(y[2]) + Math.abs(z[2]),
  ];
}
