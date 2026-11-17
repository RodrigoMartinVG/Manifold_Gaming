import { quat, vec3, type Vec3 } from '@manifold/common';
import { HISTORY, hitPartsOf } from './character';
import type { Entity, EntityId, Pose } from './types';
import type { World } from './world';

/**
 * HITS AGAINST THE HISTORY OF POSES (stage 4c, decision 0022). A shot (a ray) or a strike (a ball swept
 * along a segment) is tested against the characters' hit parts as their history had them `back` steps
 * ago, as far as its shooter saw, and against everything else as it is now: only the targets' poses go
 * back, never the world. The first thing it meets is what it hits. With additions, multiplications, a
 * division and a square root: the same bits in every browser.
 */

/** How many steps back a shot may look at most (decision 0022): 15, a quarter of a second. */
export const MOST_BACK = HISTORY - 1;

/** What a shot or a strike met first: a character's part (in its pose of then), or the world (as it is now). */
export type ShotHit =
  | { kind: 'character'; entity: EntityId; part: string; distance: number; point: Vec3 }
  | { kind: 'world'; entity: EntityId; distance: number; point: Vec3; normal: Vec3 };

/**
 * Where a ray from `from` along the unit `direction` first meets a ball (its center, its radius), at
 * most `reach` along it: 0 if it starts inside, null if it does not meet it.
 */
export function rayBall(from: Vec3, direction: Vec3, center: Vec3, radius: number, reach: number): number | null {
  const m = vec3.sub(from, center);
  const c = vec3.dot(m, m) - radius * radius;
  if (c <= 0) return 0;
  const b = vec3.dot(m, direction);
  if (b > 0) return null;
  const d = b * b - c;
  if (d < 0) return null;
  const t = -b - Math.sqrt(d);
  return t <= reach ? t : null;
}

/**
 * Where a ray first meets a capsule (the segment from `a` to `b`, its radius), at most `reach` along it:
 * 0 if it starts inside, null if it does not meet it. A capsule is a cylinder and the two balls at its
 * ends: the first it meets of the three.
 */
export function rayCapsule(from: Vec3, direction: Vec3, a: Vec3, b: Vec3, radius: number, reach: number): number | null {
  const ba = vec3.sub(b, a);
  const oa = vec3.sub(from, a);
  const baba = vec3.dot(ba, ba);
  // Inside: nearer than its radius to the segment.
  const along = baba > 0 ? Math.min(1, Math.max(0, vec3.dot(oa, ba) / baba)) : 0;
  const nearest = vec3.sub(oa, vec3.scale(ba, along));
  if (vec3.dot(nearest, nearest) <= radius * radius) return 0;
  let best: number | null = null;
  const keep = (t: number | null) => {
    if (t !== null && t >= 0 && t <= reach && (best === null || t < best)) best = t;
  };
  // The cylinder: |(o + t d − a) × ba|² = r² |ba|², the side between its ends.
  const bard = vec3.dot(ba, direction);
  const baoa = vec3.dot(ba, oa);
  const A = baba - bard * bard;
  if (A > 1e-12) {
    const B = baba * vec3.dot(direction, oa) - baoa * bard;
    const C = baba * vec3.dot(oa, oa) - baoa * baoa - radius * radius * baba;
    const h = B * B - A * C;
    if (h >= 0) {
      const t = (-B - Math.sqrt(h)) / A;
      const y = baoa + t * bard;
      if (y > 0 && y < baba) keep(t);
    }
  }
  keep(rayBall(from, direction, a, radius, reach));
  keep(rayBall(from, direction, b, radius, reach));
  return best;
}

/** A character's pose `back` steps ago (0: as this step ended), from its history; the oldest it has, if it has fewer; where it is now, if none. */
export function poseBack(e: Entity, back: number): Pose | null {
  const c = e.character;
  if (!c || !e.transform) return null;
  const h = c.history;
  if (h.length === 0) return { position: e.transform.position, rotation: e.transform.rotation, pitch: c.pitch, mode: c.mode };
  return h[Math.max(0, h.length - 1 - Math.max(0, Math.min(MOST_BACK, Math.round(back))))]!;
}

/**
 * WHAT A SHOT HITS (decision 0022): a ray from `from` along `direction` (of length 1), at most `reach`
 * long, or, with a `radius`, a ball swept along it (a strike, decision 0000's swept volumes). Against
 * the characters' parts `back` steps ago (0 to 15; more is 15) and the world as it is now; the
 * shooter (`skip`) left out. The first it meets, or null.
 */
export function castHit(
  world: World,
  from: Vec3,
  direction: Vec3,
  reach: number,
  o: { back?: number; skip?: EntityId; radius?: number } = {},
): ShotHit | null {
  const radius = o.radius ?? 0;
  let hit: ShotHit | null = null;
  for (const e of world.entities.values()) {
    if (e.id === o.skip || !e.character || !e.body) continue;
    const pose = poseBack(e, o.back ?? 0);
    if (!pose) continue;
    for (const part of hitPartsOf(e.character, e.body, pose.mode)) {
      const center = vec3.add(pose.position, quat.rotate(pose.rotation, part.offset));
      const r = part.shape.radius + radius;
      let t: number | null;
      if (part.shape.kind === 'ball') t = rayBall(from, direction, center, r, reach);
      else {
        const axis = vec3.scale(quat.rotate(quat.multiply(pose.rotation, part.rotation), [0, 1, 0]), part.shape.halfHeight);
        t = rayCapsule(from, direction, vec3.sub(center, axis), vec3.add(center, axis), r, reach);
      }
      if (t !== null && (hit === null || t < hit.distance))
        hit = { kind: 'character', entity: e.id, part: part.name, distance: t, point: vec3.add(from, vec3.scale(direction, t)) };
    }
  }
  // The world as it is now, the characters left out (their bodies of now are not what is hit).
  const query = { ...(o.skip === undefined ? {} : { skip: o.skip }), characters: false };
  const wall =
    radius > 0
      ? world.castShape({ kind: 'ball', radius }, from, quat.identity(), direction, hit ? hit.distance : reach, query)
      : world.castRay(from, direction, hit ? hit.distance : reach, query);
  if (wall && (hit === null || wall.distance < hit.distance))
    return { kind: 'world', entity: wall.entity, distance: wall.distance, point: wall.point, normal: wall.normal };
  return hit;
}
