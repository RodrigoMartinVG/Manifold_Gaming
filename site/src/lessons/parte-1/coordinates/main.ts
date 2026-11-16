import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createLabels } from './labels';
import { createFigure } from './figure';

// The camera looks at a point to the right of the origin: the figure stays left of the panel.
const { scene, camera, controls, onFrame } = createScene({
  camera: [7.5, 4.6, 5.7],
  target: [1.9, 1, -1.5],
});
const { label, place } = createLabels(camera);

// THE LESSON'S FORMULAS. A point is three numbers, its coordinates (x, y, z), in meters.
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

// THE FRAME: the axes, and everything placed by its coordinates, live in this group. Left-handed,
// the group is mirrored (scale.z = −1): the same numbers, drawn in the mirror.
const frame = new THREE.Group();
scene.add(frame);
const { segment, rod, triangle, rightAngle } = createFigure(frame);
const RED = 0xe06c75; // along X
const GREEN = 0x98c379; // along Y
const BLUE = 0x61afef; // along Z
const AXIS = 4.5; // m, the length drawn of each axis

/** A label at a point given by its coordinates: change the vector it returns to move it. */
const tags: { at: THREE.Vector3; local: THREE.Vector3 }[] = [];
function tag(text: string, local = new THREE.Vector3()) {
  const l = label();
  l.say(text);
  tags.push({ at: l.at, local });
  return local;
}

// THE AXES: an arrow for the positive half, a dim line for the negative one.
const AXES = [
  { name: '+X', direction: new THREE.Vector3(1, 0, 0), color: RED },
  { name: '+Y', direction: new THREE.Vector3(0, 1, 0), color: GREEN },
  { name: '+Z', direction: new THREE.Vector3(0, 0, 1), color: BLUE },
];
for (const axis of AXES) {
  frame.add(
    new THREE.ArrowHelper(axis.direction, new THREE.Vector3(), AXIS, axis.color, 0.3, 0.14),
  );
  const back = axis.direction.clone().multiplyScalar(-AXIS);
  const negative = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([back, new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: axis.color, transparent: true, opacity: 0.35 }),
  );
  frame.add(negative);
  tag(axis.name, axis.direction.clone().multiplyScalar(AXIS + 0.3));
}
tag('O', new THREE.Vector3(-0.2, 0.05, 0.2));
// The floor's grid marks every meter along X and Z; the Y axis gets its own ticks.
const ticks: THREE.Vector3[] = [];
for (let i = 1; i < AXIS; i++)
  ticks.push(new THREE.Vector3(-0.1, i, 0), new THREE.Vector3(0.1, i, 0));
frame.add(
  new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(ticks),
    new THREE.LineBasicMaterial({ color: GREEN }),
  ),
);

// THE TWO POINTS, as data: their coordinates. P starts where the worked example puts it.
const p = new THREE.Vector3(3, 2, 1);
const q = new THREE.Vector3(-1, 0.5, -2);
function ball(color: number) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }),
  );
  frame.add(mesh);
  return mesh;
}
const pBall = ball(0xe5c07b);
const qBall = ball(0x93d9c9);
const pTag = tag('P');
const qTag = tag('Q');

// P'S COORDINATES, SEEN AS LENGTHS: from P straight down to its foot F = (x, 0, z), whose height
// is y; from F to each axis, which it meets at x and at z.
const O = new THREE.Vector3();
const foot = new THREE.Vector3();
const onX = new THREE.Vector3();
const onZ = new THREE.Vector3();
const xRod = rod(RED, 0.04);
const zRod = rod(BLUE, 0.04);
const drop = segment(GREEN, true);
const footToX = segment(0xb8b0a0, true);
const footToZ = segment(0xb8b0a0, true);
const xTag = tag('x');
const yTag = tag('y');
const zTag = tag('z');

// THE BOX BETWEEN P AND Q: from P along X to A, along Z to B (both at P's height), then straight up
// or down to Q. P, A, B: a right triangle on a level floor. P, B, Q: a standing one.
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const delta = new THREE.Vector3();
const legX = segment(RED);
const legZ = segment(BLUE);
const legY = segment(GREEN);
const floorLine = segment(0xe5c07b, true);
const pq = rod(0xe8e2d6, 0.025);
const floorFill = triangle(0xe5c07b);
const standingFill = triangle(0xe8e2d6);
const atA = rightAngle(0xe8e2d6);
const atB = rightAngle(0xe8e2d6);
const dxTag = tag('Δx');
const dzTag = tag('Δz');
const dyTag = tag('Δy');
const dTag = tag('d');

// THE PANEL. Moving a point (a height, or dragging it) turns the autopilot off; its box gives it back.
const settings = {
  autopilot: true,
  'height of P (m)': p.y,
  'height of Q (m)': q.y,
  'left-handed': false,
};
const shown = {
  'P (x, y, z)': '',
  'Q (x, y, z)': '',
  'Δ = Q − P': '',
  'floor distance (m)': 0,
  'our distance (m)': 0,
  'three.js distanceTo (m)': 0,
};
let time = 0;
const gui = new GUI({ title: 'coordinates' });
gui.add(settings, 'autopilot').listen();
gui
  .add(settings, 'height of P (m)', -1, 4, 0.05)
  .listen()
  .onChange((y: number) => {
    p.y = y;
    settings.autopilot = false;
  });
gui
  .add(settings, 'height of Q (m)', -1, 4, 0.05)
  .listen()
  .onChange((y: number) => {
    q.y = y;
    settings.autopilot = false;
  });
gui.add(settings, 'left-handed');
const example = {
  'worked example': () => {
    settings.autopilot = false;
    time = 0; // the autopilot, given back, starts from here
    p.set(3, 2, 1);
    q.set(-1, 0.5, -2);
  },
};
gui.add(example, 'worked example');
gui.add(shown, 'P (x, y, z)').disable().listen();
gui.add(shown, 'Q (x, y, z)').disable().listen();
gui.add(shown, 'Δ = Q − P').disable().listen();
gui.add(shown, 'floor distance (m)').disable().listen();
gui.add(shown, 'our distance (m)').disable().listen();
gui.add(shown, 'three.js distanceTo (m)').disable().listen();

// DRAGGING P OR Q, level: the pointer's ray meets the horizontal plane at the point's height.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
let dragged: THREE.Vector3 | null = null;
function aim(e: PointerEvent) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
  raycaster.setFromCamera(pointer, camera);
}
addEventListener(
  'pointerdown',
  (e) => {
    if (!(e.target instanceof HTMLCanvasElement)) return; // on the panel
    aim(e);
    // The point nearest to the ray, if the ray passes within 0.4 m of it.
    let nearest = 0.4 * 0.4;
    dragged = null;
    for (const point of [p, q]) {
      const d = raycaster.ray.distanceSqToPoint(frame.localToWorld(hit.copy(point)));
      if (d < nearest) {
        nearest = d;
        dragged = point;
      }
    }
    if (!dragged) return;
    settings.autopilot = false;
    controls.enabled = false; // the camera stays still while a point is dragged
    level.constant = -dragged.y; // the plane y = height
  },
  { capture: true }, // before the camera's controls hear it
);
addEventListener('pointermove', (e) => {
  if (!dragged) return;
  aim(e);
  if (!raycaster.ray.intersectPlane(level, hit)) return;
  frame.worldToLocal(hit); // the mirror, undone: back to coordinates
  dragged.x = THREE.MathUtils.clamp(hit.x, -AXIS, AXIS);
  dragged.z = THREE.MathUtils.clamp(hit.z, -AXIS, AXIS);
});
addEventListener('pointerup', () => {
  dragged = null;
  controls.enabled = true;
});

/** Three coordinates, two decimals (and no "−0.00"). */
const two = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);
const triple = (v: THREE.Vector3) => `(${two(v.x)}, ${two(v.y)}, ${two(v.z)})`;

onFrame((dt) => {
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
  frame.scale.z = settings['left-handed'] ? -1 : 1;
  frame.updateMatrixWorld();
  pBall.position.copy(p);
  qBall.position.copy(q);

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
  floorFill.set(p, a, b);
  standingFill.set(p, b, q);
  atA.set(a, p, b);
  atB.set(b, p, q);

  // The labels, beside the middle of what they name.
  pTag.set(p.x, p.y + 0.2, p.z);
  qTag.set(q.x, q.y + 0.2, q.z);
  xTag.set(p.x / 2, 0.08, 0);
  zTag.set(0, 0.08, p.z / 2);
  yTag.set(p.x + 0.15, p.y / 2, p.z);
  dxTag.set((p.x + q.x) / 2, p.y + 0.08, p.z);
  dzTag.set(q.x, p.y + 0.08, (p.z + q.z) / 2);
  dyTag.set(q.x + 0.15, (p.y + q.y) / 2, q.z);
  dTag.set((p.x + q.x) / 2, (p.y + q.y) / 2 + 0.12, (p.z + q.z) / 2);
  for (const t of tags) frame.localToWorld(t.at.copy(t.local));
  place();

  // THE PANEL: the differences, and the distance by our formula and by three.js.
  shown['P (x, y, z)'] = triple(p);
  shown['Q (x, y, z)'] = triple(q);
  delta.set(q.x - p.x, q.y - p.y, q.z - p.z);
  shown['Δ = Q − P'] = triple(delta);
  shown['floor distance (m)'] = +floorDistance(p, q).toFixed(4);
  shown['our distance (m)'] = +distance(p, q).toFixed(4);
  shown['three.js distanceTo (m)'] = +p.distanceTo(q).toFixed(4);
});

console.log('P, Q and the distance between them: our formula and three.js agree.');
