import { arrow, axes, createLab, draggable, fan, numbers, path, point } from 'lab';
import { dot, inCone, length, normalize, vec, type Vec } from './vec';

// ─── INSIDE THE CONE: an eye at O looks along b; is the target, at a's tip, within α of where it looks? Ours
// compares f̂ · t with |t| cos α, cos α worked out once. The naive test forgets the |t| (it compares the raw
// f̂ · t with cos α): far targets pass outside the cone, near ones fail inside it. ───

const lab = createLab({ title: 'inside the cone', camera: [0.5, 8.5, 1.2], target: [0.5, 0, -1] });
axes(lab, { length: 5 });

const O = vec(0, 0, 0);
let a = vec(3, 0, -1); // the target
let b = vec(1, 0, -2); // where the eye looks
const settings = { 'cone half-angle α (°)': 30, normalize: true };
lab.gui.add(settings, 'cone half-angle α (°)', 5, 85, 1).listen();
lab.gui.add(settings, 'normalize').listen();
lab.gui.add(
  {
    'worked example': () => {
      [a, b] = [vec(3, 0, -1), vec(1, 0, -2)];
      Object.assign(settings, { 'cone half-angle α (°)': 30, normalize: true });
    },
  },
  'worked example',
);

const draw = {
  cone: fan(lab, { color: 0xe5c07b, opacity: 0.22 }),
  edges: path(lab, { color: 0xe5c07b, pairs: true }),
  facing: arrow(lab, { color: 0x61afef, width: 0.037, label: 'f' }),
  way: arrow(lab, { color: 0xe06c75, label: 't' }),
};
const tipA = point(lab, { color: 0xe06c75, radius: 0.15 });
const tipB = point(lab, { color: 0x61afef, radius: 0.12 });
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
const FLOOR = { normal: vec(0, 1, 0), d: 0 };
draggable(lab, tipA.mesh, { plane: () => FLOOR, move: (p) => (a = vec(half(p.x), 0, half(p.z))) });
draggable(lab, tipB.mesh, { plane: () => FLOOR, move: (p) => (b = vec(half(p.x), 0, half(p.z))) });

const cosAlpha = () => Math.cos((settings['cone half-angle α (°)'] * Math.PI) / 180);
/** Ours, or (normalize off) the naive test. */
const inside = () =>
  settings.normalize ? inCone(O, b, a, cosAlpha()) : dot(normalize(b), a) >= cosAlpha();
const heading = (u: Vec) => Math.atan2(u.z, u.x);
const degrees = () =>
  (Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))) * 180) / Math.PI;
numbers(lab.gui, {
  'f̂ · t': () => dot(normalize(b), a).toFixed(3),
  '|t| cos α': () => (length(a) * cosAlpha()).toFixed(3),
  'angle to the target (°)': () => degrees().toFixed(1),
  'in front': () => (dot(b, a) > 0 ? 'yes' : 'no'),
  'inside the cone': () => (inside() ? 'yes' : 'no'),
});

lab.onFrame(() => {
  const h = heading(b);
  const alpha = (settings['cone half-angle α (°)'] * Math.PI) / 180;
  const at = (k: number) => vec(9 * Math.cos(k), 0, 9 * Math.sin(k));
  draw.cone.set(
    O,
    Array.from({ length: 33 }, (_, i) => at(h - alpha + (2 * alpha * i) / 32)),
  );
  draw.edges.set([O, at(h - alpha), O, at(h + alpha)]);
  draw.facing.set(O, b);
  draw.way.set(O, a);
  tipA.set(a);
  tipB.set(b);
  (tipA.mesh.material as { color: { setHex(c: number): void } }).color.setHex(
    inside() ? 0xe5c07b : 0xe06c75,
  );
});

console.log('Drag the target (red) and where the eye looks (blue); change the cone.');
