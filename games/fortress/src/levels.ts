import { levelFromText, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import { FORTRESS_ZONES } from './rules';

/** The fortress's levels: text files in `games/fortress/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const FORTRESS_LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*\/(.+)\.level$/, '$1'),
    levelFromText(text, { zones: FORTRESS_ZONES, kit: KIT }),
  ]),
);
