import type { VariableInfo } from '@manifold/commands';
import type { Entity, World } from '@manifold/core';
import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';
import type { Language, Say } from './words';

/** What the HUD shows: a label and its value, already in the player's language. */
export interface HudItem {
  label: string;
  value: string;
}

/** What a game's HUD shows now (or nothing: none for this world): read from the world, every frame. */
export type Hud = (o: { world: World; hero: Entity | undefined; say: Say; language: Language }) => readonly HudItem[];

export const HUD_VARIABLES = {
  hud: {
    name: 'view.hud',
    description: "The game's HUD, over the game (stage 3i): in the Dojo, a level's time, falls and stars.",
    scope: 'view',
    type: { kind: 'boolean' },
    default: true,
  },
} as const satisfies Record<string, VariableInfo>;

/**
 * THE HUD (stage 3i): what the game says it shows, read from the world on every frame, in a strip at
 * the top left. The page writes it only when it changes (a time to tenths changes ten times a second,
 * not sixty), and for the browser tests, in `data-hud` ("Tiempo 0:12,3 | Caídas 0").
 */
export function mountHud(page: GamePage, hud: Hud): Piece {
  addInterfaceStyles();
  const strip = document.createElement('div');
  strip.className = 'mg-hud';
  strip.hidden = true;
  page.container.append(strip);
  let on = true;
  let shown = '';
  page.registry.declareVariable({ ...HUD_VARIABLES.hud, onChange: (v) => (on = v === true) });
  return {
    frame({ world, hero }) {
      const items = on ? hud({ world, hero, say: page.words, language: page.language }) : [];
      const text = items.map((i) => `${i.label} ${i.value}`).join(' | ');
      if (text === shown) return;
      shown = text;
      strip.hidden = items.length === 0;
      strip.replaceChildren(
        ...items.map((i) => {
          const span = document.createElement('span');
          const value = document.createElement('b');
          value.textContent = i.value;
          span.append(i.label, value);
          return span;
        }),
      );
      page.container.dataset.hud = text;
    },
    stop: () => strip.remove(),
  };
}
