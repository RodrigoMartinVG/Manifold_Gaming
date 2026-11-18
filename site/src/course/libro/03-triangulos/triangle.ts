import type { Point } from './line';
import { setPixel, type Colour, type Screen } from './screen';

/**
 * WHICH SIDE of the line from `a` to `b` the point `p` is on: dx₁·dy₂ − dy₁·dx₂, with (dx₁, dy₁) the way from `a`
 * to `b` and (dx₂, dy₂) the way from `a` to `p`. Positive on one side, negative on the other, zero on the line; and,
 * without its sign, twice the area of the triangle a, b, p.
 */
export function edge(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/**
 * THE TOP-LEFT RULE, for a pixel whose centre is exactly on an edge (its sign is 0): it belongs to the triangle only
 * if the edge is a top one or a left one. With the corners in the order whose area is positive (clockwise on the
 * screen, where y goes down), a top edge goes rightwards along a row, and a left edge goes up. Two triangles that
 * share an edge walk it in opposite directions, so exactly one of them takes each such pixel.
 */
function topLeft(a: Point, b: Point): boolean {
  const dy = b.y - a.y;
  return dy < 0 || (dy === 0 && b.x - a.x > 0);
}

/**
 * Calls `paint(x, y, wa, wb, wc)` for every pixel of the screen whose centre is inside the triangle a, b, c (by the
 * three signs, and the top-left rule on its edges), asking only the pixels in the box round it. `wa`, `wb` and `wc`
 * are the centre's weights for a, b and c: the shares of the area of the three triangles it cuts, adding up to 1.
 */
function eachPixel(
  s: Screen,
  a: Point,
  b: Point,
  c: Point,
  paint: (x: number, y: number, wa: number, wb: number, wc: number) => void,
) {
  // The corners in the order whose area is positive; the weights are given back in the order they came.
  const swap = edge(a, b, c) < 0;
  if (swap) [b, c] = [c, b];
  const area = edge(a, b, c);
  if (area === 0) return; // three corners on one line: no inside
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const x1 = Math.min(s.width, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const y1 = Math.min(s.height, Math.ceil(Math.max(a.y, b.y, c.y)));
  const takes = (u: Point, v: Point, w: number) => w > 0 || (w === 0 && topLeft(u, v));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = { x: x + 0.5, y: y + 0.5 };
      const [wa, wb, wc] = [edge(b, c, p), edge(c, a, p), edge(a, b, p)];
      if (takes(b, c, wa) && takes(c, a, wb) && takes(a, b, wc))
        if (swap) paint(x, y, wa / area, wc / area, wb / area);
        else paint(x, y, wa / area, wb / area, wc / area);
    }
}

/** A solid triangle, one colour. */
export function fillTriangle(s: Screen, a: Point, b: Point, c: Point, colour: Colour) {
  eachPixel(s, a, b, c, (x, y) => setPixel(s, x, y, colour));
}

/** A triangle whose colour is its three corners' colours, mixed at each pixel in that pixel's weights. */
export function fillTriangle3(s: Screen, a: Point, b: Point, c: Point, ca: Colour, cb: Colour, cc: Colour) {
  eachPixel(s, a, b, c, (x, y, wa, wb, wc) =>
    setPixel(s, x, y, [
      Math.round(wa * ca[0] + wb * cb[0] + wc * cc[0]),
      Math.round(wa * ca[1] + wb * cb[1] + wc * cc[1]),
      Math.round(wa * ca[2] + wb * cb[2] + wc * cc[2]),
    ]),
  );
}

/** A convex polygon, as triangles fanned from its first corner: a fan never paints a pixel twice, nor leaves a gap. */
export function fillPolygon(s: Screen, points: readonly Point[], colour: Colour) {
  for (let k = 1; k + 1 < points.length; k++) fillTriangle(s, points[0]!, points[k]!, points[k + 1]!, colour);
}
