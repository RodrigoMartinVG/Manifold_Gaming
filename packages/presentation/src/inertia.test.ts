import { describe, expect, test } from 'vitest';
import { angleAt, decay, INERTIA_TIME } from './inertia';

describe('inertialization (stage 4b)', () => {
  test('an offset dies out: from its angle at its speed to nothing, with no speed and no acceleration left, never past 0', () => {
    const h = 1e-5;
    const speed = (o: ReturnType<typeof decay>, t: number) => (angleAt(o, t + h) - angleAt(o, t - h)) / (2 * h);
    const accel = (o: ReturnType<typeof decay>, t: number) =>
      (angleAt(o, t + h) - 2 * angleAt(o, t) + angleAt(o, t - h)) / (h * h);
    for (const [x0, v0] of [
      [1, 0],
      [0.5, -2],
      [1.2, -20],
      [0.3, 4],
    ] as const) {
      const o = decay(x0, v0);
      expect(angleAt(o, 0)).toBeCloseTo(x0, 12);
      // Moving away from 0, it is taken as still: it does not run on.
      expect(speed(o, 0)).toBeCloseTo(Math.min(v0, 0), 3);
      expect(o.t1).toBeLessThanOrEqual(INERTIA_TIME);
      const end = o.t1 - 2 * h;
      expect(angleAt(o, end)).toBeCloseTo(0, 6);
      expect(speed(o, end)).toBeCloseTo(0, 3);
      expect(Math.abs(accel(o, end))).toBeLessThan(0.5);
      expect(angleAt(o, o.t1)).toBe(0);
      for (let t = 0; t <= o.t1; t += o.t1 / 200) expect(angleAt(o, t)).toBeGreaterThanOrEqual(-1e-9);
    }
    // Shrinking fast already, it takes less: five times what that speed would take, at most.
    expect(decay(0.5, -20).t1).toBeCloseTo((5 * 0.5) / 20, 12);
  });
});
