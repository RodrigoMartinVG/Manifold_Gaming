import type { Vec3 } from '@manifold/common';

/** A color as three numbers from 0 to 1, as it is written (sRGB). */
export type Rgb = readonly [number, number, number];

/**
 * THE SKY AT AN HOUR (stage 5a; decision 0029: the three games are one night, from dusk to dawn): its
 * colors, where the sun and the moon are, how many stars are out, and the color and the way of the
 * light. Pure: the drawing (`stage.ts`) paints a dome with it and colors and turns its lights by it,
 * and a test holds it. Only how the world looks: how lit it is (what a watcher sees by) is the level's
 * `ambient`, the simulation's, and the drawing's lights are as bright as it says at any hour. (The
 * first try darkened them with the hour too, and a level at dusk with its ambient of 0.3 was lit by
 * half of that: the hour gives the light's hue and way, never its strength.)
 *
 * The sun goes round once a day. Its elevation is a sine over the day, from sunrise to sunset (62° at
 * the top), and another one under the horizon through the night (34° below at the bottom); its
 * azimuth goes round at 15° an hour, south at the middle of the day. The world's directions: up +Y,
 * north −Z (where a level looks if it does not say), east +X. So the sun rises in the east a little
 * to the north (a summer's day) and sets in the west. The moon is where the sun is not: opposite it.
 */
export interface SkyLook {
  hour: number;
  /** The sky straight up, at the horizon, and the ground under it. */
  zenith: Rgb;
  horizon: Rgb;
  ground: Rgb;
  /** The hue of the light the sky fills with, from above (its largest component 1: the strength is the ambient's). */
  fill: Rgb;
  /** Where the sun is (a unit direction), its color, and how bright its glow is in the sky (0 to 1: it stays a while after it sets). */
  sun: Vec3;
  sunColor: Rgb;
  sunGlow: number;
  /** Where the moon is, and how bright it is drawn (0 to 1, as it clears the horizon). */
  moon: Vec3;
  moonGlow: number;
  /**
   * The light that comes from one way (the drawing's directional light): the sun's while its glow is
   * out, warm and low at the end of the day, then the moon's, pale blue; between them, for a moment in
   * the middle of the twilight, none. Where it comes from, its hue (largest component 1) and its share
   * of the light, 0 to 1.
   */
  key: { from: Vec3; color: Rgb; share: number };
  /** How many of the stars are out, 0 to 1. */
  stars: number;
}

/** When the sun rises and sets (hours): a summer's day, its sunset at a quarter past seven. */
export const SUNRISE = 6.25;
export const SUNSET = 19.4;
/** How high the sun gets at the middle of the day, and how low under the horizon at the middle of the night (degrees). */
const HIGHEST = 62;
const LOWEST = 34;
/** The moon's light's hue: a pale blue. */
const MOONLIGHT: Rgb = [0.69, 0.78, 1];

/** The sky's colors through the day, at hours: between two, a line from one to the other (`keyAt`). */
interface Key {
  hour: number;
  zenith: number;
  horizon: number;
  ground: number;
  fill: number;
  sun: number;
  stars: number;
}
const KEYS: readonly Key[] = [
  { hour: 0, zenith: 0x05070f, horizon: 0x0e1426, ground: 0x0a090c, fill: 0x56648e, sun: 0xff7040, stars: 1 },
  { hour: 4.5, zenith: 0x0a0f22, horizon: 0x1c2442, ground: 0x0c0b0f, fill: 0x5c6890, sun: 0xff7040, stars: 0.75 },
  { hour: 5.6, zenith: 0x24335e, horizon: 0xb07f84, ground: 0x1a1618, fill: 0x9a90b0, sun: 0xff8050, stars: 0.2 },
  { hour: 6.5, zenith: 0x47679e, horizon: 0xf0b07c, ground: 0x2c241f, fill: 0xd8c0b4, sun: 0xffb070, stars: 0 },
  { hour: 8, zenith: 0x4c7cbe, horizon: 0xb8d0e8, ground: 0x3a3028, fill: 0xc8d4ff, sun: 0xfff0d8, stars: 0 },
  { hour: 13, zenith: 0x3c72c4, horizon: 0xbcd6ee, ground: 0x3a3028, fill: 0xc8d4ff, sun: 0xfff6e8, stars: 0 },
  { hour: 17.5, zenith: 0x436eb6, horizon: 0xd8d2c4, ground: 0x3a3028, fill: 0xd0d4f0, sun: 0xffe2b8, stars: 0 },
  { hour: 19, zenith: 0x384e8a, horizon: 0xf0894a, ground: 0x2e231c, fill: 0xe0b8a0, sun: 0xff9a50, stars: 0 },
  { hour: 19.75, zenith: 0x252f5e, horizon: 0xc0605a, ground: 0x1c1616, fill: 0xa890a8, sun: 0xff7040, stars: 0.1 },
  { hour: 20.5, zenith: 0x131b3d, horizon: 0x3a3a6c, ground: 0x110f13, fill: 0x707aa8, sun: 0xff7040, stars: 0.45 },
  { hour: 22, zenith: 0x070a16, horizon: 0x10162c, ground: 0x0a090c, fill: 0x56648e, sun: 0xff7040, stars: 1 },
  { hour: 24, zenith: 0x05070f, horizon: 0x0e1426, ground: 0x0a090c, fill: 0x56648e, sun: 0xff7040, stars: 1 },
];

const rgbOf = (hex: number): Rgb => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
/** 0 below `from`, 1 above `to`, and smooth between (3t² − 2t³). */
const smooth = (from: number, to: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const RAD = Math.PI / 180;
/** A color's hue, its largest component made 1 (black stays black). */
const hueOf = (c: Rgb): Rgb => {
  const most = Math.max(c[0], c[1], c[2]);
  return most > 0 ? [c[0] / most, c[1] / most, c[2] / most] : c;
};

/** An hour as one of the day's, from 0 up to 24 (26 is 2, −1 is 23). */
export const dayHour = (hour: number) => ((hour % 24) + 24) % 24;

/** How high the sun is at an hour (degrees; under the horizon, less than 0). */
export function sunElevation(hour: number): number {
  const h = dayHour(hour);
  const day = SUNSET - SUNRISE;
  if (h >= SUNRISE && h <= SUNSET) return HIGHEST * Math.sin((Math.PI * (h - SUNRISE)) / day);
  return -LOWEST * Math.sin((Math.PI * dayHour(h - SUNSET)) / (24 - day));
}

/** Where the sun is at an hour, a unit direction (up +Y, north −Z, east +X). */
export function sunDirection(hour: number): Vec3 {
  const e = sunElevation(hour) * RAD;
  // From the north, clockwise: south (180°) at the middle of the day, 15° an hour.
  const azimuth = (180 + 15 * (dayHour(hour) - (SUNRISE + SUNSET) / 2)) * RAD;
  return [Math.sin(azimuth) * Math.cos(e), Math.sin(e), -Math.cos(azimuth) * Math.cos(e)];
}

/** The keys either side of an hour, and how far it is from the first to the second (0 to 1). */
function keyAt(hour: number): { a: Key; b: Key; t: number } {
  const h = dayHour(hour);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.hour <= h) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  return { a, b, t: (h - a.hour) / (b.hour - a.hour) };
}

/** The sky at an hour (0 to 24; any other number, as the day's hour it is). */
export function skyAt(hour: number): SkyLook {
  const { a, b, t } = keyAt(hour);
  const color = (k: 'zenith' | 'horizon' | 'ground' | 'fill' | 'sun') => mixRgb(rgbOf(a[k]), rgbOf(b[k]), t);
  const sun = sunDirection(hour);
  const moon: Vec3 = [-sun[0], -sun[1], -sun[2]];
  const elevation = sunElevation(hour);
  const sunColor = color('sun');
  // Its glow stays out until it is 8° under the horizon; the light is the sun's while the glow is more
  // than half out, and the moon's after, its share |2w − 1|: 0 where they change, so nothing jumps.
  const sunGlow = smooth(-8, 0, elevation);
  const bySun = sunGlow >= 0.5;
  return {
    hour: dayHour(hour),
    zenith: color('zenith'),
    horizon: color('horizon'),
    ground: color('ground'),
    fill: hueOf(color('fill')),
    sun,
    sunColor,
    sunGlow,
    moon,
    moonGlow: smooth(-1, 12, -elevation),
    key: { from: bySun ? sun : moon, color: bySun ? hueOf(sunColor) : MOONLIGHT, share: Math.abs(2 * sunGlow - 1) },
    stars: mix(a.stars, b.stars, t),
  };
}
