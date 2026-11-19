import { CHARACTER_MODELS } from '@manifold/character/models';
import { KIT_MODELS } from '@manifold/kit/models';
import { ARMS_MODELS } from '@manifold/arms/models';
import type { Mount } from '@manifold/presentation';
import { startGame } from '@manifold/shell';
import { WALL } from './game';

/** Starts the wall inside `container` (the site's `/jugar/muralla/`), on the games' shell (stage 5h). */
export function startWall(container: HTMLElement): Promise<Mount> {
  return startGame(container, { ...WALL, models: { ...CHARACTER_MODELS, ...KIT_MODELS, ...ARMS_MODELS } });
}

export { WALL, WALL_THEME, WALL_WORDS } from './game';
export { WALL_CARTRIDGE, WALL_LEVEL_LIST, wallDone } from './cartridge';
export { WALL_LEVELS } from './levels';
