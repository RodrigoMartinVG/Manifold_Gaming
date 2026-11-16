import RAPIER from '@dimforge/rapier3d-deterministic-compat';

/**
 * COLLISION GROUPS, as Rapier keeps them: one 32-bit number per collider. Its 16 high bits are the
 * groups it is a MEMBER of; its 16 low bits, the groups it MEETS (its filter). Two things meet only
 * if each is a member of a group the other meets: both have to agree. A question has its own.
 */
export const WORLD = 0b01;
export const GLASS = 0b10;
export const EVERY = 0xffff;
export const groups = (member: number, filter: number) => ((member << 16) | filter) >>> 0;

/** What a question leaves out, or counts. */
export interface Filter {
  /** Whether the glass counts. If not, the question meets only the WORLD group. */
  glass: boolean;
  /** The collider of the one asking, left out; or null, and then it counts like anything else. */
  me: RAPIER.Collider | null;
  /** Solid: a ray that starts inside something hits it at 0. Hollow: it hits its surface from inside. */
  solid: boolean;
}

/** An answer: how far it went, where it touches, the normal of that surface there, and what it is. */
export interface Answer {
  distance: number;
  point: RAPIER.Vector;
  normal: RAPIER.Vector;
  collider: RAPIER.Collider;
}

/** The question's own groups: a member of every group, meeting the world's (and the glass's). */
const meets = (f: Filter) => groups(EVERY, f.glass ? WORLD | GLASS : WORLD);
const UNTURNED = { x: 0, y: 0, z: 0, w: 1 };

/**
 * A RAY: from `from` along `direction` (OF LENGTH 1), as far as `reach`: the FIRST thing it hits.
 * Rapier calls the distance a "time of impact": how many `direction`s it went. With a direction of
 * length 1, that is meters.
 */
export function castRay(
  world: RAPIER.World,
  from: RAPIER.Vector,
  direction: RAPIER.Vector,
  reach: number,
  f: Filter,
): Answer | null {
  const ray = new RAPIER.Ray(from, direction);
  const hit = world.castRayAndGetNormal(
    ray,
    reach,
    f.solid,
    undefined,
    meets(f),
    f.me ?? undefined,
  );
  if (!hit) return null;
  const { timeOfImpact, normal, collider } = hit;
  return { distance: timeOfImpact, point: ray.pointAt(timeOfImpact), normal, collider };
}

/**
 * A SWEEP: a ball of `radius` moved from `from` along `direction` (of length 1), as far as `reach`:
 * where it would FIRST touch something. Nothing moves: it is only a question. A ball that starts
 * already inside something touches it at 0 (`true`: it stops at what it starts in).
 */
export function castBall(
  world: RAPIER.World,
  from: RAPIER.Vector,
  direction: RAPIER.Vector,
  radius: number,
  reach: number,
  f: Filter,
): Answer | null {
  const ball = new RAPIER.Ball(radius);
  const hit = world.castShape(
    from,
    UNTURNED,
    direction,
    ball,
    0,
    reach,
    true,
    undefined,
    meets(f),
    f.me ?? undefined,
  );
  if (!hit) return null;
  return {
    distance: hit.time_of_impact,
    point: hit.witness1,
    normal: hit.normal1,
    collider: hit.collider,
  };
}
