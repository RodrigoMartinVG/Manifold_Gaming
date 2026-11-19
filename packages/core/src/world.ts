import { Random, quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { HISTORY, moveCharacter, newCharacter, poseOf } from './character';
import { castHit } from './hits';
import { pressed } from './input';
import { COMPONENT_NAME } from './components';
import { EARTH, gravityAt } from './gravity';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from './materials';
import { HIT_HEARD, hitRadius } from './sound';
import { bodyMass, PHYSICS, type PhysicsBackend, type PhysicsHit } from './physics';

import { VERIFIED, type Profile } from './profile';
import type { Cartridge } from './cartridge';
import type { KitPieces } from './level';
import type {
  CollisionGroups,
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

  private indexBody(e: Entity) {
    if (!e.body) return;
    this.byHandle.set(e.body.handle, e.id);
    if (e.character) {
      this.characterBodies.add(e.body.handle);
      this.characterList = null;
    }
  }

  private forgetBody(e: Entity) {
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
  private readonly wires: Signal[] = [];
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
      entities: copyData([...this.entities.values()]),
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
   * stands between. A body takes it as an impulse; a character, as a change of its velocity, as if it
   * weighed `CHARACTER_MASS` (a push up lifts it off the ground). It is heard (a `blast` sound, as far as
   * a hit of its strength) and said (`blast`). Returns what it pushed, and how much of the blast each
   * one took (0 to 1): what that does to them (their health) is each game's.
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
        e.character.velocity = vec3.add(e.character.velocity, vec3.scale(away, (strength * share) / CHARACTER_MASS));
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

  /**
   * THE STORY'S PIECES (stage 4f), after the signals: each active objective whose signal is on is done
   * (`objective`, done), and the one it leads to becomes active (`objective`, active); each scene whose
   * signal is on and has not played, plays (`scene`). What they say is keys of the game's words.
   */
  private tell() {
    for (const e of [...this.entities.values()]) {
      const o = e.objective;
      if (o?.state !== 'active' || this.signal(o.when) === 0) continue;
      o.state = 'done';
      this.emit({ type: 'objective', name: e.name ?? String(e.id), say: o.say, state: 'done' });
      const next = o.then ? this.named(o.then)?.objective : undefined;
      if (next && next.state === 'waiting') {
        next.state = 'active';
        this.emit({ type: 'objective', name: o.then!, say: next.say, state: 'active' });
      }
    }
    for (const e of this.entities.values()) {
      const sc = e.scene;
      if (!sc || sc.played || this.signal(sc.when) === 0) continue;
      sc.played = true;
      this.emit({ type: 'scene', name: e.name ?? String(e.id), lines: sc.lines.map((l) => ({ ...l })) });
    }
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
    for (const e of this.entities.values()) if (e.name === name) return e;
    return undefined;
  }

  /** The uniform field is handed to the physics as is (the planets of phase 7 will push each body instead). */
  private uniformGravity() {
    return gravityAt(this.field, [0, 0, 0]);
  }

  createEntity(components: Components): Entity {
    const { body, character, sensor, mover, mechanism, lamp, watcher, breakable, health, ...rest } = components;
    for (const name of Object.keys(rest.game ?? {}))
      if (!COMPONENT_NAME.test(name))
        throw new Error(
          `"${name}" is not a game component's name: it goes with its game, \`<game>.<component>\`, like \`dojo.runner\``,
        );
    // A name names one entity in its world (stage 3b): two with one name, and `inspect` or a signal
    // would find either.
    if (rest.name !== undefined) {
      if (!ENTITY_NAME.test(rest.name)) throw new Error(`"${rest.name}" is not a name: one word, like \`door_north\``);
      if (this.named(rest.name)) throw new Error(`"${rest.name}" is already another entity's name`);
    }
    // Made of a material it does not know, its friction would be a guess (stage 3b).
    const material = body?.material === undefined ? undefined : this.table[body.material];
    if (body?.material !== undefined && !material)
      throw new Error(`no material "${body.material}" in this world (${Object.keys(this.table).join(', ')})`);
    const entity: Entity = { id: ++this.lastId, ...rest };
    if (health) {
      if (!(health.most > 0)) throw new Error('Health has some points: its most must be more than 0');
      entity.health = { points: health.most, most: health.most, down: -1 };
    }
    if (mover) entity.mover = { from: [...mover.from], to: [...mover.to], seconds: mover.seconds };
    if (breakable) {
      if (!(breakable.threshold >= 0)) throw new Error('What breaks it is an energy, 0 or more');
      entity.breakable = { threshold: breakable.threshold, broken: false };
    }
    if (lamp) {
      if (!entity.transform) throw new Error('A lamp needs a transform: where is it?');
      if (!(lamp.radius > 0) || !(lamp.intensity >= 0))
        throw new Error('A lamp reaches somewhere (a radius over 0), with some light (0 or more)');
      entity.lamp = { radius: lamp.radius, intensity: lamp.intensity, signal: lamp.signal, on: lamp.signal === null };
    }
    if (watcher) {
      if (!entity.transform) throw new Error('A watcher needs a transform: where is its eye, and where does it look?');
      if (!(watcher.range > 0) || !(watcher.cone >= -1 && watcher.cone <= 1))
        throw new Error('A watcher sees somewhere: a range over 0, a cone between -1 and 1');
      entity.watcher = { range: watcher.range, cone: watcher.cone, threshold: watcher.threshold, sees: [] };
    }
    if (mechanism) {
      if (!entity.transform) throw new Error('A mechanism needs a transform: where is it, closed?');
      if (!(mechanism.seconds > 0)) throw new Error('A mechanism takes some time: its seconds must be more than 0');
      if (!mechanism.door === !mechanism.lift) throw new Error('A mechanism is a door or a lift');
      entity.mechanism = {
        signal: mechanism.signal,
        seconds: mechanism.seconds,
        closed: { position: [...entity.transform.position], rotation: [...entity.transform.rotation] },
        ...(mechanism.door
          ? { door: { hinge: [...mechanism.door.hinge], axis: [...mechanism.door.axis], degrees: mechanism.door.degrees } }
          : {}),
        ...(mechanism.lift ? { lift: { by: [...mechanism.lift.by] } } : {}),
        toward: 0,
        since: this.tick,
        from: 0,
      };
    }
    if (sensor) {
      if (!entity.transform) throw new Error('A zone needs a transform: where is it?');
      const params = Object.fromEntries(Object.entries(sensor.params ?? {}).map(([k, v]) => [k, [...v]]));
      entity.sensor = { kind: sensor.kind, half: [...sensor.half], inside: [], params };
    }
    if (body) {
      if (!entity.transform) throw new Error('A body needs a transform: where is it?');
      // What it is made of gives it its friction, its bounce and (stage 3g) what it weighs for its size.
      const spec = material
        ? {
            ...body,
            friction: body.friction ?? material.friction,
            restitution: body.restitution ?? material.bounce,
            density: body.density ?? material.density,
          }
        : body;
      entity.body = this.physics.addBody(spec, entity.transform);
    }
    if (character) {
      if (entity.body?.type !== 'character') throw new Error("A character needs a body of type 'character'.");
      entity.character = newCharacter(character);
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
    spin: () => this.spin(),
    kinematics: () => this.move(),
    characters: () => {
      for (const e of this.entities.values()) if (e.character && e.body?.type === 'character') moveCharacter(this, e, STEP);
    },
    physics: () => this.physics.step(),
    breaks: () => this.shatter(),
    readBack: () => this.readBack(),
    history: () => this.remember(),
    projectiles: () => this.fly(),
    zones: () => this.sense(),
    light: () => this.illuminate(),
    signals: () => this.compute(),
    story: () => this.tell(),
  };

  /**
   * KINEMATIC BODIES SYSTEM: each one gets the velocity of this step: the one it has, the one it
   * spins with, and, if it is a MOVING PLATFORM (stage 2d), the one that takes it where it has to be
   * at the end of this step. That place is a function of the time (back and forth, at a constant
   * speed), not of where it was: so it never drifts, however many trips it makes.
   */
  private move() {
    const t = this.tick * STEP;
    for (const e of this.entities.values()) {
      if (!e.transform || e.body?.type !== 'kinematic') continue;
      const m = e.mover;
      if (m) {
        const phase = t % (2 * m.seconds);
        const u = phase <= m.seconds ? phase / m.seconds : 2 - phase / m.seconds;
        const target = vec3.add(m.from, vec3.scale(vec3.sub(m.to, m.from), u));
        e.body.linearVelocity = vec3.scale(vec3.sub(target, e.transform.position), 1 / STEP);
      }
      if (e.spin) e.body.angularVelocity = [...e.spin.angularVelocity];
      if (e.mechanism) this.drive(e, e.mechanism);
      this.physics.setKinematicVelocity(e.body.handle, e.body.linearVelocity, e.body.angularVelocity);
    }
  }

  /**
   * A MECHANISM (stage 3c): it reads its signal, as it was at the end of the last step, and turns
   * back from where it is if the signal changed which way it goes; then it gets the velocity that
   * takes it where it has to be at the end of this step. Its place is a function of its state and the
   * step (`mechanismAt`); its velocity, of where it really is: so it never drifts. Turning, from the
   * turn between where it is and where it has to be: twice its vector part, over the step (for the
   * small turn of one step, the angle; a little less, and the next step makes it up). No sine, no
   * cosine: the same bits everywhere.
   */
  private drive(e: Entity, m: Mechanism) {
    const want = this.signal(m.signal) !== 0 ? 1 : 0;
    if (want !== m.toward) {
      m.from = progressOf(m, this.tick - 1);
      m.since = this.tick - 1;
      m.toward = want;
      // Heard when it starts to move (stage 3f): a door creaks, a lift hums, 12 m around.
      this.emit({
        type: 'sound',
        sound: m.door ? 'door' : 'lift',
        source: e.id,
        at: [...e.transform!.position],
        surface: e.body?.material ?? null,
        speed: 1 / m.seconds,
        energy: 0,
        radius: 12,
      });
    }
    const target = mechanismAt(m, progressOf(m, this.tick));
    const body = e.body!;
    body.linearVelocity = vec3.scale(vec3.sub(target.position, e.transform!.position), 1 / STEP);
    let turn = quat.multiply(target.rotation, quat.conjugate(e.transform!.rotation));
    if (turn[3] < 0) turn = [-turn[0], -turn[1], -turn[2], -turn[3]];
    body.angularVelocity = [(2 * turn[0]) / STEP, (2 * turn[1]) / STEP, (2 * turn[2]) / STEP];
  }

  /**
   * READING BACK every moving body's pose and velocities. And, for what the physics moves, a hit, heard
   * (stage 3f): how much its velocity changed in the step beyond what gravity gave it is what something
   * did to it; half its mass times that change squared, the energy of the hit. From what the world
   * already has (the velocity before, the one after): the same in every copy, and after a snapshot.
   */
  /**
   * PROJECTILES SYSTEM (stage 4c): each one moves a segment of ray, its velocity for a step (bent by
   * the gravity if it says so), swept with its radius against the characters as they are now and the
   * world (`castHit`, its shooter left out): so a fast one crosses nothing between two steps. What it
   * strikes first, if it has health, it hurts (a character's part by name), and it is gone (`impact`).
   * Out of steps, it is gone too.
   */
  private fly() {
    for (const e of [...this.entities.values()]) {
      const p = e.projectile;
      if (!p || !e.transform) continue;
      const at = e.transform.position;
      if (p.gravity) p.velocity = vec3.add(p.velocity, vec3.scale(gravityAt(this.field, at), STEP));
      const move = vec3.scale(p.velocity, STEP);
      const length = vec3.length(move);
      if (length > 0) {
        const hit = castHit(this, at, vec3.scale(move, 1 / length), length, {
          ...(p.from === null ? {} : { skip: p.from }),
          radius: p.radius,
        });
        if (hit) {
          if (this.entities.get(hit.entity)?.health)
            this.hurt(hit.entity, p.damage, { from: p.from, part: hit.kind === 'character' ? hit.part : null, kind: p.kind });
          this.emit({
            type: 'impact',
            projectile: e.id,
            at: hit.point,
            hit: hit.entity,
            kind: p.kind,
            // (Stage 5g) Which way it went, and who fired it: what a game does where it struck (a rocket blows).
            velocity: [...p.velocity],
            from: p.from,
          });
          this.removeEntity(e.id);
          continue;
        }
        e.transform.position = vec3.add(at, move);
      }
      if (--p.life <= 0) this.removeEntity(e.id);
    }
  }

  /**
   * HISTORY SYSTEM (stage 4c, decision 0022): each character's pose as it ends this step, at the end
   * of its history, which keeps the last `HISTORY` (the oldest goes).
   */
  private remember() {
    for (const e of this.entities.values()) {
      const c = e.character;
      if (!c || !e.transform) continue;
      c.history.push({ position: [...e.transform.position], rotation: [...e.transform.rotation], pitch: c.pitch, mode: c.mode });
      if (c.history.length > HISTORY) c.history.splice(0, c.history.length - HISTORY);
    }
  }

  private readBack() {
    const g = this.uniformGravity();
    const gone: EntityId[] = [];
    for (const e of this.entities.values()) {
      if (!e.body || !e.transform || e.body.type === 'fixed') continue;
      // (Not copied: reading gives the body a new velocity, and no one changes one in place.)
      const before = e.body.linearVelocity;
      this.physics.read(e.body.handle, e.transform, e.body);
      if (e.body.type !== 'dynamic') continue;
      // Out of the world (stage 4.5b): what the physics moves, past `FARTHEST` from the origin, is gone
      // (a ball out of a level without a void fell for ever, and the physics went on with it). Never a
      // character: what becomes of one is its game's.
      if (!e.character && vec3.length(e.transform.position) > this.edge) {
        gone.push(e.id);
        continue;
      }
      // Only as a contact begins (stage 4.5's close): what it was pressed against, or slides along, it does
      // not strike again on every step. (Asked first: most bodies begin no contact in a step, and the rest
      // of this is then not worked out. The order of the two questions changes nothing of what is heard.)
      const struck = this.physics.struck(e.body.handle);
      if (struck.length === 0) continue;
      // What its contacts did to its velocity, beyond holding it up against gravity (stage 4.5's close: a
      // crate at rest takes back a step of gravity on every step, 0.6 J for its 45 kg, and was heard on
      // every one; the author heard it).
      const contact = vec3.sub(vec3.sub(e.body.linearVelocity, before), vec3.scale(g, STEP));
      const fall = vec3.length(g);
      const up = fall > 1e-9 ? vec3.scale(g, -1 / fall) : ([0, 0, 0] as Vec3);
      const change = vec3.sub(contact, vec3.scale(up, Math.min(Math.max(vec3.dot(contact, up), 0), fall * STEP)));
      // Its mass from its density and its shape, here (asking the physics, a call into WebAssembly for
      // every body on every step, took the stress room's step near its budget): the same number.
      const energy = 0.5 * bodyMass(e.body) * vec3.dot(change, change);
      if (energy < HIT_HEARD) continue;
      // On what: the first thing it began to touch (its material), or its own.
      const other = this.byHandle.get(struck[0]!);
      const against = other === undefined ? undefined : this.entities.get(other);
      this.emit({
        type: 'sound',
        sound: 'hit',
        source: e.id,
        at: [...e.transform.position],
        surface: against?.body?.material ?? e.body.material ?? null,
        speed: vec3.length(before),
        energy,
        radius: hitRadius(energy),
        against: against?.id ?? null,
      });
    }
    for (const id of gone) this.removeEntity(id);
  }

  /**
   * BREAKS SYSTEM (stage 3e): for every whole breakable with a body, what the physics moves that touches
   * it now, and with how much energy it came: half its mass times its speed squared, its speed as it was
   * before this step (its component still has it: it is read back after this phase). The first hit at
   * least its threshold breaks it (`breakApart`).
   */
  private shatter() {
    for (const e of [...this.entities.values()]) {
      const b = e.breakable;
      if (!b || b.broken || !e.body) continue;
      for (const handle of this.physics.touching(e.body.handle)) {
        const other = [...this.entities.values()].find((x) => x.body?.handle === handle);
        if (other?.body?.type !== 'dynamic') continue;
        const v = other.body.linearVelocity;
        const energy = 0.5 * this.physics.massOf(handle) * vec3.dot(v, v);
        if (energy >= b.threshold) {
          this.breakApart(e, other.id, energy);
          break;
        }
      }
    }
  }

  /**
   * Breaks something (stage 3e; the console or a game may, too): it is broken (a lamp gives no light),
   * its body goes (it stops colliding), a few large pieces the physics moves fly from where it was
   * (in the hash: they are the world's), and the break is an event with a seed for the fragments. The
   * pieces: as many as its size asks for (one per 0.2 m of its largest side, 2 at least, 6 at most), a
   * cube a third of its smallest side, out at 1 to 3 m/s from the world's randomness.
   */
  breakApart(e: Entity, by: EntityId, energy: number) {
    const b = e.breakable;
    if (!b || b.broken || !e.transform) return;
    b.broken = true;
    const at: Vec3 = [...e.transform.position];
    const seed = this.random.uint32();
    const half: Vec3 =
      e.body?.shape.kind === 'box'
        ? e.body.shape.halfExtents
        : e.body?.shape.kind === 'ball'
          ? [e.body.shape.radius, e.body.shape.radius, e.body.shape.radius]
          : [0.1, 0.1, 0.1];
    const material = e.body?.material ?? null;
    if (e.body) {
      this.forgetBody(e);
      this.physics.removeBody(e.body.handle);
      delete e.body;
    }
    const pieces = Math.max(2, Math.min(6, Math.round((2 * Math.max(...half)) / 0.2)));
    const side = Math.max(0.04, (2 * Math.min(...half)) / 3);
    const color = e.appearance?.color ?? 0x8a8a8a;
    for (let i = 0; i < pieces; i++) {
      const out: Vec3 = [this.random.between(-1, 1), this.random.between(0.2, 1), this.random.between(-1, 1)];
      const speed = this.random.between(1, 3) / Math.max(1e-9, vec3.length(out));
      this.createEntity({
        transform: {
          position: vec3.add(at, [
            this.random.between(-half[0], half[0]),
            this.random.between(-half[1], half[1]),
            this.random.between(-half[2], half[2]),
          ]),
          rotation: quat.identity(),
        },
        body: {
          type: 'dynamic',
          shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
          linearVelocity: vec3.scale(out, speed),
          angularVelocity: [this.random.between(-6, 6), this.random.between(-6, 6), this.random.between(-6, 6)],
        },
        appearance: { shape: 'box', size: [side, side, side], color },
      });
    }
    this.emit({ type: 'broke', entity: e.id, at, by, energy, seed });
    this.emit({
      type: 'sound',
      sound: 'break',
      source: e.id,
      at,
      surface: e.lamp ? 'glass' : material,
      speed: 0,
      energy,
      radius: Math.max(15, hitRadius(energy)),
    });
    // A box that broke is gone but for its pieces; a lamp stays, broken (it is still a lamp, dark).
    if (!e.lamp) this.removeEntity(e.id);
  }

  /**
   * HOW LIT A POINT IS (stage 3d): the ambient light, plus, from every lamp on that reaches it and sees
   * it (a ray from the lamp: nothing in between, the lamp and `skip`, the one lit, left out), its intensity falling
   * linearly to its radius, times what gets through the zones in between (`transmission`). Additions,
   * multiplications, a division and a square root: the same in every browser and in Node.
   */
  lightAt(point: Vec3, skip?: EntityId): number {
    return this.lit(point, skip, this.lampsOn(), this.attenuators());
  }

  /** The lamps on, and the zones that attenuate: what the light reads, gathered once per step. */
  private lampsOn(): Entity[] {
    return [...this.entities.values()].filter((e) => e.lamp?.on && e.transform);
  }
  private attenuators(): Entity[] {
    return [...this.entities.values()].filter((e) => e.sensor?.params.opacity?.[0] && e.transform);
  }

  private lit(point: Vec3, skip: EntityId | undefined, lamps: readonly Entity[], fogs: readonly Entity[]): number {
    let light = this.ambient;
    for (const e of lamps) {
      const lamp = e.lamp!;
      if (!e.transform) continue;
      const to = vec3.sub(point, e.transform.position);
      const d = vec3.length(to);
      if (d >= lamp.radius) continue;
      if (d > 1e-9) {
        const hit = this.castRay(e.transform.position, vec3.scale(to, 1 / d), d, {
          besides: e.id,
          ...(skip === undefined ? {} : { skip }),
        });
        if (hit && hit.distance < d - 1e-6) continue;
      }
      light += lamp.intensity * (1 - d / lamp.radius) * this.through(e.transform.position, point, fogs);
    }
    return light;
  }

  /**
   * WHAT GETS THROUGH from one point to another (stage 3d), from 1 (all) towards 0: each zone with an
   * `opacity` (per meter) the segment crosses takes its length inside it times its opacity, and what
   * gets through is 1 / (1 + their sum): a rational falloff, not the browsers' exponential (no `exp`),
   * the same everywhere. Light and sight both cross it: a watcher sees no more through a fog bank than
   * the player does.
   */
  transmission(from: Vec3, to: Vec3): number {
    return this.through(from, to, this.attenuators());
  }

  private through(from: Vec3, to: Vec3, fogs: readonly Entity[]): number {
    if (fogs.length === 0) return 1;
    let thickness = 0;
    for (const zone of fogs)
      thickness +=
        zone.sensor!.params.opacity![0]! *
        insideLength(zone.transform!.position, zone.transform!.rotation, zone.sensor!.half, from, to);
    return 1 / (1 + thickness);
  }

  /**
   * LIGHT SYSTEM (stage 3d): every lamp on or off as its signal was at the end of the last step (as a
   * mechanism reads it); how lit every character is, at its center; and who every watcher sees (in
   * range, in its cone, nothing in between, lit enough as seen from it). A change in what a watcher
   * sees is an event (`seen`, `lost`).
   */
  private illuminate() {
    for (const e of this.entities.values())
      // (Stage 5e: put out by a hand, it gives no light until a hand lights it again.)
      if (e.lamp) e.lamp.on = !e.breakable?.broken && !e.lamp.out && (e.lamp.signal === null || this.signal(e.lamp.signal) !== 0);
    const lamps = this.lampsOn();
    const fogs = this.attenuators();
    const characters: Entity[] = [];
    // Where each one's body is (stage 4b: crouched, lower than its center), where light and sight reach.
    const centers = new Map<EntityId, Vec3>();
    for (const e of this.entities.values())
      if (e.character && e.transform) {
        const offset = e.body ? poseOf(e.character, e.body).offset : ([0, 0, 0] as Vec3);
        const center = vec3.add(e.transform.position, quat.rotate(e.transform.rotation, offset));
        centers.set(e.id, center);
        e.character.light = this.lit(center, e.id, lamps, fogs);
        characters.push(e);
      }
    for (const eye of this.entities.values()) {
      const w = eye.watcher;
      if (!w || !eye.transform) continue;
      const from = eye.transform.position;
      const forward = quat.rotate(eye.transform.rotation, [0, 0, -1]);
      const now: EntityId[] = [];
      for (const e of characters) {
        const at = centers.get(e.id)!;
        const to = vec3.sub(at, from);
        const d = vec3.length(to);
        if (d > w.range || d < 1e-9) continue;
        const direction = vec3.scale(to, 1 / d);
        if (vec3.dot(direction, forward) < w.cone) continue;
        const hit = this.castRay(from, direction, d, { skip: eye.id, besides: e.id });
        if (hit && hit.distance < d - 1e-6) continue;
        // Crouched, a watcher sees less of it (stage 4b: its posture): it needs that much more light.
        const posture = e.character!.mode === 'crouch' ? e.character!.movement.crouch.seen : 1;
        if (e.character!.light * this.through(from, at, fogs) * posture < w.threshold) continue;
        now.push(e.id);
      }
      for (const id of w.sees) if (!now.includes(id)) this.emit({ type: 'lost', watcher: eye.id, entity: id });
      for (const id of now) if (!w.sees.includes(id)) this.emit({ type: 'seen', watcher: eye.id, entity: id });
      w.sees = [...w.sees.filter((id) => now.includes(id)), ...now.filter((id) => !w.sees.includes(id))];
    }
  }

  /**
   * SIGNALS SYSTEM (stage 3c, decision 0018): every signal, in the order declared, from what the
   * zones noticed in this step and the signals above it. A change is an event (`signalChanged`).
   */
  private compute() {
    if (this.wires.length === 0) return;
    const value = new Map<string, number>();
    const zone = (name: string) => this.named(name)?.sensor;
    for (const w of this.wires) {
      const was = w.value;
      const on = (name: string) => (value.get(name) ?? 0) !== 0;
      switch (w.op) {
        case 'input':
          w.value = w.memory;
          break;
        case 'zone':
          w.value = (zone(w.reads[0]!)?.inside ?? []).filter((id) => {
            const e = this.entities.get(id);
            return e?.character !== undefined || e?.body?.type === 'dynamic';
          }).length;
          break;
        case 'used':
          w.value = (zone(w.reads[0]!)?.inside ?? []).filter((id) => {
            const c = this.entities.get(id)?.character;
            return c !== undefined && pressed(this, c.player, 'use');
          }).length;
          break;
        case 'seen':
          w.value = this.named(w.reads[0]!)?.watcher?.sees.length ?? 0;
          break;
        case 'any':
          w.value = w.reads.some(on) ? 1 : 0;
          break;
        case 'all':
          w.value = w.reads.every(on) ? 1 : 0;
          break;
        case 'not':
          w.value = on(w.reads[0]!) ? 0 : 1;
          break;
        case 'toggle': {
          const now = on(w.reads[0]!) ? 1 : 0;
          if (now && !w.memory) w.value = w.value ? 0 : 1;
          w.memory = now;
          break;
        }
        case 'latch':
          w.value = on(w.reads[0]!) ? 1 : on(w.reads[1]!) ? 0 : w.value;
          break;
      }
      value.set(w.name, w.value);
      if (w.value !== was) this.emit({ type: 'signalChanged', signal: w.name, value: w.value, was });
    }
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
    if (e.character) {
      e.character.velocity = [0, 0, 0];
      e.character.grounded = false;
      // (Stage 5c: put somewhere else, it lets go of the ledge it hung from, and what it was doing off a
      // wall is over: before, the next step pulled it back to the edge it held.)
      e.character.ledge = null;
      e.character.offSteps = 0;
      e.character.leaping = false;
    }
  }

  /**
   * ZONES SYSTEM (stage 2a): for each zone, which moving bodies have their center inside its box (in
   * the box's own axes: the point is turned back by the zone's rotation). Additions, multiplications
   * and comparisons: the same everywhere. Who came in and who left become events, in a fixed order.
   *
   * Most bodies are far from every zone (stage 2.5b): first, three comparisons against the box along
   * the world's axes that holds the zone (it never leaves out one that is inside: it holds it), and
   * only the bodies within it are turned into the zone's axes. In the stress room it took 0.15 ms a
   * step, a third of the physics; the same answer, for less.
   */
  private sense() {
    const movers = [...this.entities.values()].filter((e) => e.transform && e.body && e.body.type !== 'fixed');
    for (const zone of this.entities.values()) {
      const sensor = zone.sensor;
      const at = zone.transform;
      if (!sensor || !at) continue;
      const back = quat.conjugate(at.rotation);
      const reach = holdingBox(at.rotation, sensor.half);
      const c = at.position;
      const now: EntityId[] = [];
      for (const e of movers) {
        const p = e.transform!.position;
        if (Math.abs(p[0] - c[0]) > reach[0] || Math.abs(p[1] - c[1]) > reach[1] || Math.abs(p[2] - c[2]) > reach[2]) continue;
        const local = quat.rotate(back, vec3.sub(e.transform!.position, at.position));
        if (Math.abs(local[0]) <= sensor.half[0] && Math.abs(local[1]) <= sensor.half[1] && Math.abs(local[2]) <= sensor.half[2])
          now.push(e.id);
      }
      for (const id of sensor.inside)
        if (!now.includes(id) && this.entities.has(id)) this.emit({ type: 'sensorLeft', sensor: zone.id, entity: id });
      for (const id of now) if (!sensor.inside.includes(id)) this.emit({ type: 'sensorEntered', sensor: zone.id, entity: id });
      // Who was inside first stays first; who came now goes after.
      sensor.inside = [...sensor.inside.filter((id) => now.includes(id)), ...now.filter((id) => !sensor.inside.includes(id))];
    }
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

  /**
   * SPIN system: the rotation advances this step's angle around the axis of its angular velocity,
   * WITHOUT TRIGONOMETRY (stage 1f: it used `hypot`, `sin` and `cos`, which each JavaScript engine
   * computes its own way). The quaternion of a small turn is [ω·dt/2, 1], brought back to length 1:
   * it turns 2·atan(|ω|·dt/2) instead of |ω|·dt, two parts in a hundred thousand less at 1 rad/s.
   * Additions, multiplications and a square root, the same bits everywhere. It is renormalized, so
   * rounding does not accumulate.
   */
  private spin() {
    for (const e of this.entities.values()) {
      if (!e.spin || !e.transform) continue;
      const w = e.spin.angularVelocity;
      // A kinematic body is turned by the physics (with its deterministic math: see `move`); a
      // dynamic or fixed one is moved by the physics, or not at all.
      if (e.body) continue;
      if (w[0] === 0 && w[1] === 0 && w[2] === 0) continue;
      const h = STEP / 2;
      const delta = quat.normalize([w[0] * h, w[1] * h, w[2] * h, 1]);
      e.transform.rotation = quat.normalize(quat.multiply(delta, e.transform.rotation));
    }
  }
}

/**
 * Half the size, along the world's axes, of the box that holds a box of half size `half` turned by
 * `rotation`: each of its own axes, turned, contributes its length along each of the world's axes.
 */
function holdingBox(rotation: Quat, half: Vec3): Vec3 {
  const x = quat.rotate(rotation, [half[0], 0, 0]);
  const y = quat.rotate(rotation, [0, half[1], 0]);
  const z = quat.rotate(rotation, [0, 0, half[2]]);
  return [
    Math.abs(x[0]) + Math.abs(y[0]) + Math.abs(z[0]),
    Math.abs(x[1]) + Math.abs(y[1]) + Math.abs(z[1]),
    Math.abs(x[2]) + Math.abs(y[2]) + Math.abs(z[2]),
  ];
}
