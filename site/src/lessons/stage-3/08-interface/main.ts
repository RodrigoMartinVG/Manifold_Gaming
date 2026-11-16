import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createWorld, GOAL, STARS, STEP, step, type Notice, type Point, type Sound } from './world';
import { languageOf, missingKeys, wordsIn, type Language } from './words';

const { scene, camera, onFrame } = createScene({ camera: [0, 6, 7.5], target: [0, 0, 0] });

// THE PLACE: wood on the left, metal on the right, the goal, the token and its stars.
function floor(x: number, color: number) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.1, 7),
    new THREE.MeshStandardMaterial({ color }),
  );
  box.position.set(x, -0.05, 0);
  scene.add(box);
}
floor(-2.5, 0x8a6a42); // wood
floor(2.5, 0x7a7e84); // metal
const goal = new THREE.Mesh(
  new THREE.RingGeometry(0.4, 0.5, 32),
  new THREE.MeshBasicMaterial({ color: 0xe6dccb }),
);
goal.rotation.x = -Math.PI / 2;
goal.position.set(GOAL.x, 0.02, GOAL.z);
scene.add(goal);
const token = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.25, 0.6),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(token);
const starMeshes: THREE.Mesh[] = [];
const starLook = new THREE.MeshStandardMaterial({ color: 0xf0d59a, emissive: 0x5a4418 });
for (let i = 0; i < STARS; i++)
  starMeshes.push(new THREE.Mesh(new THREE.OctahedronGeometry(0.25), starLook));
scene.add(...starMeshes);
// A door behind the camera: it is heard, and seen only if you turn around.
const door = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 2.2, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x6a4a32 }),
);
door.position.set(-6, 1.1, 14);
scene.add(door);

// THE PAGE'S LAYER, over the drawing: the HUD (top left), a notice (top), the subtitles (bottom).
function layer(css: string) {
  const box = document.createElement('div');
  box.style.cssText = `position: absolute; pointer-events: none; font: 600 14px/1.4 system-ui; ${css}`;
  document.body.append(box);
  return box;
}
const DARK = 'background: rgb(18 16 13 / 0.78); border-radius: 6px;';
const GOLD = 'color: #f0d59a;';
const hudBox = layer(
  `top: 10px; left: 10px; display: flex; gap: 14px; padding: 4px 10px; ${GOLD} ${DARK}`,
);
const noticeBox = layer(
  `top: 18%; left: 50%; transform: translateX(-50%); padding: 6px 16px; ${GOLD} ${DARK}` +
    'font-size: 17px; white-space: nowrap; transition: opacity 0.4s; opacity: 0',
);
const subtitleBox = layer(
  'bottom: 14px; left: 50%; transform: translateX(-50%); text-align: center; white-space: nowrap',
);
subtitleBox.setAttribute('aria-live', 'polite'); // a screen reader says them too

/** Writes a box only when what it says changed (a time to tenths changes ten times a second). */
function put(box: HTMLElement, lines: string[], css = '') {
  const text = lines.join(' | ');
  if (box.dataset.text === text) return;
  box.dataset.text = text;
  box.replaceChildren(
    ...lines.map((line) => {
      const div = document.createElement('div');
      div.style.cssText = css;
      div.textContent = line;
      return div;
    }),
  );
}

// THE PANEL. The language starts as the page's (`<html lang>`), and the setting writes it there.
const settings = { language: languageOf(), subtitles: true, autopilot: true };
let words = wordsIn(settings.language);
const english = wordsIn('en'); // the console's language
const shown = {
  'last notice (key)': '',
  'last notice (words)': '',
  'last subtitle': '',
  'sounds (world)': 0,
  'sounds subtitled': 0,
  'world hash (step 300)': '…',
  'keys missing': missingKeys().join(', ') || 'none',
};
const gui = new GUI({ title: 'keys and words' });
gui.add(settings, 'language', ['es', 'en']).onChange((language: Language) => {
  document.documentElement.lang = language;
  words = wordsIn(languageOf());
});
gui.add(settings, 'subtitles').onChange(() => lines.clear());
gui.add(settings, 'autopilot').listen();
gui.add({ restart: () => restart() }, 'restart');
gui.add(shown, 'last notice (key)').disable().listen();
gui.add(shown, 'last notice (words)').disable().listen();
gui.add(shown, 'last subtitle').disable().listen();
gui.add(shown, 'sounds (world)').disable().listen();
gui.add(shown, 'sounds subtitled').disable().listen();
gui.add(shown, 'world hash (step 300)').disable().listen();
gui.add(shown, 'keys missing').disable().listen();

// THE KEYS: WASD or the arrows take the token (the world gets where to walk, not keys);
// ticking 'autopilot' gives it back.
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
const held = new Set<string>();
addEventListener('keydown', (e) => {
  // (Not while a control of the panel has the keys: its arrows are its own.)
  if (!KEYS[e.code] || (e.target instanceof Element && e.target.closest('.lil-gui'))) return;
  e.preventDefault();
  held.add(e.code);
  settings.autopilot = false;
});
addEventListener('keyup', (e) => held.delete(e.code));
function wanted(): Point | null {
  if (settings.autopilot) return null;
  const want = { x: 0, z: 0 };
  for (const code of held) {
    const [x, z] = KEYS[code] ?? [0, 0];
    want.x += x;
    want.z += z;
  }
  return want;
}

const SEED = 7;
let world = createWorld(SEED);
let last: Notice | null = null; // the last notice, kept as its key and numbers
let noticeAge = 0;
// The subtitles on screen, by key: towards where, how many times, and for how long.
const lines = new Map<string, { arrow: string; count: number; age: number }>();
function restart() {
  world = createWorld(SEED);
  settings.autopilot = true;
  last = null;
  lines.clear();
  shown['sounds (world)'] = 0;
  shown['sounds subtitled'] = 0;
  shown['world hash (step 300)'] = '…';
}

// A SUBTITLE for a sound the camera would hear (its radius, and 6 m more, as the engine does), with
// an arrow towards where it came from, seen from above. The arrow is the camera's, not the world's.
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
function subtitle(s: Sound) {
  camera.updateMatrixWorld();
  const d = new THREE.Vector3(...s.at).sub(camera.position);
  if (d.length() >= s.radius + 6) return;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
  const ahead = new THREE.Vector3(right.z, 0, -right.x); // the right, turned a quarter to the left
  const eighth = Math.round(Math.atan2(d.dot(right), d.dot(ahead)) / (Math.PI / 4) + 8) % 8;
  const key = s.surface ? `sound.${s.kind}.${s.surface}` : `sound.${s.kind}`;
  const count = (lines.get(key)?.count ?? 0) + 1;
  lines.delete(key); // (and back at the end: the newest goes last)
  lines.set(key, { arrow: ARROWS[eighth] ?? '', count, age: 0 });
  const oldest = lines.keys().next().value;
  if (lines.size > 4 && oldest !== undefined) lines.delete(oldest);
  shown['sounds subtitled']++;
}

let behind = 0;
onFrame((dt) => {
  behind += dt;
  while (behind >= STEP) {
    step(world, wanted());
    behind -= STEP;
    if (world.tick === 300)
      shown['world hash (step 300)'] = world.hash.toString(16).padStart(8, '0');
  }
  // WHAT HAPPENED, taken once per frame (two steps in a frame leave both of theirs).
  for (const notice of world.notices.splice(0)) {
    last = notice;
    noticeAge = 0;
    console.log(`notice: ${english.say(notice.key, notice.values)}`); // the console stays in English
  }
  for (const sound of world.sounds.splice(0)) {
    shown['sounds (world)']++;
    if (settings.subtitles) subtitle(sound);
  }

  // THE DRAWING
  token.position.set(world.at.x, 0.55, world.at.z);
  starMeshes.forEach((mesh, i) => {
    const star = world.stars[i];
    mesh.visible = star !== undefined;
    if (star) mesh.position.set(star.x, 0.8, star.z);
    mesh.rotation.y += 2 * dt;
  });

  // THE WORDS, said again in every frame in the page's language: the HUD read from the world (what
  // is), the notice and the subtitles from the keys they came with (what happened).
  put(hudBox, [
    `${words.say('hud.time')} ${words.time((world.tick - world.lapStart) * STEP)}`,
    `${words.say('hud.stars')} ${words.say('hud.of', [world.taken, STARS])}`,
    `${words.say('hud.lap')} ${words.number(world.lap)}`,
  ]);
  noticeAge += dt;
  const said = last ? words.say(last.key, last.values) : '';
  put(noticeBox, [said]);
  noticeBox.style.opacity = last && noticeAge < 2.6 ? '1' : '0';
  for (const [key, line] of lines) if ((line.age += dt) > 2.2) lines.delete(key);
  const subtitles: string[] = [];
  for (const [key, line] of lines)
    subtitles.push(`${words.say(key)} ${line.arrow}${line.count > 1 ? ` ×${line.count}` : ''}`);
  put(subtitleBox, subtitles, `margin-top: 3px; padding: 2px 10px; color: #fff; ${DARK}`);
  if (subtitles.length > 0) shown['last subtitle'] = subtitles[subtitles.length - 1] ?? '';
  if (last) {
    const values = last.values.map((v) => Math.round(v * 100) / 100).join(', ');
    shown['last notice (key)'] = `${last.key} [${values}]`;
    shown['last notice (words)'] = said;
  }
});
