import * as THREE from 'three';
import {
  AXIS_COLOR,
  createLab,
  draggable,
  fan,
  frame,
  line,
  numbers,
  point,
  rightAngle,
  rod,
} from 'lab';

// ─── THE LESSON: the two formulas. Read these, and change them to see what happens. ───
// A point is three numbers, its coordinates (x, y, z), in meters.
/** Pythagoras on the floor: the legs are Δx and Δz. */
function floorDistance(p: THREE.Vector3, q: THREE.Vector3) {
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  return Math.sqrt(dx * dx + dz * dz);
}
/** Pythagoras twice: the floor distance and Δy are the legs of a second right triangle. */
function distance(p: THREE.Vector3, q: THREE.Vector3) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const dz = q.z - p.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ─── THE DRAWING: the lab kit, from here on. No need to read it; the formulas above are the lesson. ───
// THE FIGURE: the tutorial's lab kit (its source is one click away, under the editor). Everything it
// draws is placed by its coordinates in `lab.world`; left-handed, that group is mirrored (scale.z = −1):
// the same numbers, drawn in the mirror.
const lab = createLab({ title: 'coordinates', camera: [7.6, 5.2, 7.8], target: [0.4, 1.3, -0.6] });
const AXIS = 4.5; // m, the length drawn of each axis
const DIM = 0xb8b0a0;

// THE AXES: an arrow for the positive half, a dim line for the negative one, ticks every meter on Y
// (the floor's grid marks the meters along X and Z).
frame(lab, { size: AXIS, names: ['+X', '+Y', '+Z'] });
const O = new THREE.Vector3();
for (const [color, end] of [
  [AXIS_COLOR.x, new THREE.Vector3(-AXIS, 0, 0)],
  [AXIS_COLOR.y, new THREE.Vector3(0, -AXIS, 0)],
  [AXIS_COLOR.z, new THREE.Vector3(0, 0, -AXIS)],
] as const)
  line(lab, { color, opacity: 0.35 }).set(end, O);
for (let i = 1; i < AXIS; i++)
  line(lab, { color: AXIS_COLOR.y }).set({ x: -0.1, y: i, z: 0 }, { x: 0.1, y: i, z: 0 });
lab.label('O').color('#8b93a3').at({ x: -0.2, y: 0.05, z: 0.2 });

// THE TWO POINTS, as data: their coordinates. P starts where the worked example puts it.
const p = new THREE.Vector3(3, 2, 1);
const q = new THREE.Vector3(-1, 0.5, -2);
const pBall = point(lab, { color: 0xe5c07b, label: 'P', radius: 0.12 });
const qBall = point(lab, { color: 0x93d9c9, label: 'Q', radius: 0.12 });

// P'S COORDINATES, SEEN AS LENGTHS: from P straight down to its foot F = (x, 0, z), whose height is y;
// from F to each axis, which it meets at x and at z.
const foot = new THREE.Vector3();
const onX = new THREE.Vector3();
const onZ = new THREE.Vector3();
const xRod = rod(lab, { color: AXIS_COLOR.x, width: 0.04 });
const zRod = rod(lab, { color: AXIS_COLOR.z, width: 0.04 });
const drop = line(lab, { color: AXIS_COLOR.y, dashed: true });
const footToX = line(lab, { color: DIM, dashed: true });
const footToZ = line(lab, { color: DIM, dashed: true });
const name = (text: string, color: number) =>
  lab.label(text).color(`#${color.toString(16).padStart(6, '0')}`);
const xName = name('x', AXIS_COLOR.x);
const yName = name('y', AXIS_COLOR.y);
const zName = name('z', AXIS_COLOR.z);

// THE BOX BETWEEN P AND Q: from P along X to A, along Z to B (both at P's height), then straight up or
// down to Q. P, A, B: a right triangle on a level floor. P, B, Q: a standing one.
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const legX = line(lab, { color: AXIS_COLOR.x });
const legZ = line(lab, { color: AXIS_COLOR.z });
const legY = line(lab, { color: AXIS_COLOR.y });
const floorLine = line(lab, { color: 0xe5c07b, dashed: true });
const pq = rod(lab, { color: 0xe8e2d6, width: 0.025 });
const floorFill = fan(lab, { color: 0xe5c07b, opacity: 0.2 });
const standingFill = fan(lab, { color: 0xe8e2d6, opacity: 0.15 });
const atA = rightAngle(lab, { color: 0xe8e2d6 });
const atB = rightAngle(lab, { color: 0xe8e2d6 });
const dxName = name('Δx', AXIS_COLOR.x);
const dzName = name('Δz', AXIS_COLOR.z);
const dyName = name('Δy', AXIS_COLOR.y);
const dName = name('d', 0xe8e2d6);

// THE PANEL. Moving a point (a height, or dragging it) turns the autopilot off; its box gives it back.
const settings = {
  autopilot: true,
  'height of P (m)': p.y,
  'height of Q (m)': q.y,
  'left-handed': false,
};
let time = 0;
lab.gui.add(settings, 'autopilot').listen();
lab.gui
  .add(settings, 'height of P (m)', -1, 4, 0.05)
  .listen()
  .onChange((y: number) => {
    p.y = y;
    settings.autopilot = false;
  });
lab.gui
  .add(settings, 'height of Q (m)', -1, 4, 0.05)
  .listen()
  .onChange((y: number) => {
    q.y = y;
    settings.autopilot = false;
  });
lab.gui.add(settings, 'left-handed');
const example = {
  'worked example': () => {
    settings.autopilot = false;
    time = 0; // the autopilot, given back, starts from here
    p.set(3, 2, 1);
    q.set(-1, 0.5, -2);
  },
};
lab.gui.add(example, 'worked example');
/** Three coordinates, two decimals (and no "−0.00"). */
const two = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);
const triple = (v: THREE.Vector3) => `(${two(v.x)}, ${two(v.y)}, ${two(v.z)})`;
numbers(lab.gui, {
  'P (x, y, z)': () => triple(p),
  'Q (x, y, z)': () => triple(q),
  'Δ = Q − P': () => triple(new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z)),
  'floor distance (m)': () => +floorDistance(p, q).toFixed(4),
  'our distance (m)': () => +distance(p, q).toFixed(4),
  'three.js distanceTo (m)': () => +p.distanceTo(q).toFixed(4),
});

// DRAGGING P OR Q, level: across the horizontal plane at the point's height, y = h, which is the plane
// [n | d] with n = (0, 1, 0) and d = −h. (The kit works in lab.world's coordinates: the mirror is undone.)
for (const [ball, at] of [
  [pBall, p],
  [qBall, q],
] as const)
  draggable(lab, ball.mesh, {
    plane: () => ({ normal: { x: 0, y: 1, z: 0 }, d: -at.y }),
    move: (hit) => {
      at.x = THREE.MathUtils.clamp(hit.x, -AXIS, AXIS);
      at.z = THREE.MathUtils.clamp(hit.z, -AXIS, AXIS);
    },
    start: () => (settings.autopilot = false),
  });

lab.onFrame((dt) => {
  if (settings.autopilot) {
    time += dt;
    // A slow wander, from P = (3, 2, 1): x from −3 to 3, y from 0.8 to 3.2, z from −1 to 3.
    p.set(
      3 * Math.cos(0.23 * time),
      2 + 1.2 * Math.sin(0.37 * time),
      1 + 2 * Math.sin(0.29 * time),
    );
  }
  settings['height of P (m)'] = p.y;
  settings['height of Q (m)'] = q.y;
  lab.world.scale.z = settings['left-handed'] ? -1 : 1;
  pBall.set(p);
  qBall.set(q);

  // P's coordinates as lengths.
  foot.set(p.x, 0, p.z);
  onX.set(p.x, 0, 0);
  onZ.set(0, 0, p.z);
  xRod.set(O, onX);
  zRod.set(O, onZ);
  drop.set(p, foot);
  footToX.set(foot, onX);
  footToZ.set(foot, onZ);

  // The box: Pythagoras on the level triangle P, A, B, then on the standing one P, B, Q.
  a.set(q.x, p.y, p.z);
  b.set(q.x, p.y, q.z);
  legX.set(p, a);
  legZ.set(a, b);
  legY.set(b, q);
  floorLine.set(p, b);
  pq.set(p, q);
  floorFill.set(p, [a, b]);
  standingFill.set(p, [b, q]);
  atA.set(a, p, b);
  atB.set(b, p, q);

  // The names, beside the middle of what they name.
  xName.at({ x: p.x / 2, y: 0.12, z: 0 });
  zName.at({ x: 0, y: 0.12, z: p.z / 2 });
  yName.at({ x: p.x + 0.18, y: p.y / 2, z: p.z });
  dxName.at({ x: (p.x + q.x) / 2, y: p.y + 0.12, z: p.z });
  dzName.at({ x: q.x, y: p.y + 0.12, z: (p.z + q.z) / 2 });
  dyName.at({ x: q.x + 0.18, y: (p.y + q.y) / 2, z: q.z });
  dName.at({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 0.15, z: (p.z + q.z) / 2 });
});

console.log('P, Q and the distance between them: our formula and three.js agree.');
