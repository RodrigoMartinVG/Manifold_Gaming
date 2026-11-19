import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics } from '@manifold/core';
import { levelOf } from '../play';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

/**
 * Each level played to its way out as a person who knows it would: unseen, never caught. What it shows
 * is that the way it was made for is there (the guards, thinking every step, are the ones a page has).
 */
describe('the fortress’s four levels, played unseen to their way out (stage 5m)', () => {
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
      referenceText(
        f.session,
        "The fortress's courtyard, played unseen to its way out: the west side, a blow from behind.",
        'games/fortress/src/references/level-2.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/level-2.replay');
    f.session.world.dispose();
  });
});
