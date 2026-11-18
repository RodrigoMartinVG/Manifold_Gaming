/**
 * THE PROJECT'S VECTORS: three numbers that say how much along x, along y and along z (lesson 1.4), and the
 * two products (1.5 and 1.6). Each operation makes a new vector: nothing here changes a vector it was given.
 */
export interface Vec {
  x: number;
  y: number;
  z: number;
}

export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z });

/** a + b: one displacement after the other. */
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y, a.z + b.z);

/** a − b: what takes you from b to a. */
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y, a.z - b.z);

/** k · a: the same direction, k times as long (backwards if k is negative). */
export const scale = (a: Vec, k: number): Vec => vec(a.x * k, a.y * k, a.z * k);

/** |a|: how long it is, by Pythagoras. */
export const length = (a: Vec): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/** â = a / |a|: the same direction, 1 long. The zero vector has no direction: it stays zero. */
export function normalize(a: Vec): Vec {
  const l = length(a);
  return l === 0 ? vec(0, 0, 0) : scale(a, 1 / l);
}

/** a · b: |a| |b| cos θ. Zero: perpendicular; its sign: whether they point the same way. */
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** a × b: perpendicular to both, as long as their parallelogram's area; (a, b, a × b) is right-handed. */
export const cross = (a: Vec, b: Vec): Vec => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
