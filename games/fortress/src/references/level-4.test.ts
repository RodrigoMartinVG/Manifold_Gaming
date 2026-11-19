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
      referenceText(
        f.session,
        "The fortress's keep, played unseen to its way out: the flame behind its guard, the west aisle.",
        'games/fortress/src/references/level-4.test.ts',
      ),
    ).toMatchFileSnapshot('../../replays/level-4.replay');
    f.session.world.dispose();
  });
});
