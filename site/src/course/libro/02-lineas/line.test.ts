import { describe, expect, it } from 'vitest';
import { createScreen } from './screen';
import { drawLine, drawPolyline, lerp } from './line';

/**
 * THE BOOK'S CHAPTER 2, as numbers (site/src/content/docs/tutorial/libro/02-lineas.mdx): the point that travels,
 * and a line with no holes and no pixel too many, in every direction. (`./screen` is chapter 1's: the test sees
 * the project as the reader has it at this step; vitest.config.ts.)
 */
const lit = (s: ReturnType<typeof createScreen>) => {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) if (s.pixels[4 * (y * s.width + x)] !== 0) out.push({ x, y });
  return out;
};

describe('the point that travels', () => {
  it('is the midpoint at ½, a quarter of the way at ¼, and keeps going past B', () => {
    const [A, B] = [
      { x: 2, y: 3 },
      { x: 10, y: 7 },
    ];
    expect(lerp(A, B, 0.5)).toEqual({ x: 6, y: 5 });
    expect(lerp(A, B, 0.25)).toEqual({ x: 4, y: 4 });
    expect(lerp(A, B, 1.5)).toEqual({ x: 14, y: 9 });
  });
});

describe('a line as many steps long as its longer side', () => {
  it('from pixel (3, 2) to pixel (8, 13): twelve pixels', () => {
    const s = createScreen(24, 16);
    drawLine(s, { x: 3.5, y: 2.5 }, { x: 8.5, y: 13.5 }, [255, 255, 255]);
    expect(lit(s).length).toBe(12);
  });

  it('in every direction, joins its two ends with max(|dx|, |dy|) + 1 pixels that touch', () => {
    for (let ax = 0; ax < 12; ax += 3)
      for (let ay = 0; ay < 12; ay += 4)
        for (let bx = 0; bx < 12; bx++)
          for (let by = 0; by < 12; by++) {
            const s = createScreen(12, 12);
            drawLine(s, { x: ax + 0.5, y: ay + 0.5 }, { x: bx + 0.5, y: by + 0.5 }, [255, 255, 255]);
            const px = lit(s);
            expect(px.length).toBe(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) + 1);
            expect(px.some((p) => p.x === ax && p.y === ay)).toBe(true);
            expect(px.some((p) => p.x === bx && p.y === by)).toBe(true);
            // Every pixel touches another (at least at a corner), unless it is the only one.
            if (px.length > 1)
              for (const p of px)
                expect(px.some((q) => q !== p && Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1)).toBe(true);
          }
  });

  it('closes a polyline from the last point back to the first', () => {
    const open = createScreen(12, 12);
    const closed = createScreen(12, 12);
    const square = [
      { x: 1.5, y: 1.5 },
      { x: 9.5, y: 1.5 },
      { x: 9.5, y: 9.5 },
      { x: 1.5, y: 9.5 },
    ];
    drawPolyline(open, square, [255, 255, 255]);
    drawPolyline(closed, square, [255, 255, 255], true);
    expect(lit(open).length).toBe(25); // three sides of 9, sharing two corners
    expect(lit(closed).length).toBe(32); // the fourth side adds 7
  });
});
