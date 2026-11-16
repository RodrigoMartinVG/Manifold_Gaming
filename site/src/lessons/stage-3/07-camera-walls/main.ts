import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createCameraRig } from './camera';
import { createViews } from './view';

await RAPIER.init();
// The big view looks from above, and also sees layer 1, where the marks are.
const { scene, camera, onFrame } = createScene({ camera: [0, 26, 1], target: [0, 0, 0] });
camera.layers.enable(1);
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

// THE CORRIDOR, made of boxes: a ring 2 m wide around a block, with walls 4.5 m high (as in the
// Dojo's corridor), and on its far side a tunnel: a ceiling 3 m up. Each box: x, y, z of its
// center, and its half sizes (m).
type Box = [number, number, number, number, number, number];
const WALLS: Box[] = [
  [0, 2.25, -8.25, 8.5, 2.25, 0.25],
  [0, 2.25, 8.25, 8.5, 2.25, 0.25],
  [-8.25, 2.25, 0, 0.25, 2.25, 8],
  [8.25, 2.25, 0, 0.25, 2.25, 8],
  [0, 2.25, 0, 6, 2.25, 6], // the block in the middle
];
const CEILING: Box = [1, 3.25, -7, 3, 0.25, 1];
const BOXES = [...WALLS, CEILING];
for (const [x, y, z, hx, hy, hz] of BOXES)
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z));

function boxMesh([x, y, z, hx, hy, hz]: Box, color: number, layer = 0, opacity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity }),
  );
  mesh.position.set(x, y, z);
  mesh.layers.set(layer);
  scene.add(mesh);
}
for (const wall of WALLS) boxMesh(wall, 0x8a7a66);
boxMesh([0, -0.06, 0, 8.5, 0.05, 8.5], 0x6f6a62); // the floor, only drawn: nothing falls here
// The ceiling: solid for the player's camera (layer 2), see-through from above (layer 1).
boxMesh(CEILING, 0x5a5048, 2);
boxMesh(CEILING, 0x5a5048, 1, 0.35);

// THE CHARACTER: a capsule in the world, moved by Rapier's character controller (the walls stop
// it). On autopilot it walks the middle of the ring at 4.5 m/s, corner to corner: a lap is 56 m,
// 12.4 s. A key (WASD or the arrows) takes the autopilot off; W is −Z, up in the view from above.
const WALK = 4.5;
const CORNERS = [
  new THREE.Vector3(7, 0.8, 7),
  new THREE.Vector3(7, 0.8, -7),
  new THREE.Vector3(-7, 0.8, -7),
  new THREE.Vector3(-7, 0.8, 7),
];
const spot = new THREE.Vector3(0, 0.8, 7);
const facing = new THREE.Vector3(1, 0, 0); // where it looks
let next = 0; // the corner it walks to
/** The corner at the end of the side of the ring it is on (going round, as the autopilot goes). */
const cornerAfter = (p: THREE.Vector3) => (p.z > 6 ? 0 : p.x > 6 ? 1 : p.z < -6 ? 2 : 3);
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spot.x, spot.y, spot.z),
);
const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
const controller = world.createCharacterController(0.02);
world.step(); // so the queries see every collider from the first frame
const hero = new THREE.Group();
hero.add(
  new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 1, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
  ),
  new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.1).translate(0, 0.5, -0.28),
    new THREE.MeshStandardMaterial({ color: 0x15120f }),
  ),
);
scene.add(hero);
const headOf = () => spot.clone().setY(spot.y + 0.6);

const held = new Set<string>();
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
addEventListener('keydown', (e) => {
  if (!KEYS.includes(e.code)) return;
  held.add(e.code);
  settings.autopilot = false;
  e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
const key = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);

/** ONE STEP of the simulation: the character walks, by itself or with the keys. */
function step() {
  let walk = new THREE.Vector3(
    key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft'),
    0,
    key('KeyS', 'ArrowDown') - key('KeyW', 'ArrowUp'),
  );
  walk.normalize().multiplyScalar(WALK * STEP);
  if (settings.autopilot) {
    walk = CORNERS[next]!.clone().sub(spot).setY(0);
    if (walk.length() <= WALK * STEP) next = (next + 1) % CORNERS.length;
    walk.clampLength(0, WALK * STEP);
  }
  controller.computeColliderMovement(collider, walk);
  spot.add(controller.computedMovement());
  // It turns towards where it walks, a tenth of what is left per step. (A fixed fraction is right
  // here: the step is fixed. In the drawing, where frames are not, it would not be.) Straight back,
  // it first turns to a side: halfway between two opposite directions there is no direction.
  if (walk.lengthSq() > 0) {
    const toward = walk.normalize();
    if (facing.dot(toward) < -0.99) toward.set(-facing.z, 0, facing.x);
    facing.lerp(toward, 0.1).normalize();
  }
  body.setNextKinematicTranslation(spot);
  world.step();
}

// THE CAMERA (camera.ts), and what is drawn about it (view.ts): the marks seen from above, and
// what the player sees, bottom left.
const rig = createCameraRig(world, body);
const views = createViews(scene);

const settings = { sweep: true, 'ease out': true, 'leash learns the wall': false, autopilot: true };
const shown = {
  'closest to a wall (cm)': 0,
  'frames with a wall between': 0,
  'cut (m)': 0,
  'leash (m)': 0,
  'fastest out (m/s)': 0,
};
const gui = new GUI({ title: 'the camera against walls' });
gui.add(settings, 'sweep').onChange(restart);
gui.add(settings, 'ease out').onChange(restart);
gui.add(settings, 'leash learns the wall').onChange(restart);
gui
  .add(settings, 'autopilot')
  .listen()
  .onChange((on: boolean) => {
    if (on) next = cornerAfter(spot); // back on: on to the end of the side it is on
  });
gui.add(shown, 'closest to a wall (cm)').disable().listen();
gui.add(shown, 'frames with a wall between').disable().listen();
gui.add(shown, 'cut (m)').disable().listen();
gui.add(shown, 'leash (m)').disable().listen();
gui.add(shown, 'fastest out (m/s)').disable().listen();

let closest = Infinity;
let lastDistance = -1; // from the camera to the head at the last frame (−1: none yet)
/** The camera behind the character again, and the measures from zero. */
function restart() {
  rig.reset(headOf(), facing);
  closest = Infinity;
  lastDistance = -1;
  shown['frames with a wall between'] = 0;
  shown['fastest out (m/s)'] = 0;
}
restart();

/** How far a point is from the nearest box (0 inside one). */
const away = (p: THREE.Vector3) =>
  Math.min(
    ...BOXES.map(([x, y, z, hx, hy, hz]) =>
      Math.hypot(
        Math.max(0, Math.abs(p.x - x) - hx),
        Math.max(0, Math.abs(p.y - y) - hy),
        Math.max(0, Math.abs(p.z - z) - hz),
      ),
    ),
  );

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  const head = headOf();
  hero.position.copy(spot);
  hero.rotation.y = Math.atan2(-facing.x, -facing.z); // the visor, where it looks
  const view = rig.frame(head, facing, dt, {
    sweep: settings.sweep,
    easeOut: settings['ease out'],
    learns: settings['leash learns the wall'],
  });

  // MEASURED where it is shown: how near a box (from the boxes themselves, not from the sweep), and
  // whether something is between it and the head (a ray, leaving out the character).
  closest = Math.min(closest, away(view.at));
  shown['closest to a wall (cm)'] = Math.round(closest * 100);
  const toHead = head.clone().sub(view.at);
  const distance = toHead.length();
  const ray = new RAPIER.Ray(view.at, toHead.divideScalar(distance));
  if (world.castRay(ray, distance, true, undefined, undefined, undefined, body))
    shown['frames with a wall between']++;
  // How fast it moved away from the head: going back out, never faster than 3 × the cut.
  if (lastDistance >= 0 && dt > 0) {
    const speed = Number(((distance - lastDistance) / dt).toFixed(1));
    shown['fastest out (m/s)'] = Math.max(shown['fastest out (m/s)'], speed);
  }
  lastDistance = distance;
  shown['cut (m)'] = Number(view.cut.toFixed(2));
  shown['leash (m)'] = Number(view.wanted.distanceTo(head).toFixed(2));

  views.draw(head, view);
});

console.log('From above: the camera (orange), where it wants to be (wire), and the sweep.');
console.log('Bottom left, what the player sees. A click on the drawing, and WASD walks.');
