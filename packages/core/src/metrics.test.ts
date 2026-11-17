import { describe, expect, test } from 'vitest';
import { DEFAULT_MOVEMENT } from './character';
import { metricsOf } from './metrics';

const BODY = { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } as const;

describe('what a character can do, in meters (stage 5a)', () => {
  const m = metricsOf(DEFAULT_MOVEMENT, BODY, 9.81);

  test('the jump, as the step integrates it: highest at step 39, 2.0995 m; back where it left at step 79', () => {
    expect(m.jump.top).toBe(39);
    expect(m.jump.height).toBeCloseTo(2.0995, 4);
    expect(m.jump.back).toBe(79);
    // The continuous v²/2g, and the step's: lower by about v Δt / 2.
    expect(m.jump.continuous).toBeCloseTo(2.1534, 4);
    expect(m.jump.continuous - m.jump.height).toBeCloseTo(6.5 / 60 / 2, 2);
  });

  test('how far a jump carries its center, walking and running; its step, its slope, its size', () => {
    expect(m.reach.walk).toBeCloseTo((4.5 * 79) / 60, 9);
    expect(m.reach.run).toBeCloseTo((7.5 * 79) / 60, 9);
    expect([m.step, m.slope]).toEqual([0.35, 30]);
    expect(m.climb).toBe(50);
    expect([m.width, m.tall, m.crouched]).toEqual([0.6, 1.6, 1]);
    // Crouched as its game's body is (the games' character: 1.1 m).
    expect(
      metricsOf(DEFAULT_MOVEMENT, BODY, 9.81, { crouch: { kind: 'capsule', halfHeight: 0.25, radius: 0.3 } }).crouched,
    ).toBeCloseTo(1.1, 9);
  });

  test('a softer jump (a game’s, 5c): a meter, in its own steps', () => {
    const soft = metricsOf({ ...DEFAULT_MOVEMENT, jump: { ...DEFAULT_MOVEMENT.jump, speed: 4.5 } }, BODY, 9.81);
    expect(soft.jump.height).toBeGreaterThan(0.95);
    expect(soft.jump.height).toBeLessThan(1.04);
    expect(soft.jump.back).toBeLessThan(m.jump.back);
  });
});
