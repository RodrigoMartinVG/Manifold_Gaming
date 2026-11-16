/** A point of the world, in meters: x to the right, y up, z towards whoever looks at the screen. */
export interface Point {
  x: number;
  y: number;
  z: number;
}

/** A point of the image plane, in meters from its center: x to the right, y up. */
export interface Flat {
  x: number;
  y: number;
}

/**
 * THE FOUR STEPS OF THE PROJECTION, one function each: the same four lines as `toScreen` in the
 * project. The eye is not turned: its right is +X, its up is +Y, and it looks along −Z.
 */

/** 1. SEEN FROM THE EYE: the point minus where the eye is. */
export function fromEye(p: Point, eye: Point): Point {
  return { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
}

/** The depth of a point seen from the eye: how far in front of it (it looks along −Z). */
export function depthOf(c: Point) {
  return -c.z;
}

/** 2. ON THE IMAGE PLANE, 1 m in front of the eye: divide by the depth. Null if not in front. */
export function onPlane(c: Point): Flat | null {
  const d = depthOf(c);
  if (d <= 0) return null;
  return { x: c.x / d, y: c.y / d };
}

/** Half the height of the image plane that is seen: tan(fov / 2), the field of view in degrees. */
export function halfHeight(fov: number) {
  return Math.tan((fov * Math.PI) / 360); // fov / 2, in radians
}

/** 3. NORMALIZED: −1 and 1 at the picture's edges. `aspect` is its width over its height. */
export function normalized(q: Flat, fov: number, aspect: number) {
  const h = halfHeight(fov);
  return { u: q.x / (aspect * h), v: q.y / h };
}

/** 4. TO PIXELS: from the left, and from the TOP (screens count downwards). */
export function toPixels(n: { u: number; v: number }, width: number, height: number): Flat {
  return { x: ((n.u + 1) / 2) * width, y: ((1 - n.v) / 2) * height };
}

/**
 * THE VANISHING POINT of the lines that go along `w` (how much x, y and z change per step along
 * them): where their pictures meet on the image plane. Null if they do not go away from the eye.
 */
export function vanishingPoint(w: { x: number; y: number; z: number }): Flat | null {
  if (w.z >= 0) return null;
  return { x: w.x / -w.z, y: w.y / -w.z };
}

/** The horizontal field of view, in degrees, that goes with a vertical one on that picture. */
export function horizontalFov(fov: number, aspect: number) {
  return (2 * Math.atan(aspect * halfHeight(fov)) * 180) / Math.PI;
}
