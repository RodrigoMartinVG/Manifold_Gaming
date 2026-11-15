import { Random, quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { moveCharacter, newCharacter } from './character';
import { COMPONENT_NAME } from './components';
import { EARTH, gravityAt } from './gravity';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from './materials';
import { PHYSICS, type PhysicsBackend, type PhysicsHit } from './physics';
import { VERIFIED, type Profile } from './profile';
import type { CollisionGroups, Components, Entity, Event, EntityId, GravityField, PlayerInput, Shape } from './types';
import { SIMULATION_VERSION } from './version';

/** What a query through the world hit (stage 2.5b): which entity, how far, where, and the surface's normal there. */
export interface Hit {
  entity: EntityId;
  distance: number;
  point: Vec3;
  /** The normal of the surface hit, pointing out of it. */
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
  /** Only the bodies these groups meet. */
  groups?: CollisionGroups;
}

/** An entity's name (stage 3b): one word, lowercase, digits and _ (`door_north`, `cube`). */
export const ENTITY_NAME = /^[a-z][a-z0-9_]*$/;

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
}

/**
 * A SNAPSHOT OF A WORLD (stage 1d, as decision 0004 defined it): everything it is, at the end of a
 * step. Its clock and its id counter, its randomness's state, its gravity, its materials (stage 3b),
 * its players' inputs (and
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
  readonly gravity: GravityField;
  readonly materials: Readonly<Record<string, Material>>;
  readonly inputs: readonly [number, PlayerInput][];
  readonly lastInputs: readonly [number, PlayerInput][];
  readonly players: readonly number[];
  readonly entities: readonly Entity[];
  /** Rapier's snapshot: its bodies, colliders, contacts and solver, as bytes. */
  readonly physics: Uint8Array;
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
 *   5. readBack: every moving body's pose and velocities go to its components;
 *   6. zones: who came into each zone, and who left (stage 2a).
 *
 * A game hooks in around them, never inside (mechanism and policy, decision 0000): before
 * (`Cartridge.beforeStep`: what these phases will use at this step: a bot's inputs, a mechanism's
 * target, what a character carries) and after (`Cartridge.onStep`: its rules, on the step's events).
 */
export const PHASES = ['spin', 'kinematics', 'characters', 'physics', 'readBack', 'zones'] as const;
export type Phase = (typeof PHASES)[number];

export class World {
  /** How many steps it took. */
  tick = 0;
  readonly random: Random;
  readonly entities = new Map<EntityId, Entity>();
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
   * WHAT ITS THINGS CAN BE MADE OF (stage 3b), by name: the engine's (`MATERIALS`) and those a level
   * declares (`addMaterial`). Data, like the rest: hashed, and in snapshots. A body names one
   * (`body.material`) and takes its friction and bounce when it is created.
   */
  private readonly table: Record<string, Material>;
  /** How it runs (stage 2.5b, decision 0014): its physics, and who verifies it. */
  readonly profile: Profile;
  /**
   * ITS physics, the one its profile names (Rapier's deterministic build, behind the boundary of
   * physics.ts): every world has its own, like its randomness. The entities keep only their bodies'
   * handles (decision 0004).
   */
  readonly physics: PhysicsBackend;

  constructor(o: WorldOptions) {
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
      gravity: copyData(this.field),
      materials: copyData(this.table),
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
      seed: 0,
      gravity: copyData(s.gravity),
      materials: copyData(s.materials) as Record<string, Material>,
      physics: s.physics,
      profile: s.profile,
    });
    world.tick = s.tick;
    world.lastId = s.lastId;
    world.random.restore(s.random);
    for (const [player, input] of copyData(s.inputs)) world.inputs.set(player, input);
    for (const [player, input] of copyData(s.lastInputs)) world.lastInputs.set(player, input);
    for (const player of s.players) world.players.add(player);
    for (const e of copyData(s.entities)) world.entities.set(e.id, e);
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
    const { body, character, sensor, mover, ...rest } = components;
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
    if (mover) entity.mover = { from: [...mover.from], to: [...mover.to], seconds: mover.seconds };
    if (sensor) {
      if (!entity.transform) throw new Error('A zone needs a transform: where is it?');
      const params = Object.fromEntries(Object.entries(sensor.params ?? {}).map(([k, v]) => [k, [...v]]));
      entity.sensor = { kind: sensor.kind, half: [...sensor.half], inside: [], params };
    }
    if (body) {
      if (!entity.transform) throw new Error('A body needs a transform: where is it?');
      const spec = material
        ? { ...body, friction: body.friction ?? material.friction, restitution: body.restitution ?? material.bounce }
        : body;
      entity.body = this.physics.addBody(spec, entity.transform);
    }
    if (character) {
      if (entity.body?.type !== 'character') throw new Error("A character needs a body of type 'character'.");
      entity.character = newCharacter(character);
    }
    this.entities.set(entity.id, entity);
    this.emit({ type: 'entityCreated', id: entity.id });
    return entity;
  }

  removeEntity(id: EntityId) {
    const entity = this.entities.get(id);
    if (!entity) return;
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
  // their seams, in one place. (A body created during a step is in them from the next step on: Rapier
  // updates what its queries see when it steps, and has nothing to do it in between.)

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
      ...(o.groups ? { groups: o.groups } : {}),
    };
  }

  /** A physics hit as an entity's (the entity whose body it is). */
  private hitOf(hit: PhysicsHit | null): Hit | null {
    if (!hit) return null;
    for (const e of this.entities.values())
      if (e.body?.handle === hit.handle) return { entity: e.id, distance: hit.distance, point: hit.point, normal: hit.normal };
    return null;
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
    readBack: () => {
      for (const e of this.entities.values())
        if (e.body && e.transform && e.body.type !== 'fixed') this.physics.read(e.body.handle, e.transform, e.body);
    },
    zones: () => this.sense(),
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
      this.physics.setKinematicVelocity(e.body.handle, e.body.linearVelocity, e.body.angularVelocity);
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
