/** A colour: how bright its red, green and blue lights are, each from 0 (off) to 255. */
export type Colour = readonly [number, number, number];

/**
 * OUR SCREEN: a grid of pixels kept in memory as one long line of numbers, four per pixel (red, green, blue,
 * and how opaque, always 255 here), row after row. Pixel (x, y) starts at 4 · (y · width + x). Its square
 * goes from (x, y) to (x + 1, y + 1), and its centre is (x + ½, y + ½).
 */
export interface Screen {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export function createScreen(width: number, height: number): Screen {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255; // every pixel opaque
  return { width, height, pixels };
}

/** The colour `t` of the way from `a` to `b`: `a` at 0, `b` at 1, and between, a mix of the two. */
export function mix(a: Colour, b: Colour, t: number): Colour {
  return [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], (1 - t) * a[2] + t * b[2]];
}

/** Mixes `c` into pixel (x, y): `amount` 0 leaves it as it was, 1 paints it `c`. Off the screen, nothing. */
export function mixPixel(s: Screen, x: number, y: number, c: Colour, amount = 1) {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return;
  const i = 4 * (y * s.width + x);
  const now: Colour = [s.pixels[i]!, s.pixels[i + 1]!, s.pixels[i + 2]!];
  const m = mix(now, c, amount);
  s.pixels[i] = Math.round(m[0]);
  s.pixels[i + 1] = Math.round(m[1]);
  s.pixels[i + 2] = Math.round(m[2]);
}

/** Paints pixel (x, y) with `c`. */
export function setPixel(s: Screen, x: number, y: number, c: Colour) {
  mixPixel(s, x, y, c, 1);
}

/** The sky, from `top` to `bottom`: each row mixes the two by how far down its centre is. */
export function verticalGradient(s: Screen, top: Colour, bottom: Colour) {
  for (let y = 0; y < s.height; y++) {
    const c = mix(top, bottom, (y + 0.5) / s.height);
    for (let x = 0; x < s.width; x++) setPixel(s, x, y, c);
  }
}

/** Every pixel whose centre falls inside the rectangle from (x, y), `w` wide and `h` high. */
export function fillRect(s: Screen, x: number, y: number, w: number, h: number, c: Colour) {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(s.height, Math.ceil(y + h)); j++)
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(s.width, Math.ceil(x + w)); i++)
      if (i + 0.5 >= x && i + 0.5 < x + w && j + 0.5 >= y && j + 0.5 < y + h) setPixel(s, i, j, c);
}

/**
 * A circle of centre (cx, cy) and radius r. Each pixel is mixed with `c` in the share of it the circle
 * covers, measured with `samples` × `samples` points spread evenly over the pixel: with 1, only its centre
 * (the edge in steps); with more, the edge soft. Only the pixels in the square round the circle are asked.
 */
export function fillCircle(s: Screen, cx: number, cy: number, r: number, c: Colour, samples = 1) {
  const n = Math.max(1, Math.round(samples));
  for (let j = Math.floor(cy - r); j <= Math.floor(cy + r); j++)
    for (let i = Math.floor(cx - r); i <= Math.floor(cx + r); i++) {
      let hits = 0;
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++) {
          const dx = i + (a + 0.5) / n - cx;
          const dy = j + (b + 0.5) / n - cy;
          if (dx * dx + dy * dy <= r * r) hits++; // Pythagoras, without the square root: d² ≤ r²
        }
      if (hits > 0) mixPixel(s, i, j, c, hits / (n * n));
    }
}
