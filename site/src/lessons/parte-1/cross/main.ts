import { arrow, axes, createLab, draggable, fan, numbers, path, point } from 'lab';
import { add, cross, dot, length, side, triple, vec, type Vec } from './vec';

// ─── THE LESSON is in vec.ts: the cross product, the triple product, and on which side of a facing a point
// is. Here they are at work, in the frame at the end ("OUR FUNCTIONS"). The rest is THE DRAWING. ───

const lab = createLab({
  title: 'the cross product',
  camera: [0.5, 8.5, 1.2],
  target: [0.5, 0, -1],
});
axes(lab, { length: 5, y: true });

const O = vec(0, 0, 0);
// Each tip is dragged on a level plane, at its height (on the floor, in "signed area").
let a = vec(3, 0, -1);
let b = vec(1, 0, -2);
let c = vec(1, -1, 0.5);

const settings = {
  mode: 'signed area' as 'signed area' | 'in space',
  'a height (m)': 0,
  'b height (m)': 0,
  'c height (m)': -1,
  'x then z': false,
};
type Triple = [number, number, number];
const VIEWS: Record<'signed area' | 'in space', { camera: Triple; target: Triple }> = {
  'signed area': { camera: [0.5, 8.5, 1.2], target: [0.5, 0, -1] },
  'in space': { camera: [9, 3.5, 11], target: [0.8, -1.5, 0] },
};
const look = () => {
  const v = VIEWS[settings.mode];
  lab.camera.position.set(...v.camera);
  lab.controls.target.set(...v.target);
};
lab.gui.add(settings, 'mode', ['signed area', 'in space']).onChange(look).listen();
lab.gui.add(settings, 'a height (m)', -3, 3, 0.5).listen();
lab.gui.add(settings, 'b height (m)', -3, 3, 0.5).listen();
lab.gui.add(settings, 'c height (m)', -3, 3, 0.5).listen();
lab.gui.add(settings, 'x then z');
lab.gui.add(
  {
    'worked example': () => {
      a = vec(3, 0, -1);
      b = vec(1, 0, -2);
      Object.assign(settings, {
        mode: 'signed area',
        'a height (m)': 0,
        'b height (m)': 0,
        'x then z': false,
      });
      look();
    },
  },
  'worked example',
);
lab.gui.add(
  {
    'space example': () => {
      a = vec(2, 1, 0);
      b = vec(0, 1, 3);
      c = vec(1, -1, 0.5);
      Object.assign(settings, {
        mode: 'in space',
        'a height (m)': 1,
        'b height (m)': 1,
        'c height (m)': -1,
      });
      look();
    },
  },
  'space example',
);

const spatial = () => settings.mode === 'in space';
/** The tips as the figure uses them: on the floor, or at their heights. */
const A = () => vec(a.x, spatial() ? settings['a height (m)'] : 0, a.z);
const B = () => vec(b.x, spatial() ? settings['b height (m)'] : 0, b.z);
const C = () => vec(c.x, settings['c height (m)'], c.z);

const draw = {
  a: arrow(lab, { color: 0xe06c75, label: 'a' }),
  b: arrow(lab, { color: 0x61afef, width: 0.037, label: 'b' }),
  axb: arrow(lab, { color: 0xe5c07b, width: 0.045, label: 'a × b' }),
  c: arrow(lab, { color: 0xc678dd, width: 0.03, label: 'c' }),
  // The parallelogram on a and b: green if b is counterclockwise from a seen from above, red if not.
  area: fan(lab, { color: 0x98c379, opacity: 0.35 }),
  // Its three shadows, on the planes x = 0, y = 0 and z = 0.
  shadowX: fan(lab, { color: 0xe0605a, opacity: 0.25 }),
  shadowY: fan(lab, { color: 0x6cc070, opacity: 0.25 }),
  shadowZ: fan(lab, { color: 0x5a9ae6, opacity: 0.25 }),
  box: path(lab, { color: 0xc678dd, opacity: 0.6, pairs: true }),
};
const tipA = point(lab, { color: 0xe06c75, radius: 0.12 });
const tipB = point(lab, { color: 0x61afef, radius: 0.12 });
const tipC = point(lab, { color: 0xc678dd, radius: 0.1 });

// DRAGGING A TIP on the level plane at its height (y = h: normal (0, 1, 0), d = −h), to half meters.
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
const level = (h: () => number) => () => ({ normal: vec(0, 1, 0), d: -h() });
draggable(lab, tipA.mesh, {
  plane: level(() => A().y),
  move: (p) => (a = vec(half(p.x), 0, half(p.z))),
});
draggable(lab, tipB.mesh, {
  plane: level(() => B().y),
  move: (p) => (b = vec(half(p.x), 0, half(p.z))),
});
draggable(lab, tipC.mesh, {
  plane: level(() => C().y),
  move: (p) => (c = vec(half(p.x), 0, half(p.z))),
});

// THE PANEL (two decimals; lengths and areas with three).
const num = (x: number, digits = 2) => x.toFixed(digits).replace(/^-(0\.0+)$/, '$1');
const show = (u: Vec) => `${num(u.x)}, ${num(u.y)}, ${num(u.z)}`;
/** The angle between two vectors, measured by the drawing (Math.acos: not the lesson), to compare. */
const angle = (u: Vec, w: Vec) =>
  Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (length(u) * length(w) || 1))));
/** Seen from above: ours, f_z t_x − f_x t_z; or, with "x then z", the naive f_x t_z − f_z t_x. */
const seenFromAbove = () => {
  if (!settings['x then z']) return side(A(), B());
  const s = A().x * B().z - A().z * B().x;
  return s > 0 ? 'left' : s < 0 ? 'right' : 'in line';
};
numbers(lab.gui, {
  'vector a': () => show(A()),
  'vector b': () => show(B()),
  'a × b': () => show(cross(A(), B())),
  '|a × b|': () => num(length(cross(A(), B())), 3),
  '|a| |b| sin θ': () => num(length(A()) * length(B()) * Math.sin(angle(A(), B())), 3),
  'area of triangle': () => num(length(cross(A(), B())) / 2, 3),
  'side (seen from above)': () => seenFromAbove(),
  '(a × b) · a': () => num(dot(cross(A(), B()), A()), 3),
  '[a, b, c]': () => num(triple(A(), B(), C()), 3),
  'right-handed': () =>
    triple(A(), B(), C()) > 0 ? 'yes' : triple(A(), B(), C()) < 0 ? 'no' : 'flat',
});

/** A point's shadow on the plane where one coordinate is 0. */
const flat = (p: Vec, k: 'x' | 'y' | 'z') => ({ ...p, [k]: 0 });

lab.onFrame(() => {
  const [pa, pb, pc] = [A(), B(), C()];
  const space = spatial();
  // ─── THE LESSON, AT WORK ───
  // OUR FUNCTIONS: the cross product, perpendicular to both, and the box's signed volume.
  const n = cross(pa, pb);
  draw.a.set(O, pa);
  draw.b.set(O, pb);
  draw.axb.set(O, n).show(space || Math.abs(n.y) > 0);
  // The parallelogram, colored by the sign of its area seen from above (the y component of a × b).
  const corners = [pa, add(pa, pb), pb];
  draw.area.set(O, corners);
  // (In space, a neutral color: its shadows carry the signs, each seen from its own axis.)
  const tint = space ? 0xe5c07b : n.y >= 0 ? 0x98c379 : 0xe06c75;
  (draw.area.mesh.material as { color: { setHex(c: number): void } }).color.setHex(tint);
  // In space: its shadows on the three coordinate planes (their signed areas are a × b's components), and
  // the box on a, b and c.
  draw.shadowX
    .set(
      O,
      corners.map((p) => flat(p, 'x')),
    )
    .show(space);
  draw.shadowY
    .set(
      O,
      corners.map((p) => flat(p, 'y')),
    )
    .show(space);
  draw.shadowZ
    .set(
      O,
      corners.map((p) => flat(p, 'z')),
    )
    .show(space);
  draw.c.set(O, pc).show(space);
  const ab = add(pa, pb);
  const edges: Vec[] = [O, pa, O, pb, pa, ab, pb, ab];
  const top = (p: Vec) => add(p, pc);
  edges.push(
    ...[O, pa, pb, ab].flatMap((p) => [p, top(p)]),
    top(O),
    top(pa),
    top(O),
    top(pb),
    top(pa),
    top(ab),
    top(pb),
    top(ab),
  );
  draw.box.set(edges).show(space);
  tipA.set(pa);
  tipB.set(pb);
  tipC.set(pc).show(space);
});

console.log('Drag the tips; "in space" gives them heights, and c makes a box with a and b.');
