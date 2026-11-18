import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { CONSTELLATIONS } from './constellations';
import { drawLine, drawPolyline, type Point } from './line';
import { createScreen, fillCircle, fillRect, setPixel, verticalGradient, type Colour } from './screen';
import { HEIGHT, SKY, WIDTH } from './sky';
import { createView, MODES, type Mode } from './herramientas/view';

const LINE: Colour = [116, 136, 196]; // the constellations' lines, a cold blue, dimmer than the stars
const BRIGHT: Colour = [255, 250, 230]; // their stars

/** The lines the reader joins, pressing one star and then another. */
const mine: [Point, Point][] = [];

// OURS: chapter 1's sky, and on it the constellations, with our own lines (line.ts).
function paintOurs(samples: number): Uint8ClampedArray {
  const s = createScreen(WIDTH, HEIGHT);
  verticalGradient(s, SKY.top, SKY.bottom);
  for (const star of SKY.stars) setPixel(s, star.x, star.y, [star.light, star.light, star.light]);
  for (const c of CONSTELLATIONS) drawPolyline(s, c.stars, LINE, c.closed);
  for (const [a, b] of mine) drawLine(s, a, b, LINE);
  for (const c of CONSTELLATIONS) for (const p of c.stars) setPixel(s, Math.floor(p.x), Math.floor(p.y), BRIGHT);
  fillCircle(s, SKY.moon.x, SKY.moon.y, SKY.moon.r, SKY.moon.colour, samples);
  for (const b of SKY.tower) fillRect(s, b.x, b.y, b.width, b.height, b.colour);
  return s.pixels;
}

// THE CANVAS'S: the same data, with the browser's own drawing; its lines are `moveTo`, `lineTo` and `stroke`.
const css = (c: Colour) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
function paintTheirs(): Uint8ClampedArray {
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

// THE PANEL: as in chapter 1, and the lines joined.
const settings = {
  view: 'split' as Mode,
  'samples per side': 4,
  'forget my lines': () => {
    mine.length = 0;
    chosen = null;
    paint();
  },
};
const counts = {
  'pixels that differ': 0,
  'by more than one level': 0,
  'largest difference': 0,
  'lines joined': 0,
};
const read = { pixel: '—', ours: '—', 'the canvas’s': '—' };
const gui = new GUI({ title: 'constellations' });
const view = createView(WIDTH, HEIGHT, gui.domElement);
gui.add(settings, 'view', MODES).onChange((m: Mode) => view.setMode(m));
gui.add(settings, 'samples per side', 1, 8, 1).onChange(paint);
gui.add(settings, 'forget my lines');
gui.add(counts, 'pixels that differ').disable().listen();
gui.add(counts, 'by more than one level').disable().listen();
gui.add(counts, 'largest difference').disable().listen();
gui.add(counts, 'lines joined').disable().listen();
gui.add(read, 'pixel').disable().listen();
gui.add(read, 'ours').disable().listen();
gui.add(read, 'the canvas’s').disable().listen();

let a: Uint8ClampedArray = new Uint8ClampedArray(0);
let b: Uint8ClampedArray = new Uint8ClampedArray(0);
function paint() {
  a = paintOurs(settings['samples per side']);
  b = paintTheirs();
  let pixels = 0;
  let more = 0;
  let largest = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
    if (d > 0) pixels++;
    if (d > 1) more++;
    largest = Math.max(largest, d);
  }
  counts['pixels that differ'] = pixels;
  counts['by more than one level'] = more;
  counts['largest difference'] = largest;
  counts['lines joined'] = mine.length;
  view.show(a, b);
}
paint();

// A press reads the pixel; on a star (or within two pixels of one), it chooses it, and the next star
// chosen is joined to it by a line. Stars are joined at their pixels' centres.
let chosen: Point | null = null;
const everyStar: Point[] = [...SKY.stars.map((s) => ({ x: s.x + 0.5, y: s.y + 0.5 })), ...CONSTELLATIONS.flatMap((c) => c.stars)];
view.onPress((x, y) => {
  const i = 4 * (y * WIDTH + x);
  read.pixel = `${x}, ${y}`;
  read.ours = `${a[i]}, ${a[i + 1]}, ${a[i + 2]}`;
  read['the canvas’s'] = `${b[i]}, ${b[i + 1]}, ${b[i + 2]}`;
  const near = everyStar.find((s) => Math.abs(s.x - (x + 0.5)) <= 2 && Math.abs(s.y - (y + 0.5)) <= 2);
  if (!near) return;
  if (chosen && (chosen.x !== near.x || chosen.y !== near.y)) {
    mine.push([chosen, near]);
    chosen = null;
    paint();
  } else chosen = near;
});

console.log('Press a star, then another: a line joins them, ours and the canvas’s.');
