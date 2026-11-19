import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { runner } from '../rules';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the top: a ledge 3 m up, a chimney 3 m wide, a ferry to a landing and a lift from it, a chimney 3.6 m wide to a terrace 18 m up; a pillar, the last chimney 4.5 m wide to the summit 27 m up', async () => {
    const f = floorOf(5);
    const ferry = () => f.named('ferry').transform!.position;
    const lift = () => f.named('lift').transform!.position[1]! + 0.15;
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The ledge 3 m up, at the balcony's end; on it, chimney 1, up to terrace B.
    f.walkTo(0, 2.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 160)).toBe(true);
    f.walkTo(0, -5.4);
    f.chimney(9, AHEAD);
    expect(f.feet()).toBeGreaterThan(8.5);
    // The ferry, back at the terrace: a hop onto it; at its end, a hop onto the landing.
    f.walkTo(0, -9.6);
    f.go(NO_INPUT, () => ferry()[2]! < -15, 900);
    f.go(NO_INPUT, () => ferry()[2]! > -11.6, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -11.6; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-10.6);
    f.go(NO_INPUT, () => ferry()[2]! < -17.4, 600);
    for (let i = 0; i < 40 && f.at()[2]! > -19.6; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-18.8);
    // The lift, at the bottom: a hop onto it; at its top, onto the terrace; to the last chimney.
    f.go(NO_INPUT, () => lift() < 9.3, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -21.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift() > 14.85, 600);
    f.walkTo(0, -26.6);
    expect(f.feet()).toBeGreaterThan(14.5);
    f.walkTo(0, -30.4);
    f.chimney(18, AHEAD);
    // (Stage 5p) Across 2.5 m to a pillar; into the last chimney, 4.5 m wide, up it to the summit.
    f.walkTo(0, -34.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(17.5);
    f.walkTo(0, -39.4);
    f.jump(AHEAD, 8);
    f.chimney(27, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's top, played to its goal: a ledge, a chimney, a ferry, a landing, a lift, the last chimney.",
        'games/tower/src/references/floor-6.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-6.replay');
    f.session.world.dispose();
  });
});
