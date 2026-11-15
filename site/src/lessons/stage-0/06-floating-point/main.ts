import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { bitsOf, spacing } from './bits';

// 1. NUMBERS THAT ARE NOT EXACT: 0.1 cannot be written in binary, so the machine keeps the closest
//    number it can. And every operation rounds its result again.
for (const x of [0.1, 0.2, 0.1 + 0.2, 0.3]) console.log(`${String(x).padEnd(19)} ${bitsOf(x)}`);
console.log(`0.1 is really ${(0.1).toPrecision(30)}`);
console.log(`(0.1 + 0.2) + 0.3 = ${0.1 + 0.2 + 0.3}, but 0.1 + (0.2 + 0.3) = ${0.1 + (0.2 + 0.3)}`);

// 2. FAR FROM THE ORIGIN. Two balls go back and forth at 1 m/s, around a point `far` meters away.
//    Each step adds velocity × step to the position: the green one with JavaScript's numbers (64
//    bits); the red one rounding to 32 bits after every operation (Math.fround), as Rapier counts.
const { scene, camera, onFrame } = createScene();
camera.position.set(0, 2.2, 3.4);
camera.lookAt(0, 0.2, 0);

const STEP = 1 / 60;
const SPEED = 1; // m/s
const f = Math.fround; // the closest 32-bit number
const ball = (color: number, z: number) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 16),
    new THREE.MeshStandardMaterial({ color }),
  );
  mesh.position.set(0, 0.12, z);
  scene.add(mesh);
  return mesh;
};
const green = ball(0x98c379, -0.35);
const red = ball(0xe06c75, 0.35);

const options = { distance: 0, restart: () => restart() }; // the point is 10^distance meters away
const readout = { far: '', spacing32: '', spacing64: '', step: '', redStep: '' };
let x64 = 0;
let x32 = 0;
let v = SPEED;
function restart() {
  const far = 10 ** options.distance;
  x64 = far;
  x32 = f(far);
  v = SPEED;
  readout.far = `${far.toLocaleString('en')} m`;
  readout.spacing32 = `${spacing(far, 32).toPrecision(3)} m`;
  readout.spacing64 = `${spacing(far, 64).toPrecision(3)} m`;
  readout.step = `${(SPEED * STEP).toPrecision(3)} m`;
}
restart();

const gui = new GUI({ title: 'Numbers that are not exact' });
gui.add(options, 'distance', 0, 7, 0.5).name('far: 10^').onChange(restart);
gui.add(options, 'restart');
const numbers = gui.addFolder('Out there');
numbers.add(readout, 'far').name('the point is at').listen().disable();
numbers.add(readout, 'spacing32').name('next 32-bit number').listen().disable();
numbers.add(readout, 'spacing64').name('next 64-bit number').listen().disable();
numbers.add(readout, 'step').name('a step moves').listen().disable();
numbers.add(readout, 'redStep').name('the red one moved').listen().disable();

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  const far = 10 ** options.distance;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    // Back and forth, 1 m to each side of the point.
    if (x64 - far > 1) v = -SPEED;
    if (x64 - far < -1) v = SPEED;
    x64 = x64 + v * STEP;
    const before = x32;
    x32 = f(x32 + f(v * STEP)); // the same addition, rounded to 32 bits
    readout.redStep = `${(x32 - before).toPrecision(3)} m`;
  }
  // Drawn RELATIVE to the point (in 64 bits): the drawing must not lose what we want to see.
  green.position.x = x64 - far;
  red.position.x = x32 - far;
});

// Try: far at 10^4, 10^5, 10^5.5 and 10^6. When does the red one go faster? When does it stop?
