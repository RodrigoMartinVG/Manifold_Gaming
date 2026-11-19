import { levelFromText, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import { byName } from '@manifold/shell/run';
import { TOWER_ZONES } from './rules';

/** The tower's floors: text files in `games/tower/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const TOWER_LEVELS: Readonly<Record<string, Level>> = byName(files, (text) =>
  levelFromText(text, { zones: TOWER_ZONES, kit: KIT }),
);
