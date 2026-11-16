import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { Quat, Vec3 } from '@manifold/common';
import type { Profile } from './profile';
import type { Body, BodySpec, CollisionGroups, Shape, Transform } from './types';

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
/** A shape of ours, as Rapier's. */
const shapeOf = (shape: Shape) =>
  shape.kind === 'ball'
    ? new RAPIER.Ball(shape.radius)
    : shape.kind === 'capsule'
      ? new RAPIER.Capsule(shape.halfHeight, shape.radius)
      : new RAPIER.Cuboid(...shape.halfExtents);

/** What a query of the physics hit (by handle: the world turns it into an entity). */
export interface PhysicsHit {
  handle: number;
  distance: number;
  point: Vec3;
  /** The surface's normal there, pointing out of what was hit. */
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
  /** Only the bodies these groups meet (like a body's). */
  groups?: CollisionGroups;
  /** More bodies left out, by handle (stage 3h: the characters, for the camera). */
  leave?: readonly number[];
}

/** The thin gap a character keeps between its capsule and what it touches (Rapier's advice: avoid getting stuck). */
export const CHARACTER_GAP = 0.02;

/**
 * The steepest ground a character stands on without sliding, as the cosine of its slope: 30°
 * (`CHARACTER.minSlide`), as √3 / 2 (a square root gives the same bits everywhere; a cosine might not).
 */
export const STANDS_ON = Math.sqrt(3) / 2;

/** How characters move (stage 1b): what they climb, what they snap to, what they push. */
const CHARACTER = {
  offset: CHARACTER_GAP,
  /** Steps it climbs without jumping: up to 35 cm, if there is at least 15 cm to stand on. */
  stepHeight: 0.35,
  stepWidth: 0.15,
  /** Going down a step or a slope, it stays on the ground if it is closer than this. */
  snapToGround: 0.3,
  /** Slopes it walks up; steeper ones, it slides down. (Radians: π/180 per degree.) */
  maxClimb: (50 * Math.PI) / 180,
  minSlide: (30 * Math.PI) / 180, // its cosine is STANDS_ON
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
  ): { movement: Vec3; grounded: boolean; ceiling: boolean; touched: number[] };
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

  /** A new physics world; or, with `snapshot`, the one that snapshot keeps (its bodies keep their handles). */
  constructor(gravity: Vec3, timestep: number, snapshot?: Uint8Array) {
    if (!ready) throw new Error('The physics is not ready: `await initPhysics()` before creating a world.');
    this.world = snapshot ? RAPIER.World.restoreSnapshot(snapshot) : new RAPIER.World(v(gravity));
    this.world.gravity = v(gravity);
    this.world.timestep = timestep;
  }

  /** Rapier's snapshot of its world, as bytes: bodies, colliders, contacts and the solver's state. */
  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
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
          : RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
    collider.setRestitution(body.restitution).setFriction(body.friction);
    if (body.density !== undefined) collider.setDensity(body.density);
    if (body.groups) collider.setCollisionGroups(groupsOf(body.groups)).setSolverGroups(groupsOf(body.groups));
    this.world.createCollider(collider, rigid);
    body.handle = rigid.handle;
    return body;
  }

  removeBody(handle: number) {
    const rigid = this.world.getRigidBody(handle);
    if (rigid) this.world.removeRigidBody(rigid);
    this.asleep.delete(handle);
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
   * (its head touched it). Brushing a wall while rising is not a ceiling.
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
  ): { movement: Vec3; grounded: boolean; ceiling: boolean; touched: number[] } {
    const rigid = this.world.getRigidBody(handle);
    const collider = rigid?.collider(0);
    if (!rigid || !collider) return { movement: [0, 0, 0], grounded: false, ceiling: false, touched: [] };
    const c = (this.controller ??= this.createController());
    c.setUp(v(up));
    const ground = standingOn === undefined ? null : this.world.getRigidBody(standingOn);
    const kind = ground?.bodyType();
    const linear = ground?.linvel();
    const angular = ground?.angvel();
    ground?.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    c.computeColliderMovement(collider, v(desired));
    if (ground && kind !== undefined && linear && angular) {
      ground.setBodyType(kind, false);
      ground.setLinvel(linear, false);
      ground.setAngvel(angular, false);
    }
    let ceiling = false;
    // What it ran into that the physics moves (stage 3g: the character pushes it, by its own rule).
    const touched: number[] = [];
    for (let i = 0; i < c.numComputedCollisions(); i++) {
      const hit = c.computedCollision(i);
      const n = hit?.normal2;
      if (n && n.x * up[0] + n.y * up[1] + n.z * up[2] > 0.7) ceiling = true;
      const body = hit?.collider?.parent();
      if (body?.isDynamic() && !touched.includes(body.handle)) touched.push(body.handle);
    }
    return { movement: toVec(c.computedMovement()), grounded: c.computedGrounded(), ceiling, touched };
  }

  /**
   * A RAY (stage 2.5b: the general query, instead of one per need): the first body it hits from
   * `from` along `direction` (length 1), as far as `reach`: its handle, how far, where, and the
   * normal of the surface there (pointing out of it). Bodies the physics moves (dynamic) count
   * unless `dynamic` is false; `skip` is left out (the one asking); `groups` filters like a body's.
   */
  castRay(from: Vec3, direction: Vec3, reach: number, o: QueryOptions = {}): PhysicsHit | null {
    const ray = new RAPIER.Ray(v(from), v(direction));
    const hit = this.world.castRayAndGetNormal(ray, reach, true, ...this.filter(o));
    const body = hit?.collider.parent();
    if (!hit || !body) return null;
    const at = ray.pointAt(hit.timeOfImpact);
    return { handle: body.handle, distance: hit.timeOfImpact, point: toVec(at), normal: toVec(hit.normal) };
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
    const hit = this.world.castShape(v(position), q(rotation), v(direction), shapeOf(shape), 0, reach, true, ...this.filter(o));
    const body = hit?.collider.parent();
    if (!hit || !body) return null;
    return { handle: body.handle, distance: hit.time_of_impact, point: toVec(hit.witness1), normal: toVec(hit.normal1) };
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
    return [
      o.dynamic === false ? RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC : undefined,
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
    this.world.step();
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
      this.asleep.add(handle);
    } else this.asleep.delete(handle);
    transform.position = toVec(rigid.translation());
    transform.rotation = toQuat(rigid.rotation());
    body.linearVelocity = toVec(rigid.linvel());
    body.angularVelocity = toVec(rigid.angvel());
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
    this.world.free();
  }
}
