import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { decide, MODES, movement, type Ask, type ModeName } from './modes';

await RAPIER.init();
const { scene, controls, onFrame } = createScene({ camera: [0, 6, 13], target: [3, 1.5, 0] });
const STEP = 1 / 60;
const GRAVITY = 9.81;
const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
world.timestep = STEP;

/** Something fixed in the level: a box, at a place. */
function block(center: [number, number, number], half: [number, number, number], color: number) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...center));
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half), body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
    new THREE.MeshStandardMaterial({ color }),
  );
  mesh.position.set(...center);
  scene.add(mesh);
}
block([0, -0.5, 0], [10, 0.5, 10], 0x8a6a42); // the floor
block([3, 1.5, 0], [2, 1.5, 1.5], 0x6e5a44); // a tower, 3 m high: its right face is the wall to climb

// THE WIND: a zone that carries whatever is inside it, towards the back, whatever its mode.
const windZone = new THREE.Box3(new THREE.Vector3(-6.5, 0, -5), new THREE.Vector3(-0.5, 7, 1.5));
const wind = { speed: 1, direction: new THREE.Vector3(0, 0, -1) };
scene.add(new THREE.Box3Helper(windZone, 0x6fa8dc));

// THE CHARACTER: the capsule of the stage 1 lesson, on a kinematic body, with its controller.
const START = { x: 7, y: 0.9, z: 0 };
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(START.x, START.y, START.z),
);
const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
const controller = world.createCharacterController(0.02);
controller.enableSnapToGround(0.3);
controller.enableAutostep(0.35, 0.15, false);
controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
const look = new THREE.MeshStandardMaterial();
const hero = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1, 6, 16), look);
scene.add(hero);
/** A color for each mode: the capsule shows which one it is in. */
const COLORS = { walk: 0x93d9c9, air: 0xe8e2d4, glide: 0xf2c14e, climb: 0xe07a3f };

// What it is doing: its mode, its velocity along the ground and up, whether it stands, its wall.
const c = {
  mode: 'air' as ModeName,
  v: new THREE.Vector3(),
  vy: 0,
  grounded: false,
  wall: new THREE.Vector3(),
  jumpWasHeld: false,
};

/** A ray from `from` along `dir`, as far as `far`: what it hits first (never the character). */
const ray = (from: THREE.Vector3, dir: THREE.Vector3, far: number) =>
  world.castRayAndGetNormal(new RAPIER.Ray(from, dir), far, true, undefined, undefined, collider);
const FEET = 0.6; // it feels walls from its feet: 60 cm under its center (its bottom is at 80)
const REACH = 0.4; // how near a wall has to be, from its center: its radius, and 10 cm

/** A WALL in that direction, near enough: the direction towards it (along the ground). Or zero. */
function wallAhead(feet: THREE.Vector3, direction: THREE.Vector3): THREE.Vector3 {
  const hit = ray(feet, direction, 1);
  if (!hit || Math.abs(hit.normal.y) > 0.35) return new THREE.Vector3(); // nothing, a floor, a slope
  const wall = new THREE.Vector3(-hit.normal.x, 0, -hit.normal.z).normalize();
  // Its distance straight to the wall, not along the ray: so it also notices it pushing at an angle.
  return hit.timeOfImpact * direction.dot(wall) <= REACH ? wall : new THREE.Vector3();
}

/** Whether the wall it climbed ended at its top: a short ray down, just past it, finds a floor. */
function topAhead(feet: THREE.Vector3, wall: THREE.Vector3): boolean {
  const from = feet.clone().addScaledVector(wall, REACH + 0.2);
  const hit = ray(from.setY(feet.y + 0.6), new THREE.Vector3(0, -1, 0), 0.75);
  return hit !== null && hit.normal.y > 0.7;
}

// The keys held, and the ones pressed since the last step (a quick tap must not be lost).
const held = new Set<string>();
const pressed = new Set<string>();
addEventListener('keydown', (e) => {
  held.add(e.code);
  pressed.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));

// THE DEMO: it plays the keys by itself, phase by phase, each one until something happens.
const DEMO: { keys: string[]; until: () => boolean }[] = [
  { keys: ['KeyA'], until: () => c.grounded && body.translation().y > 3 }, // up the wall, onto the top
  { keys: ['KeyA'], until: () => body.translation().x < 1.6 }, // to the far edge
  { keys: ['KeyA', 'Space'], until: () => c.vy < 0 }, // a jump, holding Space...
  { keys: ['Space'], until: () => c.grounded }, // ...and still holding it while it falls
];
let demo: { phase: number; steps: number } | null = null;
/** The keys the demo holds in this step; null if it is not playing. */
function demoKeys(): string[] | null {
  if (!demo) return null;
  while (demo.phase < DEMO.length && DEMO[demo.phase]!.until()) demo.phase++;
  if (demo.phase >= DEMO.length || ++demo.steps > 1200) demo = null;
  return demo ? DEMO[demo.phase]!.keys : null;
}

const seen: ModeName[] = []; // the modes it has been in
const applied = { gravity: true, fall: null as number | null, limited: false, wind: false };

function step() {
  if (body.translation().y < -3) reset(); // it fell off the floor: back to the start
  // 1. WHAT IS ASKED FOR: a direction along the ground (of length 0 to 1), and the jump.
  const keys = demoKeys();
  const down = (...codes: string[]) =>
    codes.some((k) => (keys ? keys.includes(k) : held.has(k) || pressed.has(k)));
  const move = new THREE.Vector3(
    (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
    0,
    (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0),
  );
  if (move.length() > 1) move.normalize();
  const jumping = down('Space');
  pressed.clear();
  // A wall: from its feet, towards the wall it climbs, or towards where it is asked to go.
  const p = body.translation();
  const feet = new THREE.Vector3(p.x, p.y - FEET, p.z);
  const climbed = c.wall;
  const towards = climbed.lengthSq() > 0 ? climbed : move.clone().normalize();
  c.wall = towards.lengthSq() > 0 ? wallAhead(feet, towards) : new THREE.Vector3();
  const wanted = move.clone().multiplyScalar(movement.walk.speed);
  const ask: Ask = { move, wanted, wall: c.wall, dt: STEP };

  // 2. THE MODE: exactly one, decided in one place. It steers the velocity along the ground.
  const before = c.mode;
  c.mode = decide(c, ask, jumping);
  const mode = MODES[c.mode];
  c.v = mode.steer(c.v, ask);
  // The top of the wall: it was climbing, and the wall ended under its feet. A hop, to get onto it.
  const wallEnded = before === 'climb' && c.mode !== 'climb' && c.wall.lengthSq() === 0;
  if (wallEnded && topAhead(feet, climbed)) c.vy = Math.max(c.vy, movement.climb.top);

  // 3. THE JUMP: when Space is pressed (not held), walking.
  if (jumping && !c.jumpWasHeld && c.mode === 'walk') c.vy = movement.jump.speed;
  c.jumpWasHeld = jumping;

  // 4. THE CONTRIBUTIONS, whatever the mode: gravity (unless the mode holds itself); the mode's
  // fall limit, after the sum; and the wind, which only moves it, in this step.
  applied.gravity = !mode.holds;
  if (mode.holds) c.vy = mode.holds(ask);
  else c.vy -= GRAVITY * STEP;
  applied.fall = mode.fall ? mode.fall() : null;
  applied.limited = applied.fall !== null && c.vy < -applied.fall;
  if (applied.fall !== null) c.vy = Math.max(c.vy, -applied.fall);
  applied.wind = windZone.containsPoint(new THREE.Vector3(p.x, p.y, p.z));
  const carried = new THREE.Vector3();
  if (applied.wind) carried.copy(wind.direction).multiplyScalar(wind.speed);

  // 5. WHAT IT CAN REALLY DO: the controller slides it along walls and keeps it on the ground.
  const desired = { x: (c.v.x + carried.x) * STEP, y: c.vy * STEP, z: (c.v.z + carried.z) * STEP };
  controller.computeColliderMovement(collider, desired);
  const moved = controller.computedMovement();
  c.grounded = controller.computedGrounded();
  if (c.grounded && c.vy < 0) c.vy = 0;
  body.setNextKinematicTranslation({ x: p.x + moved.x, y: p.y + moved.y, z: p.z + moved.z });
  world.step();
  if (!seen.includes(c.mode)) seen.push(c.mode);
}

/** Back to the start, still (its collider too, so the controller sees it there in the next step). */
function reset() {
  body.setTranslation(START, true);
  world.propagateModifiedBodyPositionsToColliders();
  Object.assign(c, { mode: 'air', v: new THREE.Vector3(), vy: 0, grounded: false });
  c.wall.set(0, 0, 0);
}

/** The demo's button: back to the start, and it plays. */
function playDemo() {
  reset();
  seen.length = 0;
  demo = { phase: 0, steps: 0 };
}

// THE PANEL: what it is doing, and each mode's numbers.
const readout = { mode: '', speed: '', vy: '', gravity: '', fall: '', wind: '', seen: '' };
const gui = new GUI({ title: 'Modes', width: 270 });
gui.add(readout, 'mode').listen().disable();
gui.add(readout, 'speed').name('speed along the ground').listen().disable();
gui.add(readout, 'vy').name('vertical velocity').listen().disable();
gui.add(readout, 'gravity').listen().disable();
gui.add(readout, 'fall').name('fall limit').listen().disable();
gui.add(readout, 'wind').listen().disable();
gui.add(readout, 'seen').name('modes seen').listen().disable();
gui.add({ demo: playDemo }, 'demo');
const numbers = gui.addFolder("Each mode's numbers");
numbers.add(movement.walk, 'acceleration', 1, 100, 1).name('walk: acceleration (m/s²)');
numbers.add(movement.air, 'control', 0, 50, 1).name('air: control (m/s²)');
numbers.add(movement.glide, 'control', 0, 50, 1).name('glide: control (m/s²)');
numbers.add(movement.glide, 'fall', 0.1, 10, 0.1).name('glide: fall (m/s)');
numbers.add(movement.climb, 'speed', 0.5, 6, 0.1).name('climb: speed (m/s)');
numbers.add(wind, 'speed', 0, 4, 0.1).name('wind (m/s)');
numbers.close(); // a click opens it

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }
  const p = body.translation();
  hero.position.set(p.x, p.y, p.z);
  look.color.setHex(COLORS[c.mode]);
  controls.target.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.1); // the camera looks at it
  readout.mode = c.mode;
  readout.speed = `${c.v.length().toFixed(2)} m/s`;
  readout.vy = `${c.vy.toFixed(2)} m/s`;
  readout.gravity = applied.gravity ? 'on' : 'off: the mode holds it';
  const fall = applied.fall === null ? 'none' : `${applied.fall.toFixed(1)} m/s`;
  readout.fall = applied.limited ? `${fall}, reached` : fall;
  readout.wind = applied.wind ? `${wind.speed.toFixed(1)} m/s` : 'none';
  readout.seen = seen.join(', ');
});

console.log('Click the drawing to give it the keyboard: WASD or the arrows, Space to jump.');
