import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
import { arsenal, raised } from '@manifold/arms';
import { WALL } from './game';
import { levelOf } from './play';
import { WALL_REPLAYS } from './replays';

beforeAll(initPhysics);

/** A level's run as a reference replay: its header, what it is, and that it is not edited by hand. */
function referenceText(session: Session, about: string): string {
  const [header, ...rest] = replayToText(replayOf(session)).split('\n');
  return [
    header,
    `# ${about}`,
    '# A reference replay (stage 5h, as the tower’s since 5d): playing it must end with the hash on its',
    '# last line. Recorded by games/wall/src/levels.test.ts; recorded again (npm run references) only',
    '# when the simulation changes on purpose, with SIMULATION_VERSION.',
    ...rest,
  ].join('\n');
}

/**
 * EACH LEVEL PLAYED TO ITS WAY OUT (stage 5n, decision 0031: levels to advance through): as one who knows it
 * would, fighting whoever comes in sight (aiming from the eyes at the nearest, firing as often as its weapon
 * lets: `pushTo`, `clear`), taking the weapons, the keys and the secret, through the doors the keys open, to
 * the way out. Every attacker down, never down itself. Its run, a reference replay.
 */
describe('the wall’s four levels, played to their way out (stage 5n)', () => {
  test(
    'the wall walk: the courtyard, the shotgun, the tower’s red key, the red door, those waiting in the hall',
    { timeout: 120_000 },
    async () => {
      const f = levelOf(0);
      f.pushTo(0, -4);
      f.clear();
      f.pushTo(-12.5, -6);
      expect(f.h().felled).toBe(3);
      f.pushTo(-13.5, -9.5);
      f.pushTo(-17, -10);
      f.pushTo(-17, -23.5);
      f.pushTo(-13, -23.5);
      f.pushTo(-13, -26);
      f.clear();
      f.pushTo(-15, -31);
      expect(f.h().keys).toBe(1);
      f.pushTo(-13, -24);
      f.pushTo(-17, -23.5);
      f.pushTo(-17, -10);
      f.pushTo(-12, -9.5);
      f.pushTo(0, -19.5);
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(0, -23.5);
      f.clear(90);
      expect(f.pushTo(0, -34.5)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([8, 8, 0]);
      await expect(
        referenceText(f.session, 'The wall walk, played to its way out: the shotgun, the red key, the hall.'),
      ).toMatchFileSnapshot('../replays/level-1.replay');
      f.session.world.dispose();
    },
  );

  test(
    'the gatehouse: the hall’s casters, the repeater, the closet’s secret, the blue key, the courtyard, the red key',
    { timeout: 120_000 },
    async () => {
      const f = levelOf(1);
      f.pushTo(0, -3.5);
      f.clear();
      f.pushTo(-12.5, -10);
      f.pushTo(-17, -16);
      expect(arsenal(f.me())!.owned).toContain('repeater');
      // The hidden button: the closet opens; its armor.
      f.pushTo(-13.5, -6.5);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.pushTo(-15.5, -5);
      f.pushTo(-17.5, -5);
      f.walkTo(-17.5, -4.6, 0.1);
      expect([f.h().secrets, f.h().armor]).toEqual([1, 50]);
      // Out of the closet by its door.
      f.walkTo(-15.5, -5);
      f.walkTo(-13.5, -6.5);
      f.pushTo(-12.5, -10);
      f.pushTo(12.5, -10);
      f.pushTo(14, -12);
      f.clear();
      f.pushTo(17, -17);
      f.pushTo(12.5, -10);
      f.pushTo(0, -17.5);
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(0, -22);
      f.clear(90);
      f.pushTo(-17, -31);
      expect(f.h().keys).toBe(3);
      f.pushTo(0, -31.5);
      for (let i = 0; i < 90; i++) f.step();
      expect(f.pushTo(0, -38)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([8, 8, 0]);
      await expect(
        referenceText(f.session, 'The gatehouse, played to its way out: the repeater, a secret, two keys.'),
      ).toMatchFileSnapshot('../replays/level-2.replay');
      f.session.world.dispose();
    },
  );

  test(
    'the towers: the crossbow, the room behind the tower, the yellow key and those who charge, the hall',
    { timeout: 120_000 },
    async () => {
      const f = levelOf(2);
      f.pushTo(0, -3.5);
      f.clear();
      f.pushTo(-12.5, -16);
      f.pushTo(-15, -16);
      f.clear();
      f.pushTo(-19, -12);
      f.pushTo(-15, -12);
      f.pushTo(-19, -20);
      f.pushTo(-16, -20.5);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.pushTo(-15.5, -22.5);
      f.pushTo(-15.5, -24);
      f.walkTo(-13.5, -23.6, 0.1);
      f.walkTo(-15, -24.5, 0.1);
      expect([f.h().secrets, f.h().armor]).toEqual([1, 50]);
      f.pushTo(-15.5, -21);
      f.pushTo(-12.5, -16);
      f.pushTo(12.5, -16);
      f.pushTo(15, -16);
      f.clear(90);
      f.pushTo(19, -19);
      expect(f.h().keys).toBe(4);
      f.pushTo(12.5, -16);
      f.pushTo(0, -23.5);
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(0, -28);
      f.clear(90);
      expect(f.pushTo(0, -38.5)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([9, 9, 0]);
      await expect(
        referenceText(f.session, 'The towers, played to their way out: the crossbow, a secret, the yellow key.'),
      ).toMatchFileSnapshot('../replays/level-3.replay');
      f.session.world.dispose();
    },
  );

  test(
    'the gate: the first hall and its brute, the launcher, the closet, the red key, the court’s two groups, the gate',
    { timeout: 120_000 },
    async () => {
      const f = levelOf(3);
      f.pushTo(0, -3.5);
      f.clear();
      f.pushTo(-8, -7);
      f.pushTo(-18, -4);
      f.walkTo(-12, -4, 0.1);
      expect(arsenal(f.me())!.owned).toContain('launcher');
      f.pushTo(-18, -9.5);
      f.use();
      for (let i = 0; i < 70; i++) f.step();
      f.pushTo(-16, -11.8);
      f.walkTo(-15.5, -14.3, 0.1);
      f.walkTo(-15.4, -13.2, 0.1);
      expect([f.h().secrets, f.h().armor]).toEqual([1, 50]);
      f.walkTo(-16, -11.5);
      f.pushTo(-16, -10);
      f.pushTo(-8, -7);
      f.pushTo(8, -7);
      f.pushTo(18, -9);
      f.walkTo(18, -3.2, 0.1);
      f.walkTo(12, -3.2, 0.1);
      expect(f.h().keys).toBe(1);
      f.pushTo(8, -7);
      f.pushTo(0, -8);
      f.pushTo(0, -11.5);
      f.take(6);
      f.clear(60);
      f.pushTo(0, -21.5);
      for (let i = 0; i < 90; i++) f.step();
      f.pushTo(0, -26);
      f.clear(90);
      f.pushTo(0, -33.5);
      f.clear(90);
      expect(f.pushTo(0, -44.5)).toBe(false);
      expect(f.done()).toBe(true);
      expect([f.h().felled, f.h().attackersHere, f.h().downs]).toEqual([10, 10, 0]);
      await expect(
        referenceText(f.session, 'The gate, played to its way out: the launcher, a secret, the red key, the court.'),
      ).toMatchFileSnapshot('../replays/level-4.replay');
      f.session.world.dispose();
    },
  );
});

/**
 * THE ATTACKERS, FAIR AND STILL DANGEROUS (stage 5i, decision 0031): a defender who stands where it starts
 * and only watches is hit, but not at once: each attacker raises its weapon first (seen, `arms.raised`, and
 * heard, a `ready` sound), never more than two at once, and its first shot goes by.
 */
describe('the wall’s attackers, fair (stage 5i)', () => {
  test('the wall walk: one who only watches is hit, after warnings; never more than two raised', () => {
    const f = levelOf(0);
    f.pushTo(0, -2.5);
    const full = f.me().health!.points;
    let readies = 0;
    let most = 0;
    let firstHurt = -1;
    for (let k = 0; k < 900 && (f.me().health?.down ?? -1) < 0; k++) {
      f.step();
      const world = f.session.world;
      readies += world.stepEvents.filter((e) => e.type === 'sound' && e.sound === 'ready').length;
      most = Math.max(most, [...world.entities.values()].filter((e) => e.brain && raised(e)).length);
      if (firstHurt < 0 && f.me().health!.points < full) firstHurt = readies;
    }
    expect(f.me().health!.points).toBeLessThan(full);
    expect(firstHurt, 'warned before the first hit').toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
    f.session.world.dispose();
  });
});

describe('the wall’s reference replays (stage 5h)', () => {
  test('one for each level, of this simulation version', () => {
    expect(Object.keys(WALL_REPLAYS).sort()).toEqual(['level-1', 'level-2', 'level-3', 'level-4']);
    for (const text of Object.values(WALL_REPLAYS)) expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(WALL_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(WALL.cartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
