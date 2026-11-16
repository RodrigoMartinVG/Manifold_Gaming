import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { play, startAudio } from './synth';

const { scene, camera, onFrame } = createScene({ camera: [0, 12, 10], target: [0, 0, 0] });
const STEP = 1 / 60;

// THREE FLOORS side by side, each of a material, and how far a step on it is heard walking (m).
const FLOORS = [
  { surface: 'wood', x: -4, color: 0x8a6a42, heard: 7 },
  { surface: 'stone', x: 0, color: 0x6f6a62, heard: 6 },
  { surface: 'metal', x: 4, color: 0x7a7e84, heard: 10 },
];
for (const f of FLOORS) {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: f.color }),
  );
  floor.position.set(f.x, -0.05, 0);
  scene.add(floor);
}
const floorAt = (x: number) =>
  FLOORS.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));

// A SOUND IS AN EVENT of the simulation: what made it, where, on what, how fast or how hard, and how
// far it is heard. Nothing of it is kept: an event is what happened in a step.
interface Sound {
  kind: 'step' | 'hit';
  at: THREE.Vector3;
  surface: string;
  radius: number;
}
let events: Sound[] = [];

// The character walks a loop over the three floors; every stride walked (0.8 m), a step.
const WALK = 4.5;
const STRIDE = 0.8;
const hero = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(hero);
const at = new THREE.Vector3();
let angle = 0;
let walked = 0;
// A guard, still: it hears what reaches it (an event whose radius is as far as it is).
const guard = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1),
  new THREE.MeshStandardMaterial({ color: 0x9a4a4a }),
);
guard.position.set(0, 0.8, -8);
scene.add(guard);
// A ball dropped on the metal: it falls, hits, and bounces lower each time.
const ball = {
  y: -1,
  vy: 0,
  mesh: new THREE.Mesh(
    new THREE.SphereGeometry(0.2),
    new THREE.MeshStandardMaterial({ color: 0xe5c07b }),
  ),
};
ball.mesh.position.set(4, -1, 3);
scene.add(ball.mesh);
const MASS = 1.5;

const settings = { running: false, volume: 0.6, 'drop height (m)': 2 };
const shown = { 'on what': '', 'last sound': '', 'heard (m)': 0, hits: 0, 'the guard heard': 0 };
const gui = new GUI({ title: 'what is heard' });
gui.add(settings, 'running');
gui.add(settings, 'volume', 0, 1, 0.05);
gui.add(settings, 'drop height (m)', 0.2, 4, 0.1);
gui.add(
  { 'drop a ball': () => ((ball.y = settings['drop height (m)'] + 0.2), (ball.vy = 0)) },
  'drop a ball',
);
gui.add(shown, 'on what').disable().listen();
gui.add(shown, 'last sound').disable().listen();
gui.add(shown, 'heard (m)').disable().listen();
gui.add(shown, 'hits').disable().listen();
gui.add(shown, 'the guard heard').disable().listen();
// The browser lets audio start only after a click or a key.
addEventListener('pointerdown', startAudio);
addEventListener('keydown', startAudio);

// ONE STEP of the simulation: it moves, and says what was heard.
function step() {
  const speed = settings.running ? 7.5 : WALK;
  angle += (speed * STEP) / 5;
  const before = at.clone();
  at.set(Math.sin(angle) * 5, 0.8, Math.sin(angle * 2) * 3);
  walked += at.distanceTo(before);
  if (walked >= STRIDE) {
    walked -= STRIDE;
    const floor = floorAt(at.x);
    // Farther on metal than on wood, and farther running than walking.
    events.push({
      kind: 'step',
      at: at.clone().setY(0),
      surface: floor.surface,
      radius: (floor.heard * speed) / WALK,
    });
  }
  if (ball.y > -1) {
    const was = ball.vy;
    ball.vy -= 9.81 * STEP;
    ball.y += ball.vy * STEP;
    if (ball.y <= 0.2) {
      ball.y = 0.2;
      ball.vy = -ball.vy * 0.5;
      // A hit, by its energy: half the mass times the change of velocity squared.
      const energy = 0.5 * MASS * (ball.vy - was) ** 2;
      if (energy > 0.05)
        events.push({
          kind: 'hit',
          at: new THREE.Vector3(4, 0, 3),
          surface: 'metal',
          radius: 3 + 2.5 * Math.sqrt(energy),
        });
      else ball.y = -1;
    }
  }
}

// The rings: each sound, drawn as far as it is heard, fading.
const rings: { mesh: THREE.Mesh; born: number }[] = [];
let behind = 0;
let time = 0;
onFrame((dt) => {
  behind += dt;
  time += dt;
  events = [];
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  hero.position.copy(at);
  ball.mesh.position.y = ball.y;
  shown['on what'] = floorAt(at.x).surface;
  // THE PRESENTATION READS THE EVENTS: a ring, a sound, and whether the guard was in reach.
  for (const e of events) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(e.radius - 0.06, e.radius, 48),
      new THREE.MeshBasicMaterial({
        color: e.kind === 'hit' ? 0xe5c07b : 0x93d9c9,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(e.at).setY(0.02);
    scene.add(ring);
    rings.push({ mesh: ring, born: time });
    shown['last sound'] = `${e.kind} on ${e.surface}`;
    shown['heard (m)'] = +e.radius.toFixed(1);
    if (e.kind === 'hit') shown.hits++;
    if (e.at.distanceTo(guard.position.clone().setY(0)) <= e.radius) shown['the guard heard']++;
    // As loud as it is near the camera, up to its radius (and a little more).
    const d = e.at.distanceTo(camera.position);
    play(e.surface, settings.volume * Math.max(0, 1 - d / (e.radius + 10)) ** 2);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const age = time - rings[i]!.born;
    (rings[i]!.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 - age);
    if (age > 0.6) {
      scene.remove(rings[i]!.mesh);
      rings.splice(i, 1);
    }
  }
});
