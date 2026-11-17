import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { quat, sinCosDegrees, vec3, type Quat, type Vec3 } from '@manifold/common';
import type { Profile } from './profile';
import type { Body, BodySpec, CollisionGroups, CompoundPart, Shape, Transform } from './types';

/**
 * THE BOUNDARY WITH THE PHYSICS ENGINE (decision 0000: "Rapier behind a small boundary"). This is
 * the only file of the engine that imports Rapier: the rest talks to a `PhysicsBackend`, in our types,
 * and the world takes the one its profile says (stage 2.5b: `PHYSICS`).
 *
 * It is Rapier's DETERMINISTIC build (decision 0012): it does its math the same way on every
 * machine, so two browsers can run the same world and get the same hash. It is a little slower than
 * the usual build; in exchange, replays, ghosts by link and networking are possible.
 *
 * Rapier runs in WebAssembly, which loads asynchronously: `await initPhysics()` once, before
 * creating any world (in the browser, in the tests, on a server).
 */
let ready = false;

export async function initPhysics(): Promise<void> {
  if (ready) return;
  await RAPIER.init();
  ready = true;
}

const v = (x: Vec3) => ({ x: x[0], y: x[1], z: x[2] });
const q = (r: Quat) => ({ x: r[0], y: r[1], z: r[2], w: r[3] });
const toVec = (x: { x: number; y: number; z: number }): Vec3 => [x.x, x.y, x.z];
const toQuat = (r: { x: number; y: number; z: number; w: number }): Quat => [r.x, r.y, r.z, r.w];
/** Rapier's groups: the 16 bits a body is a member of, and the 16 it meets, in one number. */
const groupsOf = (g: CollisionGroups) => ((g.member & 0xffff) << 16) | (g.filter & 0xffff);
/** Whether two groups (as Rapier's numbers) meet: each is a member of one the other meets (Rapier's own test). */
const meets = (a: number, b: number) => ((a >>> 16) & b & 0xffff) !== 0 && ((b >>> 16) & a & 0xffff) !== 0;
/**
 * A compound's boxes cut so that wherever two meet, they meet face to whole face (stage 4a). Rapier
 * mends a compound's seams (`FIX_INTERNAL_EDGES`) only there: measured, a ball at 6 m/s over three
 * slabs of the same width rolls flat, but where a narrow slab meets the side of a wide one, as a
 * dungeon's floor is full of, it still hopped (35 cm). So each box is cut along every edge of the others
 * that falls inside it, across the ground (x and z): the cuts of all of them make a grid, and two
 * neighbours share whole faces. Only Rapier sees the cut: the world keeps the few boxes it was given.
 */
function conforming(parts: readonly CompoundPart[]): CompoundPart[] {
  // Where boxes begin and end along an axis, each edge once (two within a micrometre are one: they
  // come from sums that may round apart).
  const edges = (k: 0 | 2) => {
    const all = parts.flatMap((p) => [p.offset[k] - p.halfExtents[k], p.offset[k] + p.halfExtents[k]]).sort((a, b) => a - b);
    return all.filter((x, i) => i === 0 || x - all[i - 1]! > 1e-6);
  };
  const xs = edges(0);
  const zs = edges(2);
  const cuts = (lo: number, hi: number, at: number[]) => [lo, ...at.filter((x) => x > lo + 1e-6 && x < hi - 1e-6), hi];
  const out: CompoundPart[] = [];
  for (const p of parts) {
    const cx = cuts(p.offset[0] - p.halfExtents[0], p.offset[0] + p.halfExtents[0], xs);
    const cz = cuts(p.offset[2] - p.halfExtents[2], p.offset[2] + p.halfExtents[2], zs);
    for (let i = 1; i < cx.length; i++)
      for (let j = 1; j < cz.length; j++)
        out.push({
          offset: [(cx[i - 1]! + cx[i]!) / 2, p.offset[1], (cz[j - 1]! + cz[j]!) / 2],
          halfExtents: [(cx[i]! - cx[i - 1]!) / 2, p.halfExtents[1], (cz[j]! - cz[j - 1]!) / 2],
        });
  }
  return out;
}

/**
 * A compound on a grid (stage 4a: a map's floor) as Rapier's voxels: every cell its boxes cover, counted
 * from their lowest corner, which is where the collider goes. Probed: over an irregular floor's seams, a
 * ball rolls flat on a compound with its seams mended, but a box sliding at 8 m/s still trips there (50
 * cm up, tumbling); on voxels, both roll and slide flat, as on one slab.
 */
function voxelsOf(shape: Extract<Shape, { kind: 'compound' }>, cell: Vec3) {
  const low = [0, 1, 2].map((k) => Math.min(...shape.parts.map((p) => p.offset[k]! - p.halfExtents[k]!))) as Vec3;
  const cells: number[] = [];
  for (const p of shape.parts) {
    // Its first cell and how many, along each axis (rounded: the sums may be a hair off a whole cell).
    const from = [0, 1, 2].map((k) => Math.round((p.offset[k]! - p.halfExtents[k]! - low[k]!) / cell[k]!));
    const count = [0, 1, 2].map((k) => Math.round((2 * p.halfExtents[k]!) / cell[k]!));
    for (let i = 0; i < count[0]!; i++)
      for (let j = 0; j < count[1]!; j++)
        for (let k = 0; k < count[2]!; k++) cells.push(from[0]! + i, from[1]! + j, from[2]! + k);
  }
  return RAPIER.ColliderDesc.voxels(new Int32Array(cells), { x: cell[0], y: cell[1], z: cell[2] }).setTranslation(...low);
}

/** A compound's parts as Rapier wants them: boxes cut to meet whole faces, where they are, unturned, with their seams mended. */
const compoundOf = (shape: Extract<Shape, { kind: 'compound' }>) => {
  // (Parts turned within it, a kit's ramp, stage 4.5e, are not cut to meet face to face: as they are.)
  const parts = shape.parts.some((p) => p.rotation) ? shape.parts : conforming(shape.parts);
  return [
    parts.map((p) => new RAPIER.Cuboid(...p.halfExtents)),
    parts.map((p) => ({ x: p.offset[0], y: p.offset[1], z: p.offset[2] })),
    parts.map((p) =>
      p.rotation ? { x: p.rotation[0], y: p.rotation[1], z: p.rotation[2], w: p.rotation[3] } : { x: 0, y: 0, z: 0, w: 1 },
    ),
    RAPIER.CompoundFlags.FIX_INTERNAL_EDGES,
  ] as const;
};

/** A shape of ours, as Rapier's. */
const shapeOf = (shape: Shape) =>
  shape.kind === 'ball'
    ? new RAPIER.Ball(shape.radius)
    : shape.kind === 'capsule'
      ? new RAPIER.Capsule(shape.halfHeight, shape.radius)
      : shape.kind === 'compound'
        ? new RAPIER.Compound(...compoundOf(shape))
        : new RAPIER.Cuboid(...shape.halfExtents);

const ZERO = { x: 0, y: 0, z: 0 };

/**
 * A ray's normal as the engine gives it: Rapier's, where it hit a surface. A ray that starts inside a
 * body hits it at distance 0, where there is no surface, and Rapier's is then anything (measured):
 * zero (a box, a capsule), not even a number (a ball, from its center), or a direction that is no
 * surface's (a ball, off its center). There, the engine's is always zero: no surface, and a number.
 * (Not the ray's direction backwards: a ray down from inside a wall would find a floor to stand on.)
 */
function rayNormal(distance: number, n: { x: number; y: number; z: number }): Vec3 {
  const length = n.x * n.x + n.y * n.y + n.z * n.z;
  return distance > 0 && length > 0.5 && length < 1.5 ? toVec(n) : [0, 0, 0];
}

/** What a query of the physics hit (by handle: the world turns it into an entity). */
export interface PhysicsHit {
  handle: number;
  distance: number;
  point: Vec3;
  /**
   * The surface's normal there, pointing out of what was hit. A ray that starts inside a body hits it
   * at distance 0, where there is no surface: its normal is then zero.
   */
  normal: Vec3;
}

/** What a query leaves out, or counts. */
export interface QueryOptions {
  /** A body left out (the one asking), by handle. */
  skip?: number;
  /** Another body left out besides it (stage 3a: the platform a character's carry is swept through). */
  besides?: number;
  /** Whether the bodies the physics moves (dynamic) count: yes, unless false. */
  dynamic?: boolean;
  /** Whether the bodies a program moves (kinematic: platforms, doors, lifts, characters) count: yes, unless false (stage 4d). */
  kinematic?: boolean;
  /** Only the bodies these groups meet (like a body's). */
  groups?: CollisionGroups;
  /** More bodies left out, by handle (stage 3h: the characters, for the camera). */
  leave?: readonly number[];
}

/** The thin gap a character keeps between its capsule and what it touches (Rapier's advice: avoid getting stuck). */
export const CHARACTER_GAP = 0.02;

/** The steepest ground a character stands on without sliding, and the steepest it walks up (degrees). */
export const STANDS_DEGREES = 30;
export const CLIMBS_DEGREES = 50;

/**
 * The steepest ground a character stands on without sliding, as the cosine of its slope: 30°
 * (`CHARACTER.minSlide`), as √3 / 2 (a square root gives the same bits everywhere; a cosine might not).
 */
export const STANDS_ON = Math.sqrt(3) / 2;

/** A body's mass, from its density (the physics' own, 1, without one) and its shape's volume: what Rapier gives it. */
export function bodyMass(body: Pick<Body, 'shape' | 'density'>): number {
  const s = body.shape;
  // (Products, not `**`: Math.pow may give other bits in another browser.)
  const box = (h: Vec3) => 8 * h[0] * h[1] * h[2];
  const volume =
    s.kind === 'box'
      ? box(s.halfExtents)
      : s.kind === 'compound'
        ? s.parts.reduce((sum, p) => sum + box(p.halfExtents), 0)
        : s.kind === 'ball'
          ? (4 / 3) * Math.PI * s.radius * s.radius * s.radius
          : Math.PI * s.radius * s.radius * (2 * s.halfHeight) + (4 / 3) * Math.PI * s.radius * s.radius * s.radius;
  return (body.density ?? 1) * volume;
}

/**
 * What a character's controller does not run into (stage 4.5b): what the physics moves lighter than
 * `LIGHT` kg (a ball, 14 g at the default density). The character's body moves it out of its way in
 * the physics' step, as a kick does. Before, the controller kept its gap from it too, and a character
 * standing still went back 1 to 8 cm with each ball that touched it (4c's dummy, 1.3 m in the
 * reference replay; balls rolling into its feet, 64 cm in ten). A crate of 45 kg still stops it, and it
 * pushes it by its own rule (character.ts).
 */
export const LIGHT = 5;
const light = (body: RAPIER.RigidBody | null | undefined) => !!body && body.isDynamic() && body.mass() < LIGHT;

/** The steepest ground a character walks up, as the cosine of its slope: 50° (`CHARACTER.maxClimb`), with our own cosine. */
const CLIMBS = sinCosDegrees(CLIMBS_DEGREES)[1];

/** The steps a character climbs without jumping (m): up to 35 cm, if there is at least 15 cm to stand on. */
export const STEP_UP = 0.35;

/** How characters move (stage 1b): what they climb, what they snap to, what they push. */
const CHARACTER = {
  offset: CHARACTER_GAP,
  stepHeight: STEP_UP,
  stepWidth: 0.15,
  /** Going down a step or a slope, it stays on the ground if it is closer than this. */
  snapToGround: 0.3,
  /** Slopes it walks up; steeper ones, it slides down. (Radians: π/180 per degree.) */
  maxClimb: (CLIMBS_DEGREES * Math.PI) / 180,
  minSlide: (STANDS_DEGREES * Math.PI) / 180, // its cosine is STANDS_ON
};

/**
 * WHAT THE ENGINE ASKS OF A PHYSICS (stage 2.5b): the world, the characters and the presentation
 * talk to this, never to Rapier. The world takes one from `PHYSICS`, by its profile's name.
 */
export interface PhysicsBackend {
  snapshot(): Uint8Array;
  setGravity(g: Vec3): void;
  addBody(spec: BodySpec, transform: Transform): Body;
  removeBody(handle: number): void;
  setKinematicVelocity(handle: number, linear: Vec3, angular: Vec3): void;
  moveCharacter(
    handle: number,
    desired: Vec3,
    up: Vec3,
    standingOn?: number,
  ): { movement: Vec3; grounded: boolean; ceiling: boolean; touched: number[]; walls: Vec3[] };
  /** Changes the shape a character's controller moves (stage 4b: crouching), and where it is from the body's center (in its frame). */
  setCharacterPose(handle: number, shape: Shape, offset: Vec3): void;
  /**
   * Joins two bodies at a point (stage 4c: a ragdoll's, in the presentation's physics): a ball joint,
   * each anchor in its body's own frame; the two no longer collide with each other.
   */
  join(a: number, b: number, anchorA: Vec3, anchorB: Vec3): void;
  castRay(from: Vec3, direction: Vec3, reach: number, o?: QueryOptions): PhysicsHit | null;
  castShape(shape: Shape, position: Vec3, rotation: Quat, direction: Vec3, reach: number, o?: QueryOptions): PhysicsHit | null;
  motionOf(handle: number): { kinematic: boolean; linear: Vec3; angular: Vec3; center: Vec3 } | null;
  place(handle: number, position: Vec3, rotation: Quat): void;
  setNextPose(handle: number, position: Vec3, rotation: Quat): void;
  position(handle: number): Vec3;
  step(): void;
  read(handle: number, transform: Transform, body: Body): void;
  readonly bodyCount: number;
  debugLines(): { vertices: Float32Array; colors: Float32Array };
  contacts(): { points: number[]; normals: number[] };
  /** The bodies touching this one now (stage 3e), by handle, in order: with at least one contact the solver uses. */
  touching(handle: number): number[];
  /**
   * The bodies a body began to touch in the last step (stage 4.5's close), lowest handle first: what
   * it struck, for a hit to be heard once when a contact begins, not on every step it lasts.
   */
  struck(handle: number): number[];
  /** A body's mass (stage 3e): what the physics gives it from its shape and density (0 if it moves only as told). */
  massOf(handle: number): number;
  /** Changes a moving body's velocity by an impulse (stage 3g: kg·m/s), waking it if it sleeps. */
  push(handle: number, impulse: Vec3): void;
  dispose(): void;
}

/** The physics a profile can name, and how each one is made (a new world, or one from its snapshot). */
export const PHYSICS: Record<Profile['physics'], (gravity: Vec3, timestep: number, snapshot?: Uint8Array) => PhysicsBackend> = {
  'rapier-deterministic': (gravity, timestep, snapshot) => new RapierPhysics(gravity, timestep, snapshot),
};

/** Rapier's deterministic build, behind `PhysicsBackend`. */
export class RapierPhysics implements PhysicsBackend {
  private readonly world: RAPIER.World;
  /** One controller moves every character (its settings are the same for all, for now). */
  private controller: RAPIER.KinematicCharacterController | null = null;
  /** The bodies that were asleep when they were last read: what they are, their components already say. */
  private readonly asleep = new Set<number>();
  /**
   * THE BODIES RAPIER'S QUERIES DO NOT SEE YET, by handle (measured with Rapier alone): a body created,
   * or put somewhere at once (`place`), between two steps is in no query until the next step, neither
   * where it was nor where it is; and before a world's first step, no body is. Rapier updates what its
   * queries see (a tree of boxes) when it steps, and has nothing to do it in between. Until then, the
   * queries ask each of these on its own (`unseenColliders`), where it is now, and the controller stops at
   * them (`moveCharacter`). Part of the state: a snapshot keeps them (Rapier's keeps its old tree).
   */
  private readonly unseen = new Set<number>();
  /**
   * The colliders of what the physics moves lighter than `LIGHT` (stage 4.5b): what a character's
   * controller does not run into. Kept by their handles, since the controller's filter cannot ask Rapier
   * about a body while it computes (it holds the world).
   */
  private readonly lightColliders = new Set<number>();
  /** Rapier's events of a step (its contacts that began), and by body, what each began to touch. */
  private readonly events = new RAPIER.EventQueue(true);
  private readonly struckBy = new Map<number, number[]>();

  /** A new physics world; or, with `snapshot`, the one that snapshot keeps (its bodies keep their handles). */
  constructor(gravity: Vec3, timestep: number, snapshot?: Uint8Array) {
    if (!ready) throw new Error('The physics is not ready: `await initPhysics()` before creating a world.');
    if (snapshot) {
      const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
      const count = view.getUint32(0, true);
      for (let i = 0; i < count; i++) this.unseen.add(view.getFloat64(4 + 8 * i, true));
      this.world = RAPIER.World.restoreSnapshot(snapshot.subarray(4 + 8 * count));
      // What slept when the snapshot was taken (after the bodies were read: the same) was read asleep.
      this.world.forEachRigidBody((body) => {
        if (body.isSleeping()) this.asleep.add(body.handle);
        if (light(body)) for (let i = 0; i < body.numColliders(); i++) this.lightColliders.add(body.collider(i).handle);
      });
    } else this.world = new RAPIER.World(v(gravity));
    this.world.gravity = v(gravity);
    this.world.timestep = timestep;
  }

  /**
   * The physics as bytes: how many bodies its queries do not see yet and their handles (a count, then
   * each one as 8 bytes), and then Rapier's snapshot of its world (bodies, colliders, contacts and the
   * solver's state).
   */
  snapshot(): Uint8Array {
    const rapier = this.world.takeSnapshot();
    const head = 4 + 8 * this.unseen.size;
    const out = new Uint8Array(head + rapier.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, this.unseen.size, true);
    let i = 0;
    for (const handle of this.unseen) view.setFloat64(4 + 8 * i++, handle, true);
    out.set(rapier, head);
    return out;
  }

  setGravity(g: Vec3) {
    this.world.gravity = v(g);
  }

  /** Creates the body and its collider; returns the complete body component, with its handle. */
  addBody(spec: BodySpec, transform: Transform): Body {
    const body: Body = {
      type: spec.type,
      shape: spec.shape,
      restitution: spec.restitution ?? 0.2,
      friction: spec.friction ?? 0.6,
      linearDamping: spec.linearDamping ?? 0,
      angularDamping: spec.angularDamping ?? 0,
      linearVelocity: [...(spec.linearVelocity ?? [0, 0, 0])],
      angularVelocity: [...(spec.angularVelocity ?? [0, 0, 0])],
      ...(spec.groups ? { groups: { ...spec.groups } } : {}),
      ...(spec.material !== undefined ? { material: spec.material } : {}),
      ...(spec.density !== undefined ? { density: spec.density } : {}),
      handle: 0,
    };
    // Kinematic bodies are moved by VELOCITY: the physics integrates them (with its deterministic
    // math), and what they touch receives the push.
    // A character's body is moved by POSITION: the controller says where it can go, and it goes there.
    const desc =
      body.type === 'dynamic'
        ? RAPIER.RigidBodyDesc.dynamic()
        : body.type === 'kinematic'
          ? RAPIER.RigidBodyDesc.kinematicVelocityBased()
          : body.type === 'character'
            ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(...transform.position).setRotation(q(transform.rotation));
    desc.setLinvel(...body.linearVelocity).setAngvel(v(body.angularVelocity));
    desc.setLinearDamping(body.linearDamping).setAngularDamping(body.angularDamping);
    const rigid = this.world.createRigidBody(desc);
    const shape = body.shape;
    const collider =
      shape.kind === 'ball'
        ? RAPIER.ColliderDesc.ball(shape.radius)
        : shape.kind === 'capsule'
          ? RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius)
          : shape.kind === 'compound'
            ? shape.cell
              ? voxelsOf(shape, shape.cell)
              : RAPIER.ColliderDesc.compound(...compoundOf(shape))
            : RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
    collider.setRestitution(body.restitution).setFriction(body.friction);
    if (body.density !== undefined) collider.setDensity(body.density);
    if (body.groups) collider.setCollisionGroups(groupsOf(body.groups)).setSolverGroups(groupsOf(body.groups));
    // What the physics moves says when a contact of its begins (`struck`).
    if (body.type === 'dynamic') collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const made = this.world.createCollider(collider, rigid);
    if (body.type === 'dynamic' && bodyMass(body) < LIGHT) this.lightColliders.add(made.handle);
    body.handle = rigid.handle;
    this.unseen.add(rigid.handle);
    return body;
  }

  removeBody(handle: number) {
    const rigid = this.world.getRigidBody(handle);
    if (rigid) for (let i = 0; i < rigid.numColliders(); i++) this.lightColliders.delete(rigid.collider(i).handle);
    if (rigid) this.world.removeRigidBody(rigid);
    this.asleep.delete(handle);
    this.unseen.delete(handle);
  }

  /** The velocity a kinematic body moves with during the next step. */
  setKinematicVelocity(handle: number, linear: Vec3, angular: Vec3) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    rigid.setLinvel(v(linear), true);
    rigid.setAngvel(v(angular), true);
  }

  /**
   * Where a character can go this step, if it wants to move `desired` (meters): the controller slides
   * it along walls, climbs it up steps, keeps it on slopes and on the ground, and pushes the dynamic
   * bodies in its way. Returns the movement it can do, whether it ends standing on something, and
   * whether it hit something above: a collision whose normal, on the character's side, points "up"
   * (its head touched it). Brushing a wall while rising is not a ceiling. And the walls it pressed
   * (stage 4.5b): what it touched steeper than it climbs (`maxClimb`) and not above it, that nothing
   * pushes (not what the physics moves: that it pushes), as their normals on the character's side
   * (towards the wall).
   *
   * `standingOn` (stage 2d): the kinematic body it stands on, which, for the controller, is FIXED
   * meanwhile: the engine carries the character with it, exactly (character.ts). Two things measured
   * with Rapier alone, without anything of ours:
   *   - on a kinematic body, the controller does not walk: it stands on it with no gap (the offset is
   *     not kept) and every movement along it comes out zero if the board stands still, by velocity
   *     or by position; if it moves or turns, it walks in fits (measured again when phase 2 closed:
   *     of 4.5 m asked, 2.3 to 2.6, with zero on 25 of 60 steps). On the same board, fixed, it walks.
   *     It is V1's "the controller got stuck on kinematic bodies", explained. Seen as fixed while it
   *     computes, it walks exactly as on a fixed one;
   *   - when a kinematic body moves under a character, the controller takes it along by itself, but
   *     only part of the way and not on every step (on a turning platform, every other step; on one
   *     going along a line, never): so it must not see it move either.
   * The body goes back to being kinematic, with its velocities, before the physics takes its step:
   * the world is the same as if nothing had happened. The other kinematic bodies it does see as they
   * are: when one comes against the character (a spinning cube), it pushes it out of its way, and
   * without that, the character, caught inside it, could not move.
   */
  moveCharacter(
    handle: number,
    desired: Vec3,
    up: Vec3,
    standingOn?: number,
  ): { movement: Vec3; grounded: boolean; ceiling: boolean; touched: number[]; walls: Vec3[] } {
    const rigid = this.world.getRigidBody(handle);
    const collider = rigid?.collider(0);
    if (!rigid || !collider) return { movement: [0, 0, 0], grounded: false, ceiling: false, touched: [], walls: [] };
    const c = (this.controller ??= this.createController());
    c.setUp(v(up));
    const ground = standingOn === undefined ? null : this.world.getRigidBody(standingOn);
    const kind = ground?.bodyType();
    const linear = ground?.linvel();
    const angular = ground?.angvel();
    ground?.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    c.computeColliderMovement(collider, v(desired), undefined, undefined, (other) => !this.lightColliders.has(other.handle));
    if (ground && kind !== undefined && linear && angular) {
      ground.setBodyType(kind, false);
      ground.setLinvel(linear, false);
      ground.setAngvel(angular, false);
    }
    let ceiling = false;
    // What it ran into that the physics moves (stage 3g: the character pushes it, by its own rule).
    const touched: number[] = [];
    const walls: Vec3[] = [];
    for (let i = 0; i < c.numComputedCollisions(); i++) {
      const hit = c.computedCollision(i);
      const n = hit?.normal2;
      const along = n ? n.x * up[0] + n.y * up[1] + n.z * up[2] : 0;
      if (n && along > 0.7) ceiling = true;
      const body = hit?.collider?.parent();
      if (body?.isDynamic() && !touched.includes(body.handle)) touched.push(body.handle);
      // (The character's side points into the wall: a floor's points down, −1; a wall's, about 0.)
      else if (n && body && along <= 0.7 && -along < CLIMBS) walls.push([n.x, n.y, n.z]);
    }
    const movement = this.stopAtUnseen(collider, handle, toVec(c.computedMovement()));
    // What is light enough for the controller to go through (stage 4.5b), within a few centimeters of
    // where it ends this step: the character pushes it by its own rule, as anything it touches.
    const shape = collider.shape;
    if (this.lightColliders.size > 0 && shape instanceof RAPIER.Capsule) {
      const at = collider.translation();
      const end = { x: at.x + movement[0], y: at.y + movement[1], z: at.z + movement[2] };
      const near: number[] = [];
      this.world.intersectionsWithShape(
        end,
        collider.rotation(),
        new RAPIER.Capsule(shape.halfHeight, shape.radius + 0.05),
        (other) => {
          if (this.lightColliders.has(other.handle)) near.push(other.handle);
          return true;
        },
      );
      for (const h of near) {
        const body = this.world.getCollider(h)?.parent();
        if (body && !touched.includes(body.handle)) touched.push(body.handle);
      }
    }
    return { movement, grounded: c.computedGrounded(), ceiling, touched, walls };
  }

  join(a: number, b: number, anchorA: Vec3, anchorB: Vec3) {
    const first = this.world.getRigidBody(a);
    const second = this.world.getRigidBody(b);
    if (!first || !second) return;
    const joint = this.world.createImpulseJoint(RAPIER.JointData.spherical(v(anchorA), v(anchorB)), first, second, true);
    joint.setContactsEnabled(false);
  }

  setCharacterPose(handle: number, shape: Shape, offset: Vec3) {
    const rigid = this.world.getRigidBody(handle);
    const collider = rigid?.collider(0);
    if (!rigid || !collider) return;
    collider.setShape(shapeOf(shape));
    collider.setTranslationWrtParent(v(offset));
    // Where it is in the world, now: Rapier would put it there at its next step, and the controller,
    // this step, would move the new shape from the old place (the low body, 30 cm in the air).
    const r = rigid.rotation();
    collider.setTranslation(v(vec3.add(toVec(rigid.translation()), quat.rotate(toQuat(r), offset))));
  }

  /**
   * The controller finds what is in a character's way through Rapier's queries, which do not see the
   * bodies created or put somewhere since the last step (`unseen`): its capsule is swept along the
   * movement against each of those, and stops at the first, keeping its gap. It does not slide along
   * it, for this one step: from the next, the controller sees it, and slides.
   */
  private stopAtUnseen(collider: RAPIER.Collider, handle: number, movement: Vec3): Vec3 {
    if (this.unseen.size === 0) return movement;
    const length = Math.sqrt(movement[0] * movement[0] + movement[1] * movement[1] + movement[2] * movement[2]);
    if (length < 1e-9) return movement;
    const direction = { x: movement[0] / length, y: movement[1] / length, z: movement[2] / length };
    let free = length;
    for (const other of this.unseen) {
      if (other === handle) continue;
      const body = this.world.getRigidBody(other);
      if (light(body)) continue;
      const hit = body
        ?.collider(0)
        ?.castShape(ZERO, collider.shape, collider.translation(), collider.rotation(), direction, 0, free + CHARACTER_GAP, false);
      if (hit) free = Math.min(free, Math.max(0, hit.time_of_impact - CHARACTER_GAP));
    }
    return free === length ? movement : [direction.x * free, direction.y * free, direction.z * free];
  }

  /**
   * A RAY (stage 2.5b: the general query, instead of one per need): the first body it hits from
   * `from` along `direction` (length 1), as far as `reach`: its handle, how far, where, and the
   * normal of the surface there (pointing out of it). Bodies the physics moves (dynamic) count
   * unless `dynamic` is false; `skip` is left out (the one asking); `groups` filters like a body's.
   */
  castRay(from: Vec3, direction: Vec3, reach: number, o: QueryOptions = {}): PhysicsHit | null {
    const ray = new RAPIER.Ray(v(from), v(direction));
    const seen = this.world.castRayAndGetNormal(ray, reach, true, ...this.filter(o));
    // (Nearly always, Rapier's queries see every body: nothing more to ask.)
    if (this.unseen.size === 0) {
      const body = seen?.collider.parent();
      if (!seen || !body) return null;
      const at = ray.pointAt(seen.timeOfImpact);
      return {
        handle: body.handle,
        distance: seen.timeOfImpact,
        point: toVec(at),
        normal: rayNormal(seen.timeOfImpact, seen.normal),
      };
    }
    let found = seen && { collider: seen.collider, distance: seen.timeOfImpact, normal: seen.normal };
    for (const collider of this.unseenColliders(o)) {
      const hit = collider.castRayAndGetNormal(ray, found ? found.distance : reach, true);
      if (hit && (!found || hit.timeOfImpact < found.distance))
        found = { collider, distance: hit.timeOfImpact, normal: hit.normal };
    }
    const body = found?.collider.parent();
    if (!found || !body) return null;
    const at = ray.pointAt(found.distance);
    return { handle: body.handle, distance: found.distance, point: toVec(at), normal: rayNormal(found.distance, found.normal) };
  }

  /**
   * The colliders of the bodies Rapier's queries do not see yet (`unseen`) that a query with these
   * options counts, in the order they were created or put: a query asks each one on its own.
   */
  private unseenColliders(o: QueryOptions): RAPIER.Collider[] {
    if (this.unseen.size === 0) return [];
    const left = new Set([o.skip, o.besides, ...(o.leave ?? [])]);
    const groups = o.groups ? groupsOf(o.groups) : undefined;
    const out: RAPIER.Collider[] = [];
    for (const handle of this.unseen) {
      if (left.has(handle)) continue;
      const body = this.world.getRigidBody(handle);
      const collider = body?.collider(0);
      if (!body || !collider || (o.dynamic === false && body.isDynamic()) || (o.kinematic === false && body.isKinematic()))
        continue;
      if (groups !== undefined && !meets(groups, collider.collisionGroups())) continue;
      out.push(collider);
    }
    return out;
  }

  /**
   * A SHAPE MOVED along `direction` (length 1) from `position` turned by `rotation`, as far as
   * `reach`: the first body it would touch, how far it got, where it touches, and the normal of that
   * body's surface there (pointing out of it). What it already overlaps when it starts counts, at
   * distance 0. The same options as a ray.
   */
  castShape(
    shape: Shape,
    position: Vec3,
    rotation: Quat,
    direction: Vec3,
    reach: number,
    o: QueryOptions = {},
  ): PhysicsHit | null {
    const cast = shapeOf(shape);
    const seen = this.world.castShape(v(position), q(rotation), v(direction), cast, 0, reach, true, ...this.filter(o));
    let found: PhysicsHit | null = null;
    const body = seen?.collider.parent();
    if (seen && body)
      found = { handle: body.handle, distance: seen.time_of_impact, point: toVec(seen.witness1), normal: toVec(seen.normal1) };
    if (this.unseen.size === 0) return found;
    for (const collider of this.unseenColliders(o)) {
      const max = found ? found.distance : reach;
      const hit = collider.castShape(ZERO, cast, v(position), q(rotation), v(direction), 0, max, true);
      if (!hit || (found && hit.time_of_impact >= found.distance)) continue;
      // (On the collider's own axes, from its center: turned and moved to the world's.)
      const turn = toQuat(collider.rotation());
      const center = toVec(collider.translation());
      const point = quat.rotate(turn, toVec(hit.witness1));
      found = {
        handle: collider.parent()!.handle,
        distance: hit.time_of_impact,
        point: [point[0] + center[0], point[1] + center[1], point[2] + center[2]],
        normal: quat.rotate(turn, toVec(hit.normal1)),
      };
    }
    return found;
  }

  /**
   * How a body moves now: whether the program moves it (kinematic: a platform), its velocities (the
   * turn as its axis times rad/s) and the point it turns around (the physics turns a body around its
   * center of mass).
   */
  motionOf(handle: number): { kinematic: boolean; linear: Vec3; angular: Vec3; center: Vec3 } | null {
    const body = this.world.getRigidBody(handle);
    if (!body) return null;
    return {
      kinematic: body.isKinematic(),
      linear: toVec(body.linvel()),
      angular: toVec(body.angvel()),
      center: toVec(body.worldCom()),
    };
  }

  /** Rapier's filter arguments, from our options. */
  private filter(o: QueryOptions) {
    const skip = o.skip === undefined ? undefined : this.world.getRigidBody(o.skip);
    const left = [...(o.besides === undefined ? [] : [o.besides]), ...(o.leave ?? [])];
    const flags =
      (o.dynamic === false ? RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC : 0) |
      (o.kinematic === false ? RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC : 0);
    return [
      flags === 0 ? undefined : flags,
      o.groups ? groupsOf(o.groups) : undefined,
      undefined,
      skip,
      left.length === 0 ? undefined : (collider: RAPIER.Collider) => !left.includes(collider.parent()?.handle ?? -1),
    ] as const;
  }

  /**
   * Puts a body somewhere at once, without moving through what is in between (stage 2a: back to a
   * checkpoint; `dojo.goto`). Its colliders go there too, now: Rapier moves them only at the start
   * and end of a step, and the character controller computes the next step from where its collider
   * is. Without that, a character put just above the floor computed its first step from where it
   * had been (in the air), and went one step of gravity into the floor (measured: 2.7 mm, and it took
   * twenty steps to come out).
   */
  place(handle: number, position: Vec3, rotation: Quat) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    rigid.setTranslation(v(position), true);
    rigid.setRotation(q(rotation), true);
    rigid.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rigid.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (rigid.isKinematic()) {
      rigid.setNextKinematicTranslation(v(position));
      rigid.setNextKinematicRotation(q(rotation));
    }
    this.world.propagateModifiedBodyPositionsToColliders();
    // Rapier's queries see it again from the next step: until then, asked on its own.
    this.unseen.add(handle);
  }

  /** Where a character's body will be at the end of the next step (it moves there during the step). */
  setNextPose(handle: number, position: Vec3, rotation: Quat) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    rigid.setNextKinematicTranslation(v(position));
    rigid.setNextKinematicRotation(q(rotation));
  }

  /** Where a body is now, according to the physics (32-bit numbers). */
  position(handle: number): Vec3 {
    const rigid = this.world.getRigidBody(handle);
    return rigid ? toVec(rigid.translation()) : [0, 0, 0];
  }

  private createController() {
    const c = this.world.createCharacterController(CHARACTER.offset);
    c.enableAutostep(CHARACTER.stepHeight, CHARACTER.stepWidth, false);
    c.enableSnapToGround(CHARACTER.snapToGround);
    c.setMaxSlopeClimbAngle(CHARACTER.maxClimb);
    c.setMinSlopeSlideAngle(CHARACTER.minSlide);
    // It does not push what the physics moves by Rapier's rule (each step, an impulse by the character's
    // mass: it adds up, and a block of a tonne went along as easily as a crate of 45 kg). The character
    // pushes by its own (character.ts: `push`), with a force its friction has to beat.
    c.setApplyImpulsesToDynamicBodies(false);
    return c;
  }

  step() {
    this.world.step(this.events);
    // Stepping, Rapier updated what its queries see: every body, where it is.
    this.unseen.clear();
    // The contacts that began in this step, each way round (Rapier's, from its narrow phase: the same
    // after a snapshot, which keeps it).
    this.struckBy.clear();
    const add = (a: number, b: number) => this.struckBy.set(a, [...(this.struckBy.get(a) ?? []), b]);
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const [c1, c2] = [this.world.getCollider(h1), this.world.getCollider(h2)];
      if (!c1 || !c2 || c1.isSensor() || c2.isSensor()) return;
      const [a, b] = [c1.parent()?.handle, c2.parent()?.handle];
      if (a === undefined || b === undefined || a === b) return;
      add(a, b);
      add(b, a);
    });
    for (const list of this.struckBy.values()) list.sort((x, y) => x - y);
  }

  struck(handle: number): number[] {
    return this.struckBy.get(handle) ?? [];
  }

  /** Copies where the body is and how it moves into the entity's components (after a step). */
  read(handle: number, transform: Transform, body: Body) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    // A body asleep does not move (stage 2.5b): read once when it falls asleep (Rapier stops it then:
    // its velocities become zero), and not again until something wakes it. Four calls into WebAssembly
    // a body, each one making an object: in the stress room, a third of the physics' time.
    if (rigid.isSleeping()) {
      if (this.asleep.has(handle)) return;
      if (rigid.isDynamic() && !this.restsWhereItIs(rigid, body.linearVelocity)) {
        // Where it is, it cannot rest: its sleep is refused, and it goes on as it went.
        rigid.wakeUp();
        rigid.setLinvel(v(body.linearVelocity), true);
        rigid.setAngvel(v(body.angularVelocity), true);
        transform.position = toVec(rigid.translation());
        transform.rotation = toQuat(rigid.rotation());
        return;
      }
      this.asleep.add(handle);
    } else this.asleep.delete(handle);
    transform.position = toVec(rigid.translation());
    transform.rotation = toQuat(rigid.rotation());
    body.linearVelocity = toVec(rigid.linvel());
    body.angularVelocity = toVec(rigid.angvel());
  }

  /**
   * THE SLEEP RULE (the engine's; before, Rapier's alone): whether a body Rapier just put to sleep can
   * rest where it is. Rapier puts to sleep what moves slowly for half a second (measured: less than
   * 0.4 m/s), and what barely slides, from rest, does: a box half a degree past its friction angle went
   * down 1.6 cm and stopped there for good (awake, 4.3 m in ten seconds, as its friction says).
   *
   * So: by what holds it up (of the surfaces it touches, the one that faces up the most), a box, or a
   * capsule, can slide if that surface is steeper than its friction holds (the tangent of its slope,
   * more than the friction: Rapier's, the two surfaces' average); a ball, down any slope steeper than 1
   * in 1000 (Rapier put one to sleep on 0.5°, after 8 mm: it rolls 3 m in ten seconds). And it does
   * slide if it was going down that slope as the slope makes it: at least what a tenth of a second of
   * that slope gives (from rest, half a second gave it five times as much). One that leans on others,
   * in a pile or wedged in a corner, is not moving: something else holds it, and it sleeps (refused, it
   * stayed awake for good, and a pile with them cost the step a sixth more).
   *
   * Asked only when Rapier puts a body to sleep, from what the state has (its contacts, its frictions,
   * the gravity, its velocity before the step): the same in every copy. What nothing holds up from
   * below, Rapier decides.
   */
  private restsWhereItIs(rigid: RAPIER.RigidBody, velocity: Vec3): boolean {
    const collider = rigid.collider(0);
    const g = this.world.gravity;
    const weight = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    if (!collider || weight < 1e-9) return true;
    const up = { x: -g.x / weight, y: -g.y / weight, z: -g.z / weight };
    let facing = 0;
    let friction = 0;
    let out = { x: 0, y: 0, z: 0 };
    this.world.contactPairsWith(collider, (other) => {
      this.world.contactPair(collider, other, (manifold, flipped) => {
        if (manifold.numSolverContacts() === 0) return;
        // The normal points from the first collider to the second (flipped: the other way): out of the
        // surface below, it points the other way.
        const n = manifold.normal();
        const sign = flipped ? 1 : -1;
        const along = sign * (n.x * up.x + n.y * up.y + n.z * up.z);
        if (along > facing) {
          facing = along;
          friction = (collider.friction() + other.friction()) / 2;
          out = { x: sign * n.x, y: sign * n.y, z: sign * n.z };
        }
      });
    });
    if (facing <= 0) return true;
    const sine = Math.sqrt(Math.max(0, 1 - facing * facing));
    const holds = collider.shapeType() === RAPIER.ShapeType.Ball ? 0.001 : friction;
    if (sine <= holds * facing) return true;
    // Down the slope: gravity along the surface (its length, the weight times the slope's sine).
    const pressing = g.x * out.x + g.y * out.y + g.z * out.z;
    const down = { x: g.x - pressing * out.x, y: g.y - pressing * out.y, z: g.z - pressing * out.z };
    const going = (velocity[0] * down.x + velocity[1] * down.y + velocity[2] * down.z) / (weight * sine);
    const pull = weight * (sine - holds * facing);
    return going < 0.1 * pull;
  }

  get bodyCount(): number {
    return this.world.bodies.len();
  }

  /** What the physics sees, as line segments (for `show.physics`): xyz per vertex, rgba per vertex. */
  debugLines(): { vertices: Float32Array; colors: Float32Array } {
    const { vertices, colors } = this.world.debugRender();
    return { vertices, colors };
  }

  /**
   * Where bodies touch now (for `show.contacts`, stage 1f): each contact point Rapier's solver uses,
   * and the normal of its contact (pointing from the first body to the second), as x y z after x y z.
   * For looking, not for simulating: what it returns is not part of the state.
   */
  contacts(): { points: number[]; normals: number[] } {
    const points: number[] = [];
    const normals: number[] = [];
    this.world.forEachCollider((a) => {
      this.world.contactPairsWith(a, (b) => {
        if (b.handle <= a.handle) return; // each pair once
        this.world.contactPair(a, b, (manifold, flipped) => {
          const n = manifold.normal();
          const sign = flipped ? -1 : 1;
          for (let i = 0; i < manifold.numSolverContacts(); i++) {
            const p = manifold.solverContactPoint(i);
            if (!p) continue;
            points.push(p.x, p.y, p.z);
            normals.push(n.x * sign, n.y * sign, n.z * sign);
          }
        });
      });
    });
    return { points, normals };
  }

  touching(handle: number): number[] {
    const rigid = this.world.getRigidBody(handle);
    const collider = rigid?.collider(0);
    if (!collider) return [];
    const out: number[] = [];
    this.world.contactPairsWith(collider, (other) => {
      let solid = false;
      this.world.contactPair(collider, other, (manifold) => {
        if (manifold.numSolverContacts() > 0) solid = true;
      });
      const body = other.parent();
      if (solid && body && !out.includes(body.handle)) out.push(body.handle);
    });
    return out.sort((a, b) => a - b);
  }

  massOf(handle: number): number {
    return this.world.getRigidBody(handle)?.mass() ?? 0;
  }

  push(handle: number, impulse: Vec3) {
    this.world.getRigidBody(handle)?.applyImpulse(v(impulse), true);
  }

  /** Frees the physics' memory (WebAssembly's, which the garbage collector does not see). */
  dispose() {
    if (this.controller) this.world.removeCharacterController(this.controller);
    this.events.free();
    this.world.free();
  }
}
