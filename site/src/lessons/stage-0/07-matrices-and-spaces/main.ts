import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';

const { scene, camera, onFrame } = createScene();
camera.position.set(0, 4.2, 6);
camera.lookAt(0, 0.4, 0);
const material = (color: number) => new THREE.MeshStandardMaterial({ color });

// 1. TWO SPACES, one inside the other: a turntable (the parent) and a ship on it (its child). Each
//    one has its own axes, drawn on it: its own space.
const table = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.1, 48), material(0x5a4a38));
table.add(new THREE.AxesHelper(1.3));
scene.add(table);
const ship = new THREE.Group();
ship.add(
  new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.8), material(0x4f86c6)),
  new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.3, 16).rotateX(-Math.PI / 2).translate(0, 0, -0.55),
    material(0xe0a040),
  ),
  new THREE.AxesHelper(0.6),
);
table.add(ship);

// 2. A POINT on the ship: the tip of its nose. In the ship's own space it is always (0, 0, −0.7).
const tip = new THREE.Vector3(0, 0, -0.7);
const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), material(0xe06c75));
scene.add(marker); // a child of the scene, not of the ship: it goes where OUR math says

// 3. THE SHIP'S OWN MATRIX, BY HAND: a turn and a move, multiplied in the order chosen.
ship.matrixAutoUpdate = false; // Three.js will not build it from position/rotation: we give it
const options = {
  order: 'turn, then move (T · R)',
  spin: true,
  tableX: 0,
  tableTurn: 0,
  tableScale: 1,
};
let angle = 0;
const turn = new THREE.Matrix4();
const move = new THREE.Matrix4().makeTranslation(1.1, 0.13, 0);

const readout = {
  object: '',
  world: '',
  camera: '',
  screen: '',
  row1: '',
  row2: '',
  row3: '',
  row4: '',
};
const gui = new GUI({ title: 'Matrices and spaces' });
gui.add(options, 'order', ['turn, then move (T · R)', 'move, then turn (R · T)']).name('the ship');
gui.add(options, 'spin').name('the ship turns');
const parent = gui.addFolder('The table (its parent)');
parent.add(options, 'tableX', -2, 2, 0.1).name('move (x)');
parent.add(options, 'tableTurn', -180, 180, 1).name('turn (°)');
parent.add(options, 'tableScale', 0.3, 2, 0.05).name('scale');
const spaces = gui.addFolder('The tip of the nose, in four spaces');
spaces.add(readout, 'object').name('the ship’s').listen().disable();
spaces.add(readout, 'world').name('the world’s').listen().disable();
spaces.add(readout, 'camera').name('the camera’s').listen().disable();
spaces.add(readout, 'screen').name('the screen (px)').listen().disable();
const matrix = gui.addFolder('The ship’s world matrix');
const ROWS = ['row1', 'row2', 'row3', 'row4'] as const;
for (const k of ROWS) matrix.add(readout, k).listen().disable();

const show = (v: THREE.Vector3) => `${v.x.toFixed(2)}  ${v.y.toFixed(2)}  ${v.z.toFixed(2)}`;
onFrame((dt) => {
  if (options.spin) angle += 0.8 * dt;
  turn.makeRotationY(angle);
  // The one on the right acts first: T · R turns the ship in place and then moves it; R · T moves it
  // out first, and then the turn swings it around the table's center.
  if (options.order.startsWith('turn')) ship.matrix.multiplyMatrices(move, turn);
  else ship.matrix.multiplyMatrices(turn, move);

  // The table: Three.js builds its matrix from position, rotation and scale (T · R · S).
  table.position.x = options.tableX;
  table.rotation.y = THREE.MathUtils.degToRad(options.tableTurn);
  table.scale.setScalar(options.tableScale);
  scene.updateMatrixWorld(); // every world matrix = its parent's world matrix · its own

  // The same point, from space to space: each step is a matrix.
  const world = tip.clone().applyMatrix4(ship.matrixWorld);
  const inCamera = world.clone().applyMatrix4(camera.matrixWorldInverse);
  const onScreen = world.clone().project(camera); // from −1 to 1 on each side
  marker.position.copy(world);
  readout.object = show(tip);
  readout.world = show(world);
  readout.camera = show(inCamera);
  readout.screen = `${(((onScreen.x + 1) / 2) * innerWidth).toFixed(0)}, ${(((1 - onScreen.y) / 2) * innerHeight).toFixed(0)}`;
  // Three.js keeps a matrix by columns (`elements`): here it is shown by rows.
  const e = ship.matrixWorld.elements;
  ROWS.forEach((name, row) => {
    const cells = [0, 1, 2, 3].map((col) => (e[col * 4 + row] ?? 0).toFixed(2).padStart(5));
    readout[name] = `${cells.slice(0, 3).join(' ')} | ${cells[3]}`;
  });
});

// Try: the other order. Turn the table, scale it: the ship goes with it, and the red dot too.
// Look at the matrix's last column while the ship moves: what is it?
