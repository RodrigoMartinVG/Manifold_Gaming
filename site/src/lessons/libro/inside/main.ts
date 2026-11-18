import { ACCENT, BLUE, createPlane, dot, MUTED, numbers, pixelGrid, RED, write } from 'lab/plane';

// ─── INSIDE OR OUTSIDE? A pixel is painted when its centre is at most r from the circle's centre. The
// distance is Pythagoras's: the two legs dx and dy, squared, added, and the square root. Which point of the
// pixel we test matters: its corner instead of its centre moves the whole disc half a pixel. ───

const COLS = 20;
const ROWS = 14;
const BACK = [24, 28, 52] as const;
const MOON = [240, 226, 182] as const;

const plane = createPlane({ title: 'inside or outside?' });
const settings = { radius: 5, 'test the corner, not the centre': false };
plane.gui.add(settings, 'radius', 1, 7, 0.1);
plane.gui.add(settings, 'test the corner, not the centre');

const centre = { x: 10, y: 7 };
let chosen = { x: 13, y: 10 };
/** The point of pixel (i, j) we test: its centre, or (to see what goes wrong) its top left corner. */
const tested = (i: number, j: number) =>
  settings['test the corner, not the centre'] ? { x: i, y: j } : { x: i + 0.5, y: j + 0.5 };
const distance = (i: number, j: number) => {
  const p = tested(i, j);
  return Math.sqrt((p.x - centre.x) ** 2 + (p.y - centre.y) ** 2);
};
const inside = (i: number, j: number) => distance(i, j) <= settings.radius;

const fixed = (v: number) => (Math.round(v * 100) / 100).toString();
numbers(plane.gui, {
  pixel: () => `${chosen.x}, ${chosen.y}`,
  'the point tested': () => {
    const p = tested(chosen.x, chosen.y);
    return `${fixed(p.x)}, ${fixed(p.y)}`;
  },
  'dx, dy': () => {
    const p = tested(chosen.x, chosen.y);
    return `${fixed(p.x - centre.x)}, ${fixed(p.y - centre.y)}`;
  },
  distance: () => fixed(distance(chosen.x, chosen.y)),
  'inside (distance ≤ r)': () => (inside(chosen.x, chosen.y) ? 'yes' : 'no'),
  'pixels painted': () => {
    let n = 0;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (inside(i, j)) n++;
    return n;
  },
});

const grid = pixelGrid(COLS, ROWS);
// The centre is dragged in halves of a pixel; a pixel is chosen by pointing at it.
const half = (v: number) => Math.round(v * 2) / 2;
plane.handle({
  at: () => grid.toScreen(centre),
  move: (p) => {
    const q = grid.toGrid(p);
    centre.x = Math.min(COLS, Math.max(0, half(q.x)));
    centre.y = Math.min(ROWS, Math.max(0, half(q.y)));
  },
});
const choose = (p: { x: number; y: number } | null) => {
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
      const c = inside(i, j) ? MOON : BACK;
      px.set([c[0], c[1], c[2], 255], 4 * (j * COLS + i));
    }
  grid.paint(pen, px);
  grid.caption(pen, 'se pinta el píxel cuyo punto queda a lo sumo a r del centro');

  // The points tested, small, when there is room to see them.
  if (grid.cell >= 14)
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const p = grid.toScreen(tested(i, j));
        pen.fillStyle = inside(i, j) ? 'rgba(27, 23, 19, 0.55)' : 'rgba(232, 223, 208, 0.3)';
        pen.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }

  // The true circle.
  const c = grid.toScreen(centre);
  pen.strokeStyle = ACCENT;
  pen.lineWidth = 1.5;
  pen.beginPath();
  pen.arc(c.x, c.y, settings.radius * grid.cell, 0, 2 * Math.PI);
  pen.stroke();

  // The chosen pixel, and Pythagoras's triangle from the centre to its point: dx across, dy down, d.
  grid.outline(pen, chosen.x, chosen.y, inside(chosen.x, chosen.y) ? BLUE : RED, 2.5);
  const t = grid.toScreen(tested(chosen.x, chosen.y));
  pen.lineWidth = 2;
  pen.setLineDash([5, 4]);
  pen.strokeStyle = MUTED;
  pen.beginPath();
  pen.moveTo(c.x, c.y);
  pen.lineTo(t.x, c.y);
  pen.lineTo(t.x, t.y);
  pen.stroke();
  pen.setLineDash([]);
  pen.strokeStyle = inside(chosen.x, chosen.y) ? BLUE : RED;
  pen.beginPath();
  pen.moveTo(c.x, c.y);
  pen.lineTo(t.x, t.y);
  pen.stroke();
  write(pen, 'dx', (c.x + t.x) / 2, c.y + (t.y >= c.y ? -6 : 14), {
    color: MUTED,
    align: 'center',
  });
  write(pen, 'dy', t.x + (t.x >= c.x ? 6 : -6), (c.y + t.y) / 2, {
    color: MUTED,
    align: t.x >= c.x ? 'left' : 'right',
    baseline: 'middle',
  });
  dot(pen, c, ACCENT, 6);
});

console.log(
  'Point at a pixel to see its distance to the centre; drag the centre by halves of a pixel.',
);
