import { setPixel, type Colour, type Screen } from './screen';

/** A point of the screen, in its coordinates: pixel (x, y) is the square from (x, y) to (x + 1, y + 1). */
export interface Point {
  x: number;
  y: number;
}

/** The point `t` of the way from `a` to `b`: `a` at 0, `b` at 1, and (1 − t)·a + t·b in general. */
export function lerp(a: Point, b: Point, t: number): Point {
  return { x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y };
}

/**
 * A LINE from `a` to `b`, one pixel wide. As many steps as the longer side, rounded up: each step then moves
 * at most one pixel across and one down, so consecutive points land in pixels that touch, and no pixel is
 * skipped, in any direction. Each point paints the pixel that contains it. (The DDA.)
 */
export function drawLine(s: Screen, a: Point, b: Point, c: Colour) {
  const n = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
  for (let k = 0; k <= n; k++) {
    const p = lerp(a, b, n === 0 ? 0 : k / n);
    setPixel(s, Math.floor(p.x), Math.floor(p.y), c);
  }
}

/** Points joined in order, each to the next; and the last to the first, if `closed`. */
export function drawPolyline(s: Screen, points: readonly Point[], c: Colour, closed = false) {
  for (let k = 0; k + 1 < points.length; k++) drawLine(s, points[k]!, points[k + 1]!, c);
  if (closed && points.length > 2) drawLine(s, points[points.length - 1]!, points[0]!, c);
}
