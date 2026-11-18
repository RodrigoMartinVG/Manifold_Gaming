import { CONSTELLATIONS } from './constellations';
import { HILLS, WINDOW } from './landscape';
import { drawLine, drawPolyline, type Point } from './line';
import { createScreen, fillCircle, fillRect, setPixel, verticalGradient, type Colour } from './screen';
import { HEIGHT, SKY, WIDTH } from './sky';
import { fillTriangle, fillTriangle3 } from './triangle';
import { comparePanel } from './herramientas/panel';

const LINE: Colour = [116, 136, 196]; // the constellations' lines, a cold blue, dimmer than the stars
const BRIGHT: Colour = [255, 250, 230]; // their stars

/** How many points per side measure the moon's edge, to begin with (the panel's slider changes it afterwards). */
const SAMPLES = 4;

// OURS: chapter 2's sky, and in front of it the hills and, in the tower, a stained-glass window, with our own
// triangles (triangle.ts).
function paintOurs(samples: number, mine: [Point, Point][]): Uint8ClampedArray {
  const s = createScreen(WIDTH, HEIGHT);
  verticalGradient(s, SKY.top, SKY.bottom);
  for (const star of SKY.stars) setPixel(s, star.x, star.y, [star.light, star.light, star.light]);
  for (const c of CONSTELLATIONS) drawPolyline(s, c.stars, LINE, c.closed);
  for (const [a, b] of mine) drawLine(s, a, b, LINE); // the lines you joined, pressing two stars
  for (const c of CONSTELLATIONS) for (const p of c.stars) setPixel(s, Math.floor(p.x), Math.floor(p.y), BRIGHT);
  for (const [p, q, r] of HILLS.triangles) fillTriangle(s, p, q, r, HILLS.colour);
  fillCircle(s, SKY.moon.x, SKY.moon.y, SKY.moon.r, SKY.moon.colour, samples);
  for (const b of SKY.tower) fillRect(s, b.x, b.y, b.width, b.height, b.colour);
  const [w1, w2, w3] = WINDOW.corners;
  fillTriangle3(s, w1, w2, w3, ...WINDOW.colours);
  return s.pixels;
}

// THE CANVAS'S: the same data, with the browser's own drawing; its triangles are paths, filled with `fill`.
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
  const triangle = (corners: readonly Point[]) => {
    ctx.beginPath();
    for (const p of corners) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = css(HILLS.colour);
  for (const t of HILLS.triangles) triangle(t); // each hill on its own, as ours: their shared edge, each half covered
  ctx.fillStyle = css(SKY.moon.colour);
  ctx.beginPath();
  ctx.arc(SKY.moon.x, SKY.moon.y, SKY.moon.r, 0, 2 * Math.PI);
  ctx.fill();
  for (const b of SKY.tower) {
    ctx.fillStyle = css(b.colour);
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
  // The canvas has no triangle of three colours: the window, flat, in their average.
  const average = [0, 1, 2].map((k) => Math.round(WINDOW.colours.reduce((sum, c) => sum + c[k]!, 0) / 3));
  ctx.fillStyle = `rgb(${average.join(', ')})`;
  triangle(WINDOW.corners);
  return ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
}

// THE COMPARISON: the book's tool (herramientas/panel.ts) shows the two side by side, with a panel that counts
// where they differ. Pressing a star and then another joins them: the tool gives the two paintings those lines, `mine`.
// The stars that can be pressed: the sky's, at their pixels' centres, and the constellations'.
const everyStar: Point[] = SKY.stars.map((s) => ({ x: s.x + 0.5, y: s.y + 0.5 }));
for (const c of CONSTELLATIONS) everyStar.push(...c.stars);
comparePanel({
  title: 'hills and a window',
  width: WIDTH,
  height: HEIGHT,
  samples: SAMPLES,
  ours: paintOurs,
  theirs: paintTheirs,
  stars: everyStar,
});

console.log('Look at the hills’ shared edge with the magnifying glass: ours, one colour; the canvas’s, a seam.');
