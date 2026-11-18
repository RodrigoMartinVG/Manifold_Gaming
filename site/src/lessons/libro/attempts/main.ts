import {
  ACCENT,
  BLUE,
  createPlane,
  derived,
  dot,
  numbers,
  pixelGrid,
  RED,
  type Point,
} from 'lab/plane';

// ─── THREE ATTEMPTS AT A LINE. One pixel per column: fine while the line is flatter than 45°, with holes when
// it is steeper, and nothing at all when it goes leftwards or straight down. One per row: the same, turned.
// As many steps as the longer side: each step moves at most one pixel across and one down, so no holes, in
// any direction; and no pixel too many, since fewer could not get from one end to the other. ───

const COLS = 24;
const ROWS = 16;
const BACK = [24, 28, 52] as const;
const INKED = [229, 192, 123] as const;
const MODES = ['one per column', 'one per row', 'as many as the longer side'] as const;
type Mode = (typeof MODES)[number];

const plane = createPlane({ title: 'three attempts' });
const settings = { attempt: 'one per column' as Mode };
plane.gui.add(settings, 'attempt', [...MODES]);

// The two ends, at pixel centres.
const A = { x: 3.5, y: 2.5 };
const B = { x: 8.5, y: 13.5 };
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: (1 - t) * a.x + t * b.x,
  y: (1 - t) * a.y + t * b.y,
});

/** The pixels each attempt paints, in the order it paints them. */
function attempt(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const paint = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x: Math.floor(x), y: Math.floor(y) });
  };
  if (settings.attempt === 'one per column') {
    // For each column from A's to B's, the line's height at the column's centre.
    for (let x = Math.floor(A.x); x <= Math.floor(B.x); x++) {
      const t = (x + 0.5 - A.x) / (B.x - A.x); // (straight down, B.x − A.x is 0: t is not a number)
      paint(x, A.y + t * (B.y - A.y));
    }
  } else if (settings.attempt === 'one per row') {
    for (let y = Math.floor(A.y); y <= Math.floor(B.y); y++) {
      const t = (y + 0.5 - A.y) / (B.y - A.y);
      paint(A.x + t * (B.x - A.x), y);
    }
  } else {
    const n = Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y));
    for (let k = 0; k <= n; k++) {
      const p = lerp(A, B, n === 0 ? 0 : k / n);
      paint(p.x, p.y);
    }
  }
  return out;
}
/** Two pixels painted one after the other that do not touch (not even at a corner): a hole between them. */
const holes = (px: { x: number; y: number }[]) =>
  px.slice(1).filter((p, k) => Math.max(Math.abs(p.x - px[k]!.x), Math.abs(p.y - px[k]!.y)) > 1)
    .length;

const painted = derived(() => [settings.attempt, A, B], attempt);
numbers(plane.gui, {
  'dx, dy': () => `${B.x - A.x}, ${B.y - A.y}`,
  'pixels painted': () => painted().length,
  holes: () => holes(painted()),
});

const grid = pixelGrid(COLS, ROWS);
const centre = (v: number) => Math.floor(v) + 0.5;
for (const end of [A, B])
  plane.handle({
    at: () => grid.toScreen(end),
    move: (p) => {
      const q = grid.toGrid(p);
      end.x = Math.min(COLS - 0.5, Math.max(0.5, centre(q.x)));
      end.y = Math.min(ROWS - 0.5, Math.max(0.5, centre(q.y)));
    },
  });

plane.onDraw((pen) => {
  const a = plane.area();
  grid.fit(a);
  const px = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let i = 0; i < px.length; i += 4) px.set([BACK[0], BACK[1], BACK[2], 255], i);
  for (const p of painted())
    if (p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS)
      px.set([INKED[0], INKED[1], INKED[2], 255], 4 * (p.y * COLS + p.x));
  grid.paint(pen, px);
  grid.caption(
    pen,
    painted().length === 0 ? `${settings.attempt}: no se pintó nada` : settings.attempt,
  );

  // The holes: a red mark between two pixels painted one after the other that do not touch.
  pen.strokeStyle = RED;
  pen.lineWidth = 2;
  painted().forEach((p, k) => {
    const q = painted()[k + 1];
    if (!q || Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) <= 1) return;
    const m = grid.toScreen({ x: (p.x + q.x) / 2 + 0.5, y: (p.y + q.y) / 2 + 0.5 });
    pen.beginPath();
    pen.arc(m.x, m.y, grid.cell * 0.28, 0, 2 * Math.PI);
    pen.stroke();
  });

  // The true line, thin.
  const [a0, b0] = [grid.toScreen(A), grid.toScreen(B)];
  pen.strokeStyle = BLUE;
  pen.lineWidth = 1.5;
  pen.beginPath();
  pen.moveTo(a0.x, a0.y);
  pen.lineTo(b0.x, b0.y);
  pen.stroke();
  dot(pen, a0, BLUE, 6);
  dot(pen, b0, ACCENT, 6);
});

console.log('Drag A and B, and try the three attempts: only the last never leaves holes.');
