import {
  ACCENT,
  BLUE,
  createPlane,
  derived,
  dot,
  MUTED,
  numbers,
  pixelGrid,
  RED,
  type Point,
} from 'lab/plane';

// ─── INSIDE A TRIANGLE. A pixel is inside when its centre is on the same side of the three edges: three signs,
// all the same. Only the pixels in the box round the triangle are worth asking; the rest of the screen cannot be
// inside. ───

const COLS = 24;
const ROWS = 16;
const BACK = [24, 28, 52] as const;
const PAINT = [229, 192, 123] as const;
const plane = createPlane({ title: 'inside a triangle' });
const settings = { 'only the box round it': true };
plane.gui.add(settings, 'only the box round it');

const A = { x: 3, y: 2 };
const B = { x: 20, y: 5 };
const C = { x: 8, y: 14 };
let chosen = { x: 9, y: 7 };

/** Which side of the edge from u to v the point p is on: the sign of the parallelogram's area. */
const edge = (u: Point, v: Point, p: Point) =>
  (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
const signs = (i: number, j: number) => {
  const p = { x: i + 0.5, y: j + 0.5 };
  return [edge(A, B, p), edge(B, C, p), edge(C, A, p)];
};
const inside = (i: number, j: number) => {
  const s = signs(i, j);
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
};
const box = () => ({
  x0: Math.max(0, Math.floor(Math.min(A.x, B.x, C.x))),
  x1: Math.min(COLS, Math.ceil(Math.max(A.x, B.x, C.x))),
  y0: Math.max(0, Math.floor(Math.min(A.y, B.y, C.y))),
  y1: Math.min(ROWS, Math.ceil(Math.max(A.y, B.y, C.y))),
});
const counts = derived(
  () => [A, B, C, settings],
  () => {
    const b = settings['only the box round it'] ? box() : { x0: 0, x1: COLS, y0: 0, y1: ROWS };
    let painted = 0;
    for (let j = b.y0; j < b.y1; j++) for (let i = b.x0; i < b.x1; i++) if (inside(i, j)) painted++;
    return { painted, tested: (b.x1 - b.x0) * (b.y1 - b.y0) };
  },
);
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '0');
numbers(plane.gui, {
  pixel: () => `${chosen.x}, ${chosen.y}`,
  'the three signs': () => signs(chosen.x, chosen.y).map(sign).join(' '),
  inside: () => (inside(chosen.x, chosen.y) ? 'yes' : 'no'),
  'pixels painted': () => counts().painted,
  'pixels asked': () => counts().tested,
  'area of the triangle': () => Math.abs(edge(A, B, C)) / 2,
});

const grid = pixelGrid(COLS, ROWS);
for (const q of [A, B, C])
  plane.handle({
    at: () => grid.toScreen(q),
    move: (p) => {
      const g = grid.toGrid(p);
      q.x = Math.min(COLS, Math.max(0, Math.round(g.x)));
      q.y = Math.min(ROWS, Math.max(0, Math.round(g.y)));
    },
  });
const choose = (p: Point | null) => {
  const hit = p && grid.pixelAt(p);
  if (hit) chosen = hit;
};
plane.onPress(choose);
plane.onHover(choose);

plane.onDraw((pen) => {
  const a = plane.area();
  grid.fit(a);
  const px = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const c = inside(i, j) ? PAINT : BACK;
      px.set([c[0], c[1], c[2], 255], 4 * (j * COLS + i));
    }
  grid.paint(pen, px);
  grid.caption(pen, 'se pinta el píxel cuyo centro da los tres signos iguales');

  // The box that is asked, dashed.
  const b = box();
  if (settings['only the box round it']) {
    const p0 = grid.toScreen({ x: b.x0, y: b.y0 });
    pen.strokeStyle = 'rgba(232, 223, 208, 0.6)';
    pen.setLineDash([5, 4]);
    pen.strokeRect(p0.x, p0.y, (b.x1 - b.x0) * grid.cell, (b.y1 - b.y0) * grid.cell);
    pen.setLineDash([]);
  }
  // The true triangle.
  pen.strokeStyle = ACCENT;
  pen.lineWidth = 1.5;
  pen.beginPath();
  for (const q of [A, B, C]) pen.lineTo(grid.toScreen(q).x, grid.toScreen(q).y);
  pen.closePath();
  pen.stroke();
  grid.outline(pen, chosen.x, chosen.y, inside(chosen.x, chosen.y) ? BLUE : RED, 2.5);
  for (const q of [A, B, C]) dot(pen, grid.toScreen(q), MUTED, 6);
});

console.log('Drag the corners; point at a pixel to read its three signs.');
