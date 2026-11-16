import { describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import {
  advance,
  CHARACTER_CLIPS,
  directions,
  finalWeights,
  footing,
  FOOTING,
  gestureWeight,
  newGait,
  strideAlong,
  STRIDES,
  targets,
  type Reading,
} from './locomotion';

/** A character standing, looking at −Z (the engine's forward), with "up" up: what each test changes. */
const reading = (over: Partial<Reading> = {}): Reading => ({
  mode: 'walk',
  grounded: true,
  up: [0, 1, 0],
  facing: [0, 0, -1],
  velocity: [0, 0, 0],
  vertical: 0,
  airJumps: 1,
  turning: 0,
  ...over,
});
const sum = (w: Partial<Record<string, number>>) => Object.values(w).reduce((a, b) => a! + b!, 0)!;
const at = (speed: number, degrees: number): Vec3 => {
  // A velocity on the ground, `degrees` from where it looks (to its right, positive).
  const r = (degrees * Math.PI) / 180;
  return [speed * Math.sin(r), 0, -speed * Math.cos(r)];
};

describe('how the model moves (stage 2e2)', () => {
  test('the four directions: the two nearest; with the same stride every way, half and half at 45°', () => {
    expect(directions(0)).toEqual({ forward: 1, right: 0, back: 0, left: 0 });
    expect(directions(90)).toEqual({ forward: 0, right: 1, back: 0, left: 0 });
    expect(directions(180)).toEqual({ forward: 0, right: 0, back: 1, left: 0 });
    expect(directions(-90)).toEqual({ forward: 0, right: 0, back: 0, left: 1 });
    const d = directions(45);
    expect([d.forward, d.right, d.back, d.left].map((x) => Number(x.toFixed(12)))).toEqual([0.5, 0.5, 0, 0]);
    const e = directions(-135);
    expect([e.forward, e.right, e.back, e.left].map((x) => Number(x.toFixed(12)))).toEqual([0, 0, 0.5, 0.5]);
    for (let a = -360; a <= 360; a += 7) expect(sum(directions(a, STRIDES.walk))).toBeCloseTo(1, 12);
  });

  test('mixed, the step goes where it walks: the weights from the strides, not from the angle alone', () => {
    // A foot on the ground in the mix goes back as the two cycles' would, weighted: each one's stride
    // along its direction. That sum points opposite to where it walks, at every angle, for both paces,
    // and is as long as the mix's stride.
    const towards: Record<string, [number, number]> = { forward: [1, 0], right: [0, 1], back: [-1, 0], left: [0, -1] };
    for (const pace of ['walk', 'run'] as const) {
      const s = STRIDES[pace];
      const length = { forward: s.forward, back: s.back, right: s.side, left: s.side } as Record<string, number>;
      for (let a = -180; a < 180; a += 5) {
        const w = directions(a, s) as Record<string, number>;
        let along = 0;
        let across = 0;
        for (const k of Object.keys(towards)) {
          along += w[k]! * length[k]! * towards[k]![0];
          across += w[k]! * length[k]! * towards[k]![1];
        }
        const r = (a * Math.PI) / 180;
        // Its direction, the walk's (to a millionth of a radian), and its length, the mix's stride.
        expect(
          Math.abs(Math.atan2(across, along) - Math.atan2(Math.sin(r), Math.cos(r))) % (2 * Math.PI),
          `${pace} at ${a}°`,
        ).toBeLessThan(1e-6);
        expect(Math.hypot(along, across), `${pace} at ${a}°`).toBeCloseTo(strideAlong(a, s), 9);
      }
    }
    // By the angle alone (2e2), at 45° between forward (2.64 m) and a side (1.36 m) the step went at 27°.
    expect((Math.atan2(0.5 * STRIDES.walk.side, 0.5 * STRIDES.walk.forward) * 180) / Math.PI).toBeCloseTo(27.3, 1);
    // Now the shorter side weighs more there, and the mix is shorter than either along its own axis.
    const diagonal = directions(45, STRIDES.walk);
    expect(diagonal.right).toBeGreaterThan(diagonal.forward);
    expect(strideAlong(45, STRIDES.walk)).toBeLessThan(STRIDES.walk.side);
  });

  test('on the ground, the cycle of where it really goes: forward, back, each side, walking or running', () => {
    const g = { angle: 0, climbAngle: 0 };
    expect(targets(reading({ velocity: at(4.5, 0) }), g).walk).toBeCloseTo(1, 9);
    expect(targets(reading({ velocity: at(4.5, 180) }), g).walk_back).toBeCloseTo(1, 9);
    expect(targets(reading({ velocity: at(4.5, 90) }), g).walk_right).toBeCloseTo(1, 9);
    expect(targets(reading({ velocity: at(4.5, -90) }), g).walk_left).toBeCloseTo(1, 9);
    expect(targets(reading({ velocity: at(7.5, -90) }), g).run_left).toBeCloseTo(1, 9);
    // Between the paces, half and half; between two directions, as `directions` weighs them.
    const between = targets(reading({ velocity: at(6, 0) }), g);
    expect([between.walk, between.run]).toEqual([0.5, 0.5]);
    const diagonal = targets(reading({ velocity: at(4.5, 45) }), g);
    expect(diagonal.walk).toBeCloseTo(directions(45, STRIDES.walk).forward, 9);
    expect(diagonal.walk_right).toBeCloseTo(directions(45, STRIDES.walk).right, 9);
  });

  test('each foot is down a quarter of the cycle, the right one around 0.25 and the left around 0.75', () => {
    const g = newGait();
    for (let i = 0; i < 60; i++) advance(g, reading({ velocity: at(4.5, 0) }), 1 / 60);
    const at_ = (phase: number) => {
      g.phase = phase;
      return [footing(g, 'L', true), footing(g, 'R', true)];
    };
    expect(FOOTING.stance).toBe(0.25);
    expect(at_(0.25)).toEqual(['up', 'down']);
    expect(at_(0.75)).toEqual(['down', 'up']);
    expect(at_(0.13)).toEqual(['up', 'down']);
    expect(at_(0.4)).toEqual(['up', 'lifting']);
    expect(at_(0.9)).toEqual(['lifting', 'up']);
    expect(at_(0.5)).toEqual(['up', 'up']);
    // In the air, or not walking (quiet, climbing), no foot is down.
    expect(footing(g, 'R', false)).toBe('up');
    g.phase = 0.25;
    const still = newGait();
    still.phase = 0.25;
    expect(footing(still, 'R', true)).toBe('up');
  });

  test('still, it is quiet; turning on the spot, it steps; and the weights always add up to 1', () => {
    const g = { angle: 0, climbAngle: 0 };
    expect(targets(reading(), g).idle).toBe(1);
    expect(targets(reading({ turning: 180 }), g).turn).toBe(1);
    expect(targets(reading({ turning: -45 }), g).turn).toBe(0.5);
    for (const r of [
      reading(),
      reading({ velocity: at(0.5, 30) }),
      reading({ velocity: at(3, -120), turning: 200 }),
      reading({ velocity: at(9, 170) }),
      reading({ mode: 'air', grounded: false, vertical: 0.5 }),
      reading({ mode: 'climb', grounded: false, velocity: [1, 1.5, 0] }),
      reading({ mode: 'glide', grounded: false }),
    ])
      expect(sum(targets(r, g))).toBeCloseTo(1, 12);
  });

  test('climbing, up or to a side along the wall, by the angle of its motion on it', () => {
    const g = { angle: 0, climbAngle: 0 };
    const climbing = (velocity: Vec3) => targets(reading({ mode: 'climb', grounded: false, velocity }), g);
    expect(climbing([0, 2.5, 0])).toEqual({ climb: 1, climb_right: 0 });
    const right = climbing([1.77, 1.77, 0]); // up and to its right, as the Dojo climbs pushing at 45°
    expect(right.climb).toBeCloseTo(0.5, 6);
    expect(right.climb_right).toBeCloseTo(0.5, 6);
    expect(climbing([-2.5, 0, 0]).climb_left).toBe(1);
    // Holding still on the wall (it does not, today: letting go, it falls), it keeps the last direction.
    expect(climbing([0, 0, 0])).toEqual({ climb: 1, climb_right: 0 });
  });

  test('in the air, rising and then falling, by its vertical speed', () => {
    const g = { angle: 0, climbAngle: 0 };
    const air = (vertical: number) => targets(reading({ mode: 'air', grounded: false, vertical }), g);
    expect(air(6)).toEqual({ rise: 1, fall: 0 });
    expect(air(-3)).toEqual({ rise: 0, fall: 1 });
    expect(air(1)).toEqual({ rise: 0.5, fall: 0.5 });
  });

  test('the cycle advances with the distance really travelled: against a wall, or paused, it does not move', () => {
    const g = newGait();
    // One second walking forward at 4.5 m/s, in 60 frames: 4.5 m over a cycle of 2.64 m.
    for (let i = 0; i < 60; i++) advance(g, reading({ velocity: at(4.5, 0) }), 1 / 60);
    expect(g.phase).toBeCloseTo((4.5 / STRIDES.walk.forward) % 1, 6);
    expect(g.weights.walk).toBeGreaterThan(0.99);
    // Pushing against a wall: the view reads that it did not move (models.ts: motion), and the cycle
    // stays where it was, the weights going back to quiet.
    const phase = g.phase;
    for (let i = 0; i < 60; i++) advance(g, reading(), 1 / 60);
    expect(g.phase).toBe(phase);
    expect(g.weights.idle).toBeGreaterThan(0.99);
    // Paused (no time for the world), nothing changes, however it moved.
    const before = structuredClone(g);
    advance(g, reading({ velocity: at(7.5, 90) }), 0);
    expect(g).toEqual(before);
    for (const clip of CHARACTER_CLIPS) expect(Number.isFinite(g.weights[clip])).toBe(true);
  });

  test('the jump in the air is a somersault, over the rest; a hard landing weighs, a small hop does not', () => {
    const g = newGait({ flip: 0.4, land: 0.3 });
    advance(g, reading({ mode: 'air', grounded: false, vertical: 3, airJumps: 1 }), 1 / 60);
    advance(g, reading({ mode: 'air', grounded: false, vertical: 6, airJumps: 0 }), 1 / 60);
    expect(g.gesture?.clip).toBe('flip');
    for (let i = 0; i < 6; i++) advance(g, reading({ mode: 'air', grounded: false, vertical: 5, airJumps: 0 }), 1 / 60);
    expect(gestureWeight(g)).toBe(1);
    expect(sum(finalWeights(g))).toBeCloseTo(1, 12);
    expect(finalWeights(g).flip).toBe(1);
    // It lasts as long as its animation (0.4 s here), and it is over.
    for (let i = 0; i < 24; i++) advance(g, reading({ mode: 'air', grounded: false, vertical: -2, airJumps: 0 }), 1 / 60);
    expect(g.gesture).toBeNull();
    // Coming down at 8 m/s: a landing, strong; from a hop at 2 m/s, none.
    advance(g, reading({ mode: 'air', grounded: false, vertical: -8, airJumps: 0 }), 1 / 60);
    advance(g, reading({ airJumps: 1 }), 1 / 60);
    expect(g.gesture).toMatchObject({ clip: 'land', strength: 0.8 });
    // Each one counted as it starts (what the browser tests read), however few frames show it.
    expect(g.started).toEqual({ count: 2, clip: 'land' });
    const hop = newGait();
    advance(hop, reading({ mode: 'air', grounded: false, vertical: -2 }), 1 / 60);
    advance(hop, reading(), 1 / 60);
    expect(hop.gesture).toBeNull();
    expect(hop.started).toEqual({ count: 0, clip: null });
  });

  test('a landing seen at three frames per second still starts, and is counted (stage 3b)', () => {
    // Its weight comes in from nothing, and its 0.3 s are over by the next frame: it never weighs most.
    const g = newGait({ flip: 0.4, land: 0.3 });
    advance(g, reading({ mode: 'air', grounded: false, vertical: -9, airJumps: 0 }), 1 / 3);
    advance(g, reading({ airJumps: 1 }), 1 / 3);
    expect(finalWeights(g).land).toBe(0);
    advance(g, reading({ airJumps: 1 }), 1 / 3);
    expect(g.gesture).toBeNull();
    expect(g.started).toEqual({ count: 1, clip: 'land' });
  });
});
