import { describe, expect, test } from 'vitest';
import { levelFromText, levelToText } from '@manifold/core';
import { dungeon } from './dungeon';
import { ADVENTURE_ZONES } from './rules';

/** The cells a character can walk to from the start, through floor and zones (not walls, not nothing). */
function reachable(rows: string[], from: [number, number]) {
  const seen = new Set<string>([from.join(',')]);
  const queue = [from];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const cell = rows[r + dr]?.[c + dc];
      const key = `${c + dc},${r + dr}`;
      if (cell === undefined || cell === '#' || cell === ' ' || seen.has(key)) continue;
      seen.add(key);
      queue.push([c + dc, r + dr]);
    }
  }
  return seen;
}

describe('a dungeon from a seed (stage 3k)', () => {
  test('the same seed and depth, the same dungeon; another seed, or another depth, another', () => {
    expect(dungeon(7, 1)).toEqual(dungeon(7, 1));
    expect(dungeon(7, 1).rows).not.toEqual(dungeon(8, 1).rows);
    expect(dungeon(7, 1).rows).not.toEqual(dungeon(7, 2).rows);
  });

  test('a level the engine reads (format 7, with the adventure zones), and writes back the same', () => {
    for (const seed of [1, 2, 3, 42, 1000])
      for (const depth of [1, 3]) {
        const level = levelFromText(dungeon(seed, depth).text, { zones: ADVENTURE_ZONES });
        expect(levelFromText(levelToText(level), { zones: ADVENTURE_ZONES })).toEqual(level);
      }
  });

  test('from the start, everything can be reached: the key, the exit, every gem (for many seeds)', () => {
    for (let seed = 1; seed <= 60; seed++)
      for (const depth of [1, 2, 5]) {
        const d = dungeon(seed, depth);
        const start: [number, number] = [Math.floor(d.spawn[0] / 2), Math.floor(d.spawn[2] / 2)];
        const reach = reachable(d.rows, start);
        const all = (char: string) =>
          d.rows.flatMap((row, r) => [...row].flatMap((cell, c) => (cell === char ? [`${c},${r}`] : [])));
        const where = `seed ${seed}, depth ${depth}`;
        expect(all('E'), where).toHaveLength(1);
        expect(all('k'), where).toHaveLength(1);
        for (const cell of [...all('E'), ...all('k'), ...all('*')]) expect(reach.has(cell), `${where}: ${cell}`).toBe(true);
      }
  });

  test('deeper, more rooms: more gems', () => {
    const gems = (depth: number) => dungeon(5, depth).rows.join('').split('*').length - 1;
    expect(gems(4)).toBeGreaterThan(gems(1));
  });
});
