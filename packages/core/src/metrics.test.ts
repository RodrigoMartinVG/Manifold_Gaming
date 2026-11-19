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

  test('the platformer’s jump (stage 5c): exactly its 2 m at step 24, back at step 45 (it falls 1.5 times as hard), 3.375 m on walking', () => {
    const arc = { height: 2, time: 0.42, release: 2.5, fall: 1.5, terminal: 16, corner: 0.25 };
    const p = metricsOf({ ...DEFAULT_MOVEMENT, arc }, BODY, 9.81);
    expect(p.jump).toMatchObject({ top: 24, back: 45 });
    expect(p.jump.height).toBeCloseTo(2, 12);
    expect([p.jump.gravity, p.jump.speed]).toEqual([24, 10]);
    expect(p.reach.walk).toBeCloseTo((4.5 * 45) / 60, 12);
    // Its hands at the top of the jump: its feet 2 m and 2 cm up, its middle 0.8 over them, its hands 0.5 over that.
    expect(p.ledge).toBeCloseTo(2 + 0.02 + 0.8 + 0.5, 12);
    expect(p.wall).toMatchObject({ slide: 2.5, off: 6 });
    // The widest gap between two walls it climbs walking (the gym: up to 4 m, not 4.5): 6 m/s for the
    // jump's step and the 14 its lock keeps, then steered down to 4.5 at 14 m/s², for the jump's 45 steps.
    expect(p.wall.chimney).toBeCloseTo(4.4583, 4);
  });

  test('(stage 5p) hung 0.08 s at its top, the jump held: the same 2 m at step 24, back 5 steps later, at 50; 3.75 m on walking; chimneys to 4.83 m', () => {
    const arc = { height: 2, time: 0.42, release: 2.5, fall: 1.5, terminal: 16, corner: 0.25, hang: 0.08 };
    const p = metricsOf({ ...DEFAULT_MOVEMENT, arc }, BODY, 9.81);
    expect(p.jump).toMatchObject({ top: 24, back: 50 });
    expect(p.jump.height).toBeCloseTo(2, 12);
    expect(p.reach.walk).toBeCloseTo((4.5 * 50) / 60, 12);
    expect(p.ledge).toBeCloseTo(2 + 0.02 + 0.8 + 0.5, 12);
    // The same sums for 50 steps: 4.5 m/s steered, five steps more (the gym: up to 4.5 m, not 5).
    expect(p.wall.chimney).toBeCloseTo(4.4583 + (5 * 4.5) / 60, 4);
  });
});
