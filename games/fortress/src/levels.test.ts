import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, playReplay, replayFromText, replayOf, replayToText, Session, SIMULATION_VERSION } from '@manifold/core';
import { FORTRESS } from './game';
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
describe('the fortress’s three levels, played unseen to their way out (stage 5f)', () => {
  test('the outer wall: in by the breach while the guard looks away, its lantern put out, across the yard in the dark', async () => {
    const f = levelOf(0);
    // The guard just off the yard's west end, on its way east: it does not look back at the breach, and
    // it is far along before it turns. In, the last steps crouched (a step is heard within 6 m walking).
    expect(f.wait(() => f.guardAt(0)[0]! > -4 && f.guardAt(0)[0]! < -2 && f.facingOf(0)[0]! > 0.5)).toBe(true);
    f.walkTo(-0.8, 1.2);
    f.walkTo(-1.2, -0.3, { crouch: true });
    f.use();
    expect(f.named('lantern_breach').lamp!.on).toBe(false);
    // In the dark, crouched (heard within a meter and a half), round the west side to the gate.
    f.walkTo(-8, -9, { crouch: true });
    f.walkTo(0, -14, { crouch: true });
    expect(f.walkTo(0, -20)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(f.session, "The fortress's outer wall, played unseen to its way out: a lantern put out, the dark yard."),
    ).toMatchFileSnapshot('../replays/level-1.replay');
    f.session.world.dispose();
  });

  test('the courtyard: round its dark east side, the gate’s near lantern put out as the guard crossing looks west, through it crouched', async () => {
    const f = levelOf(1);
    f.walkTo(0, 1.5);
    f.walkTo(1.5, -1, { crouch: true });
    f.walkTo(9, -4, { crouch: true });
    f.walkTo(9, -21, { crouch: true });
    expect(f.wait(() => f.guardAt(1)[0]! < -1 && f.facingOf(1)[0]! < -0.5, 900, true)).toBe(true);
    // To the east lantern from the dark side (crouched, lit by it alone, it is not seen), and a hand on it.
    f.walkTo(4, -21.7, { crouch: true });
    f.walkTo(1.8, -22, { crouch: true });
    f.use(true);
    expect(f.named('lantern_gate_east').lamp!.on).toBe(false);
    // Through the gate, the west lantern still lit: crouched, not seen (0.12 + 0.2, half of it seen).
    f.walkTo(0, -24.5, { crouch: true });
    expect(f.walkTo(0, -28)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(f.session, "The fortress's courtyard, played unseen to its way out: the dark side, a gate lantern put out."),
    ).toMatchFileSnapshot('../replays/level-2.replay');
    f.session.world.dispose();
  });

  test('the keep: the guard at its post taken down from behind, the flame taken, out by the side door as the passage’s guard walks away', async () => {
    const f = levelOf(2);
    f.walkTo(0, 1);
    // Crouched up the dark hall behind the guard at its post; within the stick's reach, a blow.
    f.walkTo(0, -13.6, { crouch: true });
    f.face([0, 0, -1], true);
    f.strike(true);
    expect(f.down(0)).toBe(true);
    // The flame: carried, lit (0.7 of light round it, seen anywhere a guard looks).
    f.walkTo(1.2, -16.6);
    f.walkTo(0.3, -17.2);
    expect(f.r().relic).toBe(true);
    expect(f.me().character!.light).toBeGreaterThan(0.8);
    // By the side door, inside; out as the passage's guard walks north, away; walking once it is far.
    f.walkTo(2.5, -15, { crouch: true });
    expect(f.wait(() => f.guardAt(1)[2]! < -18 && f.facingOf(1)[2]! < -0.5, 900, true)).toBe(true);
    f.walkTo(7, -15, { crouch: true });
    f.walkTo(8.5, -11.5);
    expect(f.walkTo(12, -11)).toBe(false);
    expect(f.done()).toBe(true);
    expect([f.r().seen, f.r().caught]).toEqual([0, 0]);
    await expect(
      referenceText(
        f.session,
        "The fortress's keep, played unseen to its way out: a blow from behind, the flame, the side door.",
      ),
    ).toMatchFileSnapshot('../replays/level-3.replay');
    f.session.world.dispose();
  });
});

describe('the fortress’s reference replays (stage 5f)', () => {
  test('one for each level, of this simulation version', () => {
    expect(Object.keys(FORTRESS_REPLAYS).sort()).toEqual(['level-1', 'level-2', 'level-3']);
    for (const text of Object.values(FORTRESS_REPLAYS))
      expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(FORTRESS_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(FORTRESS.cartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
