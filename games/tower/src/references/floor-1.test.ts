import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the entrance: a hop, a ledge 3 m up, a chimney to the terrace 6 m up; three pillars (a running jump), a ledge, a chimney to the goal 15 m up', async () => {
    const f = floorOf(0);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.go({ move: AHEAD }, () => f.at()[2]! < 4.2);
    f.jump(AHEAD, 25);
    f.go({ move: AHEAD }, () => f.at()[2]! < -0.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 120)).toBe(true);
    f.go({ move: AHEAD }, () => f.c().grounded && f.at()[2]! < -12.5);
    f.chimney(6, AHEAD);
    // (Stage 5p) From the terrace: a pillar 2 m off; one a meter lower; one 4.5 m off, a running jump away.
    f.walkTo(0, -17.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -21.7);
    f.jump(AHEAD, 25);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(4.5);
    f.walkTo(0, -24.3);
    f.go({ move: AHEAD, run: true }, () => f.at()[2]! < -25.8, 60);
    for (let i = 0; i < 30; i++) f.step({ move: AHEAD, run: true, jump: true });
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(5.5);
    // The block's ledge, 3 m up across 1.5 m; its chimney, to the goal.
    f.walkTo(0, -34.3);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 8.5, 160)).toBe(true);
    f.walkTo(0, -43.4);
    f.chimney(15, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    await expect(
      referenceText(
        f.session,
        "The tower's entrance, played to its goal: a hop, a ledge, a chimney.",
        'games/tower/src/references/floor-1.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-1.replay');
    f.session.world.dispose();
  });
});
