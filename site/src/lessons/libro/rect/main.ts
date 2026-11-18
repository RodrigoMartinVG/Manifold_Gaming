import {
  ACCENT,
  canvasPixels,
  createPlane,
  derived,
  difference,
  dot,
  numbers,
  pixelGrid,
  type Point,
} from 'lab/plane';

// ─── A RECTANGLE, BOTH WAYS. Ours paints every pixel whose centre falls inside the rectangle; the canvas's
// `fillRect` paints each pixel as much as the rectangle covers it. At whole coordinates the two agree to the
// last pixel; at half a pixel the canvas paints the border half-bright, and ours must choose. ───

const COLS = 24;
const ROWS = 16;
const BACK = [24, 28, 52] as const;
const PAINT = [229, 192, 123] as const;

const plane = createPlane({ title: 'a rectangle, both ways' });
const r = { x: 4, y: 3, width: 10, height: 7 };
for (const k of ['x', 'y'] as const) plane.gui.add(r, k, 0, 20, 0.25).listen();
for (const k of ['width', 'height'] as const) plane.gui.add(r, k, 0, 20, 0.25).listen();

/** Ours: a pixel is painted when its centre, (x + ½, y + ½), is inside the rectangle. */
function ours(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const [cx, cy] = [x + 0.5, y + 0.5];
      const inside = cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height;
      const c = inside ? PAINT : BACK;
      px.set([c[0], c[1], c[2], 255], 4 * (y * COLS + x));
    }
  return px;
}
/** The canvas's: its own `fillRect`. */
const theirs = () =>
  canvasPixels(COLS, ROWS, `rgb(${BACK.join(',')})`, (ctx) => {
    ctx.fillStyle = `rgb(${PAINT.join(',')})`;
    ctx.fillRect(r.x, r.y, r.width, r.height);
  });

const shown = derived(
  () => r,
  () => ({ a: ours(), b: theirs() }),
);
const differ = derived(
  () => r,
  () => difference(shown().a, shown().b),
);
numbers(plane.gui, {
  'pixels that differ': () => differ().pixels,
  'largest difference': () => differ().largest,
});

const left = pixelGrid(COLS, ROWS); // ours (on top)
const right = pixelGrid(COLS, ROWS); // the canvas's (below)
// The two corners can be dragged, on our grid, to quarters of a pixel.
const quarter = (v: number) => Math.round(v * 4) / 4;
plane.handle({
  at: () => left.toScreen({ x: r.x, y: r.y }),
  move: (p) => {
    const q = left.toGrid(p);
    const [x2, y2] = [r.x + r.width, r.y + r.height];
    r.x = Math.min(quarter(q.x), x2);
    r.y = Math.min(quarter(q.y), y2);
    r.width = x2 - r.x;
    r.height = y2 - r.y;
  },
});
plane.handle({
  at: () => left.toScreen({ x: r.x + r.width, y: r.y + r.height }),
  move: (p) => {
    const q = left.toGrid(p);
    r.width = Math.max(0, quarter(q.x) - r.x);
    r.height = Math.max(0, quarter(q.y) - r.y);
  },
});

plane.onDraw((pen) => {
  const a = plane.area();
  // Ours above, the canvas's below: each as wide as the figure allows.
  const h = (a.height - 12) / 2;
  left.fit({ x: a.x, y: a.y, width: a.width, height: h });
  right.fit({ x: a.x, y: a.y + h + 12, width: a.width, height: h });
  for (const [g, px, title] of [
    [left, shown().a, 'el nuestro: el centro de cada píxel'],
    [right, shown().b, 'el del canvas: fillRect'],
  ] as const) {
    g.paint(pen, px);
    g.caption(pen, title);
    const p0 = g.toScreen({ x: r.x, y: r.y });
    pen.strokeStyle = ACCENT;
    pen.lineWidth = 1.5;
    pen.strokeRect(p0.x, p0.y, r.width * g.cell, r.height * g.cell);
  }
  const corners: Point[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
  ];
  for (const c of corners) dot(pen, left.toScreen(c), ACCENT, 5);
});

console.log(
  'Drag the corners, or set x to 4.5: the canvas paints the border at half, ours chooses by the centre.',
);
