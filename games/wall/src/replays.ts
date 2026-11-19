import { byName } from '@manifold/shell/run';

/**
 * THE WALL'S REFERENCE REPLAYS (stage 5h): each level played until it is held by its test
 * (levels.test.ts), as text, by name (`level-1`…). Playing one must end with the hash on its last line.
 */
const files = import.meta.glob<string>('../replays/*.replay', { query: '?raw', import: 'default', eager: true });

export const WALL_REPLAYS: Readonly<Record<string, string>> = byName(files);
