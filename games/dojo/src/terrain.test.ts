import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { initPhysics, World, type Shape } from '@manifold/core';
import { fieldFrom, hills, noise, terrainProbe } from './terrain';

beforeAll(initPhysics);

/**
 * THE TERRAIN'S MEASURES (the forest's F0a, decision 0032). The probe's hash in every browser is the browser
 * tests' ("La misma huella"); here, what Node holds of it, and what a cell's edge does to what crosses it.
 */
describe('the terrain’s measures (the forest’s F0a)', () => {
  test('the noise is in [0, 1) and smooth; the probe steps to the same hash twice, another with its edges fixed', () => {
    for (let k = 0; k < 200; k++) {
      const v = noise(3, k * 0.37 - 20, k * 0.11 - 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // Continuous across a lattice line: the same value on both sides of it.
    expect(noise(3, 2 - 1e-9, 0.5)).toBeCloseTo(noise(3, 2, 0.5), 6);
    expect(hills(7)(0, 0)).toBe(hills(7)(0, 0));
    const asTheyCome = terrainProbe(false);
    expect(asTheyCome).toMatch(/^[0-9a-f]{8}$/);
    expect(terrainProbe(false)).toBe(asTheyCome);
    expect(terrainProbe(true)).not.toBe(asTheyCome);
  });

  /**
   * A ball rolled and a box slid at 8 m/s across 1 m cells, flat and on a slope of about 10°: how high above
   * the surface they get, after the first ten steps. Measured (2026-11-19): with the edges as they come, the
   * ball hops up to 22 cm and the box up to 35 cm flat and 55 cm on the slope; with them fixed, under a
   * centimeter, as on a box. What makes F0a point F1 at `fixEdges`.
   */
  test('what crosses a cell’s edge hops when its edges come as they are, and stays on it when they are fixed', () => {
    const highest = (floor: Shape, slope: number, thing: 'ball' | 'box') => {
      const world = new World({ seed: 1 });
      world.createEntity({
        transform: { position: [0, 0, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: floor },
      });
      const shape: Shape = thing === 'ball' ? { kind: 'ball', radius: 0.3 } : { kind: 'box', halfExtents: [0.3, 0.3, 0.3] };
      const e = world.createEntity({
        transform: { position: [-20, -20 * slope + 0.301, 0.37], rotation: quat.identity() },
        body: { type: 'dynamic', shape, linearVelocity: [8, 8 * slope, 0] as Vec3 },
      });
      let most = 0;
      for (let i = 0; i < 150; i++) {
        world.step();
        const p = e.transform!.position;
        if (i > 10) most = Math.max(most, p[1] - (slope * p[0] + 0.3));
      }
      world.dispose();
      return most;
    };
    for (const slope of [0, 0.18])
      for (const thing of ['ball', 'box'] as const) {
        const field = (fixEdges: boolean) => fieldFrom(64, 64, (x) => slope * x, fixEdges);
        expect(highest(field(false), slope, thing), `${thing} on ${slope}, as they come`).toBeGreaterThan(0.1);
        expect(highest(field(true), slope, thing), `${thing} on ${slope}, fixed`).toBeLessThan(0.01);
      }
  });
});
