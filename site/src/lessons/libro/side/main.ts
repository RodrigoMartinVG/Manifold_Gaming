import {
  ACCENT,
  BLUE,
  createPlane,
  dot,
  MUTED,
  numbers,
  pixelGrid,
  RED,
  write,
  type Point,
} from 'lab/plane';

// ─── WHICH SIDE? The way from A to B, (dx₁, dy₁), and from A to P, (dx₂, dy₂). The number dx₁·dy₂ − dy₁·dx₂ is the
// area of the parallelogram they span, with a sign: positive on one side of the line through A and B, negative on
// the other, zero on it. Half of it, without the sign, is the area of the triangle ABP. ───

const COLS = 14;
const ROWS = 10;
const plane = createPlane({ title: 'which side?' });
const A = { x: 2, y: 6 };
const B = { x: 10, y: 2 };
const P = { x: 7, y: 7 };

const det = () => (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x);
const f = (v: number) => (Math.round(v * 100) / 100).toString();
numbers(plane.gui, {
  'A to B (dx₁, dy₁)': () => `${f(B.x - A.x)}, ${f(B.y - A.y)}`,
  'A to P (dx₂, dy₂)': () => `${f(P.x - A.x)}, ${f(P.y - A.y)}`,
  'dx₁·dy₂ − dy₁·dx₂': () => f(det()),
  side: () => (det() > 0 ? 'positive' : det() < 0 ? 'negative' : 'on the line'),
  'area of the triangle ABP': () => f(Math.abs(det()) / 2),
});

const grid = pixelGrid(COLS, ROWS);
const half = (v: number) => Math.round(v * 2) / 2;
for (const q of [A, B, P])
  plane.handle({
    at: () => grid.toScreen(q),
    move: (p) => {
      const g = grid.toGrid(p);
      q.x = Math.min(COLS, Math.max(0, half(g.x)));
      q.y = Math.min(ROWS, Math.max(0, half(g.y)));
    },
  });

plane.onDraw((pen) => {
  const a = plane.area();
  grid.fit({ x: a.x + 16, y: a.y, width: a.width - 16, height: a.height - 14 });
  const blank = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let i = 0; i < blank.length; i += 4) blank.set([30, 26, 22, 255], i);
  grid.paint(pen, blank);
  grid.caption(pen, 'x hacia la derecha, y hacia abajo');
  const s = (q: Point) => grid.toScreen(q);

  // The two sides of the line through A and B, tinted: each pixel of the frame by the sign it gives.
  pen.save();
  pen.beginPath();
  pen.rect(grid.x, grid.y, COLS * grid.cell, ROWS * grid.cell);
  pen.clip();
  const step = Math.max(4, grid.cell / 3);
  for (let y = grid.y; y < grid.y + ROWS * grid.cell; y += step)
    for (let x = grid.x; x < grid.x + COLS * grid.cell; x += step) {
      const q = grid.toGrid({ x: x + step / 2, y: y + step / 2 });
      const d = (B.x - A.x) * (q.y - A.y) - (B.y - A.y) * (q.x - A.x);
      pen.fillStyle = d > 0 ? 'rgba(97, 175, 239, 0.12)' : 'rgba(224, 108, 117, 0.12)';
      pen.fillRect(x, y, step, step);
    }
  // The whole line through A and B.
  const far = (t: number) => s({ x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) });
  pen.strokeStyle = MUTED;
  pen.setLineDash([4, 5]);
  pen.beginPath();
  pen.moveTo(far(-4).x, far(-4).y);
  pen.lineTo(far(5).x, far(5).y);
  pen.stroke();
  pen.setLineDash([]);
  pen.restore();

  // The parallelogram of the two ways, A → B and A → P, and the triangle ABP, half of it: inside the frame only.
  pen.save();
  pen.beginPath();
  pen.rect(grid.x, grid.y, COLS * grid.cell, ROWS * grid.cell);
  pen.clip();
  const Q = { x: B.x + P.x - A.x, y: B.y + P.y - A.y };
  pen.fillStyle = det() >= 0 ? 'rgba(97, 175, 239, 0.25)' : 'rgba(224, 108, 117, 0.25)';
  pen.beginPath();
  for (const q of [A, B, Q, P]) pen.lineTo(s(q).x, s(q).y);
  pen.closePath();
  pen.fill();
  pen.fillStyle = 'rgba(229, 192, 123, 0.35)';
  pen.beginPath();
  for (const q of [A, B, P]) pen.lineTo(s(q).x, s(q).y);
  pen.closePath();
  pen.fill();
  pen.restore();

  pen.lineWidth = 2.5;
  for (const [to, colour] of [
    [B, BLUE],
    [P, ACCENT],
  ] as const) {
    pen.strokeStyle = colour;
    pen.beginPath();
    pen.moveTo(s(A).x, s(A).y);
    pen.lineTo(s(to).x, s(to).y);
    pen.stroke();
  }
  dot(pen, s(A), MUTED, 6);
  dot(pen, s(B), BLUE, 7);
  dot(pen, s(P), det() >= 0 ? BLUE : RED, 7);
  write(pen, 'A', s(A).x - 10, s(A).y - 8, { bold: true, align: 'right' });
  write(pen, 'B', s(B).x + 10, s(B).y - 8, { bold: true });
  write(pen, 'P', s(P).x + 10, s(P).y + 14, { bold: true, color: ACCENT });
});

console.log(
  'Drag P across the line: the number changes sign there, and is twice the triangle’s area.',
);
