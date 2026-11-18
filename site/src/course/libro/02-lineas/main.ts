import { CONSTELLATIONS } from './constellations';
import { drawLine, drawPolyline, type Point } from './line';
import { createScreen, fillCircle, fillRect, setPixel, verticalGradient, type Colour } from './screen';
import { HEIGHT, SKY, WIDTH } from './sky';
import { comparePanel } from './herramientas/panel';

const LINE: Colour = [116, 136, 196]; // the constellations' lines, a cold blue, dimmer than the stars
const BRIGHT: Colour = [255, 250, 230]; // their stars

/** How many points per side measure the moon's edge, to begin with (the panel's slider changes it afterwards). */
const SAMPLES = 4;

// OURS: chapter 1's sky, and on it the constellations, with our own lines (line.ts).
function paintOurs(samples: number, mine: [Point, Point][]): Uint8ClampedArray {
  const s = createScreen(WIDTH, HEIGHT);
  verticalGradient(s, SKY.top, SKY.bottom);
  for (const star of SKY.stars) setPixel(s, star.x, star.y, [star.light, star.light, star.light]);
  for (const c of CONSTELLATIONS) drawPolyline(s, c.stars, LINE, c.closed);
  for (const [a, b] of mine) drawLine(s, a, b, LINE); // the lines you joined, pressing two stars
  for (const c of CONSTELLATIONS) for (const p of c.stars) setPixel(s, Math.floor(p.x), Math.floor(p.y), BRIGHT);
  fillCircle(s, SKY.moon.x, SKY.moon.y, SKY.moon.r, SKY.moon.colour, samples);
  for (const b of SKY.tower) fillRect(s, b.x, b.y, b.width, b.height, b.colour);
  return s.pixels;
}

// THE CANVAS'S: the same data, with the browser's own drawing; its lines are `moveTo`, `lineTo` and `stroke`.
const css = (c: Colour) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
function paintTheirs(mine: [Point, Point][]): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [WIDTH, HEIGHT];
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, css(SKY.top));
  sky.addColorStop(1, css(SKY.bottom));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of SKY.stars) {
    ctx.fillStyle = css([star.light, star.light, star.light]);
    ctx.fillRect(star.x, star.y, 1, 1);
  }
  ctx.strokeStyle = css(LINE);
  ctx.lineWidth = 1;
  for (const c of CONSTELLATIONS) {
    ctx.beginPath();
    c.stars.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (c.closed) ctx.closePath();
    ctx.stroke();
  }
  for (const [a, b] of mine) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.fillStyle = css(BRIGHT);
  for (const c of CONSTELLATIONS) for (const p of c.stars) ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
  ctx.fillStyle = css(SKY.moon.colour);
  ctx.beginPath();
  ctx.arc(SKY.moon.x, SKY.moon.y, SKY.moon.r, 0, 2 * Math.PI);
  ctx.fill();
  for (const b of SKY.tower) {
    ctx.fillStyle = css(b.colour);
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
  return ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
}

// THE COMPARISON: the book's tool (herramientas/panel.ts) shows the two side by side, with a panel that counts
// where they differ. Pressing a star and then another joins them: the tool gives the two paintings those lines, `mine`.
// The stars that can be pressed: the sky's, at their pixels' centres, and the constellations'.
const everyStar: Point[] = SKY.stars.map((s) => ({ x: s.x + 0.5, y: s.y + 0.5 }));
for (const c of CONSTELLATIONS) everyStar.push(...c.stars);
comparePanel({
  title: 'constellations',
  width: WIDTH,
  height: HEIGHT,
  samples: SAMPLES,
  ours: paintOurs,
  theirs: paintTheirs,
  stars: everyStar,
});

console.log('Press a star, then another: a line joins them, ours and the canvas’s.');
