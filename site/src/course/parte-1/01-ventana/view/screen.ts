import type { Point } from '../world';

/**
 * FROM A POINT TO THE SCREEN, with our own numbers: what the graphics card does for every vertex.
 * The camera is at `eye`, looking along −Z, with a vertical field of view of `fov` degrees, on a
 * picture `width` × `height` pixels. Null for a point that is not in front of the camera.
 */
export function toScreen(p: Point, eye: Point, fov: number, width: number, height: number) {
  // 1. Seen from the camera: the point minus where the camera is.
  const x = p.x - eye.x;
  const y = p.y - eye.y;
  const depth = eye.z - p.z; // how far in front (the camera looks along −Z)
  if (depth <= 0) return null;
  // 2. On a screen 1 m in front of the eye (similar triangles): divide by the depth.
  const sx = x / depth;
  const sy = y / depth;
  // 3. That screen's half height is tan(fov / 2); its half width, that times the proportions.
  const half = Math.tan((fov * Math.PI) / 360);
  const u = sx / (half * (width / height)); // −1 at the left edge, 1 at the right one
  const v = sy / half; // −1 at the bottom, 1 at the top
  // 4. To pixels: from the left, and from the TOP (screens count downwards).
  return { x: ((u + 1) / 2) * width, y: ((1 - v) / 2) * height, depth };
}
