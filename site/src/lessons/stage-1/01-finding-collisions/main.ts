import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createRandom } from './random';
import { everyPair, grid, type Ball } from './broad-phase';

const { scene, onFrame } = createScene({ camera: [0, 15, 11], target: [0, 0, 0] });
const HALF = 8; // the yard goes from −8 to 8 m, in x and in z

// Balls that move on the floor and go through each other: this lesson FINDS the collisions; solving
// them (pushing the balls apart) is the physics engine's job.
const options = {
  bodies: 300,
  method: 'a grid',
  cell: 1.5,
  showBoxes: false,
  restart: () => restart(),
};
let balls: Ball[] = [];
function restart() {
  const random = createRandom(5);
  balls = Array.from({ length: options.bodies }, () => ({
    x: (random() * 2 - 1) * (HALF - 0.5),
    z: (random() * 2 - 1) * (HALF - 0.5),
    vx: (random() * 2 - 1) * 2,
    vz: (random() * 2 - 1) * 2,
    radius: 0.12 + random() * 0.3,
  }));
  dots.count = balls.length;
}

// One mesh for all the balls (an InstancedMesh: one drawing call), each with its own color.
const MAX = 2000;
const dots = new THREE.InstancedMesh(
  new THREE.SphereGeometry(1, 16, 10),
  new THREE.MeshStandardMaterial({ color: 0xffffff }),
  MAX,
);
scene.add(dots);
const boxes = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX * 8 * 3), 3),
  ),
  new THREE.LineBasicMaterial({ color: 0x9a8a70 }),
);
scene.add(boxes);
restart();

const readout = { tests: 0, candidates: 0, touching: 0, same: '-', took: '' };
const gui = new GUI({ title: 'Finding collisions' });
gui.add(options, 'bodies', 10, MAX, 10).name('bodies (on restart)');
gui.add(options, 'method', ['every pair', 'a grid']).name('broad phase');
gui.add(options, 'cell', 0.25, 4, 0.25).name('grid cell (m)');
gui.add(options, 'showBoxes').name('show the boxes');
gui.add(options, 'restart');
const found = gui.addFolder('This frame');
found.add(readout, 'tests').name('box tests').listen().disable();
found.add(readout, 'candidates').name('boxes that overlap').listen().disable();
found.add(readout, 'touching').name('really touching').listen().disable();
found.add(readout, 'same').name('the same pairs as every pair').listen().disable();
found.add(readout, 'took').name('took').listen().disable();

const color = new THREE.Color();
const place = new THREE.Matrix4();
onFrame((dt) => {
  for (const b of balls) {
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (Math.abs(b.x) > HALF - b.radius) b.vx = -Math.sign(b.x) * Math.abs(b.vx);
    if (Math.abs(b.z) > HALF - b.radius) b.vz = -Math.sign(b.z) * Math.abs(b.vz);
  }

  // 1. THE BROAD PHASE: the pairs whose boxes overlap.
  const start = performance.now();
  const broad = options.method === 'a grid' ? grid(balls, options.cell) : everyPair(balls);
  // 2. THE NARROW PHASE: of those, the ones that really touch (two circles: the distance between
  //    their centers against the sum of their radii, squared so as not to take a square root).
  const touching: number[] = [];
  for (const pair of broad.pairs) {
    const a = balls[Math.floor(pair / balls.length)]!;
    const b = balls[pair % balls.length]!;
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    if (dx * dx + dz * dz < (a.radius + b.radius) ** 2) touching.push(pair);
  }
  readout.took = `${(performance.now() - start).toFixed(2)} ms`;
  readout.tests = broad.tests;
  readout.candidates = broad.pairs.length;
  readout.touching = touching.length;
  // The grid must find exactly what every pair finds: the same answer, for less.
  if (options.method === 'a grid' && balls.length <= 600) {
    const all = everyPair(balls).pairs;
    const got = new Set(broad.pairs);
    readout.same = all.length === got.size && all.every((p) => got.has(p)) ? 'yes' : 'NO';
  } else readout.same = '-';

  // Colors: gray far from everything, yellow if its box overlaps another, red if it touches one.
  const state = new Uint8Array(balls.length);
  for (const p of broad.pairs) state[Math.floor(p / balls.length)] = state[p % balls.length] = 1;
  for (const p of touching) state[Math.floor(p / balls.length)] = state[p % balls.length] = 2;
  balls.forEach((b, i) => {
    place.makeScale(b.radius, b.radius, b.radius).setPosition(b.x, b.radius, b.z);
    dots.setMatrixAt(i, place);
    dots.setColorAt(i, color.set([0x6f7f95, 0xe5c07b, 0xe06c75][state[i]!]!));
  });
  dots.instanceMatrix.needsUpdate = true;
  if (dots.instanceColor) dots.instanceColor.needsUpdate = true;

  // The boxes, as squares on the floor.
  boxes.visible = options.showBoxes;
  if (options.showBoxes) {
    const v = boxes.geometry.attributes.position as THREE.BufferAttribute;
    balls.forEach((b, i) => {
      const [x0, x1, z0, z1] = [b.x - b.radius, b.x + b.radius, b.z - b.radius, b.z + b.radius];
      const corners = [x0, z0, x1, z0, x1, z0, x1, z1, x1, z1, x0, z1, x0, z1, x0, z0];
      for (let k = 0; k < 8; k++) v.setXYZ(i * 8 + k, corners[k * 2]!, 0.01, corners[k * 2 + 1]!);
    });
    v.needsUpdate = true;
    boxes.geometry.setDrawRange(0, balls.length * 8);
  }
});

// Try: 2000 bodies with every pair, and then with the grid: look at "box tests" and "took".
