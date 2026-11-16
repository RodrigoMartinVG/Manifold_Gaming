import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { EVERY, GLASS, WORLD, castBall, castRay, groups, type Answer } from './queries';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [3.5, 13, 9], target: [3.5, 0, 0.5] });
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;
const Y = 0.5; // every question crosses the room at this height
const REACH = 20;
const UP = new THREE.Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Something fixed in the room: its body, its collider (in a group) and its mesh. */
interface Placed {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Mesh;
}
/** Places it at `at`, turned `turn` radians around y. */
function place(
  shape: RAPIER.ColliderDesc,
  geometry: THREE.BufferGeometry,
  at: THREE.Vector3,
  color: number,
  group = WORLD,
  turn = 0,
): Placed {
  const rotation = new THREE.Quaternion().setFromAxisAngle(UP, turn);
  const fixed = RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z).setRotation(rotation);
  const body = world.createRigidBody(fixed);
  const collider = world.createCollider(shape.setCollisionGroups(groups(group, EVERY)), body);
  const see = group === GLASS ? { transparent: true, opacity: 0.35 } : {};
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, ...see }));
  mesh.position.copy(at);
  mesh.quaternion.copy(rotation);
  scene.add(mesh);
  return { body, collider, mesh };
}
function box(at: THREE.Vector3, half: THREE.Vector3, color: number, group = WORLD, turn = 0) {
  const shape = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z);
  const geometry = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
  return place(shape, geometry, at, color, group, turn);
}
/** What is only drawn: a line between two points, and a see-through mesh. */
function line(color: number, opacity = 1) {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([UP, UP]), material);
  l.frustumCulled = false;
  scene.add(l);
  return l;
}
function ghost(color: number, opacity: number, geometry: THREE.BufferGeometry) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  material.opacity = opacity;
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return mesh;
}

// THE ROOM: four walls whose inner faces are 5 m from the middle (the floor is only drawn).
const floor = new THREE.BoxGeometry(10.4, 0.1, 10.4).translate(0, -0.07, 0);
scene.add(new THREE.Mesh(floor, new THREE.MeshStandardMaterial({ color: 0x2a2620 })));
box(v(-5.1, Y, 0), v(0.1, 0.5, 5.2), 0x6f6a62);
box(v(5.1, Y, 0), v(0.1, 0.5, 5.2), 0x6f6a62);
box(v(0, Y, -5.1), v(5.2, 0.5, 0.1), 0x6f6a62);
box(v(0, Y, 5.1), v(5.2, 0.5, 0.1), 0x6f6a62);
// A WALL WITH A SLOT, 3 m to the east: 40 cm wide, narrower than a ball of 25 cm (50 cm across).
box(v(3, Y, -1.35), v(0.1, 0.5, 1.15), 0x8a6a42);
box(v(3, Y, 1.35), v(0.1, 0.5, 1.15), 0x8a6a42);
// GLASS, 3 m to the north, in a group of its own: each question decides whether it sees it.
box(v(0, Y, -3.05), v(1.5, 0.5, 0.05), 0x9fd3ff, GLASS);
// A crate turned 30°, and a round pillar: surfaces whose normals are not along the axes.
box(v(2, 0.4, 3.4), v(0.4, 0.4, 0.4), 0x8a6a42, WORLD, Math.PI / 6);
const round = new THREE.CylinderGeometry(0.6, 0.6, 1, 32);
place(RAPIER.ColliderDesc.cylinder(0.5, 0.6), round, v(-2.5, Y, 2.5), 0x6f6a62);

// THE ONE ASKING, in the middle: a ball of 30 cm with a body of its own, as a character has one.
// Every question starts at its center: inside its own body.
const FROM = v(0, Y, 0);
const asker = place(RAPIER.ColliderDesc.ball(0.3), new THREE.SphereGeometry(0.3), FROM, 0x93d9c9);
const nose = new THREE.BoxGeometry(0.25, 0.08, 0.08).translate(0.35, 0, 0);
asker.mesh.add(new THREE.Mesh(nose, new THREE.MeshBasicMaterial({ color: 0xe5c07b })));

const settings = {
  'ball radius (m)': 0.25,
  'see the glass': true,
  'leave myself out': true,
  solid: true,
  autopilot: true,
};
const shown: { [row: string]: string } = {
  'turning: ray / ball (m)': '',
  'west, the wall (m)': '',
  'east, the slot (m)': '',
  'north, the glass (m)': '',
  'before the first step': '',
  'new box: seen at once': '—',
  'new box: seen after (steps)': '—',
};
const filter = () => ({
  glass: settings['see the glass'],
  me: settings['leave myself out'] ? asker.collider : null,
  solid: settings.solid,
});

// THE TRAP, at once: Rapier puts what is created into what its questions search when it STEPS.
// Nothing has stepped yet, so this ray to the west finds nothing, not even the wall.
const first = castRay(world, FROM, { x: -1, y: 0, z: 0 }, REACH, filter());
shown['before the first step'] = first ? 'something' : 'nothing';

/** One direction, asked twice: a ray, and a ball swept along it. */
interface Asked {
  direction: RAPIER.Vector;
  ray: Answer | null;
  ball: Answer | null;
}
const ask = (direction: RAPIER.Vector): Asked => ({
  direction,
  ray: castRay(world, FROM, direction, REACH, filter()),
  ball: castBall(world, FROM, direction, settings['ball radius (m)'], REACH, filter()),
});
const both = (a: Asked) => [a.ray, a.ball].map((h) => h?.distance.toFixed(2) ?? 'none').join(' / ');
// THREE DIRECTIONS THAT NEVER CHANGE, each with its row on the panel and its faint drawing.
const probe = (row: string, direction: RAPIER.Vector) => ({
  row,
  direction,
  asked: ask(direction),
  ray: line(0xe5c07b, 0.3),
  ball: ghost(0x93d9c9, 0.18, new THREE.SphereGeometry(1, 24, 16)),
});
const probes = [
  probe('west, the wall (m)', { x: -1, y: 0, z: 0 }),
  probe('east, the slot (m)', { x: 1, y: 0, z: 0 }),
  probe('north, the glass (m)', { x: 0, y: 0, z: -1 }),
];
// AND ONE THAT TURNS: by itself, 20° per second, until a key turns it (A and D, or the arrows).
const TURN = THREE.MathUtils.degToRad(20);
const BY_HAND = THREE.MathUtils.degToRad(60);
const along = (angle: number) => ({ x: Math.cos(angle), y: 0, z: -Math.sin(angle) });
let angle = 0;
let turning = ask(along(angle));
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return; // typing in the panel is not steering
  if (!['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
  held.add(e.code);
  settings.autopilot = false;
  e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));

// THE NEW BOX: put in the way of the turning ray, 2 m out (the one before is taken away). Asked at
// once, between two steps, and then asked again after every step until the ray finds it.
interface NewBox extends Placed {
  direction: RAPIER.Vector;
  steps: number;
}
let added: NewBox | null = null;
const plain = { glass: true, me: asker.collider, solid: true };
const sees = (direction: RAPIER.Vector, c: RAPIER.Collider) =>
  castRay(world, FROM, direction, REACH, plain)?.collider.handle === c.handle;
function addBox() {
  if (added) {
    world.removeRigidBody(added.body);
    scene.remove(added.mesh);
  }
  const direction = along(angle);
  const at = v(direction.x * 2, Y, direction.z * 2);
  const made = box(at, v(0.3, 0.5, 0.3), 0xc8743a, WORLD, angle);
  shown['new box: seen at once'] = sees(direction, made.collider) ? 'yes' : 'no';
  shown['new box: seen after (steps)'] = 'not yet';
  added = { ...made, direction, steps: 0 };
}

// ONE STEP: nothing in the room moves, but the step is what puts new bodies into the questions.
function step() {
  world.step();
  const left = held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0;
  const right = held.has('KeyD') || held.has('ArrowRight') ? 1 : 0;
  angle += settings.autopilot ? TURN * STEP : (left - right) * BY_HAND * STEP;
  turning = ask(along(angle));
  for (const p of probes) p.asked = ask(p.direction);
  if (added && shown['new box: seen after (steps)'] === 'not yet') {
    added.steps++;
    if (sees(added.direction, added.collider)) {
      shown['new box: seen after (steps)'] = String(added.steps);
    }
  }
}

const gui = new GUI({ title: 'asking the world' });
gui.add(settings, 'ball radius (m)', 0.1, 0.45, 0.05);
gui.add(settings, 'see the glass');
gui.add(settings, 'leave myself out');
gui.add(settings, 'solid');
gui.add(settings, 'autopilot').listen();
gui.add({ 'add a box in the way': addBox }, 'add a box in the way');
for (const row of Object.keys(shown)) gui.add(shown, row).disable().listen();

// WHAT IS DRAWN: the ray to what it hits, with the normal there; the ball where it would touch,
// with the tube it swept; and, fainter, the three directions that never change.
const look = {
  ray: line(0xe5c07b),
  normal: line(0x98c379),
  hit: ghost(0xe5c07b, 1, new THREE.SphereGeometry(0.06)),
  ball: ghost(0x93d9c9, 0.45, new THREE.SphereGeometry(1, 24, 16)),
  tube: ghost(0x93d9c9, 0.12, new THREE.CylinderGeometry(1, 1, 1, 24, 1, true)),
  touch: ghost(0x93d9c9, 1, new THREE.SphereGeometry(0.05)),
};
const vec = (p: RAPIER.Vector) => v(p.x, p.y, p.z);
/** Where a question's ball stops: its center, that far along its direction. */
const center = (a: Asked) =>
  FROM.clone().addScaledVector(vec(a.direction), a.ball?.distance ?? REACH);

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  asker.mesh.rotation.y = angle;
  const r = settings['ball radius (m)'];
  const end = turning.ray ? vec(turning.ray.point) : center(turning);
  look.ray.geometry.setFromPoints([FROM, end]);
  look.hit.position.copy(end);
  // A solid ray that starts inside something touches no surface: Rapier's normal comes as NaN.
  const normal = turning.ray?.normal;
  const n = normal && Number.isFinite(normal.x) ? vec(normal) : v(0, 0, 0);
  look.normal.geometry.setFromPoints([end, end.clone().addScaledVector(n, 0.6)]);
  const stop = center(turning);
  look.ball.position.copy(stop);
  look.ball.scale.setScalar(r);
  look.tube.position.copy(FROM).lerp(stop, 0.5); // halfway: the tube goes from FROM to the ball
  look.tube.scale.set(r, Math.max(stop.distanceTo(FROM), 1e-3), r);
  look.tube.quaternion.setFromUnitVectors(UP, vec(turning.direction));
  look.touch.visible = turning.ball !== null;
  if (turning.ball) look.touch.position.copy(vec(turning.ball.point));
  for (const p of probes) {
    p.ray.geometry.setFromPoints([FROM, p.asked.ray ? vec(p.asked.ray.point) : center(p.asked)]);
    p.ball.position.copy(center(p.asked));
    p.ball.scale.setScalar(r);
    shown[p.row] = both(p.asked);
  }
  shown['turning: ray / ball (m)'] = both(turning);
});
