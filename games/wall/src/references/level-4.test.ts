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
    'the gate: the hall’s brute, the shelf jumped up to (the launcher), the flame lance, the closet, the court, the ferry on the rampart, the turret, the hoist',
    { timeout: 180_000 },
    async () => {
      const f = levelOf(3);
      f.pushTo(0, -4);
      f.pushTo(0, -7);
      f.clear();
      // The armory: up the blocks, a meter each, onto the shelf: the launcher.
      f.pushTo(-8, -12.5);
      f.pushTo(-14.5, -12.5);
      f.walkTo(-15.2, -17);
      f.hop(-17, -17);
      f.hop(-19, -17);
      f.hop(-21.5, -17.5);
      f.walkTo(-22.5, -17.5);
      expect(f.at()[1]).toBeGreaterThan(3.5);
      expect(arsenal(f.me())!.owned).toContain('launcher');
      f.walkTo(-21.5, -15.8);
      f.walkTo(-19, -12.5);
      // The east room: the flame lance; a hand in it, the closet south.
      f.pushTo(-12.5, -12.5);
      f.pushTo(12.5, -12.5);
      f.pushTo(15, -12.5);
      f.clear();
      f.pushTo(18, -13);
      f.pushTo(16, -16);
      expect(arsenal(f.me())!.owned).toContain('flamer');
      f.pushTo(23.3, -7.2);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.walkTo(21, -4.5);
      f.walkTo(21, -2.5);
      expect([f.h().secrets, f.h().armor]).toEqual([1, 50]);
      f.walkTo(21, -4.5);
      f.walkTo(21, -8);
      // The court: those who come out of the gatehouse, with darts.
      f.take(2);
      f.pushTo(12.5, -12.5);
      f.pushTo(0, -15);
      f.pushTo(0, -23);
      f.clear(90);
      // Up the west stair to the rampart; the ferry across its break; along the north one to the turret.
      f.pushTo(-23, -21.5);
      f.walkTo(-23, -28.6);
      expect(f.at()[1]).toBeGreaterThan(3.5);
      f.walkTo(-22.5, -31.6);
      f.waitFor(() => f.where('ferry')[2]! > -33.2);
      f.walkTo(-22.5, -33, 0.15);
      f.waitFor(() => f.where('ferry')[2]! < -36.8, 300);
      f.walkTo(-22.5, -39.5);
      f.pushTo(-22.5, -49.5);
      f.pushTo(18.5, -49.5);
      f.walkTo(19, -51.5);
      f.walkTo(19, -56);
      expect(f.h().keys).toBe(1);
      // Those the turret's horn calls come along the rampart: the launcher.
      f.walkTo(19, -51.5);
      f.take(6);
      f.clear(90);
      // The red door, the gatehouse's upper floor, the platform up to the winch room: the way out.
      f.walkTo(19, -49.5);
      f.pushTo(0.5, -49.5);
      f.clear(60);
      for (let i = 0; i < 90; i++) f.step();
      f.walkTo(0.5, -52.5);
      f.waitFor(() => f.where('hoist')[1]! < 2.9);
      f.walkTo(0, -55, 0.15);
      f.waitFor(() => f.where('hoist')[1]! > 5.8, 400);
      expect(f.walkTo(2, -57)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([12, 12, 0]);
      await expect(
        referenceText(
          f.session,
          'The gate, played to its way out: the shelf, the flame lance, the rampart, the hoist.',
          'games/wall/src/references/level-4.test.ts',
        ),
      ).toMatchFileSnapshot('../../replays/level-4.replay');
      f.session.world.dispose();
    },
  );
});
