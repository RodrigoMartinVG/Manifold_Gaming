import { poseOf, seenOf } from '../character';
import type { Entity, EntityId } from '../types';
import { insideLength, type World } from '../world';
import { quat, type Vec3, vec3 } from '@manifold/common';

/**
 * AN EMITTER (stage 5.5e, S8): where it is, which way it faces, how wide (the cosine of half its cone; −1,
 * every way) and how far it reaches. A lamp is one that shines every way, as far as its radius; a
 * watcher's eye, one that looks along its −Z, in its cone, as far as its range. What they share is the
 * beam (`reaches`): before, each had its own, and they had drifted (one was out at its edge, the other
 * in). The shield's beam, a reflection, a torch are emitters with a cone.
 */
export interface Emitter {
  readonly entity: EntityId;
  readonly at: Vec3;
  /** Which way it faces; null, every way (then its cone is −1). */
  readonly forward: Vec3 | null;
  readonly cone: number;
  readonly range: number;
}

/** A lamp as an emitter: every way, as far as its radius. */
export const lampEmitter = (e: Entity): Emitter => ({
  entity: e.id,
  at: e.transform!.position,
  forward: null,
  cone: -1,
  range: e.lamp!.radius,
});

/** A watcher's eye as an emitter: along its −Z, in its cone, as far as its range. */
export const eyeEmitter = (e: Entity): Emitter => ({
  entity: e.id,
  at: e.transform!.position,
  forward: quat.rotate(e.transform!.rotation, [0, 0, -1]),
  cone: e.watcher!.cone,
  range: e.watcher!.range,
});

/**
 * A BEAM (stage 5.5e, S8): whether an emitter reaches a point, and how far it is (null: it does not).
 * Within its range (at its very edge too: a lamp gives nothing there), within its cone, and nothing in
 * between (a ray from it; the emitter and `besides`, what it reaches, left out). At the emitter itself,
 * one that shines every way reaches it, with no ray; one with a cone cannot tell which way it is, and
 * does not.
 */
export function reaches(world: World, em: Emitter, point: Vec3, besides?: EntityId): number | null {
  const to = vec3.sub(point, em.at);
  const d = vec3.length(to);
  if (d > em.range) return null;
  if (d <= 1e-9) return em.forward === null ? d : null;
  const direction = vec3.scale(to, 1 / d);
  if (em.forward !== null && vec3.dot(direction, em.forward) < em.cone) return null;
  const hit = world.castRay(em.at, direction, d, { skip: em.entity, ...(besides === undefined ? {} : { besides }) });
  return hit && hit.distance < d - 1e-6 ? null : d;
}

/**
 * HOW LIT A POINT IS (stage 3d): the ambient light, plus, from every lamp on that reaches it and sees
 * it (a ray from the lamp: nothing in between, the lamp and `skip`, the one lit, left out), its intensity falling
 * linearly to its radius, times what gets through the zones in between (`transmission`). Additions,
 * multiplications, a division and a square root: the same in every browser and in Node.
 */
export function lightAt(world: World, point: Vec3, skip?: EntityId): number {
  return lightFrom(world, point, skip, lampsOn(world), attenuators(world));
}

/** The lamps on, and the zones that attenuate: what the light reads, gathered once per step. */
export function lampsOn(world: World): Entity[] {
  return [...world.entities.values()].filter((e) => e.lamp?.on && e.transform);
}

export function attenuators(world: World): Entity[] {
  return [...world.entities.values()].filter((e) => e.sensor?.params.opacity?.[0] && e.transform);
}

/** How lit a point is, from these lamps, through these zones: each lamp's beam, its intensity falling to its radius. */
export function lightFrom(
  world: World,
  point: Vec3,
  skip: EntityId | undefined,
  lamps: readonly Entity[],
  fogs: readonly Entity[],
): number {
  let light = world.ambient;
  for (const e of lamps) {
    if (!e.transform) continue;
    const d = reaches(world, lampEmitter(e), point, skip);
    if (d === null) continue;
    light += e.lamp!.intensity * (1 - d / e.lamp!.radius) * through(world, e.transform.position, point, fogs);
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
export function transmission(world: World, from: Vec3, to: Vec3): number {
  return through(world, from, to, attenuators(world));
}

export function through(world: World, from: Vec3, to: Vec3, fogs: readonly Entity[]): number {
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
 * mechanism reads it); how lit every character is, at its center, and (stage 5.5e) every entity that
 * receives light (`lit`), at its place; and who every watcher sees (its eye's beam reaches it, lit
 * enough as seen from it). A change in what a watcher sees is an event (`seen`, `lost`).
 */
export function illuminate(world: World) {
  for (const e of world.entities.values())
    // (Stage 5e: put out by a hand, it gives no light until a hand lights it again.)
    if (e.lamp) e.lamp.on = !e.breakable?.broken && !e.lamp.out && (e.lamp.signal === null || world.signal(e.lamp.signal) !== 0);
  const lamps = lampsOn(world);
  const fogs = attenuators(world);
  const characters: Entity[] = [];
  // Where each one's body is (stage 4b: crouched, lower than its center), where light and sight reach.
  const centers = new Map<EntityId, Vec3>();
  for (const e of world.entities.values())
    if (e.character && e.transform) {
      const offset = e.body ? poseOf(e.character, e.body).offset : ([0, 0, 0] as Vec3);
      const center = vec3.add(e.transform.position, quat.rotate(e.transform.rotation, offset));
      centers.set(e.id, center);
      e.character.light = lightFrom(world, center, e.id, lamps, fogs);
      characters.push(e);
    }
  for (const e of world.entities.values())
    if (e.lit && e.transform) e.lit.light = lightFrom(world, e.transform.position, e.id, lamps, fogs);
  for (const eye of world.entities.values()) {
    const w = eye.watcher;
    if (!w || !eye.transform) continue;
    const from = eye.transform.position;
    const sight = eyeEmitter(eye);
    const now: EntityId[] = [];
    for (const e of characters) {
      const at = centers.get(e.id)!;
      if (reaches(world, sight, at, e.id) === null) continue;
      // In a posture seen less (stage 4b: crouched), a watcher needs that much more light (its mode's, stage 5.5e).
      const posture = seenOf(e.character!);
      if (e.character!.light * through(world, from, at, fogs) * posture < w.threshold) continue;
      now.push(e.id);
    }
    for (const id of w.sees) if (!now.includes(id)) world.emit({ type: 'lost', watcher: eye.id, entity: id });
    for (const id of now) if (!w.sees.includes(id)) world.emit({ type: 'seen', watcher: eye.id, entity: id });
    w.sees = [...w.sees.filter((id) => now.includes(id)), ...now.filter((id) => !w.sees.includes(id))];
  }
}
