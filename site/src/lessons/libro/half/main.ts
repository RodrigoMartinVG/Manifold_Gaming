import {
  ACCENT,
  canvasPixels,
  createPlane,
  derived,
  difference,
  numbers,
  pixelGrid,
} from 'lab/plane';

// ─── HALF A PIXEL. The canvas strokes a line as a band one pixel wide, centred on it, and paints each pixel as
// much as the band covers it. A line at a whole y runs along the border between two rows: it covers half of
// each, and two grey rows come out. At y + ½ it runs through the rows' centres: one row, whole. Ours paints
// the pixel each point falls in: always one row. ───

const COLS = 16;
const ROWS = 8;
const BACK = [24, 28, 52] as const;
const INKED = [229, 192, 123] as const;

const plane = createPlane({ title: 'half a pixel' });
const settings = { 'the line’s y': 4, 'show the band': true };
plane.gui.add(settings, 'the line’s y', 1, 7, 0.25);
plane.gui.add(settings, 'show the band');

// The line crosses the whole screen, from beyond its left edge to beyond its right one.
const y = () => settings['the line’s y'];
const theirs = () =>
  canvasPixels(COLS, ROWS, `rgb(${BACK.join(',')})`, (ctx) => {
    ctx.strokeStyle = `rgb(${INKED.join(',')})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, y());
    ctx.lineTo(COLS + 1, y());
    ctx.stroke();
  });
/** Ours: the steps of chapter 2's line, each landing in the pixel that contains it. */
function ours(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(COLS * ROWS * 4);
  for (let i = 0; i < px.length; i += 4) px.set([BACK[0], BACK[1], BACK[2], 255], i);
  const row = Math.floor(y());
  for (let x = 0; x < COLS; x++)
    if (row >= 0 && row < ROWS) px.set([INKED[0], INKED[1], INKED[2], 255], 4 * (row * COLS + x));
  return px;
}

const shown = derived(y, () => ({ a: theirs(), b: ours() }));
/** How much the canvas painted each row, at the middle column: 0 % (the background) to 100 % (the line's colour). */
const rows = () => {
  const out: string[] = [];
  for (let j = 0; j < ROWS; j++) {
    const v = shown().a[4 * (j * COLS + COLS / 2)]!;
    const share = Math.round((100 * (v - BACK[0])) / (INKED[0] - BACK[0]));
    if (share > 0) out.push(`${j}: ${share} %`);
  }
  return out;
};
numbers(plane.gui, {
  'rows the canvas paints': () => rows().length,
  'how much of each row': () => rows().join(', '),
  'rows ours paints': () => 1,
  'pixels that differ': () => difference(shown().a, shown().b).pixels,
});

const theirGrid = pixelGrid(COLS, ROWS);
const ourGrid = pixelGrid(COLS, ROWS);
plane.onDraw((pen) => {
  const a = plane.area();
  const top = { x: a.x, y: a.y, width: a.width, height: a.height / 2 - 6 };
  const bottom = { x: a.x, y: a.y + a.height / 2 + 6, width: a.width, height: a.height / 2 - 6 };
  theirGrid.fit(top);
  ourGrid.fit(bottom);
  theirGrid.paint(pen, shown().a);
  theirGrid.caption(pen, 'el del canvas: lineTo, de un píxel de ancho');
  ourGrid.paint(pen, shown().b);
  ourGrid.caption(pen, 'el nuestro: el píxel donde cae cada punto');
  for (const g of [theirGrid, ourGrid]) {
    const p0 = g.toScreen({ x: 0, y: y() });
    pen.strokeStyle = ACCENT;
    pen.lineWidth = 1;
    pen.beginPath();
    pen.moveTo(p0.x, p0.y);
    pen.lineTo(p0.x + COLS * g.cell, p0.y);
    pen.stroke();
  }
  if (settings['show the band']) {
    // The band the canvas fills: from half a pixel above the line to half a pixel below.
    const p0 = theirGrid.toScreen({ x: 0, y: y() - 0.5 });
    pen.strokeStyle = 'rgba(229, 192, 123, 0.9)';
    pen.setLineDash([5, 4]);
    pen.strokeRect(p0.x, p0.y, COLS * theirGrid.cell, theirGrid.cell);
    pen.setLineDash([]);
  }
});

console.log('Move the line by quarters of a pixel: at a whole y, two grey rows; at y + ½, one.');
