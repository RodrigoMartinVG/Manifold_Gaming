import { CHARACTER_MODELS } from '@manifold/character/models';
import { KIT_MODELS } from '@manifold/kit/models';
import type { Mount } from '@manifold/presentation';
import { startGame } from '@manifold/shell';
import { TOWER } from './game';

/** Starts the tower inside `container` (the site's `/jugar/torre/`), on the games' shell (stage 5b). */
export function startTower(container: HTMLElement): Promise<Mount> {
  return startGame(container, { ...TOWER, models: { ...CHARACTER_MODELS, ...KIT_MODELS } });
}

export { TOWER, TOWER_THEME, TOWER_WORDS } from './game';
export { TOWER_CARTRIDGE, TOWER_LEVEL_LIST, towerDone } from './cartridge';
export { TOWER_LEVELS } from './levels';
