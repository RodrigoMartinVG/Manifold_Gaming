import { arrow, axes, createLab, draggable, fan, line, numbers, point, rightAngle } from 'lab';
import { dot, length, normalize, project, reject, scale, vec, type Vec } from './vec';

// ─── THE SHADOW OF A VECTOR: how much of a goes along b's line (a‖, the projection) and what is left across
// it (a⊥, the rejection). THE LESSON is in vec.ts; the rest is THE DRAWING, with the lab kit. ───

const lab = createLab({
  title: 'the shadow of a vector',
  camera: [0.5, 8.5, 1.2],
  target: [0.5, 0, -1],
});
axes(lab, { length: 5 });

const O = vec(0, 0, 0);
let a = vec(3, 0, -1);
let b = vec(1, 0, -2);
const settings = { 'flip b': false, 'b × 2': false };
lab.gui.add(settings, 'flip b').listen();
lab.gui.add(settings, 'b × 2').listen();
lab.gui.add(
  {
    'worked example': () => {
      [a, b] = [vec(3, 0, -1), vec(1, 0, -2)];
      settings['flip b'] = settings['b × 2'] = false;
    },
  },
  'worked example',
);

const draw = {
  bLine: line(lab, { color: 0x61afef, dashed: true, opacity: 0.6 }),
  a: arrow(lab, { color: 0xe06c75, label: 'a' }),
  b: arrow(lab, { color: 0x61afef, width: 0.037, label: 'b' }),
  along: arrow(lab, { color: 0xe5c07b, width: 0.045, label: 'a‖', labelAt: 0.5, labelSide: 18 }),
  across: arrow(lab, { color: 0x98c379, width: 0.032, label: 'a⊥', labelAt: 0.55, labelSide: 16 }),
  light: line(lab, { color: 0xe06c75, dashed: true, opacity: 0.5 }),
  square: rightAngle(lab, { color: 0xf2efe9 }),
  theta: fan(lab, { color: 0xc678dd, opacity: 0.35 }),
};
const thetaLabel = lab.label('θ').color('#c678dd');
const tipA = point(lab, { color: 0xe06c75, radius: 0.12 });
const tipB = point(lab, { color: 0x61afef, radius: 0.12 });

// b as it is used: flipped, doubled, or as dragged; its tip drawn where it ends, and dragged from there.
const factor = () => (settings['flip b'] ? -1 : 1) * (settings['b × 2'] ? 2 : 1);
const B = () => scale(b, factor());
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
const FLOOR = { normal: vec(0, 1, 0), d: 0 };
draggable(lab, tipA.mesh, { plane: () => FLOOR, move: (p) => (a = vec(half(p.x), 0, half(p.z))) });
draggable(lab, tipB.mesh, {
  plane: () => FLOOR,
  move: (p) => (b = scale(vec(half(p.x), 0, half(p.z)), 1 / factor())),
});

// The angle between two vectors, measured by the drawing (by each one's heading on the floor), to compare.
const heading = (u: Vec) => Math.atan2(u.z, u.x);
function angle(u: Vec, w: Vec) {
  const d = Math.abs(heading(u) - heading(w));
  return d > Math.PI ? 2 * Math.PI - d : d;
}
function arc(h0: number, h1: number, r: number): Vec[] {
  let d = h1 - h0;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Array.from({ length: 33 }, (_, i) =>
    vec(r * Math.cos(h0 + (d * i) / 32), 0, r * Math.sin(h0 + (d * i) / 32)),
  );
}

const num = (x: number, digits = 2) => x.toFixed(digits).replace(/^-(0\.0+)$/, '$1');
const show = (u: Vec) => `${num(u.x)}, ${num(u.y)}, ${num(u.z)}`;
numbers(lab.gui, {
  'vector a': () => show(a),
  'vector b': () => show(B()),
  'a · b': () => num(dot(a, B())),
  '|a| |b| cos θ': () => num(length(a) * length(B()) * Math.cos(angle(a, B()))),
  'angle θ (°)': () => num((angle(a, B()) * 180) / Math.PI),
  'projection a‖b': () => show(project(a, B())),
  'rejection a⊥b': () => show(reject(a, B())),
  '|a⊥b|': () => num(length(reject(a, B())), 3),
  '|a| sin θ': () => num(length(a) * Math.sin(angle(a, B())), 3),
});

lab.onFrame(() => {
  const bb = B();
  // ─── THE LESSON, AT WORK: the shadow, and what is left across; added, they give a back. ───
  const along = project(a, bb);
  const across = reject(a, bb);
  draw.a.set(O, a);
  draw.b.set(O, bb);
  draw.along.set(O, along);
  draw.across.set(along, across);
  draw.light.set(a, along); // the light falling square onto b's line
  draw.square.set(along, a, length(along) > 0.3 ? O : scale(bb, 2));
  const u = normalize(bb);
  draw.bLine.set(scale(u, -12), scale(u, 12));
  const seen = length(a) > 0 && length(bb) > 0;
  draw.theta.set(O, arc(heading(a), heading(bb), 0.8)).show(seen);
  thetaLabel.at(arc(heading(a), heading(bb), 1.05)[16]!).show(seen);
  tipA.set(a);
  tipB.set(bb);
});

console.log('Drag the tips of a and b; the gold arrow is the shadow of a on the line of b.');
