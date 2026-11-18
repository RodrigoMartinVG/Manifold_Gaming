/** VECTORS, and the dot product: how much of one goes along the other (chapter 2). */
export interface Vec {
  x: number;
  y: number;
  z: number;
}
export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z });
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec, k: number): Vec => vec(a.x * k, a.y * k, a.z * k);
export const length = (a: Vec): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export function normalize(a: Vec): Vec {
  const l = length(a);
  return l === 0 ? vec(0, 0, 0) : scale(a, 1 / l);
}
/** a · b: each component times the other's, added. */
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z;
