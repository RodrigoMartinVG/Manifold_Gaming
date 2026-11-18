import {
  ACCENT,
  canvasPixels,
  createPlane,
  derived,
  difference,
  dot,
  numbers,
  pixelGrid,
} from 'lab/plane';

// ─── SOFT EDGES. A pixel on the circle's edge is partly inside: asking only its centre paints it all or
// nothing, and the edge comes out in steps. The canvas paints it as much as the circle covers it. We can too:
// n × n points spread over each pixel, and the pixel painted by the share of them that fall inside. ───

const COLS = 24;
const ROWS = 16;
const BACK = [24, 28, 52] as const;
const MOON = [240, 226, 182] as const;

const plane = createPlane({ title: 'soft edges' });
const settings = { 'samples per side': 1, radius: 5.3, 'show the samples': true };
plane.gui.add(settings, 'samples per side', 1, 8, 1);
plane.gui.add(settings, 'radius', 1, 7.5, 0.1);
plane.gui.add(settings, 'show the samples');
const centre = { x: 12, y: 8 };

/** How much of pixel (i, j) the circle covers, measured with n × n points spread evenly over it. */
function coverage(i: number, j: number, n: number): number {
  let hits = 0;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const [x, y] = [i + (a + 0.5) / n, j + (b + 0.5) / n];
      if ((x - centre.x) ** 2 + (y - centre.y) ** 2 <= settings.radius ** 2) hits++;
    }
  return hits / (n * n);
}

/** Ours: each pixel the background's colour and the moon's, mixed in the share the circle covers. */
function ours(): Uint8ClampedArray {
  const n = settings['samples per side'];
  const px = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const c = coverage(i, j, n);
      const mix = (k: 0 | 1 | 2) => Math.round((1 - c) * BACK[k] + c * MOON[k]);
      px.set([mix(0), mix(1), mix(2), 255], 4 * (j * COLS + i));
    }
  return px;
}
/** The canvas's: its own `arc`, filled. */
const theirs = () =>
  canvasPixels(COLS, ROWS, `rgb(${BACK.join(',')})`, (ctx) => {
    ctx.fillStyle = `rgb(${MOON.join(',')})`;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, settings.radius, 0, 2 * Math.PI);
    ctx.fill();
  });

const state = () => [settings, centre];
const shown = derived(state, () => ({ a: ours(), b: theirs() }));
const differ = derived(state, () => difference(shown().a, shown().b));

/**
 * How far each picture is from the TRUE AREA: each pixel's share measured with 128 × 128 points (only where
 * the edge passes; inside and outside the share is exactly 1 or 0), turned into the red it should have.
 */
const offTruth = derived(state, () => {
  const off = { ours: 0, theirs: 0 };
  const r = settings.radius;
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const near = Math.hypot(
        Math.max(i - centre.x, 0, centre.x - i - 1),
        Math.max(j - centre.y, 0, centre.y - j - 1),
      );
      const far = Math.hypot(
        Math.max(Math.abs(i - centre.x), Math.abs(i + 1 - centre.x)),
        Math.max(Math.abs(j - centre.y), Math.abs(j + 1 - centre.y)),
      );
      const share = far <= r ? 1 : near > r ? 0 : coverage(i, j, 128);
      const red = (1 - share) * BACK[0] + share * MOON[0];
      const k = 4 * (j * COLS + i);
      off.ours = Math.max(off.ours, Math.abs(shown().a[k]! - red));
      off.theirs = Math.max(off.theirs, Math.abs(shown().b[k]! - red));
    }
  return { ours: Math.round(off.ours), theirs: Math.round(off.theirs) };
});
numbers(plane.gui, {
  'samples per pixel': () => settings['samples per side'] ** 2,
  'levels possible': () => settings['samples per side'] ** 2 + 1,
  'pixels that differ': () => differ().pixels,
  'largest difference': () => differ().largest,
  'ours, off the true area by': () => offTruth().ours,
  'the canvas’s, off the true area by': () => offTruth().theirs,
});

const left = pixelGrid(COLS, ROWS); // ours (on top)
const right = pixelGrid(COLS, ROWS); // the canvas's (below)
const half = (v: number) => Math.round(v * 2) / 2;
plane.handle({
  at: () => left.toScreen(centre),
  move: (p) => {
    const q = left.toGrid(p);
    centre.x = Math.min(COLS, Math.max(0, half(q.x)));
    centre.y = Math.min(ROWS, Math.max(0, half(q.y)));
  },
});

plane.onDraw((pen) => {
  const a = plane.area();
  // Ours above, the canvas's below: each as wide as the figure allows.
  const h = (a.height - 12) / 2;
  left.fit({ x: a.x, y: a.y, width: a.width, height: h });
  right.fit({ x: a.x, y: a.y + h + 12, width: a.width, height: h });
  const n = settings['samples per side'];
  left.paint(pen, shown().a);
  left.caption(
    pen,
    n === 1 ? 'el nuestro: solo el centro' : `el nuestro: ${n} × ${n} puntos por píxel`,
  );
  right.paint(pen, shown().b);
  right.caption(pen, 'el del canvas: arc');

  for (const g of [left, right]) {
    const c = g.toScreen(centre);
    pen.strokeStyle = ACCENT;
    pen.lineWidth = 1;
    pen.beginPath();
    pen.arc(c.x, c.y, settings.radius * g.cell, 0, 2 * Math.PI);
    pen.stroke();
  }
  // The points each pixel of ours is measured with, where there is room to see them.
  if (settings['show the samples'] && left.cell / n >= 2.5)
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        // Only where the edge passes: there the points decide; inside and outside they all agree.
        const c = coverage(i, j, n);
        if (c === 0 || c === 1) continue;
        for (let s = 0; s < n; s++)
          for (let t = 0; t < n; t++) {
            const q = { x: i + (s + 0.5) / n, y: j + (t + 0.5) / n };
            const hit = (q.x - centre.x) ** 2 + (q.y - centre.y) ** 2 <= settings.radius ** 2;
            const p = left.toScreen(q);
            pen.fillStyle = hit ? 'rgba(27, 23, 19, 0.6)' : 'rgba(232, 223, 208, 0.28)';
            pen.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
          }
      }
  dot(pen, left.toScreen(centre), ACCENT, 5);
});

console.log(
  'Raise the samples per side: our edge softens, and its error against the true area halves.',
);
