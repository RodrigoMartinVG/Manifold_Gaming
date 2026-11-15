import * as THREE from 'three';

/** How high the bowl is at a distance `r` from its middle: y = 0.08 · r², a gentle paraboloid. */
export const surface = (r: number) => 0.02 + 0.08 * r * r;

/**
 * A BOWL, as triangles: one point in the middle and rings of points around it. The same triangles
 * are drawn and handed to the physics (a triangle mesh): what is seen is what the balls roll on.
 * Each ring closes on itself (its last point joins its first), so there is no seam to trip on.
 */
export function bowlGeometry(radius = 6, rings = 24, around = 48): THREE.BufferGeometry {
  const points = [0, surface(0), 0];
  for (let i = 1; i <= rings; i++) {
    const r = (radius * i) / rings;
    for (let j = 0; j < around; j++) {
      const angle = (2 * Math.PI * j) / around;
      points.push(r * Math.cos(angle), surface(r), r * Math.sin(angle));
    }
  }
  /** The index of point `j` of ring `i` (the rings count from 1; the middle is 0). */
  const at = (i: number, j: number) => 1 + (i - 1) * around + (j % around);
  const triangles: number[] = [];
  for (let j = 0; j < around; j++) triangles.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < around; j++) {
      triangles.push(at(i, j), at(i, j + 1), at(i + 1, j + 1));
      triangles.push(at(i, j), at(i + 1, j + 1), at(i + 1, j));
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

/** Lines over the bowl, a ring every meter and some spokes, so that its curve is seen. */
export function bowlLines(radius = 6): THREE.BufferGeometry {
  const at = (r: number, angle: number) =>
    new THREE.Vector3(r * Math.cos(angle), surface(r) + 0.03, r * Math.sin(angle));
  const points: THREE.Vector3[] = [];
  const turn = (j: number, n: number) => (2 * Math.PI * j) / n;
  for (let r = 1; r <= radius; r++)
    for (let j = 0; j < 96; j++) points.push(at(r, turn(j, 96)), at(r, turn(j + 1, 96)));
  for (let j = 0; j < 12; j++)
    for (let k = 0; k < 24; k++)
      points.push(at((radius * k) / 24, turn(j, 12)), at((radius * (k + 1)) / 24, turn(j, 12)));
  return new THREE.BufferGeometry().setFromPoints(points);
}
