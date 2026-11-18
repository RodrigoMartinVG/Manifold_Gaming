import { createPlane, MUTED, numbers, write } from 'lab/plane';

// ─── A PIXEL: three small lights, red, green and blue, each from 0 (off) to 255 (as bright as it goes). From
// where we sit we see one colour, their sum; up close, a screen shows the three side by side. ───

const plane = createPlane({ title: 'a pixel' });
const colour = { red: 229, green: 192, blue: 123 };
plane.gui.add(colour, 'red', 0, 255, 1);
plane.gui.add(colour, 'green', 0, 255, 1);
plane.gui.add(colour, 'blue', 0, 255, 1);

const hex = (n: number) => n.toString(16).padStart(2, '0');
numbers(plane.gui, {
  'the three numbers': () => `${colour.red}, ${colour.green}, ${colour.blue}`,
  'in CSS': () => `rgb(${colour.red}, ${colour.green}, ${colour.blue})`,
  'in hexadecimal': () => `#${hex(colour.red)}${hex(colour.green)}${hex(colour.blue)}`,
});

plane.onDraw((pen) => {
  const a = plane.area();
  const side = Math.max(40, Math.min(a.height - 44, (a.width - 40) / 2));
  const top = a.y + 26 + (a.height - 26 - side) / 2;
  const left = a.x + (a.width - 2 * side - 40) / 2;

  // What we see: the pixel's colour, one square.
  pen.fillStyle = `rgb(${colour.red}, ${colour.green}, ${colour.blue})`;
  pen.fillRect(left, top, side, side);
  write(pen, 'lo que ves', left, top - 10, { color: MUTED });

  // Up close: a patch of four by four pixels, each three stripes, each stripe as bright as its number.
  const x0 = left + side + 40;
  const n = 4;
  const p = side / n;
  pen.fillStyle = '#000';
  pen.fillRect(x0, top, side, side);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      [colour.red, colour.green, colour.blue].forEach((v, k) => {
        pen.fillStyle =
          k === 0 ? `rgb(${v}, 0, 0)` : k === 1 ? `rgb(0, ${v}, 0)` : `rgb(0, 0, ${v})`;
        const w = p / 3;
        pen.fillRect(x0 + i * p + k * w + w * 0.12, top + j * p + p * 0.06, w * 0.76, p * 0.88);
      });
  write(pen, 'de cerca: rojo, verde y azul', x0, top - 10, { color: MUTED });
});

console.log('Move the three lights: what you see is their sum.');
