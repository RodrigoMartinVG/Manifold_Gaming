import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createRandom } from './random';
import { bowlGeometry, bowlLines, surface } from './bowl';
import { sense, type Zone } from './zones';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [2.2, 8.5, 12], target: [2.2, 0.3, 0] });
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;
const random = createRandom(7);

// THE BOWL: fixed, a triangle mesh. The balls roll down it, around it, and through the zones.
const bowl = bowlGeometry();
const vertices = new Float32Array(bowl.getAttribute('position').array);
world.createCollider(
  RAPIER.ColliderDesc.trimesh(vertices, new Uint32Array(bowl.getIndex()!.array)).setFriction(0.8),
);
scene.add(
  new THREE.Mesh(bowl, new THREE.MeshStandardMaterial({ color: 0x6f6a62, side: THREE.DoubleSide })),
  new THREE.LineSegments(bowlLines(), new THREE.LineBasicMaterial({ color: 0x8f8676 })),
);

// THE ZONES: boxes that push nothing. A center, a rotation and half their size along their axes.
const UP = new THREE.Vector3(0, 1, 0);
const zone = (name: string, center: number[], half: number[], turn = 0): Zone => ({
  name,
  center: new THREE.Vector3(...center),
  rotation: new THREE.Quaternion().setFromAxisAngle(UP, (turn * Math.PI) / 180),
  half: new THREE.Vector3(...half),
  inside: [],
});
const zones: Zone[] = [
  zone('gate', [0, 1.4, 3], [1.8, 0.8, 0.15], 30), // a thin wall the balls go through, turned
  zone('pad', [-3.2, 1.4, -1], [1, 0.8, 1]), // a square on the slope
  zone('spot', [2.6, 1.3, -2.2], [0.3, 0.3, 0.3]), // a small one
  zone('drain', [0, 0.4, 0], [0.7, 0.5, 0.7]), // at the bottom: it MEANS something (see `step`)
];
const [gate, , spot] = zones as [Zone, Zone, Zone, Zone];

// How a zone is drawn: a wire box, and a faint fill while someone has its center inside.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const drawn = zones.map((z) => {
  const color = z.name === 'drain' ? 0xe06c75 : 0xe5c07b;
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(unitBox),
    new THREE.LineBasicMaterial({ color }),
  );
  const fill = new THREE.Mesh(
    unitBox,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  scene.add(wire, fill);
  return { zone: z, wire, fill };
});

// THE BALLS: dynamic bodies, numbered, each with a dot at its CENTER: the only point a zone looks at.
interface Ball {
  id: number;
  body: RAPIER.RigidBody;
  radius: number;
  mesh: THREE.Mesh;
  dot: THREE.Mesh;
  label: THREE.Sprite;
}
let balls: Ball[] = [];

function label(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e6dccb';
  g.fillText(text, 32, 34);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
  );
  sprite.scale.setScalar(0.5);
  return sprite;
}

/** Puts a ball on the bowl's rim, somewhere, rolling sideways and a little inwards. */
function throwIn(ball: Ball) {
  const angle = random() * 2 * Math.PI;
  const r = 5.2;
  const speed = (2 + random() * 1.5) * (random() < 0.5 ? -1 : 1);
  const [x, z] = [Math.cos(angle), Math.sin(angle)];
  ball.body.setTranslation({ x: x * r, y: surface(r) + ball.radius + 0.1, z: z * r }, true);
  ball.body.setLinvel({ x: -z * speed - x * 0.5, y: 0, z: x * speed - z * 0.5 }, true);
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

const options = { balls: 10, gateTurn: 30, spotSize: 0.6, pause: false };
const readout = { entered: 0, left: 0, last: '-', exact: '-' };
const insideNow: Record<string, number> = Object.fromEntries(zones.map((z) => [z.name, 0]));

function restart() {
  for (const b of balls) {
    world.removeRigidBody(b.body);
    scene.remove(b.mesh, b.dot, b.label);
  }
  balls = [];
  for (let i = 1; i <= options.balls; i++) {
    const radius = 0.25 + random() * 0.3;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setRestitution(0.5).setFriction(0.8),
      body,
    );
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / options.balls, 0.45, 0.55),
      }),
    );
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
    );
    dot.renderOrder = 1; // drawn over the ball: the center is seen through it
    const ball = { id: i, body, radius, mesh, dot, label: label(String(i)) };
    scene.add(mesh, dot, ball.label);
    throwIn(ball);
    balls.push(ball);
  }
  // The new balls were never inside: every zone starts empty, and so do the counters.
  for (const z of zones) z.inside = [];
  readout.entered = readout.left = 0;
  console.log(`${options.balls} balls, and every zone empty.`);
}

const gui = new GUI({ title: 'Zones' });
gui.add(options, 'balls', 1, 20, 1).name('balls (restarts)').onFinishChange(restart);
gui.add(options, 'gateTurn', 0, 180, 1).name('turn the gate (°)');
gui.add(options, 'spotSize', 0.1, 2, 0.05).name('spot size (m)');
gui.add(options, 'pause');
const happened = gui.addFolder('Events');
happened.add(readout, 'entered').listen().disable();
happened.add(readout, 'left').listen().disable();
happened.add(readout, 'last').name('last event').listen().disable();
const now = gui.addFolder('Inside now');
for (const z of zones) now.add(insideNow, z.name).name(`inside ${z.name}`).listen().disable();
now.add(readout, 'exact').name('exact tests').listen().disable();

const tests = { cheap: 0, exact: 0 };
function step() {
  // 1. THE PHYSICS: gravity, the bowl, the bounces. It knows nothing about zones.
  world.step();
  // 2. THE ZONES, right after: who has its center inside each one now, against the step before.
  tests.cheap = tests.exact = 0;
  const bodies = balls.map((b) => ({
    id: b.id,
    position: new THREE.Vector3().copy(b.body.translation()),
  }));
  const events = sense(zones, bodies, tests);
  // 3. THE GAME'S RULES, which read the step's events, in their order. A zone means nothing by
  //    itself: the drain sends a ball back to the rim because THIS line says so.
  for (const e of events) {
    if (e.type === 'entered') readout.entered++;
    else readout.left++;
    readout.last = `ball ${e.body} ${e.type} ${e.zone}`;
    console.log(readout.last);
    if (e.type === 'entered' && e.zone === 'drain') throwIn(balls[e.body - 1]!);
  }
}

restart();
let accumulator = 0;
onFrame((dt) => {
  // The panel changes the zones (between steps, never in the middle of one).
  gate.rotation.setFromAxisAngle(UP, (options.gateTurn * Math.PI) / 180);
  spot.half.setScalar(options.spotSize / 2);
  accumulator = options.pause ? 0 : accumulator + dt;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }

  for (const b of balls) {
    const p = b.body.translation();
    b.mesh.position.set(p.x, p.y, p.z);
    b.mesh.quaternion.copy(b.body.rotation());
    b.dot.position.set(p.x, p.y, p.z);
    b.label.position.set(p.x, p.y + b.radius + 0.35, p.z);
  }
  for (const { zone: z, wire, fill } of drawn) {
    for (const o of [wire, fill]) {
      o.position.copy(z.center);
      o.quaternion.copy(z.rotation);
      o.scale.copy(z.half).multiplyScalar(2);
    }
    fill.visible = z.inside.length > 0; // lit while someone is inside
    insideNow[z.name] = z.inside.length;
  }
  readout.exact = `${tests.exact} of ${tests.cheap}`;
});

console.log(
  'Four zones: gate (turned), pad, spot (small), and drain: whoever enters it goes back to the rim.',
);
