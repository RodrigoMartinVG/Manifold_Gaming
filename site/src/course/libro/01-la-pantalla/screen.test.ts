import { describe, expect, it } from 'vitest';
import { createScreen, fillCircle, fillRect, mix, setPixel, verticalGradient, type Colour, type Screen } from './screen';

/**
 * THE BOOK'S CHAPTER 1, as numbers (site/src/content/docs/tutorial/dibujar/01-la-pantalla.mdx): what the text says
 * our screen does, it does.
 */
const MOON: Colour = [240, 226, 182];
const painted = (s: Screen) => {
  let n = 0;
  for (let i = 0; i < s.pixels.length; i += 4) if (s.pixels[i] !== 0) n++;
  return n;
};

describe('our screen', () => {
  it('is a line of numbers, four per pixel, every pixel opaque', () => {
    const s = createScreen(160, 90);
    expect(s.pixels.length).toBe(160 * 90 * 4);
    expect(s.pixels.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true);
  });

  it('keeps pixel (10, 2) of a picture 160 wide at 1320, and number 1000 is the red of (90, 1)', () => {
    const s = createScreen(160, 90);
    setPixel(s, 10, 2, [7, 8, 9]);
    expect([s.pixels[1320], s.pixels[1321], s.pixels[1322]]).toEqual([7, 8, 9]);
    setPixel(s, 90, 1, [5, 0, 0]);
    expect(s.pixels[1000]).toBe(5);
  });

  it('paints a rectangle by its pixels’ centres: at whole numbers, width × height pixels', () => {
    const s = createScreen(24, 16);
    fillRect(s, 4, 3, 10, 7, MOON);
    expect(painted(s)).toBe(70);
  });

  it('at x = 4.5 paints column 4 (its centre, 4.5, is inside) and not column 14', () => {
    const s = createScreen(24, 16);
    fillRect(s, 4.5, 3, 10, 7, MOON);
    const at = (x: number, y: number) => s.pixels[4 * (y * 24 + x)];
    expect(at(4, 5)).toBe(MOON[0]);
    expect(at(14, 5)).toBe(0);
    expect(painted(s)).toBe(70);
  });

  it('paints 80 pixels for the circle of centre (10, 7) and radius 5, asking only their centres', () => {
    const s = createScreen(20, 14);
    fillCircle(s, 10, 7, 5, MOON, 1);
    expect(painted(s)).toBe(80);
    const inside = (x: number, y: number) => s.pixels[4 * (y * 20 + x)] !== 0;
    expect(inside(13, 10)).toBe(true); // d = √24.5 ≈ 4.95
    expect(inside(14, 10)).toBe(false); // d = √32.5 ≈ 5.70
  });

  it('with n × n samples, paints an edge pixel in one of n² + 1 shares, and an inner one whole', () => {
    const s = createScreen(24, 16);
    fillCircle(s, 12, 8, 5.3, [255, 255, 255], 4);
    expect([s.pixels[4 * (8 * 24 + 12)]]).toEqual([255]); // the centre: all 16 points inside
    // From black to white, a pixel covered by k of the 16 points is round(255 · k / 16): one of 17 levels.
    const levels = new Set(Array.from({ length: 17 }, (_, k) => Math.round((255 * k) / 16)));
    const shares = new Set<number>();
    for (let i = 0; i < s.pixels.length; i += 4) shares.add(s.pixels[i]!);
    for (const v of shares) expect(levels.has(v), `${v} is one of the 17 levels`).toBe(true);
    expect(shares.size).toBeGreaterThan(2); // more than "all or nothing"
  });

  it('mixes two colours with weights 1 − t and t, and paints the sky row by row', () => {
    expect(mix([0, 0, 0], [200, 100, 50], 0.25)).toEqual([50, 25, 12.5]);
    const s = createScreen(1, 4);
    verticalGradient(s, [0, 0, 0], [80, 80, 80]);
    expect([0, 1, 2, 3].map((y) => s.pixels[4 * y])).toEqual([10, 30, 50, 70]); // t = (y + ½) / 4
  });
});
