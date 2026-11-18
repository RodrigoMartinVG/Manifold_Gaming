import { CHARACTER_MODELS } from '@manifold/character/models';
import { KIT_MODELS } from '@manifold/kit/models';
import type { Mount } from '@manifold/presentation';
import { startGame } from '@manifold/shell';
import { FORTRESS } from './game';

/** Starts the fortress inside `container` (the site's `/jugar/fortaleza/`), on the games' shell (stage 5f). */
export function startFortress(container: HTMLElement): Promise<Mount> {
  return startGame(container, { ...FORTRESS, models: { ...CHARACTER_MODELS, ...KIT_MODELS } });
}

export { FORTRESS, FORTRESS_CARTRIDGE, FORTRESS_LEVELS, FORTRESS_THEME, FORTRESS_WORDS } from './game';
