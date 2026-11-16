import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { add, length, normalize, scale, vec, type Vec } from './vec';
import { createView } from './view/view';

// THE WORLD of the previous lesson, seen from higher up: a floor, and a ball that now moves. The
// camera looks down at it (`lookAt`: how a camera turns is a lesson of its own, later).
const { scene, camera, onFrame } = createView({ eye: [1.5, 7, 7.5], fov: 55 });
camera.lookAt(1.5, 0, -1.2);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x3a342d }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.GridHelper(12, 12, 0x5a5048, 0x463e36));
const RADIUS = 0.4;
const ball = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 16), new THREE.MeshStandardMaterial({ color: 0x5ab4e6 }));
scene.add(ball);
// An arrow for the velocity: where it goes, as long as how fast (1 m of arrow per m/s).
const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xe5c07b, 0.25, 0.15);
scene.add(arrow);

const settings = { speed: 3, normalize: true, autopilot: true };
const shown = { input: '', 'velocity (m/s)': '', 'straight speed (m/s)': 0, 'diagonal speed (m/s)': 0 };
const gui = new GUI({ title: 'moving with vectors' });
gui.add(settings, 'speed', 0.5, 6, 0.5).name('speed (m/s)');
gui.add(settings, 'normalize');
gui.add(settings, 'autopilot').listen();
gui.add(shown, 'input').disable().listen();
gui.add(shown, 'velocity (m/s)').disable().listen();
gui.add(shown, 'straight speed (m/s)').disable().listen();
gui.add(shown, 'diagonal speed (m/s)').disable().listen();

// THE INPUT: each key says −1, 0 or 1 along x and along z. W goes away from the camera (−Z).
const held = new Set<string>();
addEventListener('keydown', (e) => {
  held.add(e.code);
  if (/^(Key[WASD]|Arrow)/.test(e.code)) settings.autopilot = false;
});
addEventListener('keyup', (e) => held.delete(e.code));
const pressed = (...codes: string[]) => (codes.some((c) => held.has(c)) ? 1 : 0);
// The autopilot presses keys too: a square (one key at a time), then a diamond (two at once), and a
// rest. Each one closes on itself, so the ball comes back to where it started.
const ROUTE: [number, number][] = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
  [1, 1],
  [0, 0],
];
function input(time: number): [number, number] {
  if (settings.autopilot) return ROUTE[Math.floor(time / 0.8) % ROUTE.length] ?? [0, 0];
  return [
    pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft'),
    pressed('KeyS', 'ArrowDown') - pressed('KeyW', 'ArrowUp'),
  ];
}

// HOW FAST IT REALLY WENT: the distance covered over the time it took, straight and diagonally apart.
const covered = { straight: { meters: 0, seconds: 0 }, diagonal: { meters: 0, seconds: 0 } };

let position: Vec = vec(0, RADIUS, 0);
let time = 0;
onFrame((dt) => {
  time += dt;
  const [ix, iz] = input(time);
  // THE DIRECTION, from the keys, and THE VELOCITY: that direction times the speed. Without
  // normalizing, a diagonal is √2 long, and the ball goes 41% faster.
  const direction = vec(ix, 0, iz);
  const velocity = scale(settings.normalize ? normalize(direction) : direction, settings.speed);
  // THE MOTION: in dt seconds, the velocity times dt. A point plus a displacement is a point.
  const step = scale(velocity, dt);
  position = add(position, step);
  // (The floor ends at 6 m: the ball stays on it.)
  position = vec(Math.max(-5.5, Math.min(5.5, position.x)), RADIUS, Math.max(-5.5, Math.min(5.5, position.z)));

  if (ix !== 0 || iz !== 0) {
    const kind = ix !== 0 && iz !== 0 ? covered.diagonal : covered.straight;
    kind.meters += length(step);
    kind.seconds += dt;
  }
  ball.position.set(position.x, position.y, position.z);
  const speed = length(velocity);
  arrow.position.set(position.x, position.y + 0.5, position.z);
  arrow.visible = speed > 0;
  if (speed > 0) arrow.setDirection(new THREE.Vector3(velocity.x, 0, velocity.z).normalize());
  arrow.setLength(Math.max(speed, 0.3), 0.25, 0.15);

  shown.input = `${ix}, ${iz}`;
  shown['velocity (m/s)'] = `${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)}`;
  const rate = (k: { meters: number; seconds: number }) => (k.seconds > 0 ? +(k.meters / k.seconds).toFixed(2) : 0);
  shown['straight speed (m/s)'] = rate(covered.straight);
  shown['diagonal speed (m/s)'] = rate(covered.diagonal);
});

// A change of setting starts the measures again.
gui.onChange(() => {
  for (const k of [covered.straight, covered.diagonal]) k.meters = k.seconds = 0;
});

console.log('Click the drawing and press WASD or the arrows; the autopilot gives the keys back when ticked.');
