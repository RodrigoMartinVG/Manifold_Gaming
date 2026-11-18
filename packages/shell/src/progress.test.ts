import { describe, expect, test } from 'vitest';
import { finished, NEW_PROGRESS, PROGRESS_VERSION, progressFrom } from './progress';

const LEVELS = ['one', 'two', 'three'];

describe('a player’s way through a game (stage 5b)', () => {
  test('a level done opens the next, and keeps its best: each number its own (the fewest steps, the most stars, the fewest falls)', () => {
    let p = finished(progressFrom(null), LEVELS, 'one', { steps: 900, stars: 1, falls: 2 });
    expect(p).toEqual({
      version: PROGRESS_VERSION,
      started: true,
      reached: 1,
      best: { one: { steps: 900, stars: 1, falls: 2 } },
    });
    p = finished(p, LEVELS, 'one', { steps: 1200, stars: 3, falls: 0 });
    expect(p.best.one).toEqual({ steps: 900, stars: 3, falls: 0 });
    // Playing an earlier level again does not close the later ones.
    p = finished(finished(p, LEVELS, 'two', { steps: 600, stars: 0, falls: 0 }), LEVELS, 'one', {
      steps: 800,
      stars: 0,
      falls: 5,
    });
    expect(p.reached).toBe(2);
    expect(p.best.one).toEqual({ steps: 800, stars: 3, falls: 0 });
    // The last one done: all of them.
    expect(finished(p, LEVELS, 'three', { steps: 1, stars: 0, falls: 0 }).reached).toBe(3);
    // A level it does not have changes nothing.
    expect(finished(p, LEVELS, 'four', { steps: 1, stars: 0, falls: 0 })).toBe(p);
  });

  test('what was kept, read back: the same; nothing, garbage, or a newer version than this code, a new start', () => {
    const p = finished(progressFrom(null), LEVELS, 'one', { steps: 900, stars: 1, falls: 2 });
    expect(progressFrom(JSON.parse(JSON.stringify(p)))).toEqual(p);
    for (const kept of [null, undefined, 'progress', 7, [], { version: PROGRESS_VERSION + 1, reached: 3 }, { reached: 2 }])
      expect(progressFrom(kept), JSON.stringify(kept)).toEqual(NEW_PROGRESS);
    // What is not understood inside it is left out, not believed.
    expect(
      progressFrom({
        version: PROGRESS_VERSION,
        started: 'yes',
        reached: -1,
        best: { one: { steps: 5, stars: 1, falls: 0 }, two: { steps: 'x' } },
      }),
    ).toEqual({ version: PROGRESS_VERSION, started: false, reached: 0, best: { one: { steps: 5, stars: 1, falls: 0 } } });
  });

  test('a new start is its own: changing one does not change the next', () => {
    const a = progressFrom(null);
    a.best.one = { steps: 1, stars: 1, falls: 1 };
    expect(progressFrom(null).best).toEqual({});
    expect(NEW_PROGRESS.best).toEqual({});
  });

  test('raced against someone’s ghost (stage 5d): its best kept, but no level opened by it', () => {
    const raced = finished(progressFrom(null), LEVELS, 'three', { steps: 600, stars: 1, falls: 0 }, { open: false });
    expect(raced).toMatchObject({ started: false, reached: 0, best: { three: { steps: 600, stars: 1, falls: 0 } } });
  });
});
