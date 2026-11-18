import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { TOWER, TOWER_THEME, TOWER_WORDS } from './game';
import { runner } from './rules';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

/** A floor of the tower, played as a person would: on forward, a jump at the gap's edge held half a second (let go at once, the platformer's is a short hop), on to the goal. */
function play(recipe: string, jumpAt: number) {
  const registry = registryFor(TOWER.cartridge);
  expect(registry.run(recipe, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(TOWER.cartridge, { registry });
  const me = (): Entity | undefined => [...session.world.entities.values()].find((e) => e.character?.player === 1);
  const step = (input: PlayerInput = NO_INPUT) => {
    session.setInput(1, input);
    session.step();
  };
  for (let i = 0; i < 60; i++) step();
  let jumped = -1;
  for (let i = 0; i < 1200 && !TOWER.done(session.world, me()); i++) {
    const z = me()!.transform!.position[2]!;
    if (jumped < 0 && z < jumpAt) jumped = i;
    step({ move: AHEAD, jump: jumped >= 0 && i - jumped < 30 });
  }
  const result = TOWER.done(session.world, me());
  session.world.dispose();
  return result;
}

describe('the tower, on the games’ shell (stage 5b)', () => {
  test('its two floors played to their goal: done, and how it went (steps, no fall, no star on the straight way)', () => {
    const one = play(TOWER.levels[0]!.recipe, -4.7);
    expect(one).toMatchObject({ falls: 0, stars: 0 });
    expect(one!.steps).toBeGreaterThan(5 * 60 * 0);
    expect(one!.steps).toBeLessThan(10 * 60);
    const two = play(TOWER.levels[1]!.recipe, -4.7);
    expect(two).toMatchObject({ falls: 0, stars: 0 });
    expect(two!.steps).toBeLessThan(12 * 60);
  });

  test('its stars, by the platformer’s moves (stage 5c): the first floor’s up its chimney, leaping wall to wall; the second’s on a block 3 m high, its ledge grabbed', () => {
    const floor = (recipe: string) => {
      const registry = registryFor(TOWER.cartridge);
      registry.run(recipe, 'recipe');
      const session = new Session(TOWER.cartridge, { registry });
      const me = () => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
      const step = (input: PlayerInput) => {
        session.setInput(1, input);
        session.step();
      };
      for (let i = 0; i < 30; i++) step(NO_INPUT);
      return { session, me, step, stars: () => runner(me())!.stars };
    };
    // The chimney (its walls' faces at x = 4.15 and 6.55): the jump held, let go on a wall, pressed again.
    const one = floor(TOWER.levels[0]!.recipe);
    one.session.world.place(one.me(), [5.35, 0.82, -8]);
    let way = 1;
    let held = true;
    let wait = 0;
    one.step({ move: [way, 0, 0], jump: true });
    for (let i = 0; i < 400 && one.stars() === 0; i++) {
      let jump: boolean = held;
      let pressed = false;
      if (one.me().character!.mode === 'slide' && wait === 0) {
        if (held) held = jump = false;
        else {
          held = jump = pressed = true;
          way = -way;
          wait = 10;
        }
      }
      wait = Math.max(0, wait - 1);
      one.step({ move: [pressed ? -way : way, 0, 0], jump });
    }
    expect(one.stars()).toBe(1);
    one.session.world.dispose();
    // The block (its face at z = −2, its top 3 m up): walked up to, jumped at, hung from, climbed onto.
    const two = floor(TOWER.levels[1]!.recipe);
    two.session.world.place(two.me(), [3.5, 0.82, 0.5]);
    for (let i = 0; i < 60 && two.me().transform!.position[2]! > -1; i++) two.step({ move: AHEAD });
    for (let i = 0; i < 60 && two.me().character!.mode !== 'hang'; i++) two.step({ move: AHEAD, jump: true });
    expect(two.me().character!.mode).toBe('hang');
    for (let i = 0; i < 60 && two.stars() === 0; i++) two.step({ move: AHEAD });
    expect(two.stars()).toBe(1);
    two.session.world.dispose();
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
    const onsets = new Set(notesBetween(TOWER_THEME, 'climb', 0, beats).map((n) => n.beat));
    expect(onsets.size).toBeGreaterThan(0);
    expect(onsets.size / beats).toBeLessThan(0.2);
    expect(notesBetween(TOWER_THEME, 'done', 0, beats)).toEqual([]);
  });
});
