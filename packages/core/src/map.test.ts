import { describe, expect, test } from 'vitest';
import { mapParts, type LevelMap } from './map';

const map = (rows: string[], legend: Record<string, string> = {}): LevelMap => ({
  origin: [0, 0, 0],
  cell: 2,
  height: 3,
  legend,
  rows,
});

describe('a level drawn as text (stage 3j)', () => {
  test('a room of 3 by 2 inside its walls: four walls, one floor; each wall as few boxes as rectangles', () => {
    const parts = mapParts(map(['#####', '#...#', '#...#', '#####']));
    const walls = parts.filter((p) => p.kind === 'wall');
    const floors = parts.filter((p) => p.kind === 'floor');
    // The top row; the left side, down to the bottom (read first, it takes the corner); the right
    // side, the same; and what is left of the bottom row.
    expect(walls).toHaveLength(4);
    expect(walls[0]).toEqual({ kind: 'wall', center: [5, 1.5, 1], half: [5, 1.5, 1] });
    expect(walls[1]).toEqual({ kind: 'wall', center: [1, 1.5, 5], half: [1, 1.5, 3] });
    expect(walls[3]).toEqual({ kind: 'wall', center: [5, 1.5, 7], half: [3, 1.5, 1] });
    // The floor: one slab of 3 by 2 cells, its top at 0.
    expect(floors).toEqual([{ kind: 'floor', center: [5, -0.25, 4], half: [3, 0.25, 2] }]);
  });

  test('a space is nothing (a pit), a letter with a zone is floor and that zone; the same map, the same parts', () => {
    const g = map(['#####', '#.G #', '#####'], { G: 'goal' });
    const parts = mapParts(g);
    expect(parts.filter((p) => p.kind === 'floor').map((p) => p.half)).toEqual([[2, 0.25, 1]]);
    expect(parts.filter((p) => p.kind === 'zone')).toEqual([
      { kind: 'zone', zone: 'goal', center: [5, 0.8, 3], half: [1, 0.8, 1] },
    ]);
    expect(mapParts(g)).toEqual(parts);
  });
});
