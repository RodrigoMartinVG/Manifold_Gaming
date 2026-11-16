import * as THREE from 'three';
import { arrow, createLab, draggable, fan, frame, numbers, path, point, type V3 } from 'lab';

// THE TUTORIAL'S AXES: right-handed, +X right, +Y up, +Z towards whoever looks from the front.
// A POSITIVE TURN about an axis is counterclockwise seen from the axis's tip: about +X, +Y turns
// towards +Z; about +Y, +Z towards +X; about +Z, +X towards +Y (always the next one, in a circle).
const lab = createLab({ title: 'the right hand', camera: [3.3, 2.5, 4.1], target: [0, 0.5, 0] });
frame(lab, { size: 2, names: ['+X', '+Y', '+Z'] });

type Axis = 'X' | 'Y' | 'Z';
const AXES: Record<Axis, V3> = {
  X: { x: 1, y: 0, z: 0 },
  Y: { x: 0, y: 1, z: 0 },
  Z: { x: 0, y: 0, z: 1 },
};
/** The axis a turn about `a` starts from: the next one, in the circle X → Y → Z → X. */
const NEXT: Record<Axis, Axis> = { X: 'Y', Y: 'Z', Z: 'X' };

/** The turn by θ (radians) about an axis of the world, written out: what the lesson on matrices derives. */
function turn(about: Axis, theta: number, p: V3): V3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  if (about === 'X') return { x: p.x, y: c * p.y - s * p.z, z: s * p.y + c * p.z };
  if (about === 'Y') return { x: c * p.x + s * p.z, y: p.y, z: -s * p.x + c * p.z };
  return { x: c * p.x - s * p.y, y: s * p.x + c * p.y, z: p.z };
}

const settings = { about: 'Y' as Axis, 'angle (deg)': 0, autopilot: true };
lab.gui.add(settings, 'about', ['X', 'Y', 'Z']);
lab.gui
  .add(settings, 'angle (deg)', -180, 180, 1)
  .listen()
  .onChange(() => (settings.autopilot = false));
lab.gui.add(settings, 'autopilot').listen();
// Seen from the axis's tip, the turn goes counterclockwise.
const views = {
  'look from the tip': () => {
    const a = AXES[settings.about];
    // (From +Y, a hair towards +Z: the camera needs to know which way is up on the screen. Then +X
    // is to the right and +Z down, as on a map.)
    lab.camera.position.set(5 * a.x, 5 * a.y, 5 * a.z + 0.01 * a.y);
    lab.controls.target.set(0, 0, 0);
  },
};
lab.gui.add(views, 'look from the tip');

// What is drawn: the turned vector (gold), the angle it swept (a fan, with its edge) and its sign.
const turned = arrow(lab, { color: 0xe5c07b, width: 0.035 });
const tip = point(lab, { color: 0xe5c07b, radius: 0.1 });
const swept = fan(lab, { color: 0xe5c07b, opacity: 0.22 });
const arc = path(lab, { color: 0xe5c07b });
const sign = lab.label().color('#e5c07b');
const RADIUS = 1.6;
const ARC = 0.9;

// DRAGGING THE TIP around the turning axis, on the plane through the origin perpendicular to it
// (normal: the axis, d = 0). The angle is read with atan2 in that plane.
draggable(lab, tip.mesh, {
  plane: () => ({ normal: AXES[settings.about], d: 0 }),
  move: (p) => {
    const a = settings.about;
    const start = AXES[NEXT[a]];
    const quarter = AXES[NEXT[NEXT[a]]]; // where the start is after a quarter turn
    const along = p.x * start.x + p.y * start.y + p.z * start.z;
    const across = p.x * quarter.x + p.y * quarter.y + p.z * quarter.z;
    settings['angle (deg)'] = Math.round((Math.atan2(across, along) * 180) / Math.PI);
  },
  start: () => (settings.autopilot = false),
});

let clock = 0;
const theta = () => (settings['angle (deg)'] * Math.PI) / 180;
const show = (p: V3) =>
  [p.x, p.y, p.z].map((x) => x.toFixed(3).replace(/^-(0\.0+)$/, '$1')).join(', ');
numbers(lab.gui, {
  'start vector': () => `+${NEXT[settings.about]}`,
  'angle (rad)': () => theta().toFixed(3),
  'turned (ours)': () => show(turn(settings.about, theta(), AXES[NEXT[settings.about]])),
  // three.js's own turn, to compare: Vector3.applyAxisAngle follows the same convention.
  'turned (three.js)': () => {
    const s = AXES[NEXT[settings.about]];
    const a = AXES[settings.about];
    const v = new THREE.Vector3(s.x, s.y, s.z).applyAxisAngle(
      new THREE.Vector3(a.x, a.y, a.z),
      theta(),
    );
    return show(v);
  },
});

lab.onFrame((dt) => {
  // THE AUTOPILOT: from 0° to 90° and back, a closed-form function of the clock; touching stops it.
  if (settings.autopilot) {
    clock += dt;
    settings['angle (deg)'] = Math.round(45 * (1 - Math.cos(clock * 0.9)));
  }
  const a = settings.about;
  const start = AXES[NEXT[a]];
  const scaled = (p: V3, k: number): V3 => ({ x: p.x * k, y: p.y * k, z: p.z * k });
  const end = turn(a, theta(), scaled(start, RADIUS));
  turned.set({ x: 0, y: 0, z: 0 }, end);
  tip.set(end);
  const steps = Math.max(2, Math.ceil(Math.abs(settings['angle (deg)']) / 3));
  const edge = Array.from({ length: steps + 1 }, (_, i) =>
    turn(a, (theta() * i) / steps, scaled(start, ARC)),
  );
  swept.set({ x: 0, y: 0, z: 0 }, edge);
  arc.set(edge);
  // The sign, at the middle of the arc, a little outside it.
  const deg = settings['angle (deg)'];
  sign
    .text(deg > 0 ? 'θ > 0' : deg < 0 ? 'θ < 0' : 'θ = 0')
    .at(turn(a, theta() / 2, scaled(start, ARC + 0.35)));
});

console.log(
  'Drag the gold tip around the axis; "look from the tip" shows the turn counterclockwise.',
);
