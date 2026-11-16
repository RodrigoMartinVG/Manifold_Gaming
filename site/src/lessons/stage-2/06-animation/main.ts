import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { buildFigure, makeClips } from './figure';
import { clipName, DIRECTIONS, follow, gait, strideOf } from './gait';

const { scene, controls, onFrame } = createScene({ camera: [0, 5, 7], target: [0, 0.8, 0] });
const STEP = 1 / 60;
const settings = {
  autopilot: true,
  'phase by distance': true,
  'blend directions': true,
  'speed (m/s)': 1.2,
  'crossfade (s)': 0.1,
};

// ---------------------------------------------------------------- THE SIMULATION
// Where the figure is and where it looks, step by step: what the world keeps. It knows nothing of
// bones, clips or weights.

// THE AUTOPILOT's path: a square with rounded corners, walked clockwise (seen from above).
const HALF = 2.2;
const CORNER = 1;
const STRAIGHT = 2 * (HALF - CORNER);
const QUARTER = STRAIGHT + (Math.PI / 2) * CORNER;
const LAP = 4 * QUARTER;

/** The point `s` meters along the path, and where the path goes there. */
function pathAt(s: number) {
  const u = s % QUARTER;
  let [x, z, dx, dz] = [-HALF, STRAIGHT / 2 - u, 0, -1]; // the west side, going north (−z)
  if (u > STRAIGHT) {
    const a = (u - STRAIGHT) / CORNER; // then a corner, turning towards the east
    [x, z] = [-HALF + CORNER * (1 - Math.cos(a)), -STRAIGHT / 2 - CORNER * Math.sin(a)];
    [dx, dz] = [Math.sin(a), -Math.cos(a)];
  }
  // The other three quarters: the same, turned a quarter of a turn each.
  for (let q = Math.floor((s % LAP) / QUARTER); q > 0; q--) [x, z, dx, dz] = [-z, x, -dz, dx];
  return { at: new THREE.Vector3(x, 0, z), ahead: new THREE.Vector3(dx, 0, dz) };
}

const NORTH = new THREE.Vector3(0, 0, -1);
const sim = {
  s: 0, // how far along the path the autopilot is
  at: pathAt(0).at,
  before: pathAt(0).at, // where it was one step ago
  velocity: new THREE.Vector3(), // with the keys
  facing: NORTH.clone(),
};

// THE KEYS: the first one takes the figure off the autopilot (the checkbox gives it back).
const held = new Set<string>();
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};
addEventListener('keydown', (e) => {
  if (e.code.startsWith('Shift')) held.add('Shift');
  if (!KEYS[e.code]) return;
  e.preventDefault();
  held.add(e.code);
  settings.autopilot = false;
});
addEventListener('keyup', (e) => held.delete(e.code.startsWith('Shift') ? 'Shift' : e.code));

function step() {
  sim.before.copy(sim.at);
  const base = settings['speed (m/s)'];
  if (!settings.autopilot) {
    // With the keys: it goes where they say, Shift runs (twice the speed), and it always looks north.
    const wanted = new THREE.Vector3();
    for (const code of held)
      if (KEYS[code]) wanted.add(new THREE.Vector3(KEYS[code][0], 0, KEYS[code][1]));
    if (wanted.lengthSq() > 0) wanted.setLength(base * (held.has('Shift') ? 2 : 1));
    const change = wanted.sub(sim.velocity);
    sim.velocity.add(change.clampLength(0, 10 * STEP)); // at most 10 m/s² of change
    sim.at.addScaledVector(sim.velocity, STEP);
    sim.facing.copy(NORTH);
    return;
  }
  // Slower in the corners (0.6 of the speed), faster in the middle of a side (1.4).
  const speed =
    base * (1 + 0.4 * Math.cos((2 * Math.PI * ((sim.s % QUARTER) - STRAIGHT / 2)) / QUARTER));
  sim.s += speed * STEP;
  const { at, ahead } = pathAt(sim.s);
  sim.at.copy(at); // (back from the keys, it jumps to its path)
  sim.velocity.set(0, 0, 0);
  // Three laps, again and again: looking north all the way round (so it goes forward, to its right,
  // back and to its left), looking where it goes, and looking back. It turns at once, as the
  // engine's simulation turns a character: the view draws the turn.
  const lap = Math.floor(sim.s / LAP) % 3;
  sim.facing.copy(lap === 0 ? NORTH : ahead);
  if (lap === 2) sim.facing.negate();
}

// ---------------------------------------------------------------- THE VIEW
// It reads the simulation and chooses what to draw: the clips, how much of each, at which phase.

const figure = buildFigure();
figure.root.position.copy(sim.at);
scene.add(figure.root);
const mixer = new THREE.AnimationMixer(figure.root);
const actions = new Map<string, THREE.AnimationAction>();
for (const clip of makeClips()) {
  const action = mixer.clipAction(clip);
  action.play(); // all of them play at once; each one's weight says how much is seen
  actions.set(clip.name, action);
}
const weights = gait(0, 1.2, true); // the weights it plays with now (walking forward, to start)
let phase = 0; // where every clip is in its cycle, from 0 to 1
let angle = 0; // the motion's angle from where the body looks (degrees, to its right positive)
const TURN = THREE.MathUtils.degToRad(360); // how fast the body is drawn turning, at most (rad/s)
const UP = new THREE.Vector3(0, 1, 0);

// The path, an arrow for where it goes, and footprints where a foot landed.
const ring = Array.from({ length: 101 }, (_, i) => pathAt((i / 100) * LAP).at.setY(0.01));
const line = new THREE.LineBasicMaterial({ color: 0x5a6a68 });
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), line));
const arrow = new THREE.ArrowHelper(NORTH, sim.at, 1, 0xe5c07b, 0.15, 0.1);
scene.add(arrow);
const printShape = new THREE.BoxGeometry(0.1, 0.01, 0.22);
const prints = Array.from({ length: 12 }, () => {
  const print = new THREE.Mesh(printShape, new THREE.MeshBasicMaterial({ color: 0x2c4a44 }));
  print.visible = false;
  scene.add(print);
  return print;
});
let printed = 0;
let planted = 0; // which foot is on the ground (0: the left one)
let last: THREE.Vector3[] = []; // where the feet were in the last frame
let slide = 0; // how fast the planted foot moves in the world (m/s), averaged over about 2 s

const shown = {
  'moving at (m/s)': 0,
  'motion vs facing (°)': 0,
  'direction weights': '',
  'run weight': 0,
  'foot slide (cm/s)': 0,
};
const gui = new GUI({ title: 'An animated figure', width: 320 });
gui.add(settings, 'autopilot').listen();
gui.add(settings, 'phase by distance');
gui.add(settings, 'blend directions');
gui.add(settings, 'speed (m/s)', 0.4, 3.2, 0.1);
gui.add(settings, 'crossfade (s)', 0, 0.5, 0.05);
gui.add(shown, 'moving at (m/s)').disable().listen();
gui.add(shown, 'motion vs facing (°)').disable().listen();
gui.add(shown, 'direction weights').disable().listen();
gui.add(shown, 'run weight').disable().listen();
gui.add(shown, 'foot slide (cm/s)').disable().listen();

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step();
    behind -= STEP;
  }
  // WHERE IT IS DRAWN: between its last two steps, as in "El paso fijo".
  const at = sim.before.clone().lerp(sim.at, behind / STEP);
  // How far it really went in this frame. (Half a meter in a frame is not walking: it was put there.)
  const jumped = at.distanceTo(figure.root.position) > 0.5;
  const went = jumped ? 0 : at.distanceTo(figure.root.position);
  figure.root.position.copy(at);
  // THE BODY'S TURN: towards where the simulation has it, at most TURN per second.
  const was = figure.root.quaternion.clone();
  const yaw = Math.atan2(-sim.facing.x, -sim.facing.z);
  figure.root.quaternion.rotateTowards(new THREE.Quaternion().setFromAxisAngle(UP, yaw), TURN * dt);
  const turning = dt > 0 ? THREE.MathUtils.radToDeg(was.angleTo(figure.root.quaternion)) / dt : 0;

  // HOW IT REALLY MOVED (in its last step), from where the drawn body looks.
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(figure.root.quaternion);
  const right = new THREE.Vector3(-look.z, 0, look.x);
  const velocity = sim.at.clone().sub(sim.before).divideScalar(STEP);
  const speed = velocity.length() > 30 ? 0 : velocity.length(); // (a jump is not a speed)
  if (speed > 0.05)
    angle = THREE.MathUtils.radToDeg(Math.atan2(velocity.dot(right), velocity.dot(look)));
  // WHICH CLIPS, AND HOW MUCH: targets by direction and by speed; the weights follow them.
  follow(weights, gait(angle, speed, settings['blend directions']), dt, settings['crossfade (s)']);
  // THE PHASE, one for every clip: it advances with the distance really traveled, over the
  // distance one cycle of what plays carries the body. Without it, each clip runs on its own clock.
  phase = (phase + went / Math.max(0.1, strideOf(weights))) % 1;
  const byDistance = settings['phase by distance'];
  for (const [name, action] of actions) {
    action.setEffectiveWeight(weights[name] ?? 0);
    action.timeScale = byDistance ? 0 : 1;
    if (byDistance) action.time = phase * action.getClip().duration;
  }
  mixer.update(byDistance ? 0 : dt);

  // THE FOOT ON THE GROUND: the lower one (by 5 mm: at each landing the two are level for a moment),
  // and how fast it goes in the world, its slide. Turning, a planted foot goes round the body too:
  // another slide, left out of the average.
  figure.root.updateMatrixWorld(true);
  const feet = figure.feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
  const other = 1 - planted;
  const down = feet[other].y < feet[planted].y - 0.005 ? other : planted;
  // (A foot that just landed was in the air until now: from the next frame on, it counts.)
  if (down === planted && last.length && !jumped && turning < 30 && dt > 0) {
    const slid = Math.hypot(feet[down].x - last[down].x, feet[down].z - last[down].z);
    slide += (slid / dt - slide) * (1 - Math.exp(-dt / 2));
  }
  if (down !== planted) {
    // It landed: a footprint where it is. A foot that slides leaves its print behind.
    const print = prints[printed++ % prints.length];
    figure.soles[down].getWorldPosition(print.position).setY(0.005);
    print.quaternion.copy(figure.root.quaternion);
    print.visible = true;
  }
  figure.soles.forEach((sole, i) => {
    (sole.material as THREE.MeshStandardMaterial).emissive.setHex(i === down ? 0x2f5f56 : 0);
  });
  last = feet;
  planted = down;

  arrow.position.copy(at).setY(0.02);
  if (speed > 0.05) arrow.setDirection(velocity.clone().normalize());
  arrow.setLength(0.3 + 0.4 * speed, 0.15, 0.1);
  // The camera's target follows it, at a pace that does not depend on the frames per second (2,5 m to
  // its right, so the figure is drawn left of the panel).
  controls.target.lerp(
    at
      .clone()
      .setY(0.8)
      .setX(at.x + 2.5),
    1 - Math.exp(-3 * dt),
  );

  // What the panel shows: the weights by direction (both paces added), and the run's.
  const parts = weights.idle >= 0.005 ? [`still ${weights.idle.toFixed(2)}`] : [];
  let run = 0;
  for (const d of DIRECTIONS) {
    const w = weights[clipName('walk', d)] + weights[clipName('run', d)];
    if (w >= 0.005) parts.push(`${d} ${w.toFixed(2)}`);
    run += weights[clipName('run', d)];
  }
  shown['moving at (m/s)'] = Number(speed.toFixed(2));
  shown['motion vs facing (°)'] = Math.round(angle) === -180 ? 180 : Math.round(angle);
  shown['direction weights'] = parts.join(' · ');
  shown['run weight'] = Number(run.toFixed(2));
  shown['foot slide (cm/s)'] = Number((slide * 100).toFixed(1));
});

console.log('On autopilot, three laps: looking north, where it goes, and back.');
console.log('Click the drawing and press WASD or the arrows to drive it (Shift runs).');
