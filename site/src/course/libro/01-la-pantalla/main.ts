import { createScreen, fillCircle, fillRect, setPixel, verticalGradient, type Colour } from './screen';
import { HEIGHT, SKY, WIDTH } from './sky';
import { comparePanel } from './herramientas/panel';

/** How many points per side measure the moon's edge, to begin with (the panel's slider changes it afterwards). */
const SAMPLES = 4;

// OURS: the night sky, pixel by pixel, with our own functions (screen.ts), from the sky's data (sky.ts).
function paintOurs(samples: number): Uint8ClampedArray {
  const s = createScreen(WIDTH, HEIGHT);
  verticalGradient(s, SKY.top, SKY.bottom);
  for (const star of SKY.stars) setPixel(s, star.x, star.y, [star.light, star.light, star.light]);
  fillCircle(s, SKY.moon.x, SKY.moon.y, SKY.moon.r, SKY.moon.colour, samples);
  for (const b of SKY.tower) fillRect(s, b.x, b.y, b.width, b.height, b.colour);
  return s.pixels;
}

// THE CANVAS'S: the same data, drawn with the browser's own 2D drawing on a hidden canvas of the same size; at the
// end, `getImageData` gives its pixels back as the same strip of four numbers per pixel as ours.
const css = (c: Colour) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
function paintTheirs(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [WIDTH, HEIGHT];
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; // (we will read it back: keep it handy)
  // The sky: a gradient from (0, 0) down to (0, HEIGHT), the top's colour at its start (0) and the bottom's at its end (1).
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

// THE COMPARISON: the book's tool (herramientas/panel.ts) shows the two side by side, with a panel that counts
// where they differ.
comparePanel({ title: 'the night sky', width: WIDTH, height: HEIGHT, samples: SAMPLES, ours: paintOurs, theirs: paintTheirs });

console.log(`A sky of ${WIDTH} × ${HEIGHT} pixels: ${WIDTH * HEIGHT * 4} numbers in memory. Press a pixel to read it.`);
