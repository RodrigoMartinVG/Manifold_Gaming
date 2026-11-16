import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createRandom } from './random';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [5, 4, 7], target: [0, 1, -1] });
const STEP = 1 / 60;

// TWO PHYSICS. The simulation's: the floor, the post, the vase, the balls and the vase's few large
// pieces; it is what the hash sums up. The drawing's: the small fragments, which nobody hashes.
const sim = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
sim.timestep = STEP;
const look = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
look.timestep = STEP;
for (const w of [sim, look])
  w.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0));
sim.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.5, 0.1).setTranslation(0, 0.5, -2));
const random = createRandom(3);

interface Body {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Mesh;
  /** A ball: whether it was touching the vase at the last step (a hit is the step it starts). */
  touching?: boolean;
}
const material = (color: number) => new THREE.MeshStandardMaterial({ color });
function box(
  world: RAPIER.World,
  half: number[],
  at: number[],
  color: number,
  dynamic: boolean,
  velocity = [0, 0, 0],
): Body {
  const body = world.createRigidBody(
    (dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
      .setTranslation(at[0]!, at[1]!, at[2]!)
      .setLinvel(velocity[0]!, velocity[1]!, velocity[2]!),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(half[0]!, half[1]!, half[2]!).setDensity(600),
    body,
  );
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half[0]! * 2, half[1]! * 2, half[2]! * 2),
    material(color),
  );
  scene.add(mesh);
  return { body, collider, mesh };
}
scene.add(
  new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), material(0x4a4440))
    .translateY(0.5)
    .translateZ(-2),
);

// THE VASE, on its post: whole, it is one fixed body. It breaks when a hit brings at least `threshold`
// joules: half the mass times the speed squared of what hit it, as it came (before this step).
let vase: Body | null = null;
let pieces: Body[] = [];
let balls: Body[] = [];
const fragments: (Body & { born: number })[] = [];
const settings = { speed: 4, threshold: 60, fragments: true };
const shown = {
  'last hit (J)': 0,
  broken: false,
  'pieces (simulation)': 0,
  'fragments (drawing)': 0,
  'hash (simulation)': '',
};

function reset() {
  for (const b of [...pieces, ...balls, ...(vase ? [vase] : [])]) {
    sim.removeRigidBody(b.body);
    scene.remove(b.mesh);
  }
  pieces = [];
  balls = [];
  vase = box(sim, [0.25, 0.3, 0.25], [0, 1.3, -2], 0x5ab4e6, false);
  shown.broken = false;
  shown['last hit (J)'] = 0;
}
reset();

// A ball (4.2 kg) thrown at the vase from 2 m away, at the chosen speed, aimed: up as much as the fall
// takes away on the way, so it arrives at the vase's height.
function thrown() {
  const time = 2 / settings.speed;
  const ball = sim.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.3, 0)
      .setLinvel(0, 4.905 * time, -settings.speed),
  );
  const collider = sim.createCollider(RAPIER.ColliderDesc.ball(0.15).setDensity(300), ball);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), material(0xe5c07b));
  scene.add(mesh);
  balls.push({ body: ball, collider, mesh });
}

// THE BREAK. In the simulation, a few large pieces the physics moves (in the hash), and an event with
// a seed from its randomness. In the drawing, from that seed, many small fragments in their own
// physics: everybody who sees it sees the same, and the simulation never knows.
function breakVase(energy: number) {
  const at = vase!.body.translation();
  sim.removeRigidBody(vase!.body);
  scene.remove(vase!.mesh);
  vase = null;
  for (const dx of [-0.13, 0, 0.13])
    pieces.push(
      box(sim, [0.12, 0.28, 0.24], [at.x + dx, at.y, at.z], 0x4a90c0, true, [
        dx * 8 + (random() - 0.5),
        1,
        -1,
      ]),
    );
  shown.broken = true;
  shown['last hit (J)'] = +energy.toFixed(1);
  const seed = Math.floor(random() * 2 ** 32);
  if (settings.fragments) fragmentsFrom(seed, at);
}
function fragmentsFrom(seed: number, at: { x: number; y: number; z: number }) {
  const r = createRandom(seed);
  for (let i = 0; i < 24; i++) {
    const s = 0.03 + r() * 0.05;
    const f = box(
      look,
      [s, s, s],
      [at.x + (r() - 0.5) * 0.4, at.y + (r() - 0.5) * 0.4, at.z],
      0x9ad0f0,
      true,
      [(r() - 0.5) * 6, r() * 4, (r() - 0.5) * 6],
    );
    fragments.push({ ...f, born: tick });
  }
}

// THE SIMULATION'S HASH: every number of every body it moves, in order (the fragments are not there).
const bytes = new DataView(new ArrayBuffer(8));
function hash() {
  let h = 0x811c9dc5;
  const add = (n: number) => {
    bytes.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) h = Math.imul(h ^ bytes.getUint8(i), 0x01000193) >>> 0;
  };
  for (const b of [...(vase ? [vase] : []), ...balls, ...pieces]) {
    const t = b.body.translation();
    const q = b.body.rotation();
    for (const n of [t.x, t.y, t.z, q.x, q.y, q.z, q.w]) add(n);
  }
  return h.toString(16).padStart(8, '0');
}

const gui = new GUI({ title: 'what breaks' });
gui.add(settings, 'speed', 3, 12, 0.5).name('speed (m/s)');
gui.add(settings, 'threshold', 1, 200, 1).name('threshold (J)');
gui.add(settings, 'fragments').name('draw fragments');
gui.add({ throw: thrown }, 'throw');
gui.add({ 'a new vase': reset }, 'a new vase');
gui.add(shown, 'last hit (J)').disable().listen();
gui.add(shown, 'broken').disable().listen();
gui.add(shown, 'pieces (simulation)').disable().listen();
gui.add(shown, 'fragments (drawing)').disable().listen();
gui.add(shown, 'hash (simulation)').disable().listen();

// ONE STEP: the velocities before it (what a hit brings), the physics, then the hits on the vase.
let tick = 0;
function step() {
  tick++;
  const before = new Map(balls.map((b) => [b, b.body.linvel()]));
  sim.step();
  look.step();
  for (const ball of balls) {
    if (!vase) break;
    let touched = false;
    sim.contactPair(
      ball.collider,
      vase.collider,
      (manifold) => (touched ||= manifold.numContacts() > 0),
    );
    // A hit is the step it starts touching (while it stays, it is already slowed down).
    const starts = touched && !ball.touching;
    ball.touching = touched;
    if (!starts) continue;
    const v = before.get(ball)!;
    const energy = 0.5 * ball.body.mass() * (v.x * v.x + v.y * v.y + v.z * v.z);
    shown['last hit (J)'] = +energy.toFixed(1);
    if (energy >= settings.threshold) breakVase(energy);
  }
  // Fragments last 2.5 s.
  for (let i = fragments.length - 1; i >= 0; i--)
    if (tick - fragments[i]!.born > 150) {
      look.removeRigidBody(fragments[i]!.body);
      scene.remove(fragments[i]!.mesh);
      fragments.splice(i, 1);
    }
  shown['pieces (simulation)'] = pieces.length;
  shown['fragments (drawing)'] = fragments.length;
  shown['hash (simulation)'] = hash();
}

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  for (const b of [...(vase ? [vase] : []), ...balls, ...pieces, ...fragments]) {
    b.mesh.position.copy(b.body.translation() as THREE.Vector3);
    b.mesh.quaternion.copy(b.body.rotation() as THREE.Quaternion);
  }
});
