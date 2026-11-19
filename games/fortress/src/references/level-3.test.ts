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
        'games/fortress/src/references/level-3.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/level-3.replay');
    f.session.world.dispose();
  });
});
