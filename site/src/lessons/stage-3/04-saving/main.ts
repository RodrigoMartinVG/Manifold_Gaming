import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createRandom } from './random';
import { load, VERSION, type Progress, type Saved } from './saving';

const { scene, onFrame } = createScene({ camera: [0, 10, 7], target: [0, 0, 0] });
const SIZE = 8;
const cell = (c: number, r: number) => new THREE.Vector3(c - SIZE / 2 + 0.5, 0, r - SIZE / 2 + 0.5);
const board = new THREE.Mesh(
  new THREE.BoxGeometry(SIZE, 0.1, SIZE),
  new THREE.MeshStandardMaterial({ color: 0x57534c }),
);
board.position.y = -0.05;
scene.add(board);

// THE WORLD, built from a seed: where the gems are. Anything the progress does not say comes back as
// the seed says.
interface World {
  seed: number;
  /** Where the seed put a gem, and the gems still there. */
  placed: string[];
  gems: Map<string, THREE.Mesh>;
  at: [number, number];
}
let world: World | null = null;
function build(seed: number): World {
  for (const gem of world?.gems.values() ?? []) scene.remove(gem);
  const random = createRandom(seed);
  const gems = new Map<string, THREE.Mesh>();
  while (gems.size < 6) {
    const c = Math.floor(random() * SIZE);
    const r = Math.floor(random() * SIZE);
    if (gems.has(`${c},${r}`) || (c === 0 && r === 0)) continue;
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: 0x5ab4e6 }),
    );
    gem.position.copy(cell(c, r)).setY(0.3);
    scene.add(gem);
    gems.set(`${c},${r}`, gem);
  }
  return { seed, placed: [...gems.keys()], gems, at: [0, 0] };
}
let w = (world = build(7));
/** The cells it took a gem from: where the seed put one, and none is there. */
const taken = () => w.placed.filter((k) => !w.gems.has(k));

// THE CHARACTER walks the board row by row, and takes the gems it passes over.
const hero = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.25, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(hero);
function walkOne() {
  let [c, r] = w.at;
  c += r % 2 === 0 ? 1 : -1;
  if (c < 0 || c >= SIZE) {
    c = Math.max(0, Math.min(SIZE - 1, c));
    r = (r + 1) % SIZE;
  }
  w.at = [c, r];
  const gem = w.gems.get(`${c},${r}`);
  if (gem) {
    scene.remove(gem);
    w.gems.delete(`${c},${r}`);
  }
}

// What is kept: the progress (version 2) and, to compare, a photo of the world (with the engine's version).
let saved: Saved | null = null;
let photo: { engine: number; world: unknown } | null = null;
const settings = { 'engine version': 22, walking: true };
const shown = { gems: 0, message: '' };
const text = document.createElement('pre');
Object.assign(text.style, {
  position: 'fixed',
  left: '8px',
  bottom: '8px',
  margin: '0',
  padding: '6px 8px',
  maxWidth: '60%',
  whiteSpace: 'pre-wrap',
  font: '11px ui-monospace, monospace',
  color: '#dcd2c3',
  background: 'rgb(18 16 13 / 0.85)',
  borderRadius: '4px',
});
document.body.append(text);
const write = (message: string, data?: unknown) => {
  shown.message = message;
  text.textContent = data === undefined ? message : `${message}\n${JSON.stringify(data)}`;
};

const gui = new GUI({ title: 'saving' });
gui.add(settings, 'walking');
gui.add(settings, 'engine version', 20, 25, 1);
gui.add(
  {
    'save the progress': () => {
      const progress: Progress = { seed: w.seed, at: [...w.at], taken: taken() };
      saved = { version: VERSION, progress };
      photo = {
        engine: settings['engine version'],
        world: { ...w, gems: [...w.gems.keys()] },
      };
      write('saved (the progress, and a photo of the world)', saved);
    },
  },
  'save the progress',
);
gui.add(
  {
    'load the progress': () => {
      if (!saved) return write('nothing saved');
      const p = load(saved);
      w = world = build(p.seed);
      w.at = p.at;
      for (const k of p.taken) {
        scene.remove(w.gems.get(k)!);
        w.gems.delete(k);
      }
      write(`loaded the progress (version ${saved.version}), whatever the engine's version`, p);
    },
  },
  'load the progress',
);
gui.add(
  {
    'load the photo': () => {
      if (!photo) return write('nothing saved');
      if (photo.engine !== settings['engine version'])
        return write(
          `a photo of engine ${photo.engine}, and this engine is ${settings['engine version']}: it cannot be read`,
        );
      write('loaded the photo (same engine)');
    },
  },
  'load the photo',
);
gui.add(
  {
    'load an old save (v1)': () => {
      const old: Saved = { version: 1, progress: { seed: 7, position: [3, 2], gems: 2 } };
      const p = load(old);
      w = world = build(p.seed);
      w.at = p.at;
      write('a version 1 save, brought forward to version 2', p);
    },
  },
  'load an old save (v1)',
);
gui.add(shown, 'gems').disable().listen();
gui.add(shown, 'message').disable().listen();

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (settings.walking && behind >= 0.3) {
    walkOne();
    behind -= 0.3;
  }
  if (!settings.walking) behind = 0;
  hero.position.copy(cell(...w.at)).setY(0.55);
  shown.gems = 6 - w.gems.size;
  for (const gem of w.gems.values()) gem.rotation.y += dt;
});
