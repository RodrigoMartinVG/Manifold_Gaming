import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, registryFor, Session, type Entity } from '@manifold/core';
import { ENGINE_WORDS, missingKeys, sayer } from '@manifold/presentation';
import { DojoCartridge } from './cartridge';
import { DOJO_WORDS, dojoHud } from './interface';
import { ROOMS } from './rooms';
// Their source, as text (Vite reads it): to find the keys they use.
import rulesSource from './rules.ts?raw';
import interfaceSource from './interface.ts?raw';

beforeAll(initPhysics);

describe("the Dojo's interface (stage 3i)", () => {
  test('its words: the same keys in Spanish and in English, and every key its notices and its interface use', () => {
    expect(missingKeys(DOJO_WORDS)).toEqual([]);
    // What the rules tell (`notice(player, 'dojo.…'`, also in a choice: `? 'dojo.seen' : 'dojo.lost'`) and
    // what the interface says (`say('dojo.…'`, `words('dojo.…'`).
    const told = [...rulesSource.matchAll(/notice\(\s*player,\s*([^,)]+)/g)].flatMap((m) =>
      [...m[1]!.matchAll(/'(dojo\.[a-z.]+)'/g)].map((k) => k[1]!),
    );
    const said = [...interfaceSource.matchAll(/(?:say|words)\('(dojo\.[a-z.]+)'/g)].map((m) => m[1]!);
    const keys = new Set([...told, ...said]);
    expect(told.length).toBeGreaterThanOrEqual(6);
    expect(said.length).toBeGreaterThanOrEqual(7);
    expect([...keys].filter((k) => !(k in DOJO_WORDS.es) || !(k in DOJO_WORDS.en))).toEqual([]);
  });

  test("its HUD, in a level with a goal: the time, the falls, the stars; in Spanish, as the site's", () => {
    const registry = registryFor(DojoCartridge);
    registry.run(ROOMS.circuit!.text, 'recipe');
    const session = new Session(DojoCartridge, { registry });
    for (let i = 0; i < 90; i++) session.step();
    const hero = [...session.world.entities.values()].find((e) => e.character?.player === 1) as Entity;
    const say = sayer([DOJO_WORDS, ENGINE_WORDS], 'es');
    expect(dojoHud({ world: session.world, hero, say, language: 'es' })).toEqual([
      { label: 'Tiempo', value: '0:01,5' },
      { label: 'Caídas', value: '0' },
      { label: 'Estrellas', value: '0 de 3' },
    ]);
    // Without a goal (the Dojo's floor and cube), none.
    const plain = new Session(DojoCartridge, { registry: registryFor(DojoCartridge) });
    expect(dojoHud({ world: plain.world, hero: undefined, say, language: 'es' })).toEqual([]);
    session.world.dispose();
    plain.world.dispose();
  });
});
