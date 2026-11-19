import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { floorOf } from '../play';
import { runner } from '../rules';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the second floor: a ferry under a chimney hanging over the void, up it, and a lift to the goal 14 m up', async () => {
    const f = floorOf(2);
    const ferry = () => f.named('ferry').transform!.position;
    const lift = () => f.named('lift').transform!.position[1]! + 0.15;
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The ferry, coming back towards the balcony (it left as the floor began): a running start, a jump at
    // the edge, onto it as it comes; and still on it to the chimney's mouth.
    f.walkTo(0, 3.8);
    f.go(NO_INPUT, () => ferry()[2]! < -6, 900);
    f.go(NO_INPUT, () => ferry()[2]! > -3.6, 900);
    f.go({ move: AHEAD }, () => f.at()[2]! < 2.35, 60);
    f.jump(AHEAD, 30);
    f.go({ move: AHEAD }, () => f.c().grounded, 60);
    expect(f.c().grounded).toBe(true);
    expect(f.at()[2]!).toBeLessThan(1.5);
    // At the ferry's end, between the chimney's walls: up it.
    f.go(NO_INPUT, () => ferry()[2]! < -10.9, 600);
    f.chimney(10, AHEAD);
    expect(f.feet()).toBeGreaterThan(9.5);
    // The lift, level with the terrace: a hop onto it; up with it; off it at its top, onto the goal's terrace.
    f.walkTo(0, -19.6);
    f.go(NO_INPUT, () => Math.abs(lift() - 10) < 0.25, 900);
    // (A hop: let go at once; and on, to its middle.)
    for (let i = 0; i < 22 && f.at()[2]! > -21.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift() > 12.8, 600);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 120)).toBe(true);
    expect(f.feet()).toBeGreaterThan(13.5);
    // (Stage 5p) The ferry off the terrace's far edge, waited for: onto it, across, onto the landing; the
    // lift from it, waited for at the bottom, up to the goal.
    const ferry3 = () => f.named('ferry_3').transform!.position;
    const lift2 = () => f.named('lift_2').transform!.position[1]! + 0.15;
    f.walkTo(0, -27.6);
    f.go(NO_INPUT, () => ferry3()[2]! < -33, 900);
    f.go(NO_INPUT, () => ferry3()[2]! > -29.2, 900);
    for (let i = 0; i < 20 && f.at()[2]! > -28.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => ferry3()[2]! < -36.8, 600);
    for (let i = 0; i < 40 && f.at()[2]! > -38.8; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-38.2);
    f.walkTo(0, -41.6);
    f.go(NO_INPUT, () => lift2() < 14.3, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -42.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift2() > 19.8, 600);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's second floor, played to its goal: a ferry, a hanging chimney, a lift, a ferry, a lift.",
        'games/tower/src/references/floor-3.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/floor-3.replay');
    f.session.world.dispose();
  });
});
