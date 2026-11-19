import { describe, expect, test } from 'vitest';
import { playReplay, replayFromText, replayOf, replayToText, versionsText, type Cartridge, type Session } from '@manifold/core';

/**
 * THE REFERENCE REPLAYS' TEST KIT (stage 5.5c, decision 0033; the references are decision 0025's): what every
 * game's tests repeated, once. A reference replay is a run of a level, played by a script in a test, as
 * text in the game's `replays/` folder: playing it must end with the hash on its last line. They are
 * recorded by the tests in each game's `src/references/` (one level a file, so the levels play side by
 * side), recorded again with `npm run references` when the engine or the game's rules change on purpose,
 * and played back by the game's `replays.test.ts` and, in every browser, by the page "La misma huella".
 */

/** A run as a reference replay's text: its versions, what it is, who records it, and that it is not edited by hand. */
export function referenceText(session: Session, about: string, recordedBy: string): string {
  const [header, ...rest] = replayToText(replayOf(session)).split('\n');
  const rules = rest[0]?.startsWith('rules ') ? [rest.shift()!] : [];
  return [
    header,
    ...rules,
    `# ${about}`,
    '# A reference replay (decision 0025): playing it must end with the hash on its last line.',
    `# Recorded by ${recordedBy};`,
    "# recorded again (npm run references) only when the engine or this game's rules change on purpose.",
    ...rest,
  ].join('\n');
}

/**
 * THE CHECKS EVERY GAME'S REFERENCES GET: one for each name it expects, each of this engine and of this game's
 * rules (their versions), and each played back to the hash on its last line.
 */
export function describeReferences(
  title: string,
  cartridge: Cartridge,
  replays: Readonly<Record<string, string>>,
  names: readonly string[],
) {
  describe(title, () => {
    test('one for each, of this engine and of this game’s rules', () => {
      expect(Object.keys(replays).sort()).toEqual([...names].sort());
      for (const [name, text] of Object.entries(replays)) {
        // (Of another engine, it is refused as it is read.)
        const replay = replayFromText(text);
        expect(versionsText(replay.versions ?? {}), name).toBe(versionsText(cartridge.versions ?? {}));
      }
    });
    // (A whole level's run, thousands of steps with its bots: with every other playthrough at once, a
    // minute and more, not the 20 s a unit test gets.)
    test.each(Object.entries(replays))(
      '%s plays to the hash on its last line',
      (_, text) => {
        const { session, same } = playReplay(cartridge, replayFromText(text));
        expect(same).toBe(true);
        session.world.dispose();
      },
      180_000,
    );
  });
}
