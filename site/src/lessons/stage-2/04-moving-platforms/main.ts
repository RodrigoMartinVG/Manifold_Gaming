import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { carousel, carriedBy, ferry, type Platform } from './platforms';

await RAPIER.init();
const { scene, controls, onFrame } = createScene({ camera: [0, 7, 12], target: [-1, 1, 1] });
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

/** A box that is seen, the size of its collider. */
function boxMesh(half: [number, number, number], color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
    new THREE.MeshStandardMaterial({ color }),
  );
  scene.add(mesh);
  return mesh;
}

// Two floors, with 8 m of void between them.
type Triple = [number, number, number];
const floors: [center: Triple, half: Triple][] = [
  [
    [-3.5, -0.5, 0],
    [3.5, 0.5, 5],
  ],
  [
    [9.5, -0.5, 0],
    [1.5, 0.5, 5],
  ],
];
for (const [center, half] of floors) {
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...center));
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half), floor);
  boxMesh(half, 0x8a6a42).position.set(...center);
}

// THE PLATFORMS: kinematic bodies moved by position. At every step, each one is PLACED where its
// function says (platforms.ts); nothing adds its velocity up. Both 30 cm high: you walk onto them.
const moving: [path: Platform, half: Triple][] = [
  // 5 m over the void and back, 2.5 s each way: 2 m/s.
  [
    ferry('ferry', new THREE.Vector3(1.5, 0.15, 0), new THREE.Vector3(6.5, 0.15, 0), 2.5, STEP),
    [1.5, 0.15, 1.5],
  ],
  // 40° per second around y, on the left floor.
  [carousel('carousel', new THREE.Vector3(-4, 0.15, 0), 40, STEP), [2, 0.15, 2]],
];
const platforms = moving.map(([path, half]) => {
  const { position } = path.poseAt(0);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z,
    ),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half), body);
  const mesh = boxMesh(half, 0x7a5a3a);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(half[0] * 1.8, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xc89a5a }),
  );
  stripe.position.y = half[1] + 0.01; // a stripe on top, to see it go and turn
  mesh.add(stripe);
  return { path, body, mesh };
});

// THE CHARACTER, as in "Un personaje": a capsule on a kinematic body moved by position, and a
// visor, to see where it looks.
const START = { x: -1, y: 1.2, z: 3 };
const body = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(START.x, START.y, START.z),
);
const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3), body);
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
const controller = world.createCharacterController(0.02);
controller.enableSnapToGround(0.3);
controller.enableAutostep(0.35, 0.15, false);
controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);

const SPEED = 4.5;
const JUMP = 6.5;
const COYOTE = 6;
const options = { carry: true, fixed: true };
const readout = { on: 'nothing', carried: '0.00', turned: '0.0', kept: '0.00' };
const gui = new GUI({ title: 'Platforms that carry' });
gui.add(readout, 'on').listen().disable();
gui.add(readout, 'carried').name('carried (m/s)').listen().disable();
gui.add(readout, 'turned').name('turned (°)').listen().disable();
gui.add(readout, 'kept').name('kept in the air (m/s)').listen().disable();
gui.add(options, 'carry').name('the platform carries it');
gui.add(options, 'fixed').name('fixed for the controller');
gui.add({ demo: () => place(-2.7, 1.15, 0) }, 'demo').name('demo: onto the carousel');

// The keys held, and the ones pressed since the last step (as in "Un personaje").
const held = new Set<string>();
const pressed = new Set<string>();
addEventListener('keydown', (e) => {
  held.add(e.code);
  pressed.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));

let tick = 0; // the step: the platforms' clock
let vy = 0;
let grounded = false;
let stepsInAir = 99;
let jumpWasHeld = false;
const kept = new THREE.Vector3(); // the velocity it took from a platform, while it is in the air
const facing = new THREE.Vector3(0, 0, -1);
let turned = 0; // how many degrees the platforms turned it, in all

/** Puts the character somewhere at once, stopped; its collider too: the controller starts there. */
function place(x: number, y: number, z: number) {
  body.setTranslation({ x, y, z }, true);
  world.propagateModifiedBodyPositionsToColliders();
  vy = 0;
  kept.set(0, 0, 0);
  grounded = false;
}

/**
 * WHAT IT STANDS ON: a ray down from its center, as far as its feet (0.8 m) plus the 30 cm the
 * controller snaps it down, and a little. The handle of the body it hits, if any.
 */
function standingOn(at: THREE.Vector3) {
  const hit = world.castRay(
    new RAPIER.Ray(at, { x: 0, y: -1, z: 0 }),
    0.8 + 0.35,
    true,
    undefined,
    undefined,
    collider,
  );
  return hit ? (hit.collider.parent()?.handle ?? null) : null;
}

function step() {
  const down = (...codes: string[]) => codes.some((c) => held.has(c) || pressed.has(c));
  const x = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  const z = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  const length = Math.hypot(x, z) || 1;
  const p = body.translation();
  const here = new THREE.Vector3(p.x, p.y, p.z);

  // 1. WHAT IT STANDS ON, if it stood on something: if it is a platform, where that platform takes,
  // in this step, the point where the character is (and its velocity there).
  const handle = grounded ? standingOn(here) : null;
  const under = platforms.find((m) => m.body.handle === handle) ?? null;
  const ride = under ? carriedBy(under.path, here, tick) : null;
  const rideVelocity = ride ? ride.movement.clone().divideScalar(STEP) : new THREE.Vector3();
  readout.on = under ? under.path.name : handle !== null ? 'the floor' : 'nothing';

  // The jump, as in "Un personaje"; from a platform, it leaves with the platform's velocity.
  const jumping = down('Space');
  let leapt = false;
  if (jumping && !jumpWasHeld && (grounded || stepsInAir <= COYOTE)) {
    vy = JUMP;
    stepsInAir = COYOTE + 1;
    leapt = true;
    if (ride && options.carry) kept.copy(rideVelocity);
  }
  jumpWasHeld = jumping;
  pressed.clear();
  vy -= 9.81 * STEP;

  // 2. THE CONTROLLER, with the platform it stands on FIXED while it computes. On a kinematic body,
  // Rapier's controller does not walk well: on a still one, every move along it comes out zero; on
  // one that moves, it goes in fits, and on some steps it drags the character along by itself.
  // Seen as fixed, it walks as on the floor; and the platform is kinematic again before the
  // physics takes its step.
  const desired = {
    x: ((x / length) * SPEED + kept.x) * STEP,
    y: vy * STEP,
    z: ((z / length) * SPEED + kept.z) * STEP,
  };
  const fixedNow = under !== null && options.fixed;
  if (fixedNow) under.body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
  controller.computeColliderMovement(collider, desired);
  if (fixedNow) under.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
  const moved = controller.computedMovement();
  const wasGrounded = grounded;
  grounded = controller.computedGrounded();
  if (grounded && vy < 0) vy = 0;
  stepsInAir = grounded ? 0 : stepsInAir + 1;

  // 3. THE CARRY, AFTER the controller: exactly as far as the platform takes the point where it is.
  // It turns with it too. Walking off its edge, it keeps the platform's velocity, as jumping does.
  const carry = new THREE.Vector3();
  if (ride && options.carry && !leapt) {
    carry.copy(ride.movement);
    facing.applyQuaternion(ride.turn);
    turned += THREE.MathUtils.radToDeg(2 * Math.atan2(ride.turn.y, ride.turn.w));
    if (wasGrounded && !grounded) kept.copy(rideVelocity);
  }
  if (grounded && !leapt) kept.set(0, 0, 0); // standing again: what it kept is spent
  readout.carried = (carry.length() / STEP).toFixed(2);
  if (x !== 0 || z !== 0) facing.set(x, 0, z).normalize(); // it looks where it walks
  body.setNextKinematicTranslation({
    x: p.x + moved.x + carry.x,
    y: p.y + moved.y + carry.y,
    z: p.z + moved.z + carry.z,
  });

  // 4. THE PLATFORMS, where their functions say for the next step. Placed, never added up.
  for (const m of platforms) {
    const pose = m.path.poseAt(tick + 1);
    m.body.setNextKinematicTranslation(pose.position);
    m.body.setNextKinematicRotation(pose.rotation);
  }
  world.step();
  tick++;
  // It fell into the void: back to the start.
  if (body.translation().y < -8) place(START.x, START.y, START.z);
}

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }
  for (const m of platforms) {
    m.mesh.position.copy(m.body.translation());
    m.mesh.quaternion.copy(m.body.rotation());
  }
  const p = body.translation();
  hero.position.set(p.x, p.y, p.z);
  hero.rotation.y = Math.atan2(-facing.x, -facing.z); // the visor, where it looks
  // The camera looks at it, but does not turn with the platform: the world stays still on screen.
  controls.target.lerp(new THREE.Vector3(p.x, p.y, p.z), 1 - Math.exp(-6 * dt));
  readout.turned = turned.toFixed(1);
  readout.kept = kept.length().toFixed(2);
});

console.log('A click on the drawing gives it the keyboard: WASD or the arrows, Space to jump.');
