import type { Vec3 } from '@manifold/common';

/**
 * A LEVEL DRAWN AS TEXT (stage 3j, format 7): a map of characters, one per cell, for the dungeons a
 * seed will make (3k) and for whoever draws a maze by hand.
 *
 *     map 0 0 0  2 3  G goal  * star
 *     #########
 *     #...#..G#
 *     #.*.....#
 *     ####.####
 *     end
 *
 * The corner where the first row and the first column meet is at `x y z` (y: the floor's top); the
 * columns go along +X, the rows along +Z, `cell` meters each. `#` is a wall, `height` meters tall,
 * standing on the floor; `.` is floor (a slab 0.5 m thick, its top at y); a space is nothing (a pit).
 * Each other character the line gives a zone kind to is floor with that zone on it (as tall as a
 * character).
 */
export interface LevelMap {
  origin: Vec3;
  cell: number;
  height: number;
  /** Which zone each character stands for. */
  legend: Record<string, string>;
  rows: string[];
}

/** A box or a zone a map makes (its center and half size), in the order made. */
export interface MapPart {
  kind: 'wall' | 'floor' | 'zone';
  /** The zone's kind, for a zone. */
  zone?: string;
  center: Vec3;
  half: Vec3;
}

/** How thick a floor is, and how tall a zone on it. */
export const FLOOR_THICKNESS = 0.5;
const FLOOR = FLOOR_THICKNESS;
const ZONE = 1.6;

/**
 * The boxes and zones a map makes: its walls first, then its floor, then its zones, each made of as
 * few boxes as rectangles cover it (runs along each row, joined with the same run in the rows after:
 * a room of 10 by 10 is one floor, not 100). The same map, the same parts, in the same order.
 *
 * The floor goes under the walls too: where the floor and the walls make a rectangle, one slab. Two
 * slabs side by side meet at a seam, and what rolls across it hops: the physics finds the next slab's
 * edge, and pushes it up (measured in the maze, drawn floor between its walls in 17 slabs: a ball at
 * 6 m/s, up to 42 cm; on its one slab, nothing). An irregular floor (a dungeon's rooms and corridors)
 * still has seams: Rapier mends them only within one body (a compound, `FIX_INTERNAL_EDGES`), and a
 * map's slabs are each an entity's.
 */
export function mapParts(g: LevelMap): MapPart[] {
  const width = Math.max(0, ...g.rows.map((r) => r.length));
  const at = (row: number, col: number) => g.rows[row]?.[col] ?? ' ';
  const parts: MapPart[] = [];
  /** The rectangles that cover the cells `is` says, left to right and top to bottom. */
  const rectangles = (is: (c: string) => boolean) => {
    const taken = g.rows.map(() => new Array<boolean>(width).fill(false));
    const out: { row: number; col: number; rows: number; cols: number }[] = [];
    for (let row = 0; row < g.rows.length; row++)
      for (let col = 0; col < width; col++) {
        if (taken[row]![col] || !is(at(row, col))) continue;
        let cols = 1;
        while (col + cols < width && !taken[row]![col + cols] && is(at(row, col + cols))) cols++;
        let rows = 1;
        const fits = (r: number) => {
          for (let c = col; c < col + cols; c++) if (taken[r]![c] || !is(at(r, c))) return false;
          return true;
        };
        while (row + rows < g.rows.length && fits(row + rows)) rows++;
        for (let r = row; r < row + rows; r++) for (let c = col; c < col + cols; c++) taken[r]![c] = true;
        out.push({ row, col, rows, cols });
      }
    return out;
  };
  const [x0, y0, z0] = g.origin;
  const place = (r: { row: number; col: number; rows: number; cols: number }, bottom: number, tall: number) => ({
    center: [x0 + (r.col + r.cols / 2) * g.cell, bottom + tall / 2, z0 + (r.row + r.rows / 2) * g.cell] as Vec3,
    half: [(r.cols * g.cell) / 2, tall / 2, (r.rows * g.cell) / 2] as Vec3,
  });
  for (const r of rectangles((c) => c === '#')) parts.push({ kind: 'wall', ...place(r, y0, g.height) });
  for (const r of rectangles((c) => c !== ' ')) parts.push({ kind: 'floor', ...place(r, y0 - FLOOR, FLOOR) });
  for (const [char, zone] of Object.entries(g.legend))
    for (const r of rectangles((c) => c === char)) parts.push({ kind: 'zone', zone, ...place(r, y0, ZONE) });
  return parts;
}
