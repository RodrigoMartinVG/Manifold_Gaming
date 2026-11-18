import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, NO_INPUT } from '@manifold/core';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { floorOf } from './play';
import { TOWER, TOWER_THEME, TOWER_WORDS } from './game';

beforeAll(initPhysics);

describe('the tower, on the games’ shell (stages 5b to 5d)', () => {
  test('its stars, by the moves each floor teaches: the entrance’s on a pillar 3 m high (its ledge) and up a chimney 3.2 m wide and 9 m high', () => {
    const f = floorOf(0);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The pillar (its face towards the start at z = 7): walked up to, jumped at, its ledge, its top.
    f.walkTo(5, 8.3);
    f.go({ move: [0, 0, -1] }, () => f.at()[2]! < 7.6, 30);
    f.jump([0, 0, -1], 40);
    f.go({ move: [0, 0, -1] }, () => f.stars() === 1, 160);
    expect(f.stars()).toBe(1);
    // The chimney 3.2 m wide (x = 8): from its floor, up to its star, 8.4 m up.
    f.session.world.place(f.me(), [8, 0.82, -12]);
    f.go(NO_INPUT, () => f.c().grounded, 30);
    f.chimney(9, [0, 0, -1]);
    expect(f.stars()).toBe(2);
    f.session.world.dispose();
  });

  test('its words: the same keys in Spanish and English, and every key the game names among them', () => {
    expect(missingKeys(TOWER_WORDS)).toEqual([]);
    const named = [
      TOWER.title,
      TOWER.tagline,
      ...TOWER.levels.map((l) => l.name),
      ...[...TOWER.thread.opening, ...TOWER.thread.ending].flatMap((l) => [l.who, l.say]),
    ];
    for (const key of named) expect(TOWER_WORDS.es, key).toHaveProperty([key]);
  });

  test('its music, sparse (decision 0027): over a minute, a note begins on fewer than a fifth of the beats; quiet once a floor is done', () => {
    const beats = TOWER_THEME.tempo;
    for (const mood of ['climb', 'top']) {
      const onsets = new Set(notesBetween(TOWER_THEME, mood, 0, beats).map((n) => n.beat));
      expect(onsets.size, mood).toBeGreaterThan(0);
      expect(onsets.size / beats, mood).toBeLessThan(0.2);
    }
    expect(notesBetween(TOWER_THEME, 'done', 0, beats)).toEqual([]);
  });
});
