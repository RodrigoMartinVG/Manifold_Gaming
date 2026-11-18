/**
 * VECTORS: three numbers that say how much along x, along y and along z (the previous lesson's), and now
 * the dot product and what it is for: how much of one vector goes along another, and how much is left
 * across. Each operation makes a new vector: nothing here changes a vector it was given.
 */
export interface Vec {
  x: number;
  y: number;
  z: number;
}

export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec, k: number): Vec => vec(a.x * k, a.y * k, a.z * k);
export const length = (a: Vec): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export function normalize(a: Vec): Vec {
  const l = length(a);
  return l === 0 ? vec(0, 0, 0) : scale(a, 1 / l);
}

/** a · b: each component times the other's, added. A number, not a vector. */
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * a∥b, THE PROJECTION of a on b's line: (a · b / b · b) b, the shadow of a on that line. b need not be of
 * length 1 (the division by b · b takes care of it); onto the zero vector there is no line: zero.
 */
export function project(a: Vec, b: Vec): Vec {
  const bb = dot(b, b);
  return bb === 0 ? vec(0, 0, 0) : scale(b, dot(a, b) / bb);
}

/** a⊥b, THE REJECTION: what is left of a across b's line, a − a∥b. Perpendicular to b. */
export const reject = (a: Vec, b: Vec): Vec => sub(a, project(a, b));

/** In front of an eye at E looking along f: the way to T has a positive part along f. */
export const inFront = (e: Vec, f: Vec, t: Vec): boolean => dot(f, sub(t, e)) > 0;

/**
 * INSIDE A CONE of half-angle α around f, from E: the angle between f and the way to T is at most α, which
 * is f̂ · (T − E) ≥ |T − E| cos α. cos α is given, computed once, so no angle is ever worked out.
 */
export function inCone(e: Vec, f: Vec, t: Vec, cosAlpha: number): boolean {
  const toT = sub(t, e);
  return dot(normalize(f), toT) >= length(toT) * cosAlpha;
}
