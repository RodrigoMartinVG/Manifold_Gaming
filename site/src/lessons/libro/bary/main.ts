import { createPlane, derived, dot, INK, numbers, pixelGrid, write, type Point } from 'lab/plane';

// ─── THREE CORNERS, MIXED. A point P inside the triangle cuts it in three: the one in front of A (P, B, C), in front
// of B (P, C, A), in front of C (P, A, B). Their shares of the whole area are P's weights for A, B and C: they add up
// to one, and P is the corners mixed in those weights; so is its colour. ───

const COLS = 24;
const ROWS = 16;
const BACK = [24, 28, 52] as const;
const CA = [230, 70, 70] as const;
const CB = [70, 200, 100] as const;
const CC = [70, 120, 240] as const;
const plane = createPlane({ title: 'three corners' });

const A = { x: 2, y: 14 };
const B = { x: 12, y: 1 };
const C = { x: 22, y: 14 };
const P = { x: 12, y: 10 };
const edge = (u: Point, v: Point, p: Point) =>
  (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
/** P's weights for A, B and C: the areas of the three triangles it cuts, over the whole. */
const weights = (p: Point) => {
  const all = edge(A, B, C);
  return [edge(B, C, p) / all, edge(C, A, p) / all, edge(A, B, p) / all] as const;
};
const mix = (w: readonly [number, number, number]) =>
  [0, 1, 2].map((k) => Math.round(w[0] * CA[k]! + w[1] * CB[k]! + w[2] * CC[k]!));

const picture = derived(
  () => [A, B, C],
  () => {
    const px = new Uint8ClampedArray(COLS * ROWS * 4);
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const w = weights({ x: i + 0.5, y: j + 0.5 });
        const c = w.every((v) => v >= 0) ? mix(w) : [...BACK];
        px.set([c[0]!, c[1]!, c[2]!, 255], 4 * (j * COLS + i));
      }
    return px;
  },
);
const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
numbers(plane.gui, {
  P: () => `${P.x}, ${P.y}`,
  'weight of A (red)': () => f(weights(P)[0]),
  'weight of B (green)': () => f(weights(P)[1]),
  'weight of C (blue)': () => f(weights(P)[2]),
  'their sum': () => f(weights(P).reduce((s, v) => s + v, 0)),
  'colour at P': () => mix(weights(P)).join(', '),
});

const grid = pixelGrid(COLS, ROWS);
const half = (v: number) => Math.round(v * 2) / 2;
plane.handle({
  at: () => grid.toScreen(P),
  move: (p) => {
    const g = grid.toGrid(p);
    P.x = Math.min(COLS, Math.max(0, half(g.x)));
    P.y = Math.min(ROWS, Math.max(0, half(g.y)));
  },
});
for (const q of [A, B, C])
  plane.handle({
    at: () => grid.toScreen(q),
    move: (p) => {
      const g = grid.toGrid(p);
      q.x = Math.min(COLS, Math.max(0, Math.round(g.x)));
      q.y = Math.min(ROWS, Math.max(0, Math.round(g.y)));
    },
  });

plane.onDraw((pen) => {
  const a = plane.area();
  grid.fit(a);
  grid.paint(pen, picture());
  grid.caption(pen, 'cada píxel, sus tres esquinas mezcladas en sus pesos');
  const s = (q: Point) => grid.toScreen(q);
  // The three triangles P cuts, outlined: each in front of the corner whose weight it is.
  pen.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  pen.lineWidth = 1.5;
  for (const q of [A, B, C]) {
    pen.beginPath();
    pen.moveTo(s(P).x, s(P).y);
    pen.lineTo(s(q).x, s(q).y);
    pen.stroke();
  }
  pen.beginPath();
  for (const q of [A, B, C]) pen.lineTo(s(q).x, s(q).y);
  pen.closePath();
  pen.stroke();
  for (const [q, c, name] of [
    [A, CA, 'A'],
    [B, CB, 'B'],
    [C, CC, 'C'],
  ] as const) {
    dot(pen, s(q), `rgb(${c.join(',')})`, 7);
    write(pen, name, s(q).x + (q === A ? -12 : q === C ? 12 : 0), s(q).y + (q === B ? -10 : 18), {
      bold: true,
      align: q === A ? 'right' : q === C ? 'left' : 'center',
      color: INK,
    });
  }
  dot(pen, s(P), '#ffffff', 6);
  write(pen, 'P', s(P).x + 10, s(P).y - 8, { bold: true, color: INK });
});

console.log(
  'Drag P: its three weights are the three small triangles’ shares of the whole, and they add up to one.',
);
