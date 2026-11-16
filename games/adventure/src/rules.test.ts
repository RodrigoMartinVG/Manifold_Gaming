import { beforeAll, describe, expect, test } from 'vitest';
import {
  initPhysics,
  playRecipe,
  readSave,
  registryFor,
  saveGame,
  saveRecipe,
  Session,
  SIMULATION_VERSION,
  type Entity,
  type SavedGame,
} from '@manifold/core';
import versionOne from '../saves/version-1.json';
import { dungeon } from './dungeon';
import { ADVENTURE_PROGRESS, AdventureCartridge, explorer, type AdventureProgress } from './rules';

beforeAll(initPhysics);

/** An adventure, born from a recipe, with its explorer and a way to put it somewhere and step. */
function adventure(recipe = 'adventure.dungeon 3') {
  const registry = registryFor(AdventureCartridge);
  registry.run(recipe, 'recipe');
  const session = new Session(AdventureCartridge, { registry });
  const hero = () => [...session.world.entities.values()].find((e) => e.character?.player === 1) as Entity;
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) session.step();
  };
  const at = (kind: string) => [...session.world.entities.values()].find((e) => e.sensor?.kind === kind);
  return { session, registry, hero, step, at, ex: () => explorer(hero())! };
}

describe('the adventure (stage 3k)', () => {
  test('a gem and the key taken into the inventory; the exit, locked without the key, opens with it: the next depth', () => {
    const a = adventure();
    a.step(10);
    a.session.world.place(a.hero(), a.at('gem')!.transform!.position);
    a.step(3);
    expect(a.ex().items).toEqual(['gem']);
    a.session.world.place(a.hero(), a.at('exit')!.transform!.position);
    a.step(3);
    expect(a.ex().depth).toBe(1);
    a.session.world.place(a.hero(), a.at('key')!.transform!.position);
    a.step(3);
    expect(a.ex().items).toEqual(['gem', 'key']);
    a.session.world.place(a.hero(), a.at('exit')!.transform!.position);
    a.step(3);
    // Down: another dungeon (depth 2, the same seed), the key left in the lock, the gem kept.
    expect(a.ex()).toEqual({ dungeon: 3, depth: 2, items: ['gem'], taken: [] });
    expect(a.session.world.origin!.title).toBe('Depth 2');
    expect(a.hero().transform!.position[0]).toBeCloseTo(dungeon(3, 2).spawn[0], 5);
    a.session.world.dispose();
  });

  test('saved and loaded: the same dungeon, where it was, what it carried, and what it took is not there', () => {
    const a = adventure();
    a.step(10);
    const gem = a.at('gem')!;
    a.session.world.place(a.hero(), gem.transform!.position);
    a.step(3);
    a.step(30);
    const saved = saveGame(AdventureCartridge, a.session.world, 1, '2026-11-15')!;
    expect(saved).toMatchObject({ save: 1, game: 'adventure', version: 2, engine: SIMULATION_VERSION, made: '2026-11-15' });
    // As JSON, as it is kept; loaded as a recipe, in a fresh page.
    const { session, failed } = playRecipe(AdventureCartridge, saveRecipe(AdventureCartridge, JSON.stringify(saved)));
    expect(failed).toEqual([]);
    const hero = [...session.world.entities.values()].find((e) => e.character)!;
    expect(explorer(hero)).toEqual(a.ex());
    expect(hero.transform!.position.map((n) => +n.toFixed(2))).toEqual(a.hero().transform!.position.map((n) => +n.toFixed(2)));
    expect([...session.world.entities.values()].filter((e) => e.sensor?.kind === 'gem').length).toBe(
      [...a.session.world.entities.values()].filter((e) => e.sensor?.kind === 'gem').length,
    );
    a.session.world.dispose();
    session.world.dispose();
  });

  test('a save of version 1 (kept as a file) is brought forward, and loads; whatever engine version wrote it', () => {
    const { progress, from } = readSave(AdventureCartridge, versionOne as SavedGame);
    expect(from).toBe(1);
    expect(progress).toEqual({ dungeon: 3, depth: 2, at: [10, 1, 10], facing: [0, 0, 1], items: ['gem', 'gem'], taken: [] });
    // It said engine 21: nothing refuses it for that.
    expect((versionOne as SavedGame).engine).not.toBe(SIMULATION_VERSION);
    const { session, failed } = playRecipe(AdventureCartridge, saveRecipe(AdventureCartridge, versionOne as SavedGame));
    expect(failed).toEqual([]);
    const hero = [...session.world.entities.values()].find((e) => e.character)!;
    expect(explorer(hero)).toEqual({ dungeon: 3, depth: 2, items: ['gem', 'gem'], taken: [] });
    session.world.dispose();
  });

  test('what cannot be loaded says why: another game, a newer version, another envelope', () => {
    const base = { save: 1, game: 'adventure', version: 2, engine: 22, made: '2026-11-15', progress: {} };
    expect(() => readSave(AdventureCartridge, { ...base, game: 'dojo' })).toThrow(/a saved game of dojo, not of adventure/);
    expect(() => readSave(AdventureCartridge, { ...base, version: 3 })).toThrow(/version 3: this adventure is version 2/);
    expect(() => readSave(AdventureCartridge, { ...base, save: 2 })).toThrow(/format 2: this engine reads format 1/);
  });

  test('its progress, written and applied, is the same (the format, as data)', () => {
    const p: AdventureProgress = { dungeon: 3, depth: 1, at: [4, 1, 6], facing: [1, 0, 0], items: ['key'], taken: ['5,5'] };
    expect(ADVENTURE_PROGRESS.startup(p)).toEqual(['adventure.dungeon 3', 'adventure.depth 1']);
    const a = adventure();
    ADVENTURE_PROGRESS.apply(a.session.world, 1, p);
    expect(ADVENTURE_PROGRESS.write(a.session.world, 1)).toEqual(p);
    a.session.world.dispose();
  });
});
