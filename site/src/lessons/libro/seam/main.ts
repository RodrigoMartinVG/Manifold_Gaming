import { canvasPixels, createPlane, derived, numbers, pixelGrid, type Point } from 'lab/plane';

// ─── TWO NEIGHBOURS. A square cut along its diagonal into two triangles: twelve pixel centres lie exactly on the
// edge they share. Asking "≥ 0" paints them twice; "> 0", never; the top-left rule gives each to one triangle only.
// The canvas paints each triangle in the measure it covers the pixel: half and half, and the edge comes out as a
// seam. ───

const COLS = 18;
const ROWS = 14;
const BACK = [24, 28, 52] as const;
const ONE = [97, 175, 239] as const; // the triangle above the diagonal
const TWO = [229, 192, 123] as const; // the one below it
const RULES = ['≥ 0 (both take it)', '> 0 (neither takes it)', 'top-left'] as const;
type Rule = (typeof RULES)[number];

const plane = createPlane({ title: 'two neighbours' });
const settings = { rule: 'top-left' as Rule };
plane.gui.add(settings, 'rule', [...RULES]);

const T1: [Point, Point, Point] = [
  { x: 2, y: 1 },
  { x: 14, y: 1 },
  { x: 14, y: 13 },
];
const T2: [Point, Point, Point] = [
  { x: 2, y: 1 },
  { x: 14, y: 13 },
  { x: 2, y: 13 },
];
const edge = (u: Point, v: Point, p: Point) =>
  (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
/** The top-left rule (with these corners in this order, the area is positive): a top edge goes right, a left one up. */
const topLeft = (u: Point, v: Point) => v.y - u.y < 0 || (v.y === u.y && v.x - u.x > 0);
function takes(t: [Point, Point, Point], i: number, j: number): boolean {
  const p = { x: i + 0.5, y: j + 0.5 };
  return [0, 1, 2].every((k) => {
    const [u, v] = [t[k]!, t[(k + 1) % 3]!];
    const w = edge(u, v, p);
    if (settings.rule === '≥ 0 (both take it)') return w >= 0;
    if (settings.rule === '> 0 (neither takes it)') return w > 0;
    return w > 0 || (w === 0 && topLeft(u, v));
  });
}

/** Ours: each triangle mixes its colour in at 60 %, so a pixel painted twice shows both, and a missed one none. */
const ours = derived(
  () => settings.rule,
  () => {
    const px = new Uint8ClampedArray(COLS * ROWS * 4);
    let twice = 0;
    let neither = 0;
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        let c: number[] = [...BACK];
        const [a, b] = [takes(T1, i, j), takes(T2, i, j)];
        for (const [hit, col] of [
          [a, ONE],
          [b, TWO],
        ] as const)
          if (hit) c = c.map((v, k) => Math.round(0.4 * v + 0.6 * col[k]!));
        if (a && b) twice++;
        const inSquare = i >= 2 && i < 14 && j >= 1 && j < 13;
        if (inSquare && !a && !b) neither++;
        px.set([c[0]!, c[1]!, c[2]!, 255], 4 * (j * COLS + i));
      }
    return { px, twice, neither };
  },
);
/** The canvas's: both triangles filled whole, the same colour, opaque; their shared edge, each half covered. */
const theirs = canvasPixels(COLS, ROWS, `rgb(${BACK.join(',')})`, (ctx) => {
  ctx.fillStyle = `rgb(${TWO.join(',')})`;
  for (const t of [T1, T2]) {
    ctx.beginPath();
    for (const q of t) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fill();
  }
});
const seam = (() => {
  let n = 0;
  for (let j = 1; j < 13; j++) {
    const i = j + 1; // the pixels whose centre is on the diagonal
    if (theirs[4 * (j * COLS + i)]! < TWO[0]) n++;
  }
  return n;
})();
numbers(plane.gui, {
  'pixels painted twice': () => ours().twice,
  'pixels painted by neither': () => ours().neither,
  'the canvas: seam pixels not whole': () => seam,
});

const top = pixelGrid(COLS, ROWS);
const bottom = pixelGrid(COLS, ROWS);
plane.onDraw((pen) => {
  const a = plane.area();
  const h = (a.height - 12) / 2;
  top.fit({ x: a.x, y: a.y, width: a.width, height: h });
  bottom.fit({ x: a.x, y: a.y + h + 12, width: a.width, height: h });
  top.paint(pen, ours().px);
  top.caption(pen, `el nuestro: ${settings.rule}`);
  bottom.paint(pen, theirs);
  bottom.caption(pen, 'el del canvas: dos fill del mismo color');
  for (const g of [top, bottom]) {
    const p = (q: Point) => g.toScreen(q);
    pen.strokeStyle = 'rgba(232, 223, 208, 0.55)';
    pen.lineWidth = 1;
    pen.beginPath();
    pen.moveTo(p(T1[0]).x, p(T1[0]).y);
    pen.lineTo(p(T1[2]).x, p(T1[2]).y);
    pen.stroke();
  }
});

console.log('Change the rule: twelve pixels on the shared edge, painted twice, never, or once.');
