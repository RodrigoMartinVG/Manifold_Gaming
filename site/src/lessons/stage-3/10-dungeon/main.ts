import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { makeDungeon, type Cell, type Dungeon } from './dungeon';
import { floorCells, reachable, textHash, walkable } from './checks';

const { scene, camera, controls, onFrame } = createScene({
  camera: [0, 27, 17],
  target: [0, 0, 0],
});
const STEP = 1 / 60;
const WALK = 4; // the explorer's speed (cells per second; a cell is 1 m)

const settings = { seed: 7, depth: 2, 'generator v2': false, autopilot: true };
const shown = {
  rooms: '',
  tries: 0,
  'floor cells': 0,
  connected: '',
  'hash (map)': '',
  'same as before': '',
};
// The hash of the first dungeon each seed and depth made, since the page opened.
const first = new Map<string, string>();

// What is drawn: the dungeon (hidden while its tries are shown), the tries, and an explorer.
const built = new THREE.Group();
scene.add(built);
const look = (color: number, opacity = 1) =>
  new THREE.MeshStandardMaterial({ color, opacity, transparent: opacity < 1 });
const LOOKS = {
  wall: look(0x9a8f80),
  floor: look(0x4a4640),
  gem: look(0x5ab4e6),
  key: look(0xe8c050),
  exit: look(0xb04040, 0.35),
};
const box = (w: number, h: number, d: number, material: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
const explorer = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5), look(0x93d9c9));
scene.add(explorer);

let dungeon: Dungeon;
let size = 0;
let legs: { from: THREE.Vector3; to: THREE.Vector3; length: number }[] = [];
let pathLength = 0;
let key: THREE.Object3D | null = null;
let flashes: { tile: THREE.Mesh; look: THREE.MeshBasicMaterial; born: number; fit: boolean }[] = [];
let clock = 0; // seconds since it was built
let triesShown = 0;
let along = 0; // how far the autopilot walked along the corridors (m)
/** Where a cell's center is, in the world (the map centered on the origin). */
const at = ([c, r]: Cell, y = 0) => new THREE.Vector3(c - size / 2 + 0.5, y, r - size / 2 + 0.5);

/** Each run of cells of a row that are one of `chars`: its first column and its last. */
function runs(line: string, chars: string, each: (from: number, to: number) => void) {
  for (let c = 0; c < line.length; c++) {
    if (!chars.includes(line.charAt(c))) continue;
    const from = c;
    while (c + 1 < line.length && chars.includes(line.charAt(c + 1))) c++;
    each(from, c);
  }
}
/** A box over the cells `from` to `to` of row `r`: a wall, or a floor. */
function slab(from: number, to: number, r: number, wall: boolean) {
  const mesh = box(to - from + 1, wall ? 0.9 : 0.1, 1, wall ? LOOKS.wall : LOOKS.floor);
  mesh.position.copy(at([(from + to) / 2, r], wall ? 0.45 : -0.03));
  return mesh;
}
/** Takes a mesh out of the drawing, with its shape. */
function drop(mesh: THREE.Object3D) {
  if (mesh instanceof THREE.Mesh) mesh.geometry.dispose();
  mesh.removeFromParent();
}

// BUILD: the dungeon from the settings, its checks on the panel, its map in the console, and boxes.
function build() {
  const { seed, depth } = settings;
  dungeon = makeDungeon(seed, depth, settings['generator v2'] ? 2 : 1);
  const hash = textHash(dungeon.rows.join('\n'));
  const floor = floorCells(dungeon.rows);
  shown.rooms = `${dungeon.rooms.length} of ${dungeon.asked}`;
  shown.tries = dungeon.tries.length;
  shown['floor cells'] = floor;
  shown.connected = reachable(dungeon.rows, dungeon.start) === floor ? 'yes' : 'no';
  shown['hash (map)'] = hash;
  const before = first.get(`${seed}/${depth}`);
  if (before === undefined) first.set(`${seed}/${depth}`, hash);
  shown['same as before'] = before === undefined ? 'first time' : before === hash ? 'yes' : 'no';
  console.log(`seed ${seed}, depth ${depth}: ${hash}\n${dungeon.rows.join('\n')}`);

  [...built.children].forEach(drop);
  for (const flash of flashes) {
    drop(flash.tile);
    flash.look.dispose();
  }
  flashes = [];
  if (dungeon.size !== size) {
    size = dungeon.size;
    camera.position.set(0, size * 1.08, size * 0.68);
    controls.target.set(0, 0, 0);
  }
  const tint = dungeon.tint === null ? 0x4a4640 : new THREE.Color().setHSL(dungeon.tint, 0.4, 0.38);
  LOOKS.floor.color.set(tint);
  // A MAP OF CHARACTERS, AS BOXES: one for each run of wall in a row, and one for each run of floor.
  dungeon.rows.forEach((line, r) => {
    runs(line, '#', (from, to) => built.add(slab(from, to, r, true)));
    runs(line, '.*kE', (from, to) => built.add(slab(from, to, r, false)));
  });
  // What lies in it: a gem, the key (it turns), the exit (a red light).
  key = null;
  dungeon.rows.forEach((line, r) =>
    [...line].forEach((cell, c) => {
      let thing: THREE.Mesh | null = null;
      if (cell === '*') thing = new THREE.Mesh(new THREE.SphereGeometry(0.18), LOOKS.gem);
      if (cell === 'k') thing = box(0.5, 0.1, 0.16, LOOKS.key);
      if (cell === 'E') thing = box(0.9, 0.8, 0.9, LOOKS.exit);
      if (!thing) return;
      thing.position.copy(at([c, r], cell === 'E' ? 0.42 : 0.5));
      if (cell === 'k') key = thing;
      built.add(thing);
    }),
  );
  // The autopilot's path: a leg from each point of the route to the next.
  legs = [];
  let from = at(dungeon.start, 0.5);
  for (const cell of dungeon.route.slice(1)) {
    const to = at(cell, 0.5);
    legs.push({ from, to, length: from.distanceTo(to) });
    from = to;
  }
  pathLength = legs.reduce((sum, leg) => sum + leg.length, 0);
  explorer.position.copy(at(dungeon.start, 0.5));
  built.visible = explorer.visible = false;
  clock = triesShown = along = 0;
}
build();

const gui = new GUI({ title: 'a dungeon from a seed' });
gui.add(settings, 'seed', 0, 999, 1).onChange(build);
gui.add(settings, 'depth', 1, 5, 1).onChange(build);
gui.add(settings, 'generator v2').onChange(build);
gui.add(settings, 'autopilot').listen();
gui.add({ 'same seed again': build }, 'same seed again');
gui.add(shown, 'rooms').disable().listen();
gui.add(shown, 'tries').disable().listen();
gui.add(shown, 'floor cells').disable().listen();
gui.add(shown, 'connected').disable().listen();
gui.add(shown, 'hash (map)').disable().listen();
gui.add(shown, 'same as before').disable().listen();

// THE KEYS: WASD or the arrows take the explorer off its route; the 'autopilot' box gives it back.
const MOVES: Record<string, Cell> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (!MOVES[e.code]) return;
  e.preventDefault();
  held.add(e.code);
  settings.autopilot = false;
});
addEventListener('keyup', (e) => held.delete(e.code));

/** The autopilot's place, `m` meters along its path (past its end, at the end). */
function pointAlong(m: number) {
  for (const leg of legs) {
    if (m <= leg.length) return leg.from.clone().lerp(leg.to, leg.length ? m / leg.length : 1);
    m -= leg.length;
  }
  return legs.at(-1)?.to.clone() ?? at(dungeon.start, 0.5);
}
/** Whether the explorer fits there: floor under the four corners of its 0.5 m square. */
const free = (x: number, z: number) =>
  [x - 0.25, x + 0.25].every((px) =>
    [z - 0.25, z + 0.25].every((pz) =>
      walkable(dungeon.rows[Math.floor(pz + size / 2)]?.[Math.floor(px + size / 2)]),
    ),
  );

// ONE STEP of the explorer: along its route on autopilot, or where the keys say, if there is floor.
function step() {
  if (settings.autopilot) {
    along += WALK * STEP;
    if (along > pathLength + 1.5 * WALK) along = 0; // a second and a half at the exit, and back
    explorer.position.copy(pointAlong(along));
    return;
  }
  let dx = 0;
  let dz = 0;
  for (const code of held) {
    const move = MOVES[code];
    if (!move) continue;
    dx += move[0];
    dz += move[1];
  }
  const length = Math.hypot(dx, dz);
  if (length === 0) return;
  const x = explorer.position.x + (dx / length) * WALK * STEP;
  const z = explorer.position.z + (dz / length) * WALK * STEP;
  // Each axis on its own, so that against a wall it slides instead of stopping.
  if (free(x, explorer.position.z)) explorer.position.x = x;
  if (free(explorer.position.x, z)) explorer.position.z = z;
}

let behind = 0;
onFrame((dt) => {
  clock += dt;
  // THE TRIES, one by one (three seconds at most): a room that fit stays, one that did not flashes red.
  const every = Math.min(0.15, 3 / dungeon.tries.length);
  const due = built.visible ? 0 : Math.min(dungeon.tries.length, Math.floor(clock / every) + 1);
  for (const { room, fit } of dungeon.tries.slice(triesShown, due)) {
    const flat = new THREE.MeshBasicMaterial({
      color: fit ? 0x93d9c9 : 0xd05050,
      transparent: true,
    });
    const tile = box(room.cols, 0.05, room.rows, flat);
    const middle: Cell = [room.col + (room.cols - 1) / 2, room.row + (room.rows - 1) / 2];
    tile.position.copy(at(middle, fit ? 0.05 : 0.1));
    scene.add(tile);
    flashes.push({ tile, look: flat, born: clock, fit });
  }
  triesShown = Math.max(triesShown, due);
  for (const flash of flashes)
    flash.look.opacity = flash.fit ? 0.7 : Math.max(0, 0.8 - 1.6 * (clock - flash.born));
  // Then the dungeon, and the explorer walks it, from the first room to the exit, again and again.
  if (!built.visible && clock >= dungeon.tries.length * every + 0.5) {
    for (const flash of flashes) flash.tile.visible = false;
    built.visible = explorer.visible = true;
  }
  if (!built.visible) return;
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  key?.rotateY(1.5 * dt);
});
