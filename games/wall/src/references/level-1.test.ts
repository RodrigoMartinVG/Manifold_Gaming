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
    'the wall walk: the yard, up to its balcony, the armory, the bridge over the court, the dais’s red key, down through it, the red door',
    { timeout: 180_000 },
    async () => {
      const f = levelOf(0);
      f.pushTo(0, -4);
      f.pushTo(0, -8);
      f.clear();
      // Up the stair to the west balcony, 3 m up; along it into the armory: the shotgun.
      f.pushTo(-13, -6.5);
      f.walkTo(-13, -13.5);
      expect(f.at()[1]).toBeGreaterThan(3.5);
      f.pushTo(-13.5, -21.5);
      f.pushTo(-13.5, -24.5);
      f.pushTo(-10, -32);
      expect(arsenal(f.me())!.owned).toContain('shotgun');
      // The bridge over the inner court, into the round tower, onto its dais: the red key.
      f.pushTo(-5, -30);
      f.pushTo(8.5, -30);
      expect(f.at()[1]).toBeGreaterThan(3.5);
      f.clear();
      f.pushTo(12, -33);
      expect(f.h().keys).toBe(1);
      // Down the stair that rises through the dais; under it, to the red door, and past it.
      f.walkTo(12, -30.5);
      f.walkTo(12, -24.8);
      f.clear();
      f.pushTo(14.8, -26);
      f.pushTo(14.8, -34);
      f.pushTo(12, -35);
      f.clear();
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(12, -38);
      f.clear(90);
      expect(f.pushTo(12, -44.5)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([12, 12, 0]);
      await expect(
        referenceText(
          f.session,
          'The wall walk, played to its way out: the balcony, the armory, the bridge, the dais.',
          'games/wall/src/references/level-1.test.ts',
        ),
      ).toMatchFileSnapshot('../../replays/level-1.replay');
      f.session.world.dispose();
    },
  );
});
