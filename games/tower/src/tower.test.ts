import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { TOWER, TOWER_THEME, TOWER_WORDS } from './game';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

/** A floor of the tower, played as a person would: on forward, a jump at the gap's edge, on to the goal. */
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
  let jumped = false;
  for (let i = 0; i < 1200 && !TOWER.done(session.world, me()); i++) {
    const z = me()!.transform!.position[2]!;
    const jump = !jumped && z < jumpAt;
    if (jump) jumped = true;
    step({ move: AHEAD, jump });
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
