import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { runner } from '../rules';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the first floor: a chimney 2.4 m wide, 2.5 m across the void to a pillar, a ledge 3 m up, a chimney 3.2 m wide over nothing', async () => {
    const f = floorOf(1);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.go({ move: AHEAD }, () => f.at()[2]! < -5.4);
    f.chimney(6, AHEAD);
    expect(f.feet()).toBeGreaterThan(5.5);
    f.walkTo(0, -9.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 120)).toBe(true);
    expect(f.feet()).toBeGreaterThan(5.5);
    // To the pillar's edge, and at the block: its ledge, grabbed falling past it.
    f.walkTo(0, -14.1);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 8.5, 160)).toBe(true);
    f.walkTo(0, -19.6);
    f.jump(AHEAD, 8);
    f.chimney(15, AHEAD);
    // (Stage 5p) Across 2.5 m to a pillar; into a chimney 4 m wide over nothing, up it to the goal.
    f.walkTo(0, -27.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(14.5);
    f.walkTo(0, -32.4);
    f.jump(AHEAD, 8);
    f.chimney(24, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's first floor, played to its goal: two chimneys, a jump over the void, a ledge.",
        'games/tower/src/references/floor-2.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-2.replay');
    f.session.world.dispose();
  });
});
