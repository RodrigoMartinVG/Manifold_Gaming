import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScreen, fillCircle, fillRect, setPixel, verticalGradient, type Colour } from './screen';
import { HEIGHT, SKY, WIDTH } from './sky';
import { createView, MODES, type Mode } from './herramientas/view';

// OURS: the night sky, pixel by pixel, with our own functions (screen.ts), from the sky's data (sky.ts).
function paintOurs(samples: number): Uint8ClampedArray {
  const s = createScreen(WIDTH, HEIGHT);
  verticalGradient(s, SKY.top, SKY.bottom);
  for (const star of SKY.stars) setPixel(s, star.x, star.y, [star.light, star.light, star.light]);
  fillCircle(s, SKY.moon.x, SKY.moon.y, SKY.moon.r, SKY.moon.colour, samples);
  for (const b of SKY.tower) fillRect(s, b.x, b.y, b.width, b.height, b.colour);
  return s.pixels;
}

// THE CANVAS'S: the same data, drawn with the browser's own 2D drawing on a hidden canvas of the same size.
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

// THE PANEL: how to look, how many points per pixel the moon's edge is measured with, and what differs.
const settings = { view: 'split' as Mode, 'samples per side': 4 };
const counts = { 'pixels that differ': 0, 'by more than one level': 0, 'largest difference': 0 };
const read = { pixel: '—', ours: '—', 'the canvas’s': '—' };
const gui = new GUI({ title: 'the night sky' });
const view = createView(WIDTH, HEIGHT, gui.domElement);
gui.add(settings, 'view', MODES).onChange((m: Mode) => view.setMode(m));
gui.add(settings, 'samples per side', 1, 8, 1).onChange(paint);
gui.add(counts, 'pixels that differ').disable().listen();
gui.add(counts, 'by more than one level').disable().listen();
gui.add(counts, 'largest difference').disable().listen();
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
  view.show(a, b);
}
paint();

// A press on the picture reads that pixel's four numbers, in ours and in the canvas's.
view.onPress((x, y) => {
  const i = 4 * (y * WIDTH + x);
  read.pixel = `${x}, ${y}`;
  read.ours = `${a[i]}, ${a[i + 1]}, ${a[i + 2]}`;
  read['the canvas’s'] = `${b[i]}, ${b[i + 1]}, ${b[i + 2]}`;
});

console.log(`A sky of ${WIDTH} × ${HEIGHT} pixels: ${WIDTH * HEIGHT * 4} numbers in memory. Press a pixel to read it.`);
