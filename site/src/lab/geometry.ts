/**
 * The kit's pure geometry, with no drawing: what the figures need to compute, tested apart.
 */

/** Something with three coordinates: a three.js `Vector3`, or the tutorial's own `{ x, y, z }`. */
export interface V3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Where a ray meets a plane: the `t` with n · (origin + t · direction) + d = 0, or null if the ray is
 * parallel to the plane or meets it behind its origin. The plane is [n | d]: the points X with n · X + d = 0.
 */
export function rayPlane(origin: V3, direction: V3, normal: V3, d: number): number | null {
  const along = normal.x * direction.x + normal.y * direction.y + normal.z * direction.z;
  if (Math.abs(along) < 1e-12) return null;
  const t = -(normal.x * origin.x + normal.y * origin.y + normal.z * origin.z + d) / along;
  return t >= 0 ? t : null;
}

/**
 * How far to move the picture's centre to the left so it falls in the middle of what the panel leaves:
 * half the panel's width, and never more than a quarter of the picture (on a narrow screen the panel
 * covers it anyway, and a figure pushed off the edge is worse).
 */
export function centreShift(width: number, panelWidth: number): number {
  return Math.max(0, Math.min(panelWidth / 2, width / 4));
}
