import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { HOLD, PUSH, pull, push } from './hands';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [0.5, 7.5, 8.5], target: [-1.5, 0.4, 0] });
const STEP = 1 / 60;
const G = 9.81;
const world = new RAPIER.World({ x: 0, y: -G, z: 0 });
world.timestep = STEP;

type Triple = [number, number, number];
const paint = (color: number, opacity = 1) =>
  new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity });
/** A box that is seen, the size of its collider. */
function boxMesh(half: Triple, color: number, opacity = 1): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
  const mesh = new THREE.Mesh(geometry, paint(color, opacity));
  scene.add(mesh);
  return mesh;
}

// THE FLOOR, stone (friction 0.6), and a wall 1.4 m high where the lanes start, see-through.
const FLOOR_FRICTION = 0.6;
const WALL_X = -5.5; // the wall's face, towards the lanes
const fixed: [Triple, Triple, number, number][] = [
  [[-1, -0.5, 0], [6.5, 0.5, 3], 0x6f6a62, 1],
  [[WALL_X - 0.15, 0.7, 0], [0.15, 0.7, 2.5], 0x9ab0c0, 0.35],
];
for (const [center, half, color, opacity] of fixed) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...center));
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setFriction(FLOOR_FRICTION), body);
  boxMesh(half, color, opacity).position.set(...center);
}

// THE CHARACTERS, one per lane: kinematic capsules moved by Rapier's character controller, as in
// "Un personaje". The controller stops them at what they walk into, and here it pushes nothing
// (Rapier's own push is off): the push is ours, after it.
const START_X = -5;
const WALK = 2; // m/s
const TURN = 4; // rad/s, when the keys drive
const controller = world.createCharacterController(0.02);
controller.setApplyImpulsesToDynamicBodies(false);

/** ONE LANE: a character, and in front of it a cube of `side` m, of this density and friction. */
function lane(name: string, z: number, side: number, density: number, mu: number, color: number) {
  const half = side / 2;
  // WHAT A THING WEIGHS: its density times its volume. Rapier gives a body its collider's mass.
  const thing = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  const cube = RAPIER.ColliderDesc.cuboid(half, half, half).setDensity(density).setFriction(mu);
  world.createCollider(cube, thing);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
  // Drawn: the character with its visor (towards +x), the cube, and where it holds (a yellow dot,
  // and a line from there to what it holds).
  const hero = new THREE.Group();
  hero.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1), paint(0x93d9c9)));
  const visor = new THREE.BoxGeometry(0.1, 0.12, 0.4).translate(0.28, 0.5, 0);
  hero.add(new THREE.Mesh(visor, paint(0x15120f)));
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06), paint(0xe5c07b));
  const line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xe5c07b }),
  );
  scene.add(hero, marker, line);
  return {
    name,
    z,
    side,
    thing,
    body,
    collider,
    drawn: { hero, marker, line, cube: boxMesh([half, half, half], color) },
    start: new THREE.Vector3(START_X + 0.8 + half, half, z), // 50 cm ahead of the character
    mass: thing.mass(),
    // How hard the floor holds it back: μ·m·g, with the μ Rapier uses, the two surfaces' average.
    holdsBack: ((mu + FLOOR_FRICTION) / 2) * thing.mass() * G,
    angle: 0, // where it looks: (cos, 0, sin) of it
    target: new THREE.Vector3(), // where it holds
    holding: false,
    pushed: 0,
    lifted: 0,
  };
}
// A wooden crate of 0.4 m, 0.4³ × 700 = 44.8 kg; a stone block of 0.8 m, 0.8³ × 2400 = 1228.8 kg.
const crate = lane('crate', 1, 0.4, 700, 0.5, 0x9a7a4a);
const block = lane('block', -1, 0.8, 2400, 0.6, 0x7a7672);
const lanes = [crate, block];

const settings = { autopilot: true, 'cap the force': true, 'attach it': false };
let heldAt = 0; // how high the crate is carried
let deepest = 0; // how deep into the wall it got

// THE KEYS: WASD or the arrows walk both characters at once, G grabs or lets go. The first key
// takes the autopilot off; its checkbox gives it back.
const KEYS = 'KeyW KeyA KeyS KeyD ArrowUp ArrowLeft ArrowDown ArrowRight KeyG'.split(' ');
const held = new Set<string>();
let grabPressed = false;
addEventListener('keydown', (e) => {
  if (!KEYS.includes(e.code)) return;
  e.preventDefault();
  held.add(e.code);
  if (e.code === 'KeyG') grabPressed = true;
  settings.autopilot = false;
});
addEventListener('keyup', (e) => held.delete(e.code));
const down = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);

// THE SCRIPT, the same in both lanes, an 11 s loop in steps: stand; walk into the thing (the push);
// grab it; turn round; walk back, towards the wall; turn round again; let go.
const LOOP = 660;
const at = (seconds: number) => Math.round(seconds * 60);
const ramp = (k: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (k - at(from)) / (at(to) - at(from))));
let tick = 0;

function reset() {
  for (const l of lanes) {
    l.thing.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    l.thing.setTranslation(l.start, true);
    l.thing.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    l.thing.setLinvel({ x: 0, y: 0, z: 0 }, true);
    l.thing.setAngvel({ x: 0, y: 0, z: 0 }, true);
    l.body.setTranslation({ x: START_X, y: 0.82, z: l.z }, true); // standing, 2 cm above
    l.holding = false;
    l.angle = 0;
  }
  world.propagateModifiedBodyPositionsToColliders();
}

function step() {
  const k = tick % LOOP;
  const auto = settings.autopilot;
  if (auto && k === 0) reset();
  const capped = settings['cap the force'];
  const x = down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft');
  const z = down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp');
  const keys = new THREE.Vector3(x, 0, z);
  if (x || z) keys.setLength(WALK);
  for (const l of lanes) {
    const p = l.body.translation();
    // WHAT IT DOES: what the script says (it turns round on its outer side, away from the other
    // lane), or what the keys say (it turns towards where it walks, the short way round).
    const velocity = new THREE.Vector3();
    if (auto) {
      l.angle = Math.sign(l.z) * Math.PI * (ramp(k, 3.8, 5.3) - ramp(k, 8, 9.5));
      if (k >= at(0.5) && k < at(3)) velocity.x = WALK; // into the thing
      if (k >= at(5.3) && k < at(8)) velocity.x = -Math.min(WALK, (p.x - START_X) / STEP); // back
    } else if (x || z) {
      velocity.copy(keys);
      const off = Math.atan2(z, x) - l.angle;
      const turn = Math.atan2(Math.sin(off), Math.cos(off));
      l.angle += Math.max(-TURN * STEP, Math.min(TURN * STEP, turn));
    }
    const grab = auto ? k === at(3.2) : grabPressed && !l.holding;
    const letGo = auto ? k === at(10) : grabPressed && l.holding;
    const ahead = new THREE.Vector3(Math.cos(l.angle), 0, Math.sin(l.angle));

    // 1. WHAT IT HOLDS: in front of it and a little up. It grabs the thing if it is within reach,
    // pulls it there on every step, and lets go of it when told, or if it got 2 m away.
    l.target.set(p.x, p.y + HOLD.lift, p.z).addScaledVector(ahead, HOLD.ahead);
    const t = l.thing.translation();
    if (grab) {
      l.pushed = Math.hypot(t.x - l.start.x, t.z - l.start.z);
      l.holding = l.target.distanceTo(t) < HOLD.reach;
    }
    if (letGo) l.holding = false;
    if (l.holding && settings['attach it']) {
      // ATTACHED (to see why not): kinematic, placed where it is held, whatever is in the way.
      l.thing.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      l.thing.setNextKinematicTranslation(l.target);
    } else if (l.holding && pull(l.thing, l.target, velocity, STEP, capped) > HOLD.letGo) {
      l.holding = false;
    }
    if (!l.holding && !l.thing.isDynamic()) l.thing.setBodyType(RAPIER.RigidBodyType.Dynamic, true);

    // 2. THE CONTROLLER: how far it can really walk. It stops at what is in its way.
    controller.computeColliderMovement(l.collider, velocity.clone().multiplyScalar(STEP));
    const moved = controller.computedMovement();

    // 3. THE PUSH: what it ran into that the physics moves, ahead of it, along where it walks.
    const speed = velocity.length();
    for (let i = 0; i < controller.numComputedCollisions() && speed > 0; i++) {
      const hit = controller.computedCollision(i)?.collider?.parent();
      if (!hit?.isDynamic() || (l.holding && hit === l.thing)) continue;
      const along = velocity.clone().divideScalar(speed);
      const h = hit.translation();
      if ((h.x - p.x) * along.x + (h.z - p.z) * along.z > 0) push(hit, along, speed, STEP, capped);
    }
    // Never off the floor (it has no gravity: it only walks).
    l.body.setNextKinematicTranslation({
      x: Math.max(-7.2, Math.min(5.2, p.x + moved.x)),
      y: p.y,
      z: Math.max(-2.7, Math.min(2.7, p.z + moved.z)),
    });
  }
  grabPressed = false;
  world.step();
  tick++;

  // WHAT IS MEASURED: how high each thing got; how high the crate is carried (on autopilot,
  // halfway back); how deep into the wall it got (its center may come as near as half the crate).
  for (const l of lanes) l.lifted = Math.max(l.lifted, l.thing.translation().y - l.start.y);
  const c = crate.thing.translation();
  if (crate.holding && (!auto || tick % LOOP === at(6.5))) heldAt = c.y;
  deepest = Math.max(deepest, WALL_X + crate.side / 2 - c.x);
}

/** A setting changed: what was measured starts again (and on autopilot, the loop too). */
function restart() {
  tick = 0;
  for (const l of lanes) l.lifted = l.pushed = 0;
  heldAt = deepest = 0;
}

/** THE ROWS, read-only, written on every frame from what the simulation measured. */
function rows(): Record<string, string> {
  const holders = lanes.filter((l) => l.holding).map((l) => l.name);
  const gap = crate.holding ? crate.target.distanceTo(crate.thing.translation()) : 0;
  return {
    'crate (kg)': crate.mass.toFixed(1),
    'block (kg)': block.mass.toFixed(1),
    'push, hold at most (N)': settings['cap the force'] ? `${PUSH} / ${HOLD.force}` : 'no limit',
    'crate friction (N)': crate.holdsBack.toFixed(0),
    'block friction (N)': block.holdsBack.toFixed(0),
    'crate pushed (m)': crate.pushed.toFixed(2),
    'block pushed (m)': block.pushed.toFixed(2),
    holding: holders.join(', ') || 'nothing',
    'crate held at (m)': heldAt.toFixed(2),
    'block lifted (cm)': (block.lifted * 100).toFixed(0),
    'hand to crate (cm)': (gap * 100).toFixed(0),
    'into the wall (cm)': (deepest * 100).toFixed(0),
  };
}
const shown = rows();
const gui = new GUI({ title: 'Mass: push and hold' });
gui.add(settings, 'autopilot').listen().onChange(restart);
gui.add(settings, 'cap the force').onChange(restart);
gui.add(settings, 'attach it').onChange(restart);
for (const key of Object.keys(shown)) gui.add(shown, key).disable().listen();

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  for (const l of lanes) {
    const { hero, marker, line, cube } = l.drawn;
    cube.position.copy(l.thing.translation());
    cube.quaternion.copy(l.thing.rotation());
    hero.position.copy(l.body.translation());
    hero.rotation.y = -l.angle;
    marker.visible = line.visible = l.holding;
    marker.position.copy(l.target);
    line.geometry.setFromPoints([l.target, cube.position]);
  }
  Object.assign(shown, rows());
});

console.log('A click on the drawing gives it the keyboard: WASD or the arrows walk, G grabs.');
