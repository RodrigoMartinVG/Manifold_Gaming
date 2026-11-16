import * as THREE from 'three';
import { arrow, axes, circle, createLab, draggable, numbers, point } from 'lab';
import { add, length, normalize, scale, sub, vec, type Vec } from './vec';

// THE FLOOR SEEN FROM ABOVE: +X to the right, +Z towards us (down on the screen), +Y up, out of it.
// Each square of the grid is 1 m. The figure (`lab`) is the tutorial's shared kit: its source is one
// click away, under the editor.
const lab = createLab({
  title: 'vectors on the floor',
  camera: [0.5, 8.5, 1.2],
  target: [0.5, 0, -1],
});
axes(lab, { length: 5 });

// TWO VECTORS, a and b, drawn from the origin O. Their tips can be dragged.
const O = vec(0, 0, 0);
let a = vec(3, 0, -1);
let b = vec(1, 0, -2);

const draw = {
  a: arrow(lab, { color: 0xe06c75, label: 'a' }),
  b: arrow(lab, { color: 0x61afef, width: 0.037, label: 'b' }),
  // b again from a's tip, and a again from b's tip: the same vectors, drawn elsewhere. They are the
  // sides of the parallelogram.
  bAfterA: arrow(lab, { color: 0x61afef, width: 0.02, opacity: 0.45 }),
  aAfterB: arrow(lab, { color: 0xe06c75, width: 0.02, opacity: 0.45 }),
  sum: arrow(lab, { color: 0xe5c07b, width: 0.034, label: 'a + b' }),
  difference: arrow(lab, {
    color: 0x98c379,
    width: 0.032,
    label: 'a − b',
    labelAt: 0.5,
    labelSide: 16,
  }),
  stretched: arrow(lab, { color: 0xc678dd, width: 0.03, label: 'k a', labelSide: -16 }),
  // â lies along a: drawn over it.
  unit: arrow(lab, {
    color: 0xf2efe9,
    width: 0.026,
    label: 'â',
    labelAt: 0.6,
    labelSide: 16,
    over: true,
  }),
};
// (Where two lie along each other, the thinner one is under: a over b over a + b, as they are listed.)
// Where every unit vector of the floor ends: the circle of radius 1.
circle(lab, { color: 0xf2efe9, radius: 1, opacity: 0.3 });
// The tips that can be taken.
const tipA = point(lab, { color: 0xe06c75, radius: 0.12 });
const tipB = point(lab, { color: 0x61afef, radius: 0.12 });

const settings = { 'scalar k': -0.5, autopilot: true };
lab.gui.add(settings, 'scalar k', -2, 2, 0.1);
const pilot = lab.gui.add(settings, 'autopilot').listen();

// DRAGGING A TIP across the floor, the plane y = 0 (normal (0, 1, 0), d = 0), rounded to half meters
// so a tip can land on exact numbers, and on the origin.
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
const FLOOR = { normal: vec(0, 1, 0), d: 0 };
const stopPilot = () => (settings.autopilot = false);
draggable(lab, tipA.mesh, {
  plane: () => FLOOR,
  move: (p) => (a = vec(half(p.x), 0, half(p.z))),
  start: stopPilot,
});
draggable(lab, tipB.mesh, {
  plane: () => FLOOR,
  move: (p) => (b = vec(half(p.x), 0, half(p.z))),
  start: stopPilot,
});

// THE AUTOPILOT: the tips go from stop to stop, and rest at each one. The first stop is the page's
// worked example; at the third, b points like a, and |a + b| = |a| + |b|.
const STOPS = [
  { a: vec(3, 0, -1), b: vec(1, 0, -2) },
  { a: vec(1, 0, -3), b: vec(-2, 0, -1) },
  { a: vec(-2, 0, -1), b: vec(-1, 0, -0.5) },
  { a: vec(-1, 0, 2), b: vec(1.5, 0, -2) },
];
const MOVE = 3; // s from one stop to the next
const REST = 2.5; // s at each stop
let next = 0; // the stop it goes to
let from = { a, b };
let clock = MOVE; // it starts resting at the first stop

/** From the point P (s = 0) to Q (s = 1), along the segment: P + s (Q − P). */
const between = (p: Vec, q: Vec, s: number) => add(p, scale(sub(q, p), s));
/** Slow at both ends of a move. */
const ease = (s: number) => s * s * (3 - 2 * s);

function autopilot(dt: number) {
  clock += dt;
  if (clock >= MOVE + REST) {
    from = STOPS[next];
    next = (next + 1) % STOPS.length;
    clock = 0;
  }
  const s = ease(Math.min(1, clock / MOVE));
  a = between(from.a, STOPS[next].a, s);
  b = between(from.b, STOPS[next].b, s);
}
// Ticked again, it goes on to its next stop from where the tips are.
pilot.onChange((on: boolean) => {
  if (on) {
    from = { a, b };
    clock = 0;
  }
});

// THE PANEL: components with two decimals, lengths and unit vectors with three (and −0.00 is 0.00).
const num = (x: number, digits: number) => x.toFixed(digits).replace(/^-(0\.0+)$/, '$1');
const show = (u: Vec, digits = 2) =>
  `${num(u.x, digits)}, ${num(u.y, digits)}, ${num(u.z, digits)}`;
// three.js's vectors, to compare. Its methods change the vector they are called on (`a3.add(b3)`
// would change a3 itself), so it copies first, with `clone()`.
const a3 = () => new THREE.Vector3(a.x, a.y, a.z);
const b3 = () => new THREE.Vector3(b.x, b.y, b.z);
numbers(lab.gui, {
  'vector a': () => show(a),
  'vector b': () => show(b),
  'sum a + b': () => show(add(a, b)),
  'difference a − b': () => show(sub(a, b)),
  'unit â': () => show(normalize(a), 3),
  'length |a|': () => num(length(a), 3),
  'length |b|': () => num(length(b), 3),
  'length |a + b|': () => num(length(add(a, b)), 3),
  '|a| + |b|': () => num(length(a) + length(b), 3),
  'length |k a|': () => num(length(scale(a, settings['scalar k'])), 3),
  'length |â|': () => num(length(normalize(a)), 3),
  'three.js a + b': () => show(a3().clone().add(b3())),
  'three.js â': () => show(a3().clone().normalize(), 3),
});

lab.onFrame((dt) => {
  if (settings.autopilot) autopilot(dt);
  // OUR FUNCTIONS: each one makes a new vector, and leaves a and b as they were.
  const sum = add(a, b);
  draw.a.set(O, a);
  draw.b.set(O, b);
  draw.bAfterA.set(a, b); // tip to tail: a, then b, ends at a + b
  draw.aAfterB.set(b, a); // b, then a: the same point
  draw.sum.set(O, sum);
  draw.difference.set(b, sub(a, b)); // from b's tip to a's: b + (a − b) = a
  draw.stretched.set(O, scale(a, settings['scalar k']));
  draw.unit.set(O, normalize(a));
  tipA.set(a);
  tipB.set(b);
});

console.log('Drag the tips of a and b (their balls); the autopilot comes back when ticked.');
