import { add, dot, length, normalize, sub, vec, type Vec } from './vec';
import type { World } from './world';

/**
 * WHERE THE TURRET CAN LOOK, without rotations (they come in chapter 3): one of eight headings, the
 * compass's, from north (−Z) turning right. Each is a direction on the floor, one long: the diagonals are
 * (±1, 0, ±1) normalized, √2 long before. Turning right is the next one; left, the one before.
 */
export const HEADINGS: readonly Vec[] = [
  vec(0, 0, -1),
  vec(1, 0, -1),
  vec(1, 0, 0),
  vec(1, 0, 1),
  vec(0, 0, 1),
  vec(-1, 0, 1),
  vec(-1, 0, 0),
  vec(-1, 0, -1),
].map(normalize);
export const HEADING_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Its forward: the heading it faces. (Naive, without normalizing: the diagonals √2 long.) */
export function forwardOf(world: World, normalized = true): Vec {
  const k = ((world.turret.heading % 8) + 8) % 8;
  return normalized ? HEADINGS[k]! : vec(Math.sign(HEADINGS[k]!.x), 0, Math.sign(HEADINGS[k]!.z));
}

/** Where its eye is: over its position, at its eye's height. */
export const eyeOf = (world: World): Vec => add(world.turret.position, vec(0, world.turret.eye, 0));

/** In front: the way to the target has a positive part along the forward. */
export const inFront = (eye: Vec, f: Vec, t: Vec): boolean => dot(f, sub(t, eye)) > 0;

/** Inside the cone of half angle α: f · (T − E) ≥ |T − E| cos α, for f one long. */
export function inCone(eye: Vec, f: Vec, t: Vec, cosAlpha: number): boolean {
  const toT = sub(t, eye);
  return dot(f, toT) >= length(toT) * cosAlpha;
}

/** What the turret knows of a target. */
export interface Seen {
  id: string;
  front: boolean;
  inside: boolean;
}

/** WHAT THE TURRET KNOWS of each target: in front or behind, inside its cone or not. */
export function classify(world: World, o: { normalize?: boolean } = {}): Seen[] {
  const eye = eyeOf(world);
  const f = forwardOf(world, o.normalize ?? true);
  return world.targets.map((target) => ({
    id: target.id,
    front: inFront(eye, f, target.position),
    inside: inCone(eye, f, target.position, world.turret.cone.cos),
  }));
}

/** The heading nearest the way to a point: the one whose dot product with that way is the largest. */
export function headingTowards(world: World, to: Vec): number {
  const way = normalize(sub(to, eyeOf(world)));
  let best = 0;
  for (let k = 1; k < HEADINGS.length; k++) if (dot(HEADINGS[k]!, way) > dot(HEADINGS[best]!, way)) best = k;
  return best;
}
