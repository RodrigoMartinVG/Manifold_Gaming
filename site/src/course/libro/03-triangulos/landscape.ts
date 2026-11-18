import type { Point } from './line';
import type { Colour } from './screen';

/**
 * THE HILLS, behind the tower: two triangles of one colour that share an edge, the vertical one at x = 100.5. Every
 * pixel centre of column 100 lies exactly on it: the top-left rule gives each of them to one triangle only (the right
 * one, whose edge goes up).
 */
export const HILLS = {
  colour: [20, 18, 34] as Colour,
  triangles: [
    [
      { x: 56, y: 82 },
      { x: 100.5, y: 52 },
      { x: 100.5, y: 82 },
    ],
    [
      { x: 100.5, y: 52 },
      { x: 150, y: 82 },
      { x: 100.5, y: 82 },
    ],
  ] as [Point, Point, Point][],
};

/** A STAINED-GLASS WINDOW in the tower: one triangle, a colour at each corner, mixed between them. */
export const WINDOW = {
  corners: [
    { x: 32, y: 64 },
    { x: 36, y: 55 },
    { x: 40, y: 64 },
  ] as [Point, Point, Point],
  colours: [
    [200, 50, 60],
    [60, 180, 90],
    [70, 100, 230],
  ] as [Colour, Colour, Colour],
};
