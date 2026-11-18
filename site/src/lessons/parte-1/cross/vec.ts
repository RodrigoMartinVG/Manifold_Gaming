/**
 * VECTORS (the previous lessons'), the dot product, and now the cross product: a vector perpendicular to
 * two others, as long as the area of their parallelogram, whose sense says how they are turned. Each
 * operation makes a new vector: nothing here changes a vector it was given.
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
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * a × b, THE CROSS PRODUCT. Each component is the signed area of the parallelogram's shadow on one of the
 * coordinate planes, in the cyclic order: x from the yz plane, y from zx, z from xy.
 */
export const cross = (a: Vec, b: Vec): Vec =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** [a, b, c] = (a × b) · c, THE TRIPLE PRODUCT: the signed volume of the box on a, b and c. */
export const triple = (a: Vec, b: Vec, c: Vec): number => dot(cross(a, b), c);

/**
 * ON THE FLOOR, ON WHICH SIDE of a facing f a point at t (from the eye) is: the y component of f × t,
 * f_z t_x − f_x t_z, the signed area of their parallelogram seen from above. Positive: to the left.
 */
export function side(f: Vec, t: Vec): 'left' | 'right' | 'in line' {
  const s = f.z * t.x - f.x * t.z;
  return s > 0 ? 'left' : s < 0 ? 'right' : 'in line';
}
