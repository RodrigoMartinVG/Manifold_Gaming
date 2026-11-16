/** A vector: three numbers, how much along x, along y and along z. */
export interface Vec {
  x: number;
  y: number;
  z: number;
}

/** Takes three numbers and gives a vector: the annotations say so. */
export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z });

/** How long it is, by Pythagoras. It takes a Vec and gives a number. */
export function length(a: Vec): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}
