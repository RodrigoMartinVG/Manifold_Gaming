import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { CELL, LEGEND, MAP, RECIPE } from './level';
import { drawingOf, Recipe, rectangles, type Rect, type Source } from './text';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [4.5, 15, 15], target: [4.5, 0.5, 0] });
const STEP = 1 / 60;
const HEIGHT = 0.5; // how tall a wall is
const FLOOR = 0.25; // how thick a floor is
const ZONE = 0.6; // how tall a zone is
const RADIUS = 0.3; // the ball's
// THE BOARD LEANS toward the goal: in its own frame, gravity pulls along x and z too (m/s²). Numbers,
// not an angle: Math.sin may give another last bit in another browser, and the test below is exact.
const AUTOPILOT = { x: 4, z: 2 };
const LEAN = 4; // how far the keys lean it, on each axis
const lean = { ...AUTOPILOT }; // how it leans now

// The drawing's rows, as written: a space at the start of one is a pit; at its end, nothing.
const lines = MAP.replace(/^\n/, '').split('\n');
const rows = lines.map((r) => r.trimEnd());
const written = rows.join('\n').trimEnd();
const cells = [...rows.join('')].filter((c) => c !== ' ').length;

// The picture leans so that gravity points down on the screen (in onFrame); the physics stays flat.
const tilt = new THREE.Group();
tilt.position.set(0, 4, 0);
const board = new THREE.Group();
const width = Math.max(...rows.map((r) => r.length)) * CELL;
board.position.set(-width / 2, 0, (-rows.length * CELL) / 2);
tilt.add(board);
scene.add(tilt);
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(RADIUS, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xf2efe6 }),
);
board.add(ballMesh);

const settings = {
  autopilot: true,
  'merge rectangles': true,
  'server delay (steps)': 0,
  'wait from entry': true,
};
// What the panel shows, as text: the rows a reader (and the browser test) reads.
const shown: Record<string, string> = {
  cells: String(cells),
  boxes: '',
  'highest hop (cm)': '0.0',
  'steps to the goal': '',
  'export = map': '',
  'asserts passed': '',
  'last assert': '',
};
const gui = new GUI({ title: 'a level that tests itself' });
gui.add(settings, 'autopilot').listen();
gui.add(settings, 'merge rectangles').onChange(start);
gui.add(settings, 'server delay (steps)', 0, 30, 1).onFinishChange(start);
gui.add(settings, 'wait from entry').onChange(start);
gui.add({ 'start over': () => start() }, 'start over');
for (const name of Object.keys(shown)) gui.add(shown, name).disable().listen();

// THE KEYS lean the board, as in the wooden labyrinth toy; the first one takes it off autopilot.
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (!/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) return;
  held.add(e.code);
  settings.autopilot = false;
  e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
/** Where the board should lean: toward the goal on autopilot; otherwise, as the keys say. */
function leanWanted() {
  if (settings.autopilot) return AUTOPILOT;
  const down = (a: string, b: string) => (held.has(a) || held.has(b) ? 1 : 0);
  return {
    x: LEAN * (down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft')),
    z: LEAN * (down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp')),
  };
}

let world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
// The boxes the drawing made: what each keeps of its line (`source`), its zone if any, its mesh.
let boxes: { source: Source; zone: string | null; mesh: THREE.Mesh }[] = [];
let ball: RAPIER.RigidBody | null = null;
let recipe: Recipe;
let tick = 0;
let changes: { at: number; apply: () => void }[] = []; // what the recipe sent, and the step it enters
let hop = 0; // the highest the ball got off the floor
let dropped = 0; // the step the ball came in
let resting = 0;

/** BUILDING: the drawing made into boxes: walls, then floors, then zones, as few as rectangles cover. */
function build() {
  const merge = settings['merge rectangles'];
  const add = (r: Rect, char: string, bottom: number, tall: number, zone: string | null) => {
    const source: Source = {
      char,
      center: [(r.col + r.cols / 2) * CELL, (r.row + r.rows / 2) * CELL],
      half: [(r.cols * CELL) / 2, (r.rows * CELL) / 2],
    };
    const [x, z] = source.center;
    const [hx, hz] = source.half;
    const y = bottom + tall / 2;
    if (!zone) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
      const shape = RAPIER.ColliderDesc.cuboid(hx, tall / 2, hz);
      // Walls without friction: a spinning ball that hits one would climb it.
      if (char === '#')
        shape.setFriction(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
      world.createCollider(shape, body);
    }
    // Each box in its own color, so the rectangles show; a zone, translucent.
    const hue = (boxes.length * 0.618) % 1;
    const material = new THREE.MeshStandardMaterial(
      zone
        ? { color: zone === 'goal' ? 0xe5c07b : 0x93d9c9, transparent: true, opacity: 0.35 }
        : { color: new THREE.Color().setHSL(hue, 0.35, char === '#' ? 0.55 : 0.3) },
    );
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, tall, hz * 2), material);
    mesh.position.set(x, y, z);
    board.add(mesh);
    boxes.push({ source, zone, mesh });
  };
  for (const r of rectangles(rows, (c) => c === '#', merge)) add(r, '#', 0, HEIGHT, null);
  for (const r of rectangles(rows, (c) => c !== '#' && c !== ' ', merge))
    add(r, '.', -FLOOR, FLOOR, null);
  for (const [char, zone] of Object.entries(LEGEND))
    for (const r of rectangles(rows, (c) => c === char, merge)) add(r, char, 0, ZONE, zone);
}

/** `drop`, as it enters the world: a ball at the center of the start zone. */
function drop() {
  const start = boxes.find((b) => b.zone === 'start');
  if (!start) return console.log('drop: the map has no start (S)');
  if (ball) world.removeRigidBody(ball);
  const [x, z] = start.source.center;
  dropped = tick;
  ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, RADIUS, z));
  world.createCollider(RAPIER.ColliderDesc.ball(RADIUS), ball);
}

/** The zone the ball's center is in, as the engine's zones see it: the center inside the box. */
function zoneOf(p: RAPIER.Vector) {
  const inside = boxes.find(
    ({ zone, source: { center, half } }) =>
      zone && Math.abs(p.x - center[0]) <= half[0] && Math.abs(p.z - center[1]) <= half[1],
  );
  return inside?.zone ?? 'none';
}

/** WHAT THE RECIPE SEES of this world: the one change it can send, and the values it can read. */
const host = {
  send(line: string) {
    if (line !== 'drop') return false;
    // A CHANGE OF THE WORLD: sent now, it enters at the start of a later step. The next one; or as
    // many more as its trip to a server and back takes (in the engine's page, it goes that way).
    changes.push({ at: tick + 1 + settings['server delay (steps)'], apply: drop });
    return true;
  },
  read(what: string) {
    if (what === 'boxes') return boxes.length;
    if (what === 'cells') return cells;
    if (!what.startsWith('ball.')) return { missing: `nothing called "${what}"` };
    if (!ball) return { missing: 'there is no ball yet' };
    const p = ball.translation();
    if (what === 'ball.x') return p.x;
    if (what === 'ball.y') return p.y;
    if (what === 'ball.z') return p.z;
    if (what === 'ball.zone') return zoneOf(p);
    return { missing: `the ball has no ${what.slice('ball.'.length)}` };
  },
};

/** From the beginning: a new world built from the drawing, written back, and its recipe from the top. */
function start() {
  world.free();
  for (const b of boxes) {
    board.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
  }
  Object.assign(lean, leanWanted());
  world = new RAPIER.World({ x: lean.x, y: -9.81, z: lean.z });
  world.timestep = STEP;
  boxes = [];
  ball = null;
  changes = [];
  tick = hop = resting = 0;
  shown['steps to the goal'] = '';
  build();
  shown.boxes = String(boxes.length);
  // THE ROUND TRIP: the world written back as a drawing, from what each of its boxes keeps.
  const sources = boxes.map((b) => b.source);
  const exported = drawingOf(sources, CELL);
  shown['export = map'] = exported === written ? 'yes' : 'no';
  console.log(`${cells} cells, ${boxes.length} boxes. The world, written back:\n${exported}`);
  recipe = new Recipe(RECIPE, host, settings['wait from entry']);
  recipe.go(); // what comes before the first wait runs now, before the first step
}

/** ONE STEP, in the engine's order: what was sent enters, the world moves, and the recipe counts. */
function step() {
  tick++;
  // The lean goes a tenth of the way to the one wanted, each step (a step, not a frame: the same on
  // any screen). On autopilot it is already there, and gravity stays exactly the same.
  const wanted = leanWanted();
  lean.x += (wanted.x - lean.x) * 0.1;
  lean.z += (wanted.z - lean.z) * 0.1;
  world.gravity = { x: lean.x, y: -9.81, z: lean.z };
  for (const c of changes.filter((c) => c.at === tick)) {
    c.apply();
    recipe.entered();
  }
  world.step();
  recipe.stepped();
  if (!ball) return;
  const p = ball.translation();
  hop = Math.max(hop, p.y - RADIUS);
  const zone = zoneOf(p);
  if (zone === 'goal' && !shown['steps to the goal'])
    shown['steps to the goal'] = String(tick - dropped + 1);
  // After the test, once the ball has rested a second in the goal, it starts again: to keep moving.
  resting = recipe.done && zone === 'goal' ? resting + 1 : 0;
  if (resting > 60) drop();
}

start();
const DOWN = new THREE.Vector3(0, -1, 0);
let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  tilt.quaternion.setFromUnitVectors(new THREE.Vector3(lean.x, -9.81, lean.z).normalize(), DOWN);
  ballMesh.visible = ball !== null;
  if (ball) ballMesh.position.copy(ball.translation());
  shown['highest hop (cm)'] = (hop * 100).toFixed(1);
  shown['asserts passed'] = `${recipe.passed} of ${recipe.asserts}`;
  shown['last assert'] = recipe.last;
});
