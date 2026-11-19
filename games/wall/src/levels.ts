import { levelFromText, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import { WALL_ZONES } from './rules';

/** The wall's levels: text files in `games/wall/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const WALL_LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*\/(.+)\.level$/, '$1'),
    levelFromText(text, { zones: WALL_ZONES, kit: KIT }),
  ]),
);
