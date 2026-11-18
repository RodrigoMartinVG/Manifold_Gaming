import {
  arrow,
  axes,
  createLab,
  draggable,
  fan,
  line,
  numbers,
  path,
  point,
  rightAngle,
} from 'lab';
import {
  dot,
  inCone,
  inFront,
  length,
  normalize,
  project,
  reject,
  scale,
  vec,
  type Vec,
} from './vec';

// ─── THE LESSON is in vec.ts: the dot product, the projection and the rejection, the cone. Here they are at
// work, in the frame at the end ("OUR FUNCTIONS"). The rest is THE DRAWING, made with the lab kit. ───

// THE FLOOR SEEN FROM ABOVE, as in the previous lesson: +X to the right, +Z towards us, +Y up. 1 m squares.
const lab = createLab({ title: 'the dot product', camera: [0.5, 8.5, 1.2], target: [0.5, 0, -1] });
axes(lab, { length: 5 });

const O = vec(0, 0, 0);
let a = vec(3, 0, -1);
let b = vec(1, 0, -2);

const settings = {
  mode: 'split' as 'split' | 'look',
  'flip b': false,
  'b × 2': false,
  'cone half-angle α (°)': 30,
  normalize: true,
};
lab.gui.add(settings, 'mode', ['split', 'look']);
lab.gui.add(settings, 'flip b');
lab.gui.add(settings, 'b × 2');
lab.gui.add(settings, 'cone half-angle α (°)', 5, 85, 1).listen();
lab.gui.add(settings, 'normalize');
lab.gui.add(
  {
    'worked example': () => {
      a = vec(3, 0, -1);
      b = vec(1, 0, -2);
      settings['flip b'] = settings['b × 2'] = false;
      settings['cone half-angle α (°)'] = 30;
      settings.normalize = true;
    },
  },
  'worked example',
);

// What each mode draws. Split: a and b, b's line, the shadow of a on it (a∥b), what is left across
// (a⊥b), the right angle between them, and the angle θ. Look: an eye at O looking along b (the facing),
// the half of the floor in front of it, the cone, and the way to a's tip (the target).
const draw = {
  a: arrow(lab, { color: 0xe06c75, label: 'a' }),
  b: arrow(lab, { color: 0x61afef, width: 0.037, label: 'b' }),
  bLine: line(lab, { color: 0x61afef, dashed: true, opacity: 0.6 }),
  along: arrow(lab, { color: 0xe5c07b, width: 0.045, label: 'a‖', labelAt: 0.5, labelSide: 18 }),
  across: arrow(lab, { color: 0x98c379, width: 0.032, label: 'a⊥', labelAt: 0.55, labelSide: 16 }),
  shadow: line(lab, { color: 0xe06c75, dashed: true, opacity: 0.5 }),
  square: rightAngle(lab, { color: 0xf2efe9 }),
  theta: fan(lab, { color: 0xc678dd, opacity: 0.35 }),
  front: fan(lab, { color: 0x61afef, opacity: 0.08 }),
  cone: fan(lab, { color: 0xe5c07b, opacity: 0.22 }),
  coneEdges: path(lab, { color: 0xe5c07b, pairs: true }),
};
const thetaLabel = lab.label('θ').color('#c678dd');
const tipA = point(lab, { color: 0xe06c75, radius: 0.12 });
const tipB = point(lab, { color: 0x61afef, radius: 0.12 });

// DRAGGING A TIP across the floor (the plane y = 0), rounded to half meters.
const half = (x: number) => Math.max(-9, Math.min(9, Math.round(2 * x) / 2));
const FLOOR = { normal: vec(0, 1, 0), d: 0 };
/** How b is used: flipped, doubled, or as dragged (its tip drawn where b, so used, ends). */
const factor = () => (settings['flip b'] ? -1 : 1) * (settings['b × 2'] ? 2 : 1);
const bUsed = () => scale(b, factor());
draggable(lab, tipA.mesh, { plane: () => FLOOR, move: (p) => (a = vec(half(p.x), 0, half(p.z))) });
draggable(lab, tipB.mesh, {
  plane: () => FLOOR,
  move: (p) => (b = scale(vec(half(p.x), 0, half(p.z)), 1 / factor())),
});

// THE DRAWING'S OWN GEOMETRY, measured another way so the panel can compare: each vector's heading on the
// floor by Math.atan2, the angle between two headings, and points on an arc (the drawing may use any
// trigonometry: it is not the lesson).
const heading = (u: Vec) => Math.atan2(u.z, u.x);
function angleBetween(u: Vec, w: Vec): number {
  let d = Math.abs(heading(u) - heading(w));
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}
/** Points from the heading h0 to h1 (radians, the short way), at radius r from c, on the floor. */
function arc(c: Vec, h0: number, h1: number, r: number): Vec[] {
  let d = h1 - h0;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const out: Vec[] = [];
  for (let i = 0; i <= 32; i++) {
    const h = h0 + (d * i) / 32;
    out.push(vec(c.x + r * Math.cos(h), 0, c.z + r * Math.sin(h)));
  }
  return out;
}

// THE PANEL (two decimals, and −0.00 is 0.00).
const num = (x: number, digits = 2) => x.toFixed(digits).replace(/^-(0\.0+)$/, '$1');
const show = (u: Vec) => `${num(u.x)}, ${num(u.y)}, ${num(u.z)}`;
const cosAlpha = () => Math.cos((settings['cone half-angle α (°)'] * Math.PI) / 180);
/** Inside the cone: ours; or, with "normalize" off, the naive test that compares the raw dot with cos α. */
const inside = () =>
  settings.normalize ? inCone(O, bUsed(), a, cosAlpha()) : dot(normalize(bUsed()), a) >= cosAlpha();
numbers(lab.gui, {
  'vector a': () => show(a),
  'vector b': () => show(bUsed()),
  'a · b': () => num(dot(a, bUsed())),
  '|a| |b| cos θ': () => num(length(a) * length(bUsed()) * Math.cos(angleBetween(a, bUsed()))),
  'angle θ (°)': () => num((angleBetween(a, bUsed()) * 180) / Math.PI),
  'projection a‖b': () => show(project(a, bUsed())),
  'rejection a⊥b': () => show(reject(a, bUsed())),
  '|a⊥b|': () => num(length(reject(a, bUsed())), 3),
  '|a| sin θ': () => num(length(a) * Math.sin(angleBetween(a, bUsed())), 3),
  'in front': () => (inFront(O, bUsed(), a) ? 'yes' : 'no'),
  'inside the cone': () => (inside() ? 'yes' : 'no'),
});

lab.onFrame(() => {
  const B = bUsed();
  const splitting = settings.mode === 'split';
  // ─── THE LESSON, AT WORK ───
  // OUR FUNCTIONS: the shadow of a on b's line, and what is left across. Added, they give a back.
  const along = project(a, B);
  const across = reject(a, B);
  draw.a.set(O, a);
  draw.b.set(O, B);
  draw.along.set(O, along).show(splitting);
  draw.across.set(along, across).show(splitting); // from the shadow's tip to a's: a∥ + a⊥ = a
  draw.shadow.set(a, along).show(splitting);
  draw.square.set(along, a, length(along) > 0.3 ? O : scale(B, 2));
  if (!splitting) draw.square.object.visible = false;
  const unitB = normalize(B);
  draw.bLine.set(scale(unitB, -12), scale(unitB, 12)).show(splitting);
  // The angle θ, between a and b, as an arc near O.
  draw.theta
    .set(O, arc(O, heading(a), heading(B), 0.8))
    .show(splitting && length(a) > 0 && length(B) > 0);
  const mid = arc(O, heading(a), heading(B), 1.05)[16]!;
  thetaLabel.at(mid).show(splitting && length(a) > 0 && length(B) > 0);
  // Look: the half of the floor in front of the eye (the points with a positive part along b), and the cone.
  const hb = heading(B);
  draw.front
    .set(O, arc(O, hb - Math.PI / 2, hb, 9).concat(arc(O, hb, hb + Math.PI / 2, 9)))
    .show(!splitting);
  const alpha = (settings['cone half-angle α (°)'] * Math.PI) / 180;
  draw.cone.set(O, arc(O, hb - alpha, hb, 9).concat(arc(O, hb, hb + alpha, 9))).show(!splitting);
  const edge = (h: number) => vec(9 * Math.cos(h), 0, 9 * Math.sin(h));
  draw.coneEdges.set([O, edge(hb - alpha), O, edge(hb + alpha)]).show(!splitting);
  tipA.set(a);
  tipB.set(B);
});

console.log(
  'Drag the tips of a and b; in "look", b is where the eye at O looks, and a the target.',
);
