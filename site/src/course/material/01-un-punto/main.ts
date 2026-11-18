import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { LAYOUTS } from './layouts';
import { toScreen } from './view/screen';
import { createView } from './view/view';
import { createWorld, type World } from './world';

// START-UP, IN ORDER: the window; the world, as plain data; and what draws the world, made from the data.
// The camera stands 1,6 m high, 6 m back and a little to the right, looking straight ahead, along −Z.
const view = createView({ eye: [1.5, 1.6, 6], fov: 55 });
const world = createWorld(LAYOUTS[0]);
const RADIUS = 0.3; // each target is a ball of 0,6 m

/** WHAT DRAWS THE WORLD: meshes made from its data. `remove` takes them away, and frees them. */
function drawWorld(scene: THREE.Scene, w: World) {
  const made: (THREE.Mesh | THREE.GridHelper)[] = [];
  const mesh = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
    m.position.set(x, y, z);
    scene.add(m);
    made.push(m);
    return m;
  };
  const floor = mesh(new THREE.PlaneGeometry(w.floor.width, w.floor.depth), 0x6a5e50, 0, 0, -4);
  floor.rotation.x = -Math.PI / 2; // a plane is born standing: lay it down
  const grid = new THREE.GridHelper(w.floor.width, w.floor.width, 0x8a7a68, 0x766858);
  scene.add(grid);
  made.push(grid);
  // The turret, still: a block, and a nose towards −Z, where it looks.
  const t = w.turret.position;
  mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), 0x8c7a64, t.x, t.y + 0.3, t.z);
  mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12), 0x4a3f33, t.x, t.y + 0.4, t.z - 0.6).rotation.x = Math.PI / 2;
  // Each target: a ball on its post.
  for (const target of w.targets) {
    const p = target.position;
    mesh(new THREE.SphereGeometry(RADIUS, 32, 16), 0xe06c75, p.x, p.y, p.z);
    const post = p.y - RADIUS;
    if (post > 0) mesh(new THREE.CylinderGeometry(0.05, 0.05, post, 10), 0xc99050, p.x, post / 2, p.z);
  }
  return {
    remove() {
      for (const m of made) {
        scene.remove(m);
        m.geometry.dispose();
        for (const material of [m.material].flat()) material.dispose();
      }
    },
  };
}
const drawn = drawWorld(view.scene, world);

// A ring where OUR numbers say the chosen target's centre falls on the screen.
const mark = document.createElement('div');
mark.style.cssText =
  'position:fixed;width:12px;height:12px;margin:-7px 0 0 -7px;border:2px solid #e5c07b;border-radius:50%;pointer-events:none';
document.body.append(mark);

// THE PANEL: the camera moves (it does not turn: it always looks along −Z); pick the target to follow; and the
// check that keeps points behind the camera off the screen.
const settings = {
  'eye x (m)': 1.5,
  'eye y (m)': 1.6,
  'eye z (m)': 6,
  'field of view (°)': 55,
  target: 'target 1',
  'check behind': true,
};
const shown = { 'our pixel': '', 'three.js pixel': '', 'depth (m)': 0 };
const gui = new GUI({ title: 'a point on the screen' });
gui.add(settings, 'eye x (m)', -4, 4, 0.1);
gui.add(settings, 'eye y (m)', 0.2, 6, 0.1);
gui.add(settings, 'eye z (m)', -6, 12, 0.1);
gui.add(settings, 'field of view (°)', 25, 100, 1);
gui.add(
  settings,
  'target',
  world.targets.map((t) => t.id),
);
gui.add(settings, 'check behind');
gui.add(shown, 'our pixel').disable().listen();
gui.add(shown, 'three.js pixel').disable().listen();
gui.add(shown, 'depth (m)').disable().listen();

const eye = { x: 0, y: 0, z: 0 };
view.onFrame(() => {
  eye.x = settings['eye x (m)'];
  eye.y = settings['eye y (m)'];
  eye.z = settings['eye z (m)'];
  view.camera.position.set(eye.x, eye.y, eye.z);
  view.camera.fov = settings['field of view (°)'];
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld();

  // Where the chosen target falls: our numbers, and three.js's own (its matrices), which must agree.
  const target = world.targets.find((t) => t.id === settings.target) ?? world.targets[0]!;
  const p = target.position;
  const ours = toScreen(p, eye, settings['field of view (°)'], innerWidth, innerHeight, settings['check behind']);
  const theirs = new THREE.Vector3(p.x, p.y, p.z).project(view.camera);
  const behind = theirs.z > 1; // (three.js says so: past its far side, the point is behind it)
  shown['three.js pixel'] = behind
    ? 'behind the camera'
    : `${(((theirs.x + 1) / 2) * innerWidth).toFixed(1)}, ${(((1 - theirs.y) / 2) * innerHeight).toFixed(1)}`;
  mark.style.display = ours ? '' : 'none';
  if (ours) {
    mark.style.left = `${ours.x}px`;
    mark.style.top = `${ours.y}px`;
    shown['our pixel'] = `${ours.x.toFixed(1)}, ${ours.y.toFixed(1)}`;
    shown['depth (m)'] = +ours.depth.toFixed(2);
  } else {
    shown['our pixel'] = 'behind the camera';
    shown['depth (m)'] = 0;
  }
});

// SHUT-DOWN, in reverse, when the page goes away: the drawing, the panel, the window.
addEventListener('pagehide', () => {
  drawn.remove();
  gui.destroy();
  mark.remove();
  view.dispose();
});

console.log('The ring is our numbers; the ball, three.js. Pick a target, move the camera.');
