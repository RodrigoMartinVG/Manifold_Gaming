import { byName } from '@manifold/shell/run';

/**
 * THE TOWER'S REFERENCE REPLAYS (stage 5d): each floor played to its goal by its test (floors.test.ts),
 * as text, by name (`floor-1`…). Playing one must end with the hash on its last line.
 */
const files = import.meta.glob<string>('../replays/*.replay', { query: '?raw', import: 'default', eager: true });

export const TOWER_REPLAYS: Readonly<Record<string, string>> = byName(files);
