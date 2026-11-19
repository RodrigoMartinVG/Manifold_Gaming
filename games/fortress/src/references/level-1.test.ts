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
      referenceText(
        f.session,
        "The fortress's outer wall, played unseen to its way out: the culvert, a pebble, the gate.",
        'games/fortress/src/references/level-1.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/level-1.replay');
    f.session.world.dispose();
  });
});
