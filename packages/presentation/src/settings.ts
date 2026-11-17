import { formatValue, type Value } from '@manifold/commands';
import type { GamePage, Piece } from './page';
import { storage } from './storage';

/** One of the player's settings: a view variable, what the menu calls it (a key of the words), and its control. */
export interface Setting {
  name: string;
  say: string;
  control: { kind: 'range'; min: number; max: number; step: number } | { kind: 'toggle' };
}

/**
 * THE PLAYER'S SETTINGS (stage 3i): how loud, how fast the mouse and the stick turn the camera,
 * whether up is down, subtitles for what is heard, and less camera motion for whoever gets dizzy; how
 * much the camera takes in, and a crosshair to aim by (stage 4.5a).
 * Each one is a view variable a piece of the presentation declares (the console changes them too:
 * `view.volume 0.3`); the menu shows them in this order.
 */
export const SETTINGS: readonly Setting[] = [
  { name: 'view.volume', say: 'settings.volume', control: { kind: 'range', min: 0, max: 1, step: 0.05 } },
  { name: 'view.mouse', say: 'settings.mouse', control: { kind: 'range', min: 0.2, max: 3, step: 0.1 } },
  { name: 'view.stick', say: 'settings.stick', control: { kind: 'range', min: 0.2, max: 3, step: 0.1 } },
  { name: 'view.invert', say: 'settings.invert', control: { kind: 'toggle' } },
  { name: 'view.subtitles', say: 'settings.subtitles', control: { kind: 'toggle' } },
  { name: 'view.calm', say: 'settings.calm', control: { kind: 'toggle' } },
  // (Stage 4.5a.)
  { name: 'view.fov', say: 'settings.fov', control: { kind: 'range', min: 40, max: 90, step: 1 } },
  { name: 'view.crosshair', say: 'settings.crosshair', control: { kind: 'toggle' } },
];

/**
 * KEPT, like the console's key bindings: in this browser, for each game (`manifold.dojo.settings`).
 * When the page starts they are applied before any recipe (a room or a link that says otherwise wins,
 * as it asks for something on purpose). A change a person makes (in the menu, or typed in the console)
 * is kept; a recipe's is not (a room is not the player's taste); back at its default value, it is
 * forgotten.
 */
export function mountSettings(page: GamePage): Piece {
  const saved = storage(`manifold.${page.cartridge.id}`);
  const kept: Record<string, Value> = { ...(saved.read<Record<string, Value>>('settings') ?? {}) };
  const declared = new Set(page.registry.variables().map((v) => v.decl.name));
  for (const s of SETTINGS) {
    const v = kept[s.name];
    if (v === undefined) continue;
    // One that is not understood any more (a newer version took it away) is forgotten.
    const errors = declared.has(s.name)
      ? page.registry.run(`${s.name} ${formatValue(v)}`, 'recipe').filter((m) => m.level === 'error')
      : [{}];
    if (errors.length) delete kept[s.name];
  }
  const names = new Set(SETTINGS.map((s) => s.name));
  const defaults = new Map(page.registry.variables().map((v) => [v.decl.name, formatValue(v.decl.default)]));
  const stop = page.registry.watch((name, value, source) => {
    if (!names.has(name) || source !== 'console') return;
    if (formatValue(value) === defaults.get(name)) delete kept[name];
    else kept[name] = value;
    saved.write('settings', kept);
  });
  return { stop };
}
