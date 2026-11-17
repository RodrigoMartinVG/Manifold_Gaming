import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, registryFor, Session, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { DUMMY, impactDamage } from './rules';

beforeAll(initPhysics);

/** The room `moves`, its hero and its training dummy, and every event of every step. */
function moves() {
  const registry = registryFor(DojoCartridge);
  registry.run('seed 3\ndojo.level moves', 'recipe');
  const session = new Session(DojoCartridge, { registry });
  const events: Event[] = [];
  const step = (input: PlayerInput = {}) => {
    session.setInput(1, input);
    session.step();
    events.push(...session.world.stepEvents);
  };
  for (let i = 0; i < 30; i++) step();
  const all = () => [...session.world.entities.values()];
  const hero = all().find((e) => e.character?.player === 1)!;
  const dummy = all().find((e) => e.character?.player === 0)!;
  return { session, world: () => session.world, step, events, hero, dummy };
}

describe('the training dummy (stage 4c)', () => {
  test('where its zone is, looking where it looks, with 100 points; the hero has none', () => {
    const { dummy, hero, session } = moves();
    expect(dummy.health).toEqual({ points: DUMMY.health, most: DUMMY.health, down: -1 });
    expect(dummy.transform!.position[0]).toBeCloseTo(-8, 3);
    expect(dummy.character!.facing[0]).toBeCloseTo(1, 6);
    expect(hero.health).toBeUndefined();
    session.world.dispose();
  });

  test('balls thrown at it hurt it, from who threw them; out of points it goes down, and three seconds later it is back', () => {
    const { session, step, events, hero, dummy } = moves();
    // Three meters from it, looking at it, a tap every half second.
    session.world.place(hero, [-5, 1, 2]);
    for (let i = 0; i < 20; i++) step({ face: [-1, 0, 0] });
    let s = 0;
    while (dummy.health!.down < 0 && s < 3600) {
      step({ face: [-1, 0, 0], 'dojo.throw': s % 30 === 0 });
      s++;
    }
    const hurts = events.filter((e) => e.type === 'hurt');
    expect(dummy.health!.down).toBeGreaterThan(0);
    expect(hurts.length).toBeGreaterThan(2);
    expect(hurts.every((h) => h.type === 'hurt' && h.target === dummy.id && h.from === hero.id && h.kind === 'impact')).toBe(
      true,
    );
    expect(events.filter((e) => e.type === 'down')).toEqual([{ type: 'down', target: dummy.id, from: hero.id }]);
    console.log(`down after ${hurts.length} hits: ${hurts.map((h) => (h.type === 'hurt' ? h.amount : 0)).join(', ')}`);
    // Down, it stands there three seconds; then it is back, with all its points.
    const down = dummy.health!.down;
    while (session.world.tick < down + DUMMY.back) step({ face: [-1, 0, 0] });
    expect(dummy.health).toEqual({ points: DUMMY.health, most: DUMMY.health, down: -1 });
    expect(events.filter((e) => e.type === 'revived')).toEqual([{ type: 'revived', target: dummy.id }]);
    session.world.dispose();
  });

  test('the Dojo’s filter: a hit on the head takes double; one’s own ball nothing; a ball’s hit, four times its energy', () => {
    const { session, dummy } = moves();
    const w = session.world;
    expect(w.hurt(dummy.id, 10, { part: 'head' })).toBe(20);
    expect(w.hurt(dummy.id, 10, { part: 'body' })).toBe(10);
    expect(w.hurt(dummy.id, 10, { from: dummy.id })).toBe(0);
    expect(impactDamage(0.01)).toBe(0);
    expect(impactDamage(3.1)).toBe(12);
    expect(impactDamage(100)).toBe(50);
    session.world.dispose();
  });
});
