import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, levelFromText, levelOfWorld, levelToText, playRecipe, registryFor, Session } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { LEVELS } from './levels';
import { createDojo, DOJO_ZONES } from './rules';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

describe('recipes that check themselves (stage 3j)', () => {
  // Every saved room whose recipe has an `assert` is a test: played without a screen until nothing waits.
  for (const [name, room] of Object.entries(ROOMS).filter(([, r]) => /^\s*assert\b/m.test(r.text)))
    test(`the room "${name}": its checks hold`, () => {
      const { session, failed, said } = playRecipe(DojoCartridge, room.text);
      expect(failed).toEqual([]);
      expect(said.some((m) => m.text.startsWith('assert '))).toBe(true);
      session.world.dispose();
    });

  test('the workshop, built from the console and exported, loads back as the same level', () => {
    const { session } = playRecipe(DojoCartridge, ROOMS.workshop!.text);
    const built = levelOfWorld(session.world);
    // Its yard, and what it added: the clone, without a name, after what was there.
    expect(built.boxes.map((b) => b.name)).toEqual(['floor', 'bench', 'crate', null]);
    expect(built.lamps.map((l) => [l.name, l.intensity])).toEqual([['lamp', 1.5]]);
    // As a level file: read with the Dojo's zones, and loaded by a Dojo that has it.
    const text = levelToText(built);
    const level = levelFromText(text, { zones: DOJO_ZONES });
    const dojo = createDojo({ ...LEVELS, workshop: level });
    const registry = registryFor(dojo);
    registry.run('dojo.level workshop', 'recipe');
    const loaded = new Session(dojo, { registry });
    expect(levelOfWorld(loaded.world)).toEqual(level);
    expect(levelToText(levelOfWorld(loaded.world))).toBe(text);
    session.world.dispose();
    loaded.world.dispose();
  });
});
