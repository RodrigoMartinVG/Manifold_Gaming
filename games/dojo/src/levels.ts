import { levelFromText, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import { byName } from '@manifold/shell/run';
import { DOJO_ZONES } from './rules';

/**
 * THE DOJO'S LEVELS (stage 2a): text files in `games/dojo/levels/`, in the engine's level format.
 * Adding a level is adding a file: `dojo.level <its name>` builds it.
 */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });

/**
 * By name (the file's, without `.level`). A level that is not understood stops the build: better now
 * than in a player's hands. Read with the Dojo's zones (stage 3b) and the games' kit (stage 4.5e): one
 * it does not have is an error too.
 */
export const LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(byName(files, (text) => levelFromText(text, { zones: DOJO_ZONES, kit: KIT }))).sort(([a], [b]) =>
    a.localeCompare(b),
  ),
);
