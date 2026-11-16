import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { compute, signal } from './signals';

const { scene, onFrame } = createScene({ camera: [0, 7, 9], target: [0, 0.6, 0] });
const STEP = 1 / 60;

// NAMED THINGS: what the signals read and what follows them, found by their names.
interface Thing {
  name: string;
  mesh: THREE.Mesh;
}
const named = new Map<string, Thing>();
function box(name: string, size: number[], at: number[], color: number): Thing {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color }),
  );
  mesh.position.set(...(at as [number, number, number]));
  scene.add(mesh);
  const thing = { name, mesh };
  named.set(name, thing);
  return thing;
}
box('plate_a', [1.2, 0.05, 1.2], [-3, 0.025, 1.5], 0xa04040);
box('plate_b', [1.2, 0.05, 1.2], [-1, 0.025, 1.5], 0xa04040);
box('button', [0.3, 0.3, 0.1], [2.5, 1.1, -0.95], 0xc04040);
box('wall', [8, 2, 0.2], [0, 1, -1.1], 0x5a544c);
const crateA = box('crate_a', [0.6, 0.6, 0.6], [-3, 0.3, 3.5], 0x9a7a4a);
const crateB = box('crate_b', [0.6, 0.6, 0.6], [-1, 0.3, 3.5], 0x9a7a4a);
// The door: it turns around its hinge, its left edge (a pivot there, the door half its width aside).
const hinge = new THREE.Group();
hinge.position.set(0.4, 0, -0.9);
scene.add(hinge);
const door = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.8, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x8a6a42 }),
);
door.position.set(0.6, 0.9, 0);
hinge.add(door);
const lamp = new THREE.Mesh(
  new THREE.SphereGeometry(0.2),
  new THREE.MeshBasicMaterial({ color: 0x3a3428 }),
);
lamp.position.set(2.5, 1.8, -0.9);
scene.add(lamp);

// THE SIGNALS, in the order they are computed. Each reads zones, or signals above it.
const signals = [
  signal('a', 'zone', 'plate_a'),
  signal('b', 'zone', 'plate_b'),
  signal('both', 'all', 'a', 'b'),
  signal('pressed', 'used', 'button'),
  signal('light', 'toggle', 'pressed'),
  signal('open', 'any', 'both', 'light'),
];

// What follows a signal reads its value from the step before (the door, the lamp): from a cause to
// its effect, one step. Its place is a function of which way it goes, since when and from where.
const DOOR_SECONDS = 1;
const doorState = { toward: 0, since: 0, from: 0 };
const progress = (tick: number) =>
  THREE.MathUtils.clamp(
    doorState.from +
      ((doorState.toward ? 1 : -1) * ((tick - doorState.since) * STEP)) / DOOR_SECONDS,
    0,
    1,
  );

// The panel: the crates on their plates, the button, the order; each signal's value; how many steps
// from a cause (a crate put, the button pressed) to the door starting to move.
const settings = { 'crate a on its plate': false, 'crate b on its plate': false, backwards: false };
const shown: Record<string, number> = Object.fromEntries(signals.map((s) => [s.name, 0]));
const watch = { step: 0, 'cause to door (steps)': 0 };
let pressedNow = false;
let causeAt = -1;
const gui = new GUI({ title: 'signals' });
// (A cause enters the world at the next step.)
gui.add(settings, 'crate a on its plate').onChange(() => (causeAt = tick + 1));
gui.add(settings, 'crate b on its plate').onChange(() => (causeAt = tick + 1));
gui.add(
  { 'press the button': () => ((pressedNow = true), (causeAt = tick + 1)) },
  'press the button',
);
gui.add(settings, 'backwards').name('computed backwards');
const values = gui.addFolder('values');
for (const s of signals) values.add(shown, s.name).disable().listen();
gui.add(watch, 'step').disable().listen();
gui.add(watch, 'cause to door (steps)').disable().listen();

// ONE STEP: what follows the signals moves (with last step's values), the zones look, and at its end,
// the signals are computed, in their order.
let tick = 0;
function step() {
  tick++;
  const open = signals.find((s) => s.name === 'open')!.value ? 1 : 0;
  if (open !== doorState.toward) {
    doorState.from = progress(tick);
    doorState.toward = open;
    doorState.since = tick;
    if (causeAt >= 0) watch['cause to door (steps)'] = tick - causeAt;
    causeAt = -1;
  }
  crateA.mesh.position.z = settings['crate a on its plate'] ? 1.5 : 3.5;
  crateB.mesh.position.z = settings['crate b on its plate'] ? 1.5 : 3.5;
  const onPlate = (crate: Thing, plate: string) => {
    const p = named.get(plate)!.mesh.position;
    const c = crate.mesh.position;
    return Math.abs(c.x - p.x) < 0.6 && Math.abs(c.z - p.z) < 0.6 ? 1 : 0;
  };
  const zones = {
    on: new Map([
      ['plate_a', onPlate(crateA, 'plate_a') + onPlate(crateB, 'plate_a')],
      ['plate_b', onPlate(crateA, 'plate_b') + onPlate(crateB, 'plate_b')],
    ]),
    used: new Set(pressedNow ? ['button'] : []),
  };
  pressedNow = false;
  compute(signals, zones, settings.backwards);
  for (const s of signals) shown[s.name] = s.value;
  watch.step = tick;
}

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  hinge.rotation.y = progress(tick) * (Math.PI / 2);
  (lamp.material as THREE.MeshBasicMaterial).color.set(
    signals.find((s) => s.name === 'light')!.value ? 0xffd27a : 0x3a3428,
  );
  for (const plate of ['plate_a', 'plate_b']) {
    const on = signals.find((s) => s.name === (plate === 'plate_a' ? 'a' : 'b'))!.value;
    (named.get(plate)!.mesh.material as THREE.MeshStandardMaterial).emissive.set(
      on ? 0x502020 : 0x000000,
    );
  }
});
