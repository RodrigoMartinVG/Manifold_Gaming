import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { initPhysics } from './physics';
import type { Shape } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A field of 4 × 2 cells over 8 m along X and 4 m along Z, centered at the origin: its height is h(x, z), at each corner. */
function field(h: (x: number, z: number) => number, fixEdges = false): Shape {
  const cols = 4;
  const rows = 2;
  const heights: number[] = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) heights.push(h(-4 + 2 * j, -2 + 2 * i));
  return { kind: 'heightfield', cols, rows, heights, size: [8, 1, 4], ...(fixEdges ? { fixEdges } : {}) };
}

describe('a height field, a shape of the engine (the forest’s F0a)', () => {
  test('its heights are where they say: along X, along Z, between corners on the plane they make', () => {
    // A plane rising 0.25 m per meter along X and 0.5 m along Z: one of its corners read the wrong way
    // round (rows for columns, or a column-major matrix read by rows) puts a ray's hit elsewhere.
    const world = new World({ seed: 1 });
    const ground = world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: field((x, z) => 0.25 * x + 0.5 * z) },
    });
    world.step();
    for (const [x, z] of [
      [-3, -1],
      [3, -1],
      [-3, 1.5],
      [2.5, 1],
      [0.3, -0.7],
    ] as const) {
      const hit = world.castRay([x, 10, z], [0, -1, 0], 20)!;
      expect(hit.entity, `${x} ${z}`).toBe(ground.id);
      expect(hit.point[1], `${x} ${z}`).toBeCloseTo(0.25 * x + 0.5 * z, 4);
    }
    // Off its edges, nothing.
    expect(world.castRay([4.5, 10, 0], [0, -1, 0], 20)).toBeNull();
    expect(world.castRay([0, 10, 2.5], [0, -1, 0], 20)).toBeNull();
    world.dispose();
  });

  test('its heights scale by its size’s Y; a ball dropped on it comes to rest on it, with or without its edges fixed', () => {
    for (const fixEdges of [false, true]) {
      const world = new World({ seed: 1 });
      world.createEntity({
        transform: { position: [0, 0, 0], rotation: quat.identity() },
        body: {
          type: 'fixed',
          shape: { ...(field(() => 1, fixEdges) as Extract<Shape, { kind: 'heightfield' }>), size: [8, 2, 4] },
        },
      });
      const ball = world.createEntity({
        transform: { position: [0.5, 4, 0.5], rotation: quat.identity() },
        body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 } },
      });
      for (let i = 0; i < 180; i++) world.step();
      expect(ball.transform!.position[1], `fixEdges ${fixEdges}`).toBeCloseTo(2.25, 2);
      world.dispose();
    }
  });
});
