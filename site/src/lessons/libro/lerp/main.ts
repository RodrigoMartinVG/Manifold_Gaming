import {
  ACCENT,
  BLUE,
  createPlane,
  dot,
  MUTED,
  numbers,
  pixelGrid,
  write,
  type Point,
} from 'lab/plane';

// ─── A POINT THAT TRAVELS: P = (1 − t)·A + t·B. At t = 0 it is A, at t = 1 it is B, and between, it is on the
// segment, because it moves t·dx across and t·dy down: always in the proportion dy : dx. The two triangles,
// A to P and A to B, have proportional legs. Outside 0 to 1 it keeps going, behind A or beyond B. ───

const COLS = 14;
const ROWS = 10;
const plane = createPlane({ title: 'a point that travels' });
const settings = { t: 0.25 };
plane.gui.add(settings, 't', -0.5, 1.5, 0.05);

const A = { x: 2, y: 3 };
const B = { x: 10, y: 7 };
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: (1 - t) * a.x + t * b.x,
  y: (1 - t) * a.y + t * b.y,
});
const P = () => lerp(A, B, settings.t);

const f = (v: number) => (Math.round(v * 100) / 100).toString();
const pair = (p: Point) => `${f(p.x)}, ${f(p.y)}`;
numbers(plane.gui, {
  A: () => pair(A),
  B: () => pair(B),
  'P = (1 − t)·A + t·B': () => pair(P()),
  'the weights 1 − t and t': () => `${f(1 - settings.t)}, ${f(settings.t)}`,
});

const grid = pixelGrid(COLS, ROWS);
const half = (v: number) => Math.round(v * 2) / 2;
for (const end of [A, B])
  plane.handle({
    at: () => grid.toScreen(end),
    move: (p) => {
      const q = grid.toGrid(p);
      end.x = Math.min(COLS, Math.max(0, half(q.x)));
      end.y = Math.min(ROWS, Math.max(0, half(q.y)));
    },
  });

plane.onDraw((pen) => {
  const a = plane.area();
  grid.fit({ x: a.x + 16, y: a.y, width: a.width - 16, height: a.height - 14 });
  const blank = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let i = 0; i < blank.length; i += 4) blank.set([30, 26, 22, 255], i);
  grid.paint(pen, blank);
  grid.caption(pen, 'x hacia la derecha, y hacia abajo, como en la pantalla');
  for (let x = 0; x <= COLS; x += 2)
    write(pen, String(x), grid.x + x * grid.cell, grid.y + ROWS * grid.cell + 13, {
      color: MUTED,
      align: 'center',
      size: 11,
    });
  for (let y = 0; y <= ROWS; y += 2)
    write(pen, String(y), grid.x - 6, grid.y + y * grid.cell, {
      color: MUTED,
      align: 'right',
      baseline: 'middle',
      size: 11,
    });

  const s = (p: Point) => grid.toScreen(p);
  const p = P();
  // The whole line through A and B, faint, and the segment between them.
  const far0 = s(lerp(A, B, -3));
  const far1 = s(lerp(A, B, 4));
  pen.save();
  pen.beginPath();
  pen.rect(grid.x, grid.y, COLS * grid.cell, ROWS * grid.cell);
  pen.clip();
  pen.setLineDash([4, 5]);
  pen.strokeStyle = MUTED;
  pen.lineWidth = 1;
  pen.beginPath();
  pen.moveTo(far0.x, far0.y);
  pen.lineTo(far1.x, far1.y);
  pen.stroke();
  pen.setLineDash([]);
  pen.restore();

  // The two triangles: A to B (its legs dx and dy), and A to P (its legs t·dx and t·dy).
  const corner = (q: Point) => s({ x: q.x, y: A.y });
  pen.strokeStyle = 'rgba(97, 175, 239, 0.45)';
  pen.lineWidth = 1.5;
  pen.beginPath();
  pen.moveTo(s(A).x, s(A).y);
  pen.lineTo(corner(B).x, corner(B).y);
  pen.lineTo(s(B).x, s(B).y);
  pen.stroke();
  pen.strokeStyle = 'rgba(229, 192, 123, 0.8)';
  pen.setLineDash([3, 3]);
  pen.beginPath();
  pen.moveTo(s(A).x, s(A).y);
  pen.lineTo(corner(p).x, corner(p).y);
  pen.lineTo(s(p).x, s(p).y);
  pen.stroke();
  pen.setLineDash([]);

  pen.strokeStyle = BLUE;
  pen.lineWidth = 2.5;
  pen.beginPath();
  pen.moveTo(s(A).x, s(A).y);
  pen.lineTo(s(B).x, s(B).y);
  pen.stroke();

  dot(pen, s(A), BLUE, 7);
  dot(pen, s(B), BLUE, 7);
  dot(pen, s(p), ACCENT, 6);
  write(pen, 'A', s(A).x - 10, s(A).y - 10, { bold: true, align: 'right' });
  write(pen, 'B', s(B).x + 10, s(B).y + 16, { bold: true });
  write(pen, 'P', s(p).x + 10, s(p).y - 8, { bold: true, color: ACCENT });
});

console.log('Move t, or drag A and B: P is (1 − t)·A + t·B, on the line through them.');
