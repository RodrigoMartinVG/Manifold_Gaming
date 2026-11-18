import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
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
 * Each level held to its last wave, as a person would: from a place by the cover, aiming from the eyes at
 * the nearest attacker in sight and firing as often as the weapon lets (the attackers, thinking every
 * step, are the ones a page has). What it shows is that it can be held, and that it costs something.
 */
describe('the wall’s three levels, held until the last wave is down (stage 5h)', () => {
  const cases = [
    { index: 0, at: [2.5, 4] as const, file: 'level-1', about: "The wall's yard, held: three waves through the gate." },
    { index: 1, at: [0, 5] as const, file: 'level-2', about: "The wall's two gates, held: four waves through two gates." },
    { index: 2, at: [0, 5] as const, file: 'level-3', about: 'The wall at dawn, held: three waves, shotguns among them.' },
  ];
  test.each(cases)('$file: held, hit along the way', { timeout: 120_000 }, async ({ index, at, file, about }) => {
    const f = levelOf(index);
    f.walkTo(at[0], at[1]);
    let hurt = 0;
    for (let k = 0; k < 400 && !f.done(); k++) {
      const before = f.me().health!.points;
      f.fight(15);
      hurt += Math.max(0, before - f.me().health!.points);
    }
    expect(f.done()).toBe(true);
    expect(f.h().wave).toBe(f.h().waves);
    expect(hurt).toBeGreaterThan(0);
    await expect(referenceText(f.session, about)).toMatchFileSnapshot(`../replays/${file}.replay`);
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
