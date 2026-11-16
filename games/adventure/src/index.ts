import { CHARACTER_MODELS } from '@manifold/character/models';
import { recipeFromLink } from '@manifold/commands';
import { initPhysics } from '@manifold/core';
import { mount, type Hud, type InitialRecipe, type Mount, type Words } from '@manifold/presentation';
import { AdventureCartridge, explorer } from './rules';

/**
 * THE ADVENTURE'S WORDS (decision 0019): its notices and its HUD, in Spanish (the site's) and English
 * (the console's).
 */
export const ADVENTURE_WORDS = {
  es: {
    'adventure.gem': 'Una gema ({0})',
    'adventure.key': 'La llave: abre la salida',
    'adventure.locked': 'La salida está cerrada: falta la llave',
    'adventure.down': 'Más abajo: profundidad {0}',
    'adventure.fell': 'Te caíste: de vuelta al comienzo',
    'adventure.hud.depth': 'Profundidad',
    'adventure.hud.gems': 'Gemas',
    'adventure.hud.key': 'Llave',
    'adventure.hud.yes': 'sí',
    'adventure.hud.no': 'no',
  },
  en: {
    'adventure.gem': 'a gem ({0})',
    'adventure.key': 'the key: it opens the exit',
    'adventure.locked': 'the exit is locked: the key is missing',
    'adventure.down': 'deeper: depth {0}',
    'adventure.fell': 'you fell: back to the start',
    'adventure.hud.depth': 'Depth',
    'adventure.hud.gems': 'Gems',
    'adventure.hud.key': 'Key',
    'adventure.hud.yes': 'yes',
    'adventure.hud.no': 'no',
  },
} as const satisfies Words;

/** What the adventure shows: how deep, the gems it carries, whether it has the key. */
export const adventureHud: Hud = ({ hero, say }) => {
  const ex = hero && explorer(hero);
  if (!ex) return [];
  return [
    { label: say('adventure.hud.depth'), value: String(ex.depth) },
    { label: say('adventure.hud.gems'), value: String(ex.items.filter((i) => i === 'gem').length) },
    { label: say('adventure.hud.key'), value: say(ex.items.includes('key') ? 'adventure.hud.yes' : 'adventure.hud.no') },
  ];
};

/**
 * Starts the adventure inside `container` (the site's `/jugar/aventura/`). A link may bring a recipe
 * (`#recipe=adventure.dungeon+7`: another dungeon). It mounts a console, while it grows (decision 0010:
 * each game decides; the finished one, in phase 5, may not).
 */
export async function startAdventure(container: HTMLElement): Promise<Mount> {
  await initPhysics();
  const recipes: InitialRecipe[] = [];
  const fromLink = recipeFromLink(location.hash);
  if (fromLink) recipes.push({ from: "the link's recipe", text: fromLink });
  return mount(AdventureCartridge, container, {
    recipes,
    camera: 'orbit',
    // The games' character (stage 4a): the mannequin.
    models: CHARACTER_MODELS,
    words: ADVENTURE_WORDS,
    hud: adventureHud,
    console: { game: 'adventure', examples: ['adventure.dungeon 7', 'adventure.depth 2', 'level.export', 'inspect'] },
  });
}

export { AdventureCartridge };
