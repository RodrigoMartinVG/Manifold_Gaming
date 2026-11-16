import { describe, expect, test } from 'vitest';
import { levelFromText, levelToText } from '@manifold/core';
import { CHECKED_DUNGEONS, dungeon, textHash } from './dungeon';
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

  test('the checked dungeons are the same as when they were made: their hashes, fixed here', () => {
    // The same hash in Node and in the browsers says they all run the same code, not that the code is
    // the one that made them: a change to the generator, even by mistake, would make other dungeons
    // everywhere, and a saved game would come back to another one. Changing these is changing the
    // dungeons: only on purpose, saying so to the saved games (decision 0020).
    const fixed: Record<string, string> = {
      '1 1': 'd7809188',
      '1 3': '9887d3cd',
      '7 1': 'ba7d4909',
      '7 2': 'b6ec7673',
      '42 1': 'caa250d5',
      '42 5': 'a608a906',
    };
    expect(CHECKED_DUNGEONS.map(([seed, depth]) => `${seed} ${depth}`)).toEqual(Object.keys(fixed));
    for (const [seed, depth] of CHECKED_DUNGEONS)
      expect(textHash(dungeon(seed, depth).text), `seed ${seed}, depth ${depth}`).toBe(fixed[`${seed} ${depth}`]);
  });

  test('where only one or two rooms fit, the key is still there, and the exit, and neither where it starts', () => {
    // A grid of 8 cells holds one room; of 9, one to four. (At the real sizes, 21 cells and more, none
    // of the 180 dungeons above has fewer than three: the case is a small grid's, not a seed's.)
    for (const size of [8, 9])
      for (let seed = 1; seed <= 100; seed++) {
        const d = dungeon(seed, 1, size);
        const start: [number, number] = [Math.floor(d.spawn[0] / 2), Math.floor(d.spawn[2] / 2)];
        const where = `size ${size}, seed ${seed}`;
        expect(d.rows[start[1]]![start[0]], `${where}: where it starts`).toBe('.');
        const reach = reachable(d.rows, start);
        for (const char of ['E', 'k']) {
          const cells = d.rows.flatMap((row, r) => [...row].flatMap((cell, c) => (cell === char ? [`${c},${r}`] : [])));
          expect(cells, `${where}: ${char}`).toHaveLength(1);
          expect(reach.has(cells[0]!), `${where}: ${char} reached`).toBe(true);
        }
      }
  });

  test('deeper, more rooms: more gems', () => {
    const gems = (depth: number) => dungeon(5, depth).rows.join('').split('*').length - 1;
    expect(gems(4)).toBeGreaterThan(gems(1));
  });
});
