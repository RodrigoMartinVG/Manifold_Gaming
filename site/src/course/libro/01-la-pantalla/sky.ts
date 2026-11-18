import { seeded } from './herramientas/random';
import type { Colour } from './screen';

/** A star: one pixel, and how bright (0 to 255, the same in red, green and blue: white or grey). */
export interface Star {
  x: number;
  y: number;
  light: number;
}

/** A rectangle of the picture, and its colour. */
export interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  colour: Colour;
}

/** The picture's size, in pixels: small, so each pixel can be seen. */
export const WIDTH = 160;
export const HEIGHT = 90;

const MOON = { x: 122.5, y: 22.5, r: 9.4, colour: [242, 228, 186] as Colour };
const DARK: Colour = [14, 12, 20];

/**
 * THE TOWER, black against the sky: the ground, the body, its top and four merlons, and one lit window.
 * Plain numbers: what draws it, ours or the canvas's, reads them.
 */
const TOWER: Block[] = [
  { x: 0, y: 82, width: WIDTH, height: 8, colour: DARK },
  { x: 28, y: 34, width: 16, height: 48, colour: DARK },
  { x: 25, y: 30, width: 22, height: 5, colour: DARK },
  ...[25, 31, 37, 43].map((x) => ({ x, y: 26, width: 4, height: 4, colour: DARK })),
  { x: 34, y: 44, width: 3, height: 5, colour: [255, 190, 92] },
];

/** The stars: `count` of them, from the seed, never on the moon nor behind the tower. */
function stars(count: number, seed: number): Star[] {
  const random = seeded(seed);
  const out: Star[] = [];
  while (out.length < count) {
    const x = Math.floor(random() * WIDTH);
    const y = Math.floor(random() * 76);
    const light = 110 + Math.floor(random() * 146);
    const onMoon = Math.hypot(x + 0.5 - MOON.x, y + 0.5 - MOON.y) < MOON.r + 2;
    const onTower = x >= 24 && x < 48 && y >= 25;
    if (!onMoon && !onTower) out.push({ x, y, light });
  }
  return out;
}

/** THE NIGHT SKY, as data: the colours of its top and bottom, its stars, its moon and the tower. */
export const SKY = {
  top: [8, 11, 30] as Colour,
  bottom: [52, 48, 96] as Colour,
  stars: stars(70, 2026),
  moon: MOON,
  tower: TOWER,
};
