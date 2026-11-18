import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
import { arsenal, raised, RELOAD } from '@manifold/arms';
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
        referenceText(f.session, 'The wall walk, played to its way out: the balcony, the armory, the bridge, the dais.'),
      ).toMatchFileSnapshot('../replays/level-1.replay');
      f.session.world.dispose();
    },
  );

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
        referenceText(f.session, 'The gatehouse, played to its way out: the chapel, the cellar, the lift, two keys.'),
      ).toMatchFileSnapshot('../replays/level-2.replay');
      f.session.world.dispose();
    },
  );

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
        referenceText(f.session, 'The towers, played to their way out: the ferry, the moat, the lift, the bridge.'),
      ).toMatchFileSnapshot('../replays/level-3.replay');
      f.session.world.dispose();
    },
  );

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
        referenceText(f.session, 'The gate, played to its way out: the shelf, the flame lance, the rampart, the hoist.'),
      ).toMatchFileSnapshot('../replays/level-4.replay');
      f.session.world.dispose();
    },
  );
});

describe('the wall’s attackers, fair (stage 5i)', () => {
  test('the wall walk: one who only watches is hit, after warnings; never more than two raised', () => {
    const f = levelOf(0);
    // (Stage 5o) In the yard's door, within the sentries' range; walking there, not fighting.
    f.walkTo(0, -5);
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
