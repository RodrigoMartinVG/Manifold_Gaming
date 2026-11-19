import { vec3, type Vec3 } from '@manifold/common';
import { CHARACTER_GAP, STANDS_ON } from '../physics';
import type { Entity, EntityId, Shape } from '../types';
import type { World } from '../world';
import { isZero } from './steer';

/**
 * WHETHER A SHAPE FITS WHERE A CHARACTER IS (stage 4b: room to stand up): upright, at its place, it
 * touches nothing but the character itself (a shape swept up by the controller's gap meets nothing).
 */
export function fits(world: World, e: Entity, shape: Shape, up: Vec3): boolean {
  return world.castShape(shape, e.transform!.position, e.transform!.rotation, up, CHARACTER_GAP, { skip: e.id }) === null;
}

/**
 * A WALL in that direction (stage 2c; with the world's ray since 2.5b): a ray from `from` along
 * `direction` (of length 1), as far as `reach`; if it hits something the physics does not move that
 * stands almost upright, the direction towards it, along the ground and of length 1, and how far along
 * the ray it is; if not, zero. Not with the character controller's collisions: those only exist while
 * it pushes against the wall, and pushing against a wall steeper than what it climbs, the controller
 * does not let it rise along it.
 */
export function wallAhead(
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
export const WALL_APPROACH = 2;

export const WALL_GAP = 0.01;

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
export function topAhead(world: World, e: Entity, feet: Vec3, wall: Vec3, up: Vec3): boolean {
  if (isZero(wall)) return false;
  const face = world.castRay(vec3.add(feet, vec3.scale(up, -0.15)), wall, 0.65, { skip: e.id, dynamic: false });
  if (!face) return false;
  const above = 0.6;
  const from = vec3.add(vec3.add(feet, vec3.scale(wall, face.distance + 0.1)), vec3.scale(up, above));
  const hit = world.castRay(from, vec3.scale(up, -1), above + 0.3, { skip: e.id, dynamic: false });
  return hit !== null && vec3.dot(hit.normal, up) > 0.7;
}

/**
 * A LEDGE IT CAN GRAB (stage 5c), falling past it: a wall's face in front of it, a little under its
 * hands (from its center, towards `towards`, as far as its body and 30 cm); and above that face, 10 cm
 * in, a top it could stand on (a ray down from above its hands), at most `window` under its hands
 * (falling, they pass it: a step's fall at least) or 5 cm over them. Where its hands would hold (on
 * the top, 10 cm past the edge) and the wall's way; or null. Only on what stays where it is (stage 5d:
 * on a lift's edge it hung where the edge had been, in the air, as the lift went on).
 */
export function ledgeAhead(
  world: World,
  e: Entity,
  center: Vec3,
  towards: Vec3,
  radius: number,
  hands: number,
  window: number,
  up: Vec3,
): { at: Vec3; wall: Vec3; steps: number; climb: number } | null {
  const face = wallAhead(world, e, vec3.add(center, vec3.scale(up, hands - 0.25)), towards, radius + 0.3, up);
  if (isZero(face.wall)) return null;
  const above = 0.35;
  const from = vec3.add(vec3.add(center, vec3.scale(face.wall, face.distance + 0.1)), vec3.scale(up, hands + above));
  const hit = world.castRay(from, vec3.scale(up, -1), above + window, { skip: e.id, dynamic: false });
  if (!hit || vec3.dot(hit.normal, up) < 0.7 || hit.distance < above - 0.05) return null;
  const top = world.entities.get(hit.entity);
  if (!top?.body || top.body.type !== 'fixed' || top.mover || top.mechanism || top.spin) return null;
  return { at: vec3.add(from, vec3.scale(up, -hit.distance)), wall: face.wall, steps: 0, climb: 0 };
}

/**
 * A CHARACTER'S MIDDLE, to find what it stands on (stage 5.5e: any body, not only a capsule): its shape a
 * tenth thinner across, its bottom where its own is (`lower`: how far down its center goes for that). A
 * capsule gets longer by what its round bottom lost, as before; a ball goes down; a box keeps its height. A
 * compound has no one middle: null, and it stands on what the controller finds.
 */
function thinnerOf(shape: Shape): { shape: Shape; lower: number } | null {
  switch (shape.kind) {
    case 'capsule': {
      const radius = shape.radius * 0.9;
      return { shape: { kind: 'capsule', halfHeight: shape.halfHeight + (shape.radius - radius), radius }, lower: 0 };
    }
    case 'ball': {
      const radius = shape.radius * 0.9;
      return { shape: { kind: 'ball', radius }, lower: shape.radius - radius };
    }
    case 'box': {
      const [x, y, z] = shape.halfExtents;
      return { shape: { kind: 'box', halfExtents: [x * 0.9, y, z * 0.9] }, lower: 0 };
    }
    default:
      return null;
  }
}

/** How far under its capsule a character looks for what it stands on: what the controller snaps it down (0.3 m), and a little. */
const GROUND_REACH = 0.35;

/**
 * WHAT A CHARACTER STANDS ON (stage 2.5b): its own body, a little thinner (90% across, `thinnerOf`;
 * any body since stage 5.5e, a capsule before), with its bottom where it is, so a wall brushing its
 * sides does not count, moved down from where it is, as far as the controller keeps it on the ground:
 * the first thing it would touch whose surface faces up. The entity, the surface's normal there (stage
 * 3b), how far below its bottom it is (stage 3c), and, if the program moves it (a platform), how it
 * moves. Bodies the physics moves (a cube) are not platforms: standing on one, it stands on nothing
 * that carries it.
 *
 * Before, a ray from its center: on a platform's edge, with its center already beyond it and the round
 * bottom of its capsule still on it, the ray found nothing (stage 2d left the platform's last velocity
 * there, without carrying it: a fix halfway).
 */
export function standingOn(
  world: World,
  e: Entity,
  up: Vec3,
): { entity: number; normal: Vec3; distance: number; moves: { linear: Vec3; angular: Vec3; center: Vec3 } | null } | null {
  const shape = e.body!.shape;
  const middle = thinnerOf(shape);
  if (!middle) return null;
  const down = vec3.scale(up, -1);
  const cast = (s: Shape, lower = 0) =>
    world.castShape(
      s,
      lower === 0 ? e.transform!.position : vec3.sub(e.transform!.position, vec3.scale(up, lower)),
      e.transform!.rotation,
      down,
      GROUND_REACH,
      { skip: e.id, dynamic: false },
    );
  const found = (hit: ReturnType<typeof cast>) => {
    if (!hit || vec3.dot(hit.normal, up) < 0.5) return null;
    const body = world.entities.get(hit.entity)?.body;
    const motion = body ? world.physics.motionOf(body.handle) : null;
    return { entity: hit.entity, normal: hit.normal, distance: hit.distance, moves: motion?.kinematic ? motion : null };
  };
  const thin = found(cast(middle.shape, middle.lower));
  if (thin?.moves) return thin;
  // What the program moves, also by an edge under its round bottom (stage 3a): with its center past a
  // moving platform's edge, the thinner capsule misses it, and the controller, not given it as fixed,
  // could not get onto it (boarding the ferry as it pulled away, it was dragged along on its edge).
  const edge = found(cast(shape));
  return edge?.moves ? edge : thin;
}

/** What a character stands on (stage 2.5b), as `standingOn` finds it. */
export type Standing = NonNullable<ReturnType<typeof standingOn>>;

/**
 * THE FACE UNDER A CHARACTER'S MIDDLE, if it is steeper than it stands on (stage 4.5b): its normal, from a
 * ray straight down from its center. Null on flat enough ground, or on nothing (a round bottom on an
 * edge: what holds it there is the edge, not a slope).
 */
export function steepFace(world: World, e: Entity, up: Vec3): Vec3 | null {
  const hit = world.castRay(e.transform!.position, vec3.scale(up, -1), 2, { skip: e.id, dynamic: false, characters: false });
  if (!hit) return null;
  const along = vec3.dot(hit.normal, up);
  return along > 0.1 && along < STANDS_ON ? hit.normal : null;
}

/** How far a lock-on reaches (m): it takes one this near, and lets go of one farther. */
export const LOCK_RANGE = 15;

/**
 * WHOM `lock` TAKES (stage 4f): the nearest other character in front of it (within a quarter turn of
 * where it looks), within `LOCK_RANGE`, standing; null, none.
 */
export function lockTarget(world: World, e: Entity, up: Vec3): EntityId | null {
  const c = e.character!;
  const forward = vec3.normalize(vec3.onPlane(c.facing, up));
  let best: EntityId | null = null;
  let nearest = LOCK_RANGE;
  for (const other of world.entities.values()) {
    if (other.id === e.id || !other.character || !other.transform || (other.health?.down ?? -1) >= 0) continue;
    const to = vec3.onPlane(vec3.sub(other.transform.position, e.transform!.position), up);
    const d = vec3.length(to);
    if (d > nearest || d < 1e-6 || vec3.dot(to, forward) < 0) continue;
    nearest = d;
    best = other.id;
  }
  return best;
}
