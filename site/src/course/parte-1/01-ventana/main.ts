import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { toScreen } from './screen';
import { createView } from './view';

// THE WORLD: a floor and a ball. The camera stands 1,6 m high, 6 m back, a little to the right (the
// panel takes the right of the picture), looking straight ahead, along −Z.
const eye = { x: 1.5, y: 1.6, z: 6 };
const settings = { fov: 55, moving: true };
const { scene, camera, onFrame } = createView({ eye: [eye.x, eye.y, eye.z], fov: settings.fov });

const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshStandardMaterial({ color: 0x6a5e50 }));
floor.rotation.x = -Math.PI / 2; // a plane is born standing: lay it down
floor.position.z = -9;
scene.add(floor);
scene.add(new THREE.GridHelper(14, 14, 0x8a7a68, 0x766858).translateZ(-1));
// Posts every 5 m along both sides, to see the depth: the far ones, smaller and nearer the middle.
for (let z = 5; z >= -20; z -= 5)
  for (const x of [-4.5, 3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2), new THREE.MeshStandardMaterial({ color: 0xc99050 }));
    post.position.set(x, 1, z);
    scene.add(post);
  }
const RADIUS = 0.5;
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(RADIUS, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0x7ac8f0, emissive: 0x2a6080 }),
);
scene.add(ball);

// A mark where OUR numbers say the ball's center falls on the screen (three.js puts the ball there).
const mark = document.createElement('div');
mark.style.cssText =
  'position:fixed;width:8px;height:8px;margin:-5px 0 0 -5px;border:1px solid #e5c07b;border-radius:50%;pointer-events:none';
document.body.append(mark);

const shown = { 'ball (m)': '', 'our numbers (px)': '', 'three.js (px)': '', 'depth (m)': 0, 'size on screen (px)': 0 };
const gui = new GUI({ title: 'a window into the world' });
gui.add(settings, 'fov', 25, 100, 1).name('field of view (°)');
gui.add(settings, 'moving');
gui.add(shown, 'ball (m)').disable().listen();
gui.add(shown, 'our numbers (px)').disable().listen();
gui.add(shown, 'three.js (px)').disable().listen();
gui.add(shown, 'depth (m)').disable().listen();
gui.add(shown, 'size on screen (px)').disable().listen();

let time = 0;
onFrame((dt) => {
  if (settings.moving) time += dt;
  // The ball comes and goes: from 3 m in front of the camera to 18 m (z from 3 to −12), and from side
  // to side.
  ball.position.set(-1.5 + 2 * Math.sin(time * 0.7), RADIUS, 3 - 7.5 * (1 - Math.cos(time * 0.4)));
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();

  // Where it falls: our numbers, and three.js's own (its matrices), which must agree.
  const ours = toScreen(ball.position, eye, settings.fov, innerWidth, innerHeight);
  const theirs = ball.position.clone().project(camera);
  const tx = ((theirs.x + 1) / 2) * innerWidth;
  const ty = ((1 - theirs.y) / 2) * innerHeight;
  const p = ball.position;
  shown['ball (m)'] = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
  if (ours) {
    mark.style.left = `${ours.x}px`;
    mark.style.top = `${ours.y}px`;
    shown['our numbers (px)'] = `${ours.x.toFixed(1)}, ${ours.y.toFixed(1)}`;
    shown['depth (m)'] = +ours.depth.toFixed(2);
    // 1 m of ball at that depth: 1 / depth on the 1-m screen, over its height (2 · tan(fov / 2)).
    const half = Math.tan((settings.fov * Math.PI) / 360);
    shown['size on screen (px)'] = Math.round(((2 * RADIUS) / ours.depth / (2 * half)) * innerHeight);
  }
  shown['three.js (px)'] = `${tx.toFixed(1)}, ${ty.toFixed(1)}`;
});

console.log('Our numbers and three.js put the ball at the same pixel: the ring is ours.');
