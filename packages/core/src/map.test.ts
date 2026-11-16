import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { buildLevel, floorOnly, levelFromText } from './level';
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

  test('an irregular floor (stage 4a): its slabs are one body, and what rolls or slides across their seams does not hop or trip', () => {
    // A hall with two pits: its floor is three slabs (pits break the rectangles), and the ball's way
    // along the middle row crosses two seams, at x = 4 and x = 14.
    const rows = ['  #####  ', '###...###', '#.......#', '###...###', '  #####  '];
    expect(mapParts(map(rows)).filter((p) => p.kind === 'floor')).toHaveLength(3);
    // A ball rolling at 6 m/s, or a box sliding at 11 m/s, along the middle row: how high it went, and
    // whether it got across (a box that trips tumbles and stops short).
    const across = (world: World, what: 'ball' | 'box') => {
      const thing = world.createEntity({
        transform: { position: [3, 0.25, 5], rotation: quat.identity() },
        body:
          what === 'ball'
            ? { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 }, linearVelocity: [6, 0, 0], angularVelocity: [0, 0, -24] }
            : {
                type: 'dynamic',
                shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] },
                linearVelocity: [11, 0, 0],
                friction: 0.05,
              },
      });
      // (Across: past the second seam, at x = 14, with all of it.)
      let top = 0;
      for (let i = 0; i < 600 && thing.transform!.position[0] < 14.5; i++) {
        world.step();
        top = Math.max(top, thing.transform!.position[1] - 0.25);
      }
      return { top, across: thing.transform!.position[0] >= 14.5 };
    };
    const roll = (world: World) => {
      const r = across(world, 'ball');
      world.dispose();
      return r.top;
    };
    // The slabs as bodies of their own, as before: the ball hops at the seams.
    const apart = new World({ seed: 1 });
    for (const p of mapParts(map(rows)))
      if (p.kind !== 'zone')
        apart.createEntity({
          transform: { position: p.center, rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: p.half } },
        });
    expect(roll(apart)).toBeGreaterThan(0.01);
    // Built from the level: the floor is one entity, a compound of the three slabs, and the ball rolls flat.
    const text = `# Manifold level 7\nmap 0 0 0  2 3\n${rows.join('\n')}\nend\n`;
    const level = levelFromText(text);
    const world = new World({ seed: 1 });
    buildLevel(world, level);
    const floors = [...world.entities.values()].filter((e) => e.body?.shape.kind === 'compound');
    expect(floors).toHaveLength(1);
    // It keeps the map of floor alone, which builds the same floor again when the world is written back.
    expect(floors[0]!.source).toEqual({ map: floorOnly(level.maps[0]!) });
    expect(roll(world)).toBeLessThan(0.002);
    // And a box sliding across: on the same slabs apart it trips; on the floor as one body, it slides on.
    const apartAgain = new World({ seed: 1 });
    for (const p of mapParts(map(rows)))
      if (p.kind !== 'zone')
        apartAgain.createEntity({
          transform: { position: p.center, rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: p.half } },
        });
    expect(across(apartAgain, 'box').top).toBeGreaterThan(0.05); // it trips, and tumbles
    apartAgain.dispose();
    const built = new World({ seed: 1 });
    buildLevel(built, level);
    const slid = across(built, 'box');
    expect(slid.top).toBeLessThan(0.002);
    expect(slid.across).toBe(true);
    built.dispose();
  });
});
