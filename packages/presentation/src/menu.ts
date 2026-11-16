import type { Registry } from '@manifold/commands';
import type { World } from '@manifold/core';
import type { PageMatch } from './match';
import type { GamePage, Piece } from './page';
import { SETTINGS, type Setting } from './settings';
import { saveGame, saveRecipe, type SavedGame } from '@manifold/core';
import { storage } from './storage';
import { button, focusables, panel } from './ui';
import { numberIn, type Language } from './words';

/** The gamepad's buttons the menu reads (the standard layout): Start opens and closes it; the cross, A and B go through it. */
const PAD = { start: 9, a: 0, b: 1, up: 12, down: 13, left: 14, right: 15 } as const;

/**
 * THE PAUSE MENU (stage 3i): Escape or P (Start on a gamepad) opens it. Playing alone, it pauses the
 * world (`view.paused`: the steps stop); in a match with others it does not (the world is everybody's),
 * and it says so. Resume, the settings, start again. It works with the keyboard alone (the arrows, Enter,
 * Escape to go back) and with a gamepad (the cross, A, B). While it is open the character takes no keys.
 * (For the browser tests: `data-menu`, `pause` or `settings` while open.)
 */
export function mountMenu(page: GamePage, match: PageMatch, o: { blocked(): boolean }): Piece & { readonly open: boolean } {
  let current: { remove(): void; box: HTMLElement } | null = null;
  let release: (() => void) | null = null;
  /** Whether the world was paused before the menu paused it (by the console): closing leaves it so. */
  let pausedBefore = false;
  let pausedByMenu = false;

  const close = () => {
    if (!current) return;
    current.remove();
    current = null;
    release?.();
    release = null;
    if (pausedByMenu && !pausedBefore) page.registry.run('view.paused off', 'recipe');
    pausedByMenu = false;
    delete page.container.dataset.menu;
    // The keys go back to the game (not to the button that was pressed, now gone).
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  const show = (which: 'pause' | 'settings') => {
    current?.remove();
    const p = which === 'pause' ? pauseMenu() : settingsMenu(page, () => show('pause'));
    current = p;
    page.container.dataset.menu = which;
    p.focus();
  };

  const pauseMenu = () => {
    const alone = match.net === 'alone';
    const p = panel(page.container, {
      title: page.words(alone ? 'menu.title' : 'menu.online'),
      onKey: (e) => {
        if (e.key !== 'Escape' && e.code !== 'KeyP') return false;
        close();
        return true;
      },
    });
    const actions = document.createElement('div');
    actions.className = 'mg-actions';
    actions.append(
      button(page.words('menu.resume'), close),
      button(page.words('menu.settings'), () => show('settings')),
      button(page.words('menu.restart'), () => {
        close();
        page.restart();
      }),
    );
    // A game that saves (stage 3k, decision 0020), played alone: its progress, kept in this browser.
    const note = document.createElement('p');
    note.className = 'mg-small';
    if (page.cartridge.progress && alone) {
      const kept = storage(`manifold.${page.cartridge.id}`);
      const say = (text: string) => {
        note.textContent = text;
        page.container.dataset.saved = text;
      };
      actions.append(
        button(page.words('menu.save'), () => {
          const saved = saveGame(page.cartridge, page.session.world, page.me);
          if (!saved) return;
          kept.write('save', saved);
          say(page.words('menu.saved', [saved.made]));
        }),
        button(page.words('menu.load'), () => {
          const saved = kept.read<SavedGame>('save');
          if (!saved) return say(page.words('menu.nothing'));
          let recipe: string;
          try {
            recipe = saveRecipe(page.cartridge, saved);
          } catch (e) {
            page.say(`load: ${(e as Error).message}`, 'warn');
            return say(page.words('menu.unreadable'));
          }
          close();
          page.load(recipe);
        }),
      );
    }
    p.box.append(actions, note);
    return p;
  };

  const openMenu = () => {
    if (current) return;
    release = page.hold();
    pausedBefore = match.paused;
    if (match.net === 'alone' && !match.paused) {
      page.registry.run('view.paused on', 'recipe');
      pausedByMenu = true;
    }
    show('pause');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.code !== 'KeyP') return;
    if (o.blocked() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (current) close();
    else if (!page.held) openMenu();
  };
  document.addEventListener('keydown', onKey);

  // The gamepad: what was held at the last frame, to see what was just pressed.
  let before: readonly boolean[] = [];
  const pad = () => {
    const gamepad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected);
    if (!gamepad) return;
    const now = gamepad.buttons.map((b) => b.pressed);
    const pressed = (i: number) => now[i] && !before[i];
    before = now;
    if (pressed(PAD.start)) {
      if (current) close();
      else if (!page.held && !o.blocked()) openMenu();
      return;
    }
    if (!current) return;
    const all = focusables(current.box);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const focused = all[at];
    if (pressed(PAD.down) || pressed(PAD.up)) all[(at + (pressed(PAD.down) ? 1 : -1) + all.length) % all.length]?.focus();
    else if ((pressed(PAD.left) || pressed(PAD.right)) && focused instanceof HTMLInputElement && focused.type === 'range') {
      focused[pressed(PAD.right) ? 'stepUp' : 'stepDown']();
      focused.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (pressed(PAD.a)) focused?.click();
    else if (pressed(PAD.b)) {
      if (page.container.dataset.menu === 'settings') show('pause');
      else close();
    }
  };

  return {
    get open() {
      return current !== null;
    },
    beforeSteps: pad,
    welcome() {
      // A new world (a restart, a replay, a join): the menu does not stay over it.
      close();
    },
    stop() {
      document.removeEventListener('keydown', onKey);
      close();
    },
  };
}

/** The settings, as controls that change their view variables (`settings.ts`), and a way back. */
function settingsMenu(page: GamePage, back: () => void) {
  const p = panel(page.container, {
    title: page.words('settings.title'),
    onKey: (e) => {
      if (e.key !== 'Escape') return false;
      back();
      return true;
    },
  });
  for (const s of SETTINGS) {
    const control = settingControl(page.registry, s, page.words(s.say), page.language);
    if (control) p.box.append(control);
  }
  const note = document.createElement('p');
  note.className = 'mg-small';
  note.textContent = page.words('settings.saved');
  const actions = document.createElement('div');
  actions.className = 'mg-actions';
  actions.append(button(page.words('menu.back'), back));
  p.box.append(actions, note);
  return p;
}

/** One setting's control (if a piece declared its variable): a slider with its value, or a box to tick. */
function settingControl(registry: Registry<World>, s: Setting, text: string, language: Language): HTMLLabelElement | null {
  const declared = registry.variables().find((v) => v.decl.name === s.name);
  if (!declared) return null;
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.name = s.name;
  if (s.control.kind === 'range') {
    const output = document.createElement('output');
    input.type = 'range';
    input.min = String(s.control.min);
    input.max = String(s.control.max);
    input.step = String(s.control.step);
    input.value = String(declared.value);
    // As the player's language writes it, with as many decimals as a step has (0.05: two).
    const decimals = String(s.control.step).split('.')[1]?.length ?? 0;
    const shown = () => numberIn(language, Number(registry.value(s.name)), decimals);
    output.textContent = shown();
    input.addEventListener('input', () => {
      registry.run(`${s.name} ${input.value}`, 'console');
      output.textContent = shown();
    });
    label.append(text, output, input);
  } else {
    input.type = 'checkbox';
    input.checked = declared.value === true;
    input.addEventListener('change', () => registry.run(`${s.name} ${input.checked ? 'on' : 'off'}`, 'console'));
    label.append(text, input);
  }
  return label;
}
