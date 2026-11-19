import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
import { FORTRESS_CARTRIDGE } from './cartridge';
import { levelOf } from './play';
import { FORTRESS_REPLAYS } from './replays';

beforeAll(initPhysics);

/** A level's run as a reference replay: its header, what it is, and that it is not edited by hand. */
function referenceText(session: Session, about: string): string {
  const [header, ...rest] = replayToText(replayOf(session)).split('\n');
  return [
    header,
    `# ${about}`,
    '# A reference replay (stage 5f, as the tower’s since 5d): playing it must end with the hash on its',
    '# last line. Recorded by games/fortress/src/levels.test.ts; recorded again (npm run references) only',
    '# when the simulation changes on purpose, with SIMULATION_VERSION.',
    ...rest,
  ].join('\n');
}

/**
 * Each level played to its way out as a person who knows it would: unseen, never caught. What it shows
 * is that the way it was made for is there (the guards, thinking every step, are the ones a page has).
 */
describe('the fortress’s four levels, played unseen to their way out (stage 5m)', () => {
  test('the outer wall: in by the dark culvert, along the inner wall, a pebble to the yard, through the gate while its guard goes to look', async () => {
    const f = levelOf(0);
    // The long way, east, dark: the culvert and the passage behind the storage, crouched.
    f.walkTo(17.5, 4);
    f.walkTo(17.5, -15, { crouch: true });
    // Along the inner wall in the dark, to the gate's east, beside its guard (outside what it looks at).
    f.walkTo(12, -16.5, { crouch: true });
    f.walkTo(5, -16.5, { crouch: true });
    // A pebble into the yard: the guard at the gate hears it and goes to look.
    f.face([-0.6, 0, 0.8], true);
    f.pebble(0);
    expect(f.wait(() => f.guardAt(1)[2]! > -12.5 && f.facingOf(1)[2]! > 0.3, 600, true)).toBe(true);
    // Through the gate, walking (quick), while its back is turned.
    f.walkTo(0.5, -17);
    expect(f.walkTo(-0.5, -20.5)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(f.session, "The fortress's outer wall, played unseen to its way out: the culvert, a pebble, the gate."),
    ).toMatchFileSnapshot('../replays/level-1.replay');
    f.session.world.dispose();
  });

  test('the courtyard: up its dark west side, along the barracks wall, the door’s guard taken down from behind', async () => {
    const f = levelOf(1);
    f.walkTo(-18, -1);
    f.walkTo(-18, -21);
    f.walkTo(-12, -31, { crouch: true });
    f.walkTo(-3, -31, { crouch: true });
    // Behind the guard at the door (it faces the yard), a blow of the stick: down at once.
    f.walkTo(-0.5, -30.8, { crouch: true });
    f.face([0, 0, 1], true);
    f.strike(true);
    expect(f.down(2)).toBe(true);
    expect(f.walkTo(-0.5, -36)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught, f.r().downs]).toEqual([0, 0, 1]);
    await expect(
      referenceText(f.session, "The fortress's courtyard, played unseen to its way out: the west side, a blow from behind."),
    ).toMatchFileSnapshot('../replays/level-2.replay');
    f.session.world.dispose();
  });

  test('the barracks: behind the round, up the west corridor, a dark room while it goes by, out by the north', async () => {
    const f = levelOf(2);
    // The round going east along the south corridor, past the start: behind it, west and north, crouched.
    expect(f.wait(() => f.guardAt(0)[0]! > 6 && f.facingOf(0)[0]! > 0.5, 900)).toBe(true);
    f.walkTo(-10.3, -5, { crouch: true });
    f.walkTo(-10.3, -33, { crouch: true });
    // Into the north-west room, dark, its depth: the round goes by its door and turns south.
    f.walkTo(-15, -33.5, { crouch: true });
    f.walkTo(-15.5, -36, { crouch: true });
    expect(f.wait(() => f.guardAt(0)[2]! > -26 && f.facingOf(0)[2]! > 0.5, 1800, true)).toBe(true);
    f.walkTo(-11, -33.5, { crouch: true });
    expect(f.walkTo(0, -37)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(
        f.session,
        "The fortress's barracks, played unseen to its way out: behind the round, a dark room, the north.",
      ),
    ).toMatchFileSnapshot('../replays/level-3.replay');
    f.session.world.dispose();
  });

  test('the keep: up the hall’s dark east side, the flame taken behind its guard’s back, out by the west aisle to the postern', async () => {
    const f = levelOf(3);
    f.walkTo(7.5, -3, { crouch: true });
    f.walkTo(7.5, -33, { crouch: true });
    // Into the apse by its east door: the flame behind the guard at its mouth, who faces the hall.
    f.walkTo(4, -35, { crouch: true });
    f.walkTo(1.2, -36.2, { crouch: true });
    f.walkTo(0.3, -36.4, { crouch: true });
    expect(f.r().relic).toBe(true);
    // Carried, it gives light: out by the west door, down the west aisle (no one walks it), past the
    // hall's side door while the hall's guard is on its far side, to the postern.
    f.walkTo(-7.5, -35, { crouch: true });
    f.walkTo(-12.5, -35, { crouch: true });
    f.walkTo(-12.5, -18, { crouch: true });
    expect(f.wait(() => f.guardAt(2)[0]! > 1.5, 1200, true)).toBe(true);
    f.walkTo(-12.5, -11, { crouch: true });
    f.walkTo(-12.5, -2.5, { crouch: true });
    expect(f.walkTo(-16, -2)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(f.session, "The fortress's keep, played unseen to its way out: the flame behind its guard, the west aisle."),
    ).toMatchFileSnapshot('../replays/level-4.replay');
    f.session.world.dispose();
  });
});

describe('the fortress’s reference replays (stage 5f; four since 5m)', () => {
  test('one for each level, of this simulation version', () => {
    expect(Object.keys(FORTRESS_REPLAYS).sort()).toEqual(['level-1', 'level-2', 'level-3', 'level-4']);
    for (const text of Object.values(FORTRESS_REPLAYS))
      expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(FORTRESS_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(FORTRESS_CARTRIDGE, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
