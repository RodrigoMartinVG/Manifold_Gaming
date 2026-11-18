import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { debug } from './debug';
import { LAYOUTS } from './layouts';
import { classify, eyeOf, forwardOf, HEADING_NAMES, headingTowards, type Seen } from './turret';
import { add, cross, normalize, scale, sub, vec } from './vec';
import { createDebugView } from './view/debug-view';
import { createView } from './view/view';
import { createWorld, type World } from './world';

// START-UP, IN ORDER: the window; the world, as data; what draws the world; and what draws the debug
// requests. The camera now stands high and looks down at the turret (three.js's `lookAt`: how a camera
// turns has its own lesson). In 1.3 it did not turn, so that our projection could be checked against it.
// (A little to the right of the turret: the panel covers the right of the picture.)
const view = createView({ eye: [1.6, 9, 6.5], fov: 50 });
view.camera.lookAt(1.6, 0, -1.2);
let world = createWorld(LAYOUTS[0]);
const debugView = createDebugView(view.scene, view.camera);
const RADIUS = 0.3; // each target is a ball of 0,6 m

/** WHAT DRAWS THE WORLD: meshes made from its data; `update` moves the turret's to where the data says. */
function drawWorld(scene: THREE.Scene, w: World) {
  const made: (THREE.Mesh | THREE.GridHelper)[] = [];
  const mesh = (geometry: THREE.BufferGeometry, color: number) => {
    const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
    scene.add(m);
    made.push(m);
    return m;
  };
  const floor = mesh(new THREE.PlaneGeometry(w.floor.width, w.floor.depth), 0x6a5e50);
  floor.position.z = -4;
  floor.rotation.x = -Math.PI / 2; // a plane is born standing: lay it down
  const grid = new THREE.GridHelper(w.floor.width, w.floor.width, 0x8a7a68, 0x766858);
  grid.position.z = -4;
  scene.add(grid);
  made.push(grid);
  // The turret: a block, and a nose that points where it looks (born along y; laid along z, where lookAt aims).
  const block = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), 0x8c7a64);
  const nose = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12).rotateX(Math.PI / 2), 0x4a3f33);
  for (const target of w.targets) {
    const p = target.position;
    mesh(new THREE.SphereGeometry(RADIUS, 32, 16), 0xe06c75).position.set(p.x, p.y, p.z);
    const post = p.y - RADIUS;
    if (post > 0) mesh(new THREE.CylinderGeometry(0.05, 0.05, post, 10), 0xc99050).position.set(p.x, post / 2, p.z);
  }
  return {
    /** The turret where the world has it, its nose along its forward. */
    update(now: World) {
      const t = now.turret.position;
      const f = forwardOf(now);
      block.position.set(t.x, t.y + 0.3, t.z);
      nose.position.set(t.x + 0.6 * f.x, t.y + 0.4, t.z + 0.6 * f.z);
      nose.lookAt(t.x + 2 * f.x, t.y + 0.4, t.z + 2 * f.z);
    },
    /** Out of the scene, and their geometries and materials freed on the graphics card. */
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

// THE PANEL: the keys' moves as buttons too, the naive check, and what the turret knows.
const settings = { 'normalize forward': true };
const moves = {
  'turn left (Q)': () => act('KeyQ'),
  'turn right (E)': () => act('KeyE'),
  'next target (Tab)': () => act('Tab'),
  reset: () => {
    world = createWorld(LAYOUTS[0]);
    chosen = -1;
    report();
  },
};
const gui = new GUI({ title: 'the turret looks' });
for (const name of Object.keys(moves) as (keyof typeof moves)[]) gui.add(moves, name);
gui.add(settings, 'normalize forward').onChange(report);
const say = (s: Seen) => `${s.front ? 'in front' : 'behind'}, ${s.side}, ${s.inside ? 'inside' : 'outside'}`;
const seen = () => classify(world, { normalize: settings['normalize forward'] });
const shown = {
  get heading() {
    return HEADING_NAMES[((world.turret.heading % 8) + 8) % 8]!;
  },
  get 'turret at'() {
    const p = world.turret.position;
    return `${p.x}, ${p.z}`;
  },
  get 'target 1'() {
    return say(seen()[0]!);
  },
  get 'target 2'() {
    return say(seen()[1]!);
  },
  get 'target 3'() {
    return say(seen()[2]!);
  },
  get 'all in the cone'() {
    return seen().every((s) => s.inside) ? 'yes' : 'no';
  },
};
for (const name of Object.keys(shown) as (keyof typeof shown)[]) gui.add(shown, name).disable().listen();

// THE KEYS, read raw (by the key's place, `code`, not the letter it types), and once per press: a key
// held down repeats, and the repeats are ignored. Q and E turn an eighth; W A S D step a meter; Tab
// faces the next target, along the compass heading nearest its way.
let chosen = -1;
function act(code: string) {
  const t = world.turret;
  const step = (dx: number, dz: number) => {
    t.position.x = Math.max(-6, Math.min(6, t.position.x + dx));
    t.position.z = Math.max(-15, Math.min(7, t.position.z + dz));
  };
  if (code === 'KeyQ') t.heading = (t.heading + 7) % 8;
  else if (code === 'KeyE') t.heading = (t.heading + 1) % 8;
  else if (code === 'KeyW') step(0, -1);
  else if (code === 'KeyS') step(0, 1);
  else if (code === 'KeyA') step(-1, 0);
  else if (code === 'KeyD') step(1, 0);
  else if (code === 'Tab') {
    chosen = (chosen + 1) % world.targets.length;
    t.heading = headingTowards(world, world.targets[chosen]!.position);
  } else return;
  report();
}
/** What the turret knows, as a table in the browser's console (the console of the project comes in 2.6). */
function report() {
  console.table(seen());
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Tab') e.preventDefault(); // (Tab would take the focus elsewhere)
  act(e.code);
});

const SPANISH = { left: 'izquierda', right: 'derecha', 'in line': 'en línea' } as const;
view.onFrame((dt) => {
  drawn.update(world);
  // ─── WHAT THE TURRET KNOWS, DRAWN ───
  // Its frame (forward, right, up: lesson 1.6), the edges of its cone, and the way to each target with what
  // it decided. Asked for here, drawn by the view at the end of the frame.
  const eye = eyeOf(world);
  const f = forwardOf(world, settings['normalize forward']);
  const right = normalize(cross(f, vec(0, 1, 0)));
  const up = cross(right, normalize(f));
  debug.axes(eye, f, scale(right, 0.6), scale(up, 0.6), { depth: false });
  // The cone's edges: cos α along the forward and sin α across it, to each side (sin α = √(1 − cos² α)).
  const { cos } = world.turret.cone;
  const sin = Math.sqrt(1 - cos * cos);
  for (const s of [1, -1])
    debug.line(eye, add(eye, scale(add(scale(normalize(f), cos), scale(right, s * sin)), 7)), { color: 0xe5c07b });
  const all = seen();
  world.targets.forEach((target, i) => {
    const s = all[i]!;
    const color = s.inside ? 0xe5c07b : s.front ? 0xf2efe9 : 0x7a7068;
    debug.arrow(eye, sub(target.position, eye), { color, depth: false });
    debug.text(
      add(target.position, vec(0, 0.9, 0)),
      `${s.front ? 'delante' : 'detrás'} · ${SPANISH[s.side]} · ${s.inside ? 'dentro del cono' : 'fuera del cono'}`,
      { color },
    );
  });
  if (all.every((s) => s.inside)) debug.text(add(eye, vec(0, 1, 0)), '¡los tres en el cono!', { color: 0xe5c07b });
  debugView.draw(debug.flush(dt));
});

// SHUT-DOWN, the start-up in reverse, when the page goes.
addEventListener('pagehide', () => {
  debugView.dispose();
  drawn.remove();
  view.dispose();
});

report();
console.log('Click the drawing: Q and E turn, W A S D step, Tab faces the next target.');
