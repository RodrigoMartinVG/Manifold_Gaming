import type { Cell } from './dungeon';

/** Floor: a cell that can be walked on (not a wall, not nothing, not off the map). */
export const walkable = (cell: string | undefined) =>
  cell !== undefined && cell !== '#' && cell !== ' ';

/** How many cells of the map can be walked on. */
export const floorCells = (rows: string[]) => [...rows.join('')].filter(walkable).length;

/** The four neighbors of a cell: right, left, down, up. */
const NEIGHBORS: Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * THE FLOOD FILL: how many floor cells can be reached from `start`, a step at a time to one of the
 * four neighbors. If it is every floor cell, the dungeon is all connected. It does not trust how the
 * dungeon was made: it walks it.
 */
export function reachable(rows: string[], start: Cell): number {
  const seen = new Set([start.join(',')]);
  const queue = [start];
  // (A for…of also visits the cells pushed while it runs: it ends when the queue does.)
  for (const [c, r] of queue)
    for (const [dc, dr] of NEIGHBORS) {
      const key = `${c + dc},${r + dr}`;
      if (!walkable(rows[r + dr]?.[c + dc]) || seen.has(key)) continue;
      seen.add(key);
      queue.push([c + dc, r + dr]);
    }
  return seen.size;
}

/**
 * A TEXT'S HASH (FNV-1a over its characters), as eight hexadecimal digits, as the engine's
 * `textHash`: two maps with the same hash are, all but surely, the same map.
 */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
