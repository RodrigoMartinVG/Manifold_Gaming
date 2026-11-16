import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { BLOCKS, START, STARS } from './level';
import { inputAt, TRIES, type Input } from './demo';

await RAPIER.init();
const { scene, camera, controls, onFrame } = createScene({ camera: [0, 8, 18], target: [0, 1, 6] });
const STEP = 1 / 60;
const GRAVITY = 9.81;
const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
world.timestep = STEP;

for (const { center, half } of BLOCKS) {
  const block = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...center));
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half), block);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
    new THREE.MeshStandardMaterial({ color: 0x8a6a42 }),
  );
  mesh.position.set(...center);
  scene.add(mesh);
}
// The stars: small golden cubes that spin. Passing through one takes it.
const stars = STARS.map(({ name, at }) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffc533, emissive: 0x6a4a00 }),
  );
  mesh.position.set(...at);
  scene.add(mesh);
  return { name, at: new THREE.Vector3(...at), mesh, taken: false };
});

// The capsule of the lesson "Un personaje": a kinematic body, and its character controller.
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...START),
);
const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
const hero = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1, 6, 16),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(hero);
const controller = world.createCharacterController(0.02);
controller.enableSnapToGround(0.3);
controller.enableAutostep(0.35, 0.15, false);
controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);

/** How it moves, in m/s and m/s² (the engine's numbers). */
const MOVE = {
  speed: 4.5,
  jump: 6.5,
  coyote: 6, // steps after leaving an edge that a jump still counts
  airJumps: 1, // how many more jumps in the air, if it can
  steer: { walk: 50, air: 14, glide: 20 }, // how fast each mode reaches the velocity asked for
  glideFall: 1.5, // the fastest it falls gliding
  climb: { speed: 2.5, top: 4, off: 4 }, // up the wall; the hop at its top; away from it, jumping
};
type Mode = 'walk' | 'air' | 'glide' | 'climb';

/**
 * THE CHARACTER'S DATA. What it can do besides walking and jumping is THREE BOOLEANS in it (`can`):
 * not a subclass, not another kind of character. The same character, with other data.
 */
const character = {
  can: { climb: true, glide: true, doubleJump: true },
  airJumps: MOVE.airJumps, // jumps it still has in the air
  mode: 'air' as Mode,
  velocity: { x: 0, y: 0, z: 0 },
  grounded: false,
  stepsInAir: 99,
  jumpHeld: false,
  wall: null as { x: number; z: number } | null, // the wall it touches: the direction towards it
};
type Character = typeof character;

/**
 * WHICH MODE, decided here and only here. And here two capabilities are read: it climbs only if
 * `can.climb`, and glides only if `can.glide`. (`push`: how much it pushes against a wall, 0 to 1.)
 */
function modeFor(c: Character, push: number, jumping: boolean): Mode {
  // Grabbing a wall in the air only while falling: just after jumping off one, it does not grab it again.
  if (c.can.climb && push > 0.5 && (c.grounded || c.mode === 'climb' || c.velocity.y <= 0))
    return 'climb';
  if (c.grounded) return 'walk';
  if (c.can.glide && jumping && c.velocity.y < 0) return 'glide';
  return 'air';
}

/** A wall that way: a ray from its feet, 55 cm. If it hits something upright, the direction towards it. */
function wallAhead(x: number, z: number) {
  const p = body.translation();
  const ray = new RAPIER.Ray({ x: p.x, y: p.y - 0.5, z: p.z }, { x, y: 0, z });
  const hit = world.castRayAndGetNormal(ray, 0.55, true, undefined, undefined, collider);
  if (!hit || Math.abs(hit.normal.y) > 0.35) return null; // nothing, or a floor, a ceiling, a slope
  const length = Math.hypot(hit.normal.x, hit.normal.z);
  return { x: -hit.normal.x / length, z: -hit.normal.z / length };
}

/** Goes from the velocity it has towards the one asked for, changing at most `most` (m/s). */
function approach(v: { x: number; z: number }, x: number, z: number, most: number) {
  const dx = x - v.x;
  const dz = z - v.z;
  const away = Math.hypot(dx, dz);
  return away <= most ? { x, z } : { x: v.x + (dx * most) / away, z: v.z + (dz * most) / away };
}

function step(input: Input) {
  const c = character;
  const v = c.velocity;
  const asked = Math.hypot(input.x, input.z);
  const move = asked > 1 ? { x: input.x / asked, z: input.z / asked } : { x: input.x, z: input.z };
  // The wall it climbs, or one where it is asked to go.
  const towards = c.wall ?? (asked > 0.1 ? { x: input.x / asked, z: input.z / asked } : null);
  c.wall = towards ? wallAhead(towards.x, towards.z) : null;
  const push = c.wall ? move.x * c.wall.x + move.z * c.wall.z : 0;

  // 1. THE MODE, with what it can do. At the top of a wall it was climbing: a hop, to get onto it.
  const climbing = c.mode === 'climb';
  c.mode = modeFor(c, push, input.jump);
  if (climbing && c.mode !== 'climb' && !c.wall) v.y = Math.max(v.y, MOVE.climb.top);

  // 2. Along the ground: towards what is asked, as fast as the mode lets it; climbing, along the wall.
  if (c.mode === 'climb') {
    v.x = (move.x - push * c.wall!.x) * MOVE.climb.speed;
    v.z = (move.z - push * c.wall!.z) * MOVE.climb.speed;
  } else
    Object.assign(
      v,
      approach(v, move.x * MOVE.speed, move.z * MOVE.speed, MOVE.steer[c.mode] * STEP),
    );

  // 3. THE JUMP, when it is pressed: from the ground, from a wall, or ONE MORE IN THE AIR, if it can.
  const pressed = input.jump && !c.jumpHeld;
  c.jumpHeld = input.jump;
  if (c.grounded || c.mode === 'climb') c.airJumps = MOVE.airJumps; // back, on the ground or on a wall
  if (pressed && c.mode === 'climb') {
    v.y = MOVE.jump; // off the wall: up, and away from it
    v.x = -c.wall!.x * MOVE.climb.off;
    v.z = -c.wall!.z * MOVE.climb.off;
    c.mode = 'air';
    c.stepsInAir = MOVE.coyote + 1;
  } else if (pressed && (c.grounded || c.stepsInAir <= MOVE.coyote)) {
    v.y = MOVE.jump;
    c.stepsInAir = MOVE.coyote + 1;
  } else if (pressed && c.can.doubleJump && c.airJumps > 0) {
    v.y = MOVE.jump;
    c.airJumps--;
  }

  // 4. Up: climbing holds itself (it rises as much as it pushes); if not, gravity, and gliding caps the fall.
  if (c.mode === 'climb') v.y = MOVE.climb.speed * Math.max(0, push);
  else {
    v.y -= GRAVITY * STEP;
    if (c.mode === 'glide') v.y = Math.max(v.y, -MOVE.glideFall);
  }

  // 5. The controller says how much of that it can really do.
  controller.computeColliderMovement(collider, { x: v.x * STEP, y: v.y * STEP, z: v.z * STEP });
  const moved = controller.computedMovement();
  c.grounded = controller.computedGrounded();
  if (c.grounded && v.y < 0) v.y = 0;
  c.stepsInAir = c.grounded ? 0 : c.stepsInAir + 1;
  const p = body.translation();
  body.setNextKinematicTranslation({ x: p.x + moved.x, y: p.y + moved.y, z: p.z + moved.z });
  world.step();
}

/** Puts it somewhere, still, as if it had just been born there (what it can do does not change). */
function place(at: [number, number, number]) {
  body.setTranslation({ x: at[0], y: at[1], z: at[2] }, true);
  world.propagateModifiedBodyPositionsToColliders(); // so the next ray and the controller see it there
  Object.assign(character, {
    airJumps: MOVE.airJumps,
    mode: 'air',
    grounded: false,
    stepsInAir: 99,
    wall: null,
  });
  character.velocity = { x: 0, y: 0, z: 0 };
}

let steps = 0;
const readout = { mode: 'air', airJumps: 0, stars: 0, taken: 'none', demosPlayed: 0 };
const gui = new GUI({ title: 'What it can do' });
// The panel writes the character's own data: the checkbox `climb` IS `character.can.climb`. A change
// is a change of the world, at a step: the console says which one.
const changed = (name: string) => (on: boolean) =>
  console.log(`step ${steps}: ${name} ${on ? 'on' : 'off'}`);
gui.add(character.can, 'climb').onChange(changed('climb'));
gui.add(character.can, 'glide').onChange(changed('glide'));
gui.add(character.can, 'doubleJump').name('double jump').onChange(changed('double jump'));
gui.add(readout, 'mode').listen().disable();
gui.add(readout, 'airJumps').name('air jumps').listen().disable();
gui.add(readout, 'stars').listen().disable();
gui.add(readout, 'taken').listen().disable();
gui.add(readout, 'demosPlayed').name('demos played').listen().disable();

/** Puts the stars back. */
function putStarsBack() {
  for (const s of stars) {
    s.taken = false;
    s.mesh.visible = true;
  }
}
// THE DEMO: a scripted try at each star, with what the character can do NOW.
let demo: { at: number; step: number } | null = null;
const buttons = {
  demo() {
    putStarsBack();
    demo = { at: 0, step: 0 };
  },
  reset() {
    putStarsBack();
    demo = null;
    place(START);
  },
};
gui.add(buttons, 'demo');
gui.add(buttons, 'reset');

/** The demo's input at this step (moving on to the next try when one is over); null if it is not playing. */
function demoInput(): Input | null {
  while (demo) {
    const t = TRIES[demo.at];
    if (!t) {
      readout.demosPlayed++;
      console.log(`demo over: ${stars.filter((s) => s.taken).length} stars of ${stars.length}`);
      demo = null;
      place(START);
      break;
    }
    if (demo.step === 0) {
      place(t.from);
      const can = Object.entries(character.can)
        .filter(([, on]) => on)
        .map(([name]) => name);
      console.log(`demo: the ${t.star}'s star, with ${can.join(', ') || 'nothing'}`);
    }
    const input = inputAt(t, demo.step++);
    if (input) return input;
    demo = { at: demo.at + 1, step: 0 };
  }
  return null;
}

// The keys held, and the ones pressed since the last step (a quick tap must not be lost).
const held = new Set<string>();
const tapped = new Set<string>();
addEventListener('keydown', (e) => {
  held.add(e.code);
  tapped.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
function keyboard(): Input {
  const down = (...codes: string[]) => codes.some((k) => held.has(k) || tapped.has(k));
  return {
    x: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
    z: (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0),
    jump: down('Space'),
  };
}

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    step(demoInput() ?? keyboard()); // while the demo plays, the keyboard waits
    tapped.clear();
    steps++;
    const p = body.translation();
    for (const s of stars)
      if (!s.taken && s.at.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) < 0.8) {
        s.taken = true;
        s.mesh.visible = false;
      }
    // Fallen into the void: back to the start (or, in the demo, on to its next try).
    if (p.y < -15) {
      if (demo) demo = { at: demo.at + 1, step: 0 };
      else place(START);
    }
    accumulator -= STEP;
  }
  const p = body.translation();
  hero.position.set(p.x, p.y, p.z);
  for (const s of stars) s.mesh.rotation.set(0.5, s.mesh.rotation.y + 2 * dt, 0);
  // The camera goes with it.
  const before = controls.target.clone();
  controls.target.lerp(new THREE.Vector3(p.x, p.y, p.z), 1 - Math.exp(-6 * dt));
  camera.position.add(controls.target.clone().sub(before));
  readout.mode = character.mode;
  readout.airJumps = character.airJumps;
  readout.taken =
    stars
      .filter((s) => s.taken)
      .map((s) => s.name)
      .join(', ') || 'none';
  readout.stars = stars.filter((s) => s.taken).length;
});

console.log('A click on the drawing gives it the keyboard: WASD or the arrows, Space to jump.');
