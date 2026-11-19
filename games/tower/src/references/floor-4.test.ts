import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { runner } from '../rules';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the third floor: a carousel, a faster one, a bar ridden half a turn, three turntables up to the goal', async () => {
    const f = floorOf(3);
    /** The bar's long side, from its yaw: along z (pointing this way and the other), |cos| near 0. */
    const barAcross = () => {
      const q = f.named('bar').transform!.rotation;
      return Math.abs(Math.cos(2 * Math.atan2(q[1]!, q[3]!)));
    };
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The carousel: off the balcony's edge onto it; near its far side; off it onto the landing.
    f.walkTo(0, 2.3);
    f.jump(AHEAD, 25);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -3);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-6.4);
    // The faster one, a meter up; off it onto the second landing, a meter higher.
    f.walkTo(0, -10.3);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -15.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(1.5);
    // The bar: as it comes to point this way, onto its end; ridden half a turn; off at the other side.
    f.walkTo(0, -24.3);
    f.go(NO_INPUT, () => barAcross() > 0.5, 900);
    f.go(NO_INPUT, () => barAcross() < 0.12, 900);
    f.walkTo(0, -25.6, 0.2, 40);
    f.go(NO_INPUT, () => f.at()[2]! < -34.3, 600);
    f.walkTo(0, -36.3, 0.2, 60);
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-35.4);
    // Three turntables, each a meter higher: onto each, to its middle, and on.
    f.walkTo(0, -39.3);
    for (const [name, z] of [
      ['turntable_1', -43],
      ['turntable_2', -46.5],
      ['turntable_3', -50],
    ] as const) {
      f.jump(AHEAD, 30);
      expect(
        f.go({ move: AHEAD }, () => f.c().grounded, 90),
        name,
      ).toBe(true);
      f.walkTo(0, z);
    }
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's third floor, played to its goal: two carousels, the bar, three turntables.",
        'games/tower/src/references/floor-4.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-4.replay');
    f.session.world.dispose();
  });
});
