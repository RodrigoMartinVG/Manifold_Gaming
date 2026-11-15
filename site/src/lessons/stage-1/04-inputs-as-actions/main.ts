import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createRandom } from './random';
import { ACTIONS, BINDINGS, describe, keyboard, NOTHING, same, type Input } from './actions';
import { createWorld, STEP } from './world';

const { scene, onFrame } = createScene({ camera: [0, 7, 9], target: [0, 0.5, 0] });
for (const a of ACTIONS) console.log(`action "${a.name}" (${a.kind}): ${a.description}`);
for (const [player, keys] of Object.entries(BINDINGS))
  console.log(`player ${player}: ${Object.values(keys).join(' ')}`);

const world = createWorld();
const meshes = new Map<number, THREE.Mesh>();
for (const [id, color] of [
  [1, 0x93d9c9],
  [2, 0xe0a040],
] as const) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 24, 16),
    new THREE.MeshStandardMaterial({ color }),
  );
  scene.add(mesh);
  meshes.set(id, mesh);
}

const options = { player1: 'keyboard', player2: 'bot', screen: 60, keepTaps: true };
const keys = keyboard(() => options.keepTaps);

// A BOT asks for actions too: it does not press keys, it fills in an Input (with its own seed).
const pilot = createRandom(9);
const bots = new Map<number, Input>([
  [1, NOTHING],
  [2, NOTHING],
]);
function bot(player: number, step: number): Input {
  const last = bots.get(player) ?? NOTHING;
  let input: Input = { move: last.move, jump: false }; // a jump is a press: one step held, the next released
  if ((step + player * 20) % 40 === 0) {
    const r = Math.floor(pilot() * 9);
    input = { move: r === 8 ? null : r * 45, jump: pilot() < 0.4 };
  }
  bots.set(player, input);
  return input;
}

// WHAT ENTERED, AND WHEN: only the changes, with their step and their player. That list is all a
// replay keeps, and all the network carries.
const log: { step: number; player: number; input: Input }[] = [];
const last = new Map<number, Input>([
  [1, NOTHING],
  [2, NOTHING],
]);
const panel = document.createElement('pre');
panel.style.cssText =
  'position:absolute;left:8px;bottom:8px;margin:0;padding:6px 8px;font:11px/1.4 ui-monospace,monospace;color:#e6dccb;background:#0008;border-radius:4px;pointer-events:none';
document.body.append(panel);

const readout = { step: 0, changes: 0, jumps1: 0, jumps2: 0 };
const gui = new GUI({ title: 'Inputs as actions' });
gui.add(options, 'player1', ['keyboard', 'bot']).name('player 1 (WASD, Space)');
gui.add(options, 'player2', ['keyboard', 'bot']).name('player 2 (arrows, Enter)');
gui.add(options, 'screen', 2, 60, 1).name('screen (frames/s)');
gui.add(options, 'keepTaps').name('keep quick taps');
gui.add(readout, 'step').listen().disable();
gui.add(readout, 'changes').name('changes kept').listen().disable();
gui.add(readout, 'jumps1').name('jumps, player 1').listen().disable();
gui.add(readout, 'jumps2').name('jumps, player 2').listen().disable();

let accumulator = 0;
let screenTime = 0;
onFrame((dt) => {
  // A slow screen, on purpose: the keys are read only when one of its frames arrives.
  screenTime += dt;
  if (screenTime < 1 / options.screen) return;
  accumulator += screenTime;
  screenTime = 0;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    const step = world.steps + 1;
    // 1. FROM WHERE IT COMES, TO WHAT IT ASKS FOR: each player's source gives an Input.
    const changes = new Map<number, Input>();
    for (const player of [1, 2]) {
      const source = player === 1 ? options.player1 : options.player2;
      const input = source === 'bot' ? bot(player, step) : keys.read(player);
      // 2. Only what changed enters, at this step, for this player.
      if (!same(input, last.get(player) ?? NOTHING)) {
        changes.set(player, input);
        last.set(player, input);
        log.push({ step, player, input });
      }
    }
    keys.used();
    // 3. The world reads actions, never keys.
    world.step(changes);
  }
  for (const [id, p] of world.players)
    meshes.get(id)!.position.set(p.position[0], p.position[1] + 0.4, p.position[2]);
  panel.textContent = log
    .slice(-8)
    .map((c) => `step ${c.step} · player ${c.player} · ${describe(c.input)}`)
    .join('\n');
  readout.step = world.steps;
  readout.changes = log.length;
  readout.jumps1 = world.players.get(1)!.jumps;
  readout.jumps2 = world.players.get(2)!.jumps;
});

console.log('A click on the drawing gives it the keyboard.');
