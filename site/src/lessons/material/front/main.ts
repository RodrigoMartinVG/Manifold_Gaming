import { arrow, axes, createLab, draggable, fan, line, numbers, point } from 'lab';
import { dot, normalize, scale, sub, vec, type Vec } from './vec';

// ─── IN FRONT OR BEHIND? An eye at O looks along f; is the target in front of it? The naive rule compares the
// target's z with the eye's (in front if it is further along −Z), which is right only while the eye looks
// along −Z. Ours asks how much of the way to the target goes along f: the sign of f · t. ───

const lab = createLab({ title: 'in front or behind', camera: [0, 9, 1.5], target: [0, 0, -0.5] });
axes(lab, { length: 5 });

const O = vec(0, 0, 0);
let f = vec(0, 0, -1); // where the eye looks (one long)
let target = vec(3, 0, 0.5); // (behind the eye at first; in front of it once it looks east)

const draw = {
  half: fan(lab, { color: 0x7fb8e8, opacity: 0.2 }),
  border: line(lab, { color: 0x61afef, dashed: true, opacity: 0.7 }),
  facing: arrow(lab, { color: 0x61afef, width: 0.04, label: 'f' }),
  way: arrow(lab, { color: 0xe06c75, width: 0.03, label: 't', labelAt: 0.6, labelSide: 14 }),
};
const eye = point(lab, { color: 0xf2efe9, radius: 0.13 });
eye.set(O);
const tipF = point(lab, { color: 0x61afef, radius: 0.12 });
const tipT = point(lab, { color: 0xe06c75, radius: 0.15 });

const FLOOR = { normal: vec(0, 1, 0), d: 0 };
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
// The facing's tip goes round a circle of 2 m (it says only where the eye looks); the target, to half meters.
draggable(lab, tipF.mesh, { plane: () => FLOOR, move: (p) => (f = normalize(vec(p.x, 0, p.z))) });
draggable(lab, tipT.mesh, {
  plane: () => FLOOR,
  move: (p) => (target = vec(half(p.x), 0, half(p.z))),
});

const settings = { 'naive rule (z)': false };
lab.gui.add(settings, 'naive rule (z)');
lab.gui.add({ 'turn the eye east': () => (f = vec(1, 0, 0)) }, 'turn the eye east');

const ours = () => dot(f, sub(target, O)) > 0;
const naive = () => target.z < O.z;
numbers(lab.gui, {
  'facing f': () => `${f.x.toFixed(2)}, ${f.z.toFixed(2)}`,
  'f · t': () => dot(f, sub(target, O)).toFixed(2),
  'in front (f · t > 0)': () => (ours() ? 'yes' : 'no'),
  'in front (naive: z)': () => (naive() ? 'yes' : 'no'),
});

/** Points on the floor at radius r, from heading h0 to h1 (the drawing's trigonometry, not the lesson). */
function arc(h0: number, h1: number, r: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= 48; i++) {
    const h = h0 + ((h1 - h0) * i) / 48;
    out.push(vec(r * Math.cos(h), 0, r * Math.sin(h)));
  }
  return out;
}

lab.onFrame(() => {
  // The half of the floor in front: the points whose way from the eye has a positive part along f. With the
  // naive rule, the half with z < 0, whatever the eye looks at.
  const h = settings['naive rule (z)'] ? -Math.PI / 2 : Math.atan2(f.z, f.x);
  draw.half.set(O, arc(h - Math.PI / 2, h + Math.PI / 2, 8));
  const side = vec(-Math.sin(h), 0, Math.cos(h));
  draw.border.set(scale(side, -8), scale(side, 8));
  draw.facing.set(O, scale(f, 2));
  draw.way.set(O, target);
  tipF.set(scale(f, 2));
  tipT.set(target);
  const front = settings['naive rule (z)'] ? naive() : ours();
  (tipT.mesh.material as { color: { setHex(c: number): void } }).color.setHex(
    front ? 0xe5c07b : 0x7a7068,
  );
});

console.log('Drag the end of f to turn the eye, and the red ball to move the target.');
