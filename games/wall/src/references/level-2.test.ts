import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics } from '@manifold/core';
import { arsenal } from '@manifold/arms';
import { levelOf } from '../play';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

/**
 * EACH LEVEL PLAYED TO ITS WAY OUT (stage 5n, decision 0031: levels to advance through; stage 5o, levels of
 * floors above floors): as one who knows it would, fighting whoever comes in sight (aiming from the eyes at
 * the nearest, firing as often as its weapon lets: `pushTo`, `clear`), taking the weapons, the keys and the
 * secret, up the stairs, the lifts and the blocks, across the bridges and the ferries, through the doors the
 * keys open, to the way out. Every attacker down, never down itself. Its run, a reference replay.
 */
describe('the wall’s four levels, played to their way out (stage 5n; floors above floors since 5o)', () => {
  test(
    'the gatehouse: the hall, the chapel’s repeater and its secret, the cellar’s blue key, its lift to the gallery, the blue door, the red key',
    { timeout: 180_000 },
    async () => {
      const f = levelOf(1);
      f.pushTo(0, -4);
      f.pushTo(0, -9);
      f.clear();
      // The round chapel: up onto its altar, the repeater; a hand on its wall, the closet behind it.
      f.pushTo(-12, -16);
      f.pushTo(-15.5, -16);
      f.clear();
      f.walkTo(-16.6, -16);
      f.walkTo(-20, -16);
      expect(arsenal(f.me())!.owned).toContain('repeater');
      f.walkTo(-20, -13.5);
      f.walkTo(-23.3, -13.6);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.walkTo(-23.8, -16);
      f.walkTo(-26, -16);
      expect([f.h().secrets, f.h().armor]).toEqual([1, 50]);
      f.walkTo(-23.8, -16);
      f.walkTo(-22, -13.3);
      f.pushTo(-17, -13.3);
      f.pushTo(-14, -16);
      // Down the stair to the cellar: its blue key.
      f.pushTo(10, -8.3);
      f.walkTo(10, -14.6);
      expect(f.at()[1]).toBeLessThan(-1);
      f.pushTo(8, -18);
      f.clear();
      f.pushTo(8, -24.5);
      expect(f.h().keys).toBe(2);
      // The lift, 6 m up to the gallery; along it to the blue door, the wing upstairs: the red key.
      f.pushTo(10, -22);
      f.waitFor(() => f.at()[1]! > 3.7, 400);
      f.walkTo(10, -24.6);
      f.pushTo(12.5, -24.6);
      f.pushTo(12.5, -16);
      for (let i = 0; i < 90; i++) f.step();
      f.walkTo(16, -16);
      f.clear();
      f.pushTo(21, -13);
      expect(f.h().keys).toBe(3);
      // Round the gallery and down its stair, to the red door, and past it.
      f.pushTo(16, -16);
      f.pushTo(12.5, -16);
      f.pushTo(12.5, -24.6);
      f.pushTo(-13.5, -24.6);
      f.pushTo(-13.5, -10);
      f.walkTo(-11.5, -10);
      f.walkTo(-5.5, -10);
      f.pushTo(0, -25);
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(0, -29.5);
      f.clear(90);
      expect(f.pushTo(0, -39.5)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([15, 15, 0]);
      await expect(
        referenceText(
          f.session,
          'The gatehouse, played to its way out: the chapel, the cellar, the lift, two keys.',
          'games/wall/src/references/level-2.test.ts',
        ),
      ).toMatchFileSnapshot('../../replays/level-2.replay');
      f.session.world.dispose();
    },
  );
});
