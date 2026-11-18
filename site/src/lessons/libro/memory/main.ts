import { ACCENT, createPlane, MUTED, numbers, pixelGrid, write } from 'lab/plane';

// ─── THE GRID IN MEMORY: a picture of 8 × 5 pixels is, in memory, one long line of numbers: the pixels one
// after another, row after row, four numbers each (red, green, blue, and how opaque). Pixel (x, y) is number
// y · 8 + x in that line, and its red is at 4 · (y · 8 + x). ───

const WIDTH = 8;
const HEIGHT = 5;
const plane = createPlane({ title: 'the grid in memory' });

// A small picture whose every pixel has numbers of its own: red grows to the right, green downwards.
const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
for (let y = 0; y < HEIGHT; y++)
  for (let x = 0; x < WIDTH; x++) {
    const i = 4 * (y * WIDTH + x);
    pixels[i] = 40 + 30 * x;
    pixels[i + 1] = 40 + 45 * y;
    pixels[i + 2] = 150;
    pixels[i + 3] = 255;
  }

let chosen = { x: 3, y: 2 };
const place = () => chosen.y * WIDTH + chosen.x;
numbers(plane.gui, {
  'pixel (x, y)': () => `${chosen.x}, ${chosen.y}`,
  'its place in the line': () => place(),
  'where its red is': () => 4 * place(),
  'its four numbers': () => {
    const i = 4 * place();
    return `${pixels[i]}, ${pixels[i + 1]}, ${pixels[i + 2]}, ${pixels[i + 3]}`;
  },
});

const grid = pixelGrid(WIDTH, HEIGHT);
plane.onPress((p) => {
  const hit = grid.pixelAt(p);
  if (hit) chosen = hit;
});

plane.onDraw((pen) => {
  const a = plane.area();
  const strip = Math.min(56, a.height * 0.22); // the line of memory, at the bottom
  grid.fit({ x: a.x + 18, y: a.y, width: a.width - 18, height: a.height - strip - 26 });
  grid.paint(pen, pixels);
  grid.caption(pen, 'la pantalla: x hacia la derecha, y hacia abajo');
  for (let x = 0; x < WIDTH; x++)
    write(pen, String(x), grid.x + (x + 0.5) * grid.cell, grid.y + HEIGHT * grid.cell + 14, {
      color: MUTED,
      align: 'center',
    });
  for (let y = 0; y < HEIGHT; y++)
    write(pen, String(y), grid.x - 8, grid.y + (y + 0.5) * grid.cell, {
      color: MUTED,
      align: 'right',
      baseline: 'middle',
    });
  grid.outline(pen, chosen.x, chosen.y, ACCENT, 3);

  // The same pixels as memory holds them: one line, the rows one after another.
  const n = WIDTH * HEIGHT;
  const w = a.width / n;
  const y0 = a.y + a.height - strip + 8;
  for (let k = 0; k < n; k++) {
    pen.fillStyle = `rgb(${pixels[4 * k]}, ${pixels[4 * k + 1]}, ${pixels[4 * k + 2]})`;
    pen.fillRect(a.x + k * w + 0.5, y0, w - 1, strip - 22);
    if (k % WIDTH === 0)
      write(pen, `fila ${k / WIDTH}`, a.x + k * w + 2, y0 + strip - 10, { color: MUTED, size: 10 });
  }
  const k = place();
  pen.strokeStyle = ACCENT;
  pen.lineWidth = 3;
  pen.strokeRect(a.x + k * w + 1.5, y0 - 1, w - 3, strip - 20);
  write(pen, 'la memoria: un píxel detrás de otro', a.x, y0 - 8, { color: MUTED });
});

console.log(
  'Press a pixel: it is number y · 8 + x in the line, and its red is at four times that.',
);
