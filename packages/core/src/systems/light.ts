import { poseOf } from '../character';
import type { Entity, EntityId } from '../types';
import { insideLength, type World } from '../world';
import { quat, type Vec3, vec3 } from '@manifold/common';

/**
 * HOW LIT A POINT IS (stage 3d): the ambient light, plus, from every lamp on that reaches it and sees
 * it (a ray from the lamp: nothing in between, the lamp and `skip`, the one lit, left out), its intensity falling
 * linearly to its radius, times what gets through the zones in between (`transmission`). Additions,
 * multiplications, a division and a square root: the same in every browser and in Node.
 */
export function lightAt(world: World, point: Vec3, skip?: EntityId): number {
  return lit(world, point, skip, lampsOn(world), attenuators(world));
}

/** The lamps on, and the zones that attenuate: what the light reads, gathered once per step. */
export function lampsOn(world: World): Entity[] {
  return [...world.entities.values()].filter((e) => e.lamp?.on && e.transform);
}

export function attenuators(world: World): Entity[] {
  return [...world.entities.values()].filter((e) => e.sensor?.params.opacity?.[0] && e.transform);
}

export function lit(
  world: World,
  point: Vec3,
  skip: EntityId | undefined,
  lamps: readonly Entity[],
  fogs: readonly Entity[],
): number {
  let light = world.ambient;
  for (const e of lamps) {
    const lamp = e.lamp!;
    if (!e.transform) continue;
    const to = vec3.sub(point, e.transform.position);
    const d = vec3.length(to);
    if (d >= lamp.radius) continue;
    if (d > 1e-9) {
      const hit = world.castRay(e.transform.position, vec3.scale(to, 1 / d), d, {
        besides: e.id,
        ...(skip === undefined ? {} : { skip }),
      });
      if (hit && hit.distance < d - 1e-6) continue;
    }
    light += lamp.intensity * (1 - d / lamp.radius) * through(world, e.transform.position, point, fogs);
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
 * mechanism reads it); how lit every character is, at its center; and who every watcher sees (in
 * range, in its cone, nothing in between, lit enough as seen from it). A change in what a watcher
 * sees is an event (`seen`, `lost`).
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
      e.character.light = lit(world, center, e.id, lamps, fogs);
      characters.push(e);
    }
  for (const eye of world.entities.values()) {
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
      const hit = world.castRay(from, direction, d, { skip: eye.id, besides: e.id });
      if (hit && hit.distance < d - 1e-6) continue;
      // Crouched, a watcher sees less of it (stage 4b: its posture): it needs that much more light.
      const posture = e.character!.mode === 'crouch' ? e.character!.movement.crouch.seen : 1;
      if (e.character!.light * through(world, from, at, fogs) * posture < w.threshold) continue;
      now.push(e.id);
    }
    for (const id of w.sees) if (!now.includes(id)) world.emit({ type: 'lost', watcher: eye.id, entity: id });
    for (const id of now) if (!w.sees.includes(id)) world.emit({ type: 'seen', watcher: eye.id, entity: id });
    w.sees = [...w.sees.filter((id) => now.includes(id)), ...now.filter((id) => !w.sees.includes(id))];
  }
}
