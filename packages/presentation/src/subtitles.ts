import type { VariableInfo } from '@manifold/commands';
import type { Vec3 } from '@manifold/common';
import { upAt, type Event } from '@manifold/core';
import { weaponFeel } from './feel';
import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';
import type { Say } from './words';

export const SUBTITLE_VARIABLES = {
  subtitles: {
    name: 'view.subtitles',
    description:
      'Subtitles for what is heard (stage 3i): each sound near the camera, written at the bottom with an arrow towards where it came from ("Steps on metal ←"), whether the sound plays or not.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;

type Sound = Extract<Event, { type: 'sound' }>;

/** How long a subtitle stays (ms), and how many at once. */
const LASTS = 2200;
const AT_ONCE = 4;
/** An arrow for each eighth of a turn around the camera, from straight ahead, clockwise (as seen from above). */
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

/**
 * A sound in words, a whole sentence for each sound and what it was on (`sound.step.metal`: "Pasos en
 * metal"), for the engine's materials; without one, stone, as it sounds. A level's own material
 * ("oil") has no words: the sound alone ("Pasos"); and so do the sounds that are on nothing (a door).
 */
export function subtitleText(say: Say, sound: Sound['sound'], surface: string | null): string {
  const key = `sound.${sound}.${surface ?? 'stone'}`;
  const whole = say(key);
  return whole === key ? say(`sound.${sound}`) : whole;
}

/** (Stage 5g) A weapon used, in words, by its kind (`sound.fired.shotgun`: "Un escopetazo"); without its own, what is thrown. */
export function firedText(say: Say, kind: string): string {
  const key = `sound.fired.${kind}`;
  const words = say(key);
  return words === key ? say('sound.fired') : words;
}

/**
 * The arrow towards where a sound came from (`offset`: from the camera to it), around the camera, as
 * seen from above: along the ground, where "up" is the world's there. The camera's forward (minus the
 * third column of its matrix, `elements` as three.js keeps them) is laid on the ground first: looking
 * down at the character, its forward points into the ground, and a sound behind and below it came out
 * ahead. Looking straight down, its forward on the ground is where the top of the screen points.
 */
export function arrowFor(offset: Vec3, elements: ArrayLike<number>, up: Vec3): string {
  const flat = (v: Vec3): Vec3 => {
    const along = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
    return [v[0] - along * up[0], v[1] - along * up[1], v[2] - along * up[2]];
  };
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let ahead = flat([-elements[8]!, -elements[9]!, -elements[10]!]);
  if (dot(ahead, ahead) < 1e-6) ahead = flat([elements[4]!, elements[5]!, elements[6]!]);
  // Its right, on the ground: forward × up (the same length as forward: they are perpendicular).
  const right: Vec3 = [
    ahead[1] * up[2] - ahead[2] * up[1],
    ahead[2] * up[0] - ahead[0] * up[2],
    ahead[0] * up[1] - ahead[1] * up[0],
  ];
  const d = flat(offset);
  const eighth = Math.round((Math.atan2(dot(d, right), dot(d, ahead)) / (2 * Math.PI)) * 8 + 8) % 8;
  return ARROWS[eighth]!;
}

/**
 * SUBTITLES FOR SOUNDS (stage 3i): for whoever cannot hear them, or plays without sound. Each sound
 * the camera would hear (the same reach as the sound's: its radius, and a little more), in words
 * ("Pasos en metal"), with an arrow towards where it came from. The same sound again while its line
 * is still there counts on it ("×3") instead of filling the screen. (For the browser tests:
 * `data-subtitle`, the last one.)
 */
export function mountSubtitles(page: GamePage): Piece {
  addInterfaceStyles();
  const box = document.createElement('div');
  box.className = 'mg-subtitles';
  box.setAttribute('aria-live', 'polite');
  page.container.append(box);
  let enabled = false;
  page.registry.declareVariable({ ...SUBTITLE_VARIABLES.subtitles, onChange: (v) => (enabled = v === true) });
  const lines = new Map<string, { div: HTMLDivElement; count: number; timer: number }>();

  const show = (text: string, arrow: string) => {
    const line = lines.get(text);
    if (line) {
      line.count++;
      clearTimeout(line.timer);
      line.div.textContent = `${text} ${arrow} ×${line.count}`;
      line.timer = window.setTimeout(() => forget(text), LASTS);
    } else {
      const div = document.createElement('div');
      div.textContent = `${text} ${arrow}`;
      box.append(div);
      lines.set(text, { div, count: 1, timer: window.setTimeout(() => forget(text), LASTS) });
      // No more than a few: the oldest goes.
      if (lines.size > AT_ONCE) forget(lines.keys().next().value!);
    }
    page.container.dataset.subtitle = text;
  };
  const forget = (text: string) => {
    const line = lines.get(text);
    if (!line) return;
    clearTimeout(line.timer);
    line.div.remove();
    lines.delete(text);
  };

  return {
    event(ev) {
      if (!enabled || (ev.type !== 'sound' && ev.type !== 'fired')) return;
      // (Stage 5g) A weapon used, heard as far as its sound (audio.ts), in words: "Un escopetazo".
      const radius = ev.type === 'sound' ? ev.radius : weaponFeel(page.feel, ev.kind).heard;
      const camera = page.stage.camera;
      const dx = ev.at[0] - camera.position.x;
      const dy = ev.at[1] - camera.position.y;
      const dz = ev.at[2] - camera.position.z;
      if (Math.hypot(dx, dy, dz) >= radius + 6) return;
      const at: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
      const arrow = arrowFor([dx, dy, dz], camera.matrixWorld.elements, upAt(page.session.world, at));
      show(ev.type === 'sound' ? subtitleText(page.words, ev.sound, ev.surface) : firedText(page.words, ev.kind), arrow);
    },
    stop() {
      for (const text of [...lines.keys()]) forget(text);
      box.remove();
    },
  };
}
