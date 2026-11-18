import { describe, expect, it } from 'vitest';
import { HILLS } from './landscape';
import type { Point } from './line';
import { createScreen, type Screen } from './screen';
import { edge, fillPolygon, fillTriangle, fillTriangle3 } from './triangle';

/**
 * THE BOOK'S CHAPTER 3, as numbers (site/src/content/docs/tutorial/dibujar/03-triangulos.mdx): which side, inside,
 * and above all that triangles sharing an edge paint each pixel of it once, not twice and not never. (`./screen` and
 * `./line` are earlier chapters': the test sees the project as the reader has it at this step; vitest.config.ts.)
 */
const lit = (s: Screen) => {
  const out = new Set<string>();
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) if (s.pixels[4 * (y * s.width + x)] !== 0) out.add(`${x},${y}`);
  return out;
};
const one = (w: number, h: number, a: Point, b: Point, c: Point) => {
  const s = createScreen(w, h);
  fillTriangle(s, a, b, c, [255, 255, 255]);
  return lit(s);
};
/** How many of the triangles paint each pixel: each on its own screen, then counted. */
const coverage = (w: number, h: number, triangles: [Point, Point, Point][]) => {
  const n = new Map<string, number>();
  for (const t of triangles) for (const k of one(w, h, ...t)) n.set(k, (n.get(k) ?? 0) + 1);
  return n;
};
const p = (x: number, y: number): Point => ({ x, y });

describe('which side, and inside', () => {
  it('the side figure: the way A to B and A to P give 28, twice the triangle’s 14', () => {
    expect(edge(p(2, 6), p(10, 2), p(7, 7))).toBe(28);
    expect(edge(p(2, 6), p(10, 2), p(6, 4))).toBe(0); // on the line
    expect(edge(p(2, 6), p(10, 2), p(7, 2))).toBeLessThan(0); // the other side
  });

  it('the triangle (3, 2), (20, 5), (8, 14) paints 94 pixels, for an area of 94.5', () => {
    expect(one(24, 16, p(3, 2), p(20, 5), p(8, 14)).size).toBe(94);
    // Pixel (11, 3)'s centre is on the edge from A to B, which goes down: not a top-left edge, so not this triangle's.
    expect(edge(p(3, 2), p(20, 5), p(11.5, 3.5))).toBe(0);
    expect(one(24, 16, p(3, 2), p(20, 5), p(8, 14)).has('11,3')).toBe(false);
  });

  it('the order of the corners does not matter', () => {
    const [a, b, c] = [p(3, 2), p(20, 5), p(8, 14)];
    expect([...one(24, 16, a, c, b)].sort()).toEqual([...one(24, 16, a, b, c)].sort());
  });
});

describe('two neighbours', () => {
  it('the square cut along its diagonal: every pixel once, none twice, none missed', () => {
    const n = coverage(18, 14, [
      [p(2, 1), p(14, 1), p(14, 13)],
      [p(2, 1), p(14, 13), p(2, 13)],
    ]);
    expect(n.size).toBe(144);
    expect([...n.values()].every((v) => v === 1)).toBe(true);
  });

  it('any four corners cut along a diagonal, in any order: each pixel of the shape painted exactly once', () => {
    let seed = 7;
    const random = (k: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
    for (let trial = 0; trial < 200; trial++) {
      const [a, b, c, d] = [
        p(random(20), random(20)),
        p(random(20), random(20)),
        p(random(20), random(20)),
        p(random(20), random(20)),
      ];
      // The diagonal a–c cuts the quadrilateral in two only when b and d are on its two sides.
      if (Math.sign(edge(a, c, b)) * Math.sign(edge(a, c, d)) >= 0) continue;
      const n = coverage(20, 20, [
        [a, b, c],
        [c, d, a],
      ]);
      expect([...n.values()].every((v) => v === 1)).toBe(true);
    }
  });

  it('the hills share column 100: each of its pixels painted by one hill only', () => {
    const n = coverage(160, 90, HILLS.triangles);
    const column = [...n.entries()].filter(([k]) => k.startsWith('100,'));
    expect(column.length).toBe(30); // rows 52 to 81
    expect(column.every(([, v]) => v === 1)).toBe(true);
  });

  it('a convex polygon as a fan: no pixel twice', () => {
    const hexagon = [p(10, 2), p(18, 6), p(18, 14), p(10, 18), p(2, 14), p(2, 6)];
    const fan = hexagon.slice(1, -1).map((q, k) => [hexagon[0]!, q, hexagon[k + 2]!] as [Point, Point, Point]);
    expect([...coverage(20, 20, fan).values()].every((v) => v === 1)).toBe(true);
    const s = createScreen(20, 20);
    fillPolygon(s, hexagon, [255, 255, 255]);
    expect(lit(s).size).toBe(coverage(20, 20, fan).size);
  });
});

describe('three corners, mixed', () => {
  it('one colour at the three corners stays that colour: the weights add up to one', () => {
    const s = createScreen(24, 16);
    fillTriangle3(s, p(2, 14), p(12, 1), p(22, 14), [90, 140, 200], [90, 140, 200], [90, 140, 200]);
    for (let i = 0; i < s.pixels.length; i += 4)
      if (s.pixels[i] !== 0) expect([s.pixels[i], s.pixels[i + 1], s.pixels[i + 2]]).toEqual([90, 140, 200]);
  });

  it('near each corner, that corner’s colour leads; and in any order of the corners, the same picture', () => {
    const [a, b, c] = [p(2, 14), p(12, 1), p(22, 14)];
    const draw = (order: 'abc' | 'acb') => {
      const s = createScreen(24, 16);
      if (order === 'abc') fillTriangle3(s, a, b, c, [255, 0, 0], [0, 255, 0], [0, 0, 255]);
      else fillTriangle3(s, a, c, b, [255, 0, 0], [0, 0, 255], [0, 255, 0]);
      return s;
    };
    const s = draw('abc');
    const at = (x: number, y: number) =>
      [s.pixels[4 * (y * 24 + x)], s.pixels[4 * (y * 24 + x) + 1], s.pixels[4 * (y * 24 + x) + 2]] as number[];
    expect(at(3, 13)[0]).toBeGreaterThan(200); // by A, red
    expect(at(12, 2)[1]).toBeGreaterThan(200); // by B, green
    expect(at(20, 13)[2]).toBeGreaterThan(200); // by C, blue
    expect([...draw('acb').pixels]).toEqual([...s.pixels]);
  });
});
