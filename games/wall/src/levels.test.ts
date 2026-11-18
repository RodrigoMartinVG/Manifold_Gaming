import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
import { raised } from '@manifold/arms';
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

/** The three levels, where their defender stands, the file of their reference replay, and what each is. */
const cases = [
  { index: 0, at: [2.5, 4] as const, file: 'level-1', about: "The wall's yard, held: three waves through the gate." },
  { index: 1, at: [0, 5] as const, file: 'level-2', about: "The wall's two gates, held: four waves through two gates." },
  { index: 2, at: [0, 5] as const, file: 'level-3', about: 'The wall at dawn, held: three waves, shotguns among them.' },
];

/**
 * Each level held to its last wave: from a place by the cover, aiming from the eyes at the nearest attacker
 * in sight and firing as often as the weapon lets (the attackers, thinking every step, are the ones a page
 * has). What it shows is that it can be held. (Until 5i it also showed that it cost health; since the
 * attackers are fair, decision 0031, one who aims perfectly and fires without pause brings each down before
 * its first shot, which misses: what it costs a person is shown by one who only watches, below.)
 */
describe('the wall’s three levels, held until the last wave is down (stage 5h)', () => {
  test.each(cases)('$file: held', { timeout: 120_000 }, async ({ index, at, file, about }) => {
    const f = levelOf(index);
    f.walkTo(at[0], at[1]);
    for (let k = 0; k < 400 && !f.done(); k++) f.fight(15);
    expect(f.done()).toBe(true);
    expect(f.h().wave).toBe(f.h().waves);
    await expect(referenceText(f.session, about)).toMatchFileSnapshot(`../replays/${file}.replay`);
    f.session.world.dispose();
  });
});

/**
 * THE ATTACKERS, FAIR AND STILL DANGEROUS (stage 5i, decision 0031): a defender who stands at the cover and
 * only watches is hit, but not at once: each attacker raises its weapon first (seen, `arms.raised`, and
 * heard, a `ready` sound), never more than two at once, and its first shot goes by.
 */
describe('the wall’s attackers, fair (stage 5i)', () => {
  test.each(cases)('$file: one who only watches is hit, after warnings; never more than two raised', ({ index, at }) => {
    const f = levelOf(index);
    f.walkTo(at[0], at[1]);
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
    expect(Object.keys(WALL_REPLAYS).sort()).toEqual(['level-1', 'level-2', 'level-3']);
    for (const text of Object.values(WALL_REPLAYS)) expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(WALL_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(WALL.cartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
