import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics } from '@manifold/core';
import { arsenal, RELOAD } from '@manifold/arms';
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
    'the towers: the ferry over the moat, its secret, the west tower’s lift, the bridge between the tops, the yellow key, down the turning stair',
    { timeout: 180_000 },
    async () => {
      const f = levelOf(2);
      // The ferry: waited for at the bank, ridden across.
      f.pushTo(0, -4.5);
      f.pushTo(0, -8.4);
      f.waitFor(() => f.where('ferry')[2]! > -10.2);
      f.walkTo(0, -10, 0.15);
      f.waitFor(() => f.where('ferry')[2]! < -15.8, 300);
      f.walkTo(0, -18.5);
      f.clear();
      f.pushTo(-5, -19);
      expect(arsenal(f.me())!.owned).toContain('bolt');
      // Down into the moat; a hand at its west end, the armory under the bank; out by the stair east.
      f.walkTo(-19, -17.6);
      f.walkTo(-19, -15.5);
      for (let i = 0; i < 40; i++) f.step();
      f.walkTo(-19.5, -13);
      expect(f.at()[1]).toBeLessThan(-1);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.walkTo(-18, -9.6);
      f.walkTo(-18, -7);
      f.walkTo(-16.5, -7);
      expect([f.h().secrets, f.h().armor, arsenal(f.me())!.owned.includes('grenade')]).toEqual([1, 50, true]);
      f.walkTo(-18, -9.6);
      f.walkTo(-18, -13);
      f.pushTo(11.5, -13);
      f.walkTo(18.6, -13);
      // The west tower: its lift to the top, 6 m up, the longshot; the bridge to the east one's top.
      f.pushTo(18.6, -19);
      f.pushTo(-11, -21);
      f.walkTo(-11, -23.5);
      f.clear();
      f.walkTo(-11, -29, 0.15);
      f.waitFor(() => f.at()[1]! > 6.7, 400);
      f.walkTo(-13, -33);
      expect(arsenal(f.me())!.owned).toContain('longshot');
      f.pushTo(-7, -29);
      f.pushTo(7, -29);
      f.clear();
      f.walkTo(13, -32);
      expect(f.h().keys).toBe(4);
      // Its horn calls those who charge: darts in hand, reloaded, back across the bridge, they are met on it.
      f.take(2);
      f.step({ [RELOAD]: true });
      f.walkTo(6.5, -29);
      f.walkTo(-7.5, -29);
      f.clear(600);
      // Back over it, down the stair that turns back, out; the yellow door, and past it.
      f.walkTo(6.5, -29);
      f.walkTo(12, -23.6);
      f.walkTo(12, -29.6);
      f.walkTo(14, -30.6);
      f.walkTo(14, -29.6);
      f.walkTo(14, -24.3);
      f.walkTo(11, -21.5);
      f.walkTo(11, -19.5);
      f.pushTo(0, -19.5);
      f.clear(90);
      f.pushTo(0, -41);
      for (let i = 0; i < 90; i++) f.step();
      expect(f.pushTo(0, -52)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([12, 12, 0]);
      await expect(
        referenceText(
          f.session,
          'The towers, played to their way out: the ferry, the moat, the lift, the bridge.',
          'games/wall/src/references/level-3.test.ts',
        ),
      ).toMatchFileSnapshot('../../replays/level-3.replay');
      f.session.world.dispose();
    },
  );
});
