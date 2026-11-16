import type { VariableInfo } from '@manifold/commands';
import type { Event } from '@manifold/core';
import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';

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
      if (!enabled || ev.type !== 'sound') return;
      const s = ev as Sound;
      const camera = page.stage.camera;
      const dx = s.at[0] - camera.position.x;
      const dy = s.at[1] - camera.position.y;
      const dz = s.at[2] - camera.position.z;
      if (Math.hypot(dx, dy, dz) >= s.radius + 6) return;
      // Where it came from, around the camera: its right (the matrix's first column) and its forward
      // (minus the third), along the ground.
      const m = camera.matrixWorld.elements;
      const right = dx * m[0]! + dy * m[1]! + dz * m[2]!;
      const ahead = -(dx * m[8]! + dy * m[9]! + dz * m[10]!);
      const eighth = Math.round((Math.atan2(right, ahead) / (2 * Math.PI)) * 8 + 8) % 8;
      const what = page.words(`sound.${s.sound}`);
      // On what (a step, a landing, a hit), if it is one of the engine's materials: without one, stone, as
      // it sounds (a level's own, "oil", has no words).
      const key = `surface.${s.surface ?? 'stone'}`;
      const on = s.sound === 'step' || s.sound === 'land' || s.sound === 'hit' ? page.words(key) : key;
      const text = on === key ? what : `${what} ${on}`;
      show(text, ARROWS[eighth]!);
    },
    stop() {
      for (const text of [...lines.keys()]) forget(text);
      box.remove();
    },
  };
}
