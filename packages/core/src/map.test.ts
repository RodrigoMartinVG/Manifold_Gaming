import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { mapParts, type LevelMap } from './map';
import { initPhysics } from './physics';
import { World } from './world';

beforeAll(initPhysics);

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
    // The floor: one slab under the room and its walls, its top at 0.
    expect(floors).toEqual([{ kind: 'floor', center: [5, -0.25, 4], half: [5, 0.25, 4] }]);
  });

  test('a space is nothing (a pit), a letter with a zone is floor and that zone; the same map, the same parts', () => {
    const g = map(['#####', '#.G #', '#####'], { G: 'goal' });
    const parts = mapParts(g);
    // Under the walls too, around the pit: the top row; the first three columns of the rest; the last
    // column; and the wall under the pit.
    expect(parts.filter((p) => p.kind === 'floor').map((p) => p.half)).toEqual([
      [5, 0.25, 1],
      [3, 0.25, 2],
      [1, 0.25, 2],
      [1, 0.25, 1],
    ]);
    expect(parts.filter((p) => p.kind === 'zone')).toEqual([
      { kind: 'zone', zone: 'goal', center: [5, 0.8, 3], half: [1, 0.8, 1] },
    ]);
    expect(mapParts(g)).toEqual(parts);
  });

  test('a ball rolling along a corridor between walls does not hop: one slab under them, no seams', () => {
    // Walls standing in the floor every other cell: drawn only between them, the corridor's floor was
    // five slabs, and a ball at 6 m/s hopped at the seams (35 cm).
    const g = map(['#######', '#.#.#.#', '#.....#', '#######']);
    expect(mapParts(g).filter((p) => p.kind === 'floor')).toHaveLength(1);
    const world = new World({ seed: 1 });
    for (const p of mapParts(g))
      if (p.kind !== 'zone')
        world.createEntity({
          transform: { position: p.center, rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: p.half } },
        });
    const ball = world.createEntity({
      transform: { position: [3, 0.25, 5], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 }, linearVelocity: [6, 0, 0], angularVelocity: [0, 0, -24] },
    });
    let top = 0;
    while (ball.transform!.position[0] < 10.5) {
      world.step();
      top = Math.max(top, ball.transform!.position[1] - 0.25);
    }
    expect(top).toBeLessThan(0.002);
    world.dispose();
  });
});
