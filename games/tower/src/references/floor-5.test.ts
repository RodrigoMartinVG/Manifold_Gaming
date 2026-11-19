import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { runner } from '../rules';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the fourth floor: a wall’s ledge, one across a gap, a running jump to a pillar, a drop, a stair of ledges to the goal', async () => {
    const f = floorOf(4);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.walkTo(0, 2.6);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 160)).toBe(true);
    // Across 2 m, a block 2.5 m higher: its ledge, grabbed leaping.
    f.walkTo(0, -1.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 5, 160)).toBe(true);
    // A running jump across 4 m onto a pillar a meter higher.
    f.walkTo(0, -4.3);
    f.go({ move: AHEAD, run: true }, () => f.at()[2]! < -7.8, 60);
    for (let i = 0; i < 30; i++) f.step({ move: AHEAD, run: true, jump: true });
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 6, 160)).toBe(true);
    // Down 3 m onto the landing.
    f.walkTo(0, -13.8);
    f.jump(AHEAD, 20);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() < 4, 120)).toBe(true);
    // The stair of ledges, each 3 m higher a meter on.
    for (const [edge, top] of [
      [-19.7, 6.5],
      [-23.9, 9.5],
      [-28.9, 12.5],
      [-33.9, 15.5],
    ] as const) {
      f.walkTo(0, edge);
      f.jump(AHEAD, 40);
      expect(
        f.go({ move: AHEAD }, () => f.done() || (f.c().grounded && f.feet() > top - 0.5), 160),
        `up to ${top}`,
      ).toBe(true);
    }
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's fourth floor, played to its goal: ledges, a running jump, a drop, a stair of ledges.",
        'games/tower/src/references/floor-5.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-5.replay');
    f.session.world.dispose();
  });
});
