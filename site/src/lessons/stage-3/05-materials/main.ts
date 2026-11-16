import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createLabels, type Label } from './labels';
import { combine, MATERIALS, readMaterial, tractionOf } from './materials';
import type { Material, Rule } from './materials';

await RAPIER.init();
const { scene, camera, onFrame } = createScene({ camera: [2.5, 7.5, 11.5], target: [2.5, 0.7, 0] });
const { label, place } = createLabels(camera);
const STEP = 1 / 60;
const RUN = 8 * 60; // every 8 s (480 steps) it all starts again, until a setting changes

// THE MATERIALS: the engine's five, and one more that the level declares in a line of its own.
const materials: Record<string, Material> = { ...MATERIALS };
const own = readMaterial('material rubber friction 0.9 bounce 0.8 density 1100 drag 1');
materials[own.name] = own.material;
// Least friction first, on the left. The ramp, the floor and the wall are stone: what the engine
// makes a box of when it says nothing.
const names = Object.keys(materials).sort((a, b) => materials[a].friction - materials[b].friction);
const STONE = materials.stone;
const COLORS: Record<string, number> = {
  ice: 0xc8dde6,
  glass: 0x6fa898,
  metal: 0x8a9098,
  wood: 0x8a6a42,
  stone: 0x77726a,
  rubber: 0x9a3c3c,
};
// In Rapier's order: its CoefficientCombineRule numbers them 0 (Average) to 3 (Max).
const RULES: Rule[] = ['average', 'min', 'multiply', 'max'];

const settings = {
  'ramp angle (°)': 25,
  'combine rule': 'average' as Rule,
  traction: true,
  autopilot: true,
};
const shown: Record<string, number> = {
  'tan(angle)': 0,
  'ice slid (m)': 0,
  'stone slid (m)': 0,
  'rubber bounced (m)': 0,
  'rubber: e² × 2 m': 0,
  'stops on stone (steps)': 0,
  'stops on ice (steps)': 0,
};

// WHAT IS SEEN, made once: a box and a ball of each material, the ramp, the floor and a wall.
const BOX = 0.3; // half a box's side
const BALL = 0.25; // a ball's radius
const DROP = 2; // m, from a ball's bottom to the floor
const LENGTH = 4.5; // the ramp, along its slope
function mesh(geometry: THREE.BufferGeometry, color: number) {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  scene.add(m);
  return m;
}
const things = names.map((name, i) => {
  const x = (i - (names.length - 1) / 2) * 1.5;
  const ballTag = label();
  ballTag.at.set(x, 0, 6.1); // under the ball, nearer the camera
  return {
    name,
    box: mesh(new THREE.BoxGeometry(2 * BOX, 2 * BOX, 2 * BOX), COLORS[name] ?? 0xaaaaaa),
    ball: mesh(new THREE.SphereGeometry(BALL, 24, 16), COLORS[name] ?? 0xaaaaaa),
    boxTag: label(),
    ballTag,
    x,
  };
});
const ramp = mesh(new THREE.BoxGeometry(9, 0.2, LENGTH), 0x5e5a54);
mesh(new THREE.BoxGeometry(10, 0.2, 6), 0x5e5a54).position.set(0, -0.1, 3);
mesh(new THREE.BoxGeometry(9, 0.8, 0.3), 0x4e4a44).position.set(0, 0.4, 3.2);

// THE WALKERS: kinematic, as a character is ("Un personaje"). The physics' friction never acts on
// them; how much their feet hold is the game's rule: the floor's friction over stone's
// (`tractionOf`) limits how much a step can change their velocity. So they need no physics at all.
const WALK = 4.5; // m/s
const ACCELERATION = 50; // m/s², the most a walk changes the velocity, on stone
const [FAR, NEAR] = [-3.45, 2.05]; // the ends of their strips
interface Walker {
  on: string;
  x: number;
  z: number;
  v: number;
  stopping: number; // steps since it was told to stop
  steps: number; // how many it took, the last time
  body: THREE.Mesh;
  tag: Label;
}
const walkers: Walker[] = [
  { on: 'stone', x: -6.7 },
  { on: 'ice', x: -8 },
].map(({ on, x }) => {
  mesh(new THREE.BoxGeometry(1, 0.2, 6), COLORS[on]).position.set(x, -0.1, -0.7);
  const body = mesh(new THREE.CapsuleGeometry(0.25, 0.7, 6, 12), 0x93d9c9);
  return { on, x, z: -3.2, v: 0, stopping: 0, steps: 0, body, tag: label() };
});

/** One step of a walker: towards what it is asked, by at most what its floor lets its feet push. */
function walk(w: Walker, asked: number) {
  const traction = settings.traction ? tractionOf(materials[w.on].friction) : 1;
  const most = ACCELERATION * traction * STEP;
  const was = w.v;
  const gap = asked * WALK - w.v;
  w.v = Math.abs(gap) <= most ? asked * WALK : w.v + Math.sign(gap) * most;
  w.z += w.v * STEP;
  // Told to stop, it counts the steps until it does.
  if (asked === 0 && was !== 0) {
    w.stopping++;
    if (w.v === 0) {
      w.steps = w.stopping;
      w.stopping = 0;
    }
  }
  // At an end of its strip, it stops there (walking with the keys).
  if (w.z < FAR || w.z > NEAR) {
    w.z = Math.max(FAR, Math.min(NEAR, w.z));
    w.v = 0;
    w.stopping = 0;
  }
}

// THE KEYS: W and S (or the arrows) walk both at once. The first one pressed ends the autopilot.
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (!['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
  held.add(e.code);
  settings.autopilot = false;
  e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
const isHeld = (...codes: string[]) => codes.some((c) => held.has(c));

let world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
let bodies: { box: RAPIER.RigidBody; ball: RAPIER.RigidBody; start: THREE.Vector3 }[] = [];
let tick = 0;
let bounce = { up: false, apex: 0, done: false };

/** THE RUN, built anew: every 8 s, and whenever a setting changes. */
function build() {
  world.free();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  tick = 0;
  bounce = { up: false, apex: 0, done: false };
  if (settings.autopilot) for (const w of walkers) Object.assign(w, { z: -3.2, v: 0, stopping: 0 });
  const rule = settings['combine rule'];
  // EVERY COLLIDER SAYS WHAT IT IS MADE OF: its friction, its bounce, and the rule to combine them.
  const madeOf = (desc: RAPIER.ColliderDesc, m: Material) =>
    desc
      .setFriction(m.friction)
      .setRestitution(m.bounce)
      .setFrictionCombineRule(RULES.indexOf(rule))
      .setRestitutionCombineRule(RULES.indexOf(rule));
  const fixed = (desc: RAPIER.ColliderDesc, at: THREE.Vector3, turn = new THREE.Quaternion()) => {
    const body = RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z).setRotation(turn);
    world.createCollider(madeOf(desc, STONE), world.createRigidBody(body));
  };
  // THE RAMP turns about x, with its foot at the origin: up its slope is (0, sin θ, −cos θ).
  const angle = THREE.MathUtils.degToRad(settings['ramp angle (°)']);
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const [sin, cos] = [Math.sin(angle), Math.cos(angle)];
  const onRamp = (along: number, above: number) =>
    new THREE.Vector3(0, along * sin + above * cos, -along * cos + above * sin);
  fixed(RAPIER.ColliderDesc.cuboid(4.5, 0.1, LENGTH / 2), onRamp(LENGTH / 2, -0.1), turn);
  ramp.position.copy(onRamp(LENGTH / 2, -0.1));
  ramp.quaternion.copy(turn);
  fixed(RAPIER.ColliderDesc.cuboid(5, 0.1, 3), new THREE.Vector3(0, -0.1, 3));
  fixed(RAPIER.ColliderDesc.cuboid(4.5, 0.4, 0.15), new THREE.Vector3(0, 0.4, 3.2));
  // A BOX OF EACH, at rest on the ramp; and a ball of each, its bottom 2 m over the floor.
  bodies = things.map((t) => {
    const m = materials[t.name];
    const start = onRamp(LENGTH - 0.5, BOX).setX(t.x);
    // It may not sleep: one that barely slides would be put to sleep in half a second, and stop.
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z);
    const box = world.createRigidBody(desc.setRotation(turn).setCanSleep(false));
    world.createCollider(madeOf(RAPIER.ColliderDesc.cuboid(BOX, BOX, BOX), m), box);
    const dropped = RAPIER.RigidBodyDesc.dynamic().setTranslation(t.x, DROP + BALL, 5);
    const ball = world.createRigidBody(dropped);
    world.createCollider(madeOf(RAPIER.ColliderDesc.ball(BALL), m), ball);
    // What its contacts will use, by the same rule: against the stone it touches.
    t.boxTag.say(`${t.name}\nμ ${combine(m.friction, STONE.friction, rule).toFixed(2)}`);
    t.ballTag.say(`${t.name}\ne ${combine(m.bounce, STONE.bounce, rule).toFixed(2)}`);
    return { box, ball, start };
  });
  shown['tan(angle)'] = +Math.tan(angle).toFixed(3);
  const e = combine(own.material.bounce, STONE.bounce, rule);
  shown['rubber: e² × 2 m'] = +(e * e * DROP).toFixed(3);
}

/** A setting changed: what was measured belongs to another run. */
function restart() {
  for (const w of walkers) w.steps = 0;
  shown['rubber bounced (m)'] = 0;
  build();
}

function step() {
  world.step();
  tick++;
  // THE WALKERS, on autopilot: 1.15 s ahead, told to stop, and the same way back. Or the keys.
  const keys = (isHeld('KeyS', 'ArrowDown') ? 1 : 0) - (isHeld('KeyW', 'ArrowUp') ? 1 : 0);
  const auto = tick <= 69 ? 1 : tick > 240 && tick <= 309 ? -1 : 0;
  for (const w of walkers) walk(w, settings.autopilot ? auto : keys);
  // THE RUBBER BALL'S FIRST BOUNCE: the highest it gets between going up and coming down again.
  const rubber = bodies[names.indexOf(own.name)].ball;
  if (!bounce.done) {
    if (rubber.linvel().y > 0) {
      bounce.up = true;
      bounce.apex = Math.max(bounce.apex, rubber.translation().y - BALL);
    } else if (bounce.up) {
      bounce.done = true;
      shown['rubber bounced (m)'] = +bounce.apex.toFixed(3);
    }
  }
  if (tick >= RUN) build();
}

const gui = new GUI({ title: 'what things are made of' });
gui.add(settings, 'ramp angle (°)', 0, 40, 0.5).onChange(restart);
gui.add(settings, 'combine rule', RULES).onChange(restart);
gui.add(settings, 'traction').onChange(restart);
gui
  .add(settings, 'autopilot')
  .listen()
  .onChange((on: boolean) => on && restart());
for (const key of Object.keys(shown)) gui.add(shown, key).disable().listen();
build();

/** How far a box went from where it started, at rest. */
function slid(name: string) {
  const { box, start } = bodies[names.indexOf(name)];
  return start.distanceTo(new THREE.Vector3().copy(box.translation()));
}

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  bodies.forEach(({ box, ball }, i) => {
    const t = things[i];
    t.box.position.copy(box.translation());
    t.box.quaternion.copy(box.rotation());
    t.ball.position.copy(ball.translation());
    // (Neighbours' names at two heights, so they do not overlap.)
    t.boxTag.at.copy(t.box.position).setY(t.box.position.y + (i % 2 ? 1.3 : 0.7));
  });
  walkers.forEach((w, i) => {
    w.body.position.set(w.x, 0.6, w.z);
    w.tag.at.set(w.x, i ? 2.9 : 1.55, w.z);
    w.tag.say(w.steps ? `${w.on}\nstops in ${w.steps} steps` : w.on);
  });
  shown['ice slid (m)'] = +slid('ice').toFixed(3);
  shown['stone slid (m)'] = +slid('stone').toFixed(3);
  shown['stops on stone (steps)'] = walkers[0].steps;
  shown['stops on ice (steps)'] = walkers[1].steps;
  place();
});
