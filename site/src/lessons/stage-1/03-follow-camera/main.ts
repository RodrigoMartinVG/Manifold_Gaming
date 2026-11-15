import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { chase, leash, rigid, type Follow } from './rigs';

const { scene, camera, map, onFrame } = createScene();
const material = (color: number) => new THREE.MeshStandardMaterial({ color });

// Pillars, to see the world go by.
for (let i = 0; i < 40; i++) {
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.5), material(0x5a4a38));
  pillar.position.set(((i * 7) % 19) * 2 - 18, 1, Math.floor(i / 4) * 4 - 18);
  scene.add(pillar);
}

// THE CHARACTER: a capsule with a visor (where it looks).
const hero = new THREE.Group();
hero.add(
  new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1, 6, 16).translate(0, 0.8, 0), material(0x93d9c9)),
  new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.1).translate(0, 1.3, -0.28),
    material(0x15120f),
  ),
);
scene.add(hero);
const facing = new THREE.Vector3(0, 0, -1);

// What only the map shows (layer 1): the camera, as a cone, and its leash, as a line.
const eye = new THREE.Mesh(
  new THREE.ConeGeometry(0.35, 0.8, 12).rotateX(-Math.PI / 2),
  material(0xe0a040),
);
eye.layers.set(1);
scene.add(eye);
const leashLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xe0a040 }),
);
leashLine.layers.set(1);
scene.add(leashLine);

const RIGS = { 'fixed to its back': rigid, 'on a leash': leash, chasing: chase };
const options = { camera: 'on a leash', screen: 60, autopilot: true };
const follow: Follow = { distance: 6, height: 2.5, strength: 4, smoothing: 'with dt' };
const gui = new GUI({ title: 'The camera that follows' });
gui.add(options, 'camera', Object.keys(RIGS));
gui.add(follow, 'smoothing', ['with dt', 'per frame']).name('chasing, smoothed');
gui.add(follow, 'strength', 0.5, 12, 0.5).name('chasing strength');
gui.add(follow, 'distance', 2, 12, 0.5);
gui.add(follow, 'height', 0, 6, 0.25);
gui.add(options, 'screen', 5, 120, 1).name('screen (frames/s)');
gui.add(options, 'autopilot').name('autopilot (or WASD)');

const held = new Set<string>();
addEventListener('keydown', (e) => held.add(e.code));
addEventListener('keyup', (e) => held.delete(e.code));

let t = 0;
let screenTime = 0;
onFrame((dt) => {
  // A slow screen, on purpose (like in the lesson of the fixed step): only when one of its frames arrives.
  screenTime += dt;
  if (screenTime < 1 / options.screen) return;
  const frameDt = screenTime;
  screenTime = 0;
  t += frameDt;

  // 1. THE CHARACTER WALKS: with the keys (W is −Z), or along a figure eight by itself.
  const keys = new THREE.Vector3(
    (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
    0,
    (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0),
  );
  const velocity =
    keys.lengthSq() > 0 || !options.autopilot
      ? keys.normalize().multiplyScalar(4)
      : new THREE.Vector3(2 * Math.cos(t / 3), 0, 2.7 * Math.cos((2 * t) / 3));
  hero.position.addScaledVector(velocity, frameDt);
  if (velocity.lengthSq() > 0.01)
    facing.lerp(velocity.clone().normalize(), 1 - Math.exp(-10 * frameDt)).normalize();
  hero.lookAt(hero.position.clone().sub(facing)); // (lookAt points an object's +Z; the visor is on −Z)

  // 2. THE CAMERA, one of three ways (rigs.ts), looking at the head.
  const head = hero.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  RIGS[options.camera as keyof typeof RIGS](camera, head, facing, frameDt, follow);

  // 3. THE MAP: it follows the character, and shows the camera and its leash.
  map.position.set(hero.position.x, 30, hero.position.z);
  eye.position.copy(camera.position);
  eye.lookAt(head.x, camera.position.y, head.z);
  eye.rotateY(Math.PI); // the cone's tip, towards the character
  leashLine.geometry.setFromPoints([camera.position, head]);
});

console.log(
  'A click on the drawing gives it the keyboard: WASD walks (and the autopilot lets go).',
);
