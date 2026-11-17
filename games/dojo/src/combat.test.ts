import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, registryFor, Session, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { DUMMY, impactDamage, weapon } from './rules';

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

describe('the Dojo’s weapons (stage 4c)', () => {
  /** The hero placed at `at`, looking along `face`, with `kind` in its hands (it walked into its rack). */
  function armed(kind: 'dart' | 'bolt' | 'stick', at: [number, number, number], face: [number, number, number]) {
    const room = moves();
    const rack = { dart: [-6.5, 1, 8.2], bolt: [-5, 1, 8.6], stick: [-3.5, 1, 8.2] }[kind] as [number, number, number];
    room.session.world.place(room.hero, rack);
    for (let i = 0; i < 10; i++) room.step();
    expect(weapon(room.hero)!.kind).toBe(kind);
    room.session.world.place(room.hero, at);
    for (let i = 0; i < 30; i++) room.step({ face });
    return room;
  }
  const hurts = (events: Event[]) => events.flatMap((e) => (e.type === 'hurt' ? [e] : []));

  test('picked up walking into its rack; the dart: at once, where it aims, 25 points (50 on the head), and its tracer', () => {
    const { step, events, hero, dummy, session } = armed('dart', [-3, 1, 2], [-1, 0, 0]);
    step({ face: [-1, 0, 0], 'dojo.attack': true });
    expect(hurts(events)).toEqual([{ type: 'hurt', target: dummy.id, from: hero.id, part: 'body', kind: 'dart', amount: 25 }]);
    const shot = events.find((e) => e.type === 'shot');
    expect(shot).toMatchObject({ type: 'shot', from: hero.id, hit: dummy.id, kind: 'dart' });
    // Held, it does not fire again; pressed again before it is ready (12 steps), nothing.
    for (let i = 0; i < 5; i++) step({ face: [-1, 0, 0], 'dojo.attack': true });
    step({ face: [-1, 0, 0] });
    step({ face: [-1, 0, 0], 'dojo.attack': true });
    expect(hurts(events)).toHaveLength(1);
    // Aimed a little up, at the head (0.62 m above the center, 5 m away): double.
    for (let i = 0; i < 20; i++) step({ face: [-1, 0, 0], pitch: 0.03 });
    step({ face: [-1, 0, 0], pitch: 0.03, 'dojo.attack': true });
    expect(hurts(events).at(-1)).toMatchObject({ part: 'head', amount: 50 });
    session.world.dispose();
  });

  test('the bolt: it flies, and strikes the dummy; at the pane 2 cm thin, it stops, and the dummy behind it is not touched', () => {
    const { step, events, dummy, hero, session } = armed('bolt', [-3, 1, 2], [-1, 0, 0]);
    step({ face: [-1, 0, 0], 'dojo.attack': true });
    expect([...session.world.entities.values()].some((e) => e.projectile)).toBe(true);
    for (let i = 0; i < 10; i++) step({ face: [-1, 0, 0] });
    expect(hurts(events)).toMatchObject([{ target: dummy.id, kind: 'bolt', amount: 35 }]);
    // Through the pane at the one behind it (from in front of the pane, along −Z).
    const behind = [...session.world.entities.values()].find((e) => e.character?.player === 0 && e.id !== dummy.id)!;
    expect(behind.transform!.position[2]).toBeCloseTo(-5, 1);
    session.world.place(hero, [-8, 1, 1]);
    for (let i = 0; i < 30; i++) step({ face: [0, 0, -1] });
    step({ face: [0, 0, -1], 'dojo.attack': true });
    for (let i = 0; i < 20; i++) step({ face: [0, 0, -1] });
    expect(behind.health!.points).toBe(100);
    expect(events.filter((e) => e.type === 'impact').at(-1)).toMatchObject({
      kind: 'bolt',
      hit: session.world.named('pane')!.id,
    });
    session.world.dispose();
  });

  test('the stick: its tip sweeps in front over its steps; the dummy beside it is hit once a strike, 30 points', () => {
    const { step, events, dummy, session } = armed('stick', [-7, 1, 2], [-1, 0, 0]);
    step({ face: [-1, 0, 0], 'dojo.attack': true });
    for (let i = 0; i < 20; i++) step({ face: [-1, 0, 0] });
    expect(hurts(events)).toMatchObject([{ target: dummy.id, kind: 'stick', amount: 30 }]);
    // Another strike, once ready: once more.
    for (let i = 0; i < 10; i++) step({ face: [-1, 0, 0] });
    step({ face: [-1, 0, 0], 'dojo.attack': true });
    for (let i = 0; i < 20; i++) step({ face: [-1, 0, 0] });
    expect(hurts(events)).toHaveLength(2);
    session.world.dispose();
  });

  test('a dart looking back: at a second player running across its aim, it hits where its shooter saw it 10 steps ago, not where it is now', () => {
    /** The hero aiming along −Z from x = −3; player 2 running along +X 6 m ahead, until 10 steps ago it was on the aim; then a dart, looking back `back`. */
    const fire = (back: number) => {
      const { session, step, events, hero } = armed('dart', [-3, 1, 2], [0, 0, -1]);
      session.registry.run('players.join 2');
      step({ face: [0, 0, -1] });
      const runner = [...session.world.entities.values()].find((e) => e.character?.player === 2)!;
      runner.health = { points: 100, most: 100, down: -1 };
      session.world.place(runner, [-7, 1, -4]);
      let s = 0;
      for (; s < 300 && (runner.character!.history.at(-10)?.position[0] ?? -9) < -3; s++) {
        session.setInput(2, { move: [1, 0, 0] });
        step({ face: [0, 0, -1] });
      }
      session.setInput(2, { move: [1, 0, 0] });
      step({ face: [0, 0, -1], 'dojo.attack': true, back });
      const ahead = runner.transform!.position[0] - -3;
      const hit = hurts(events).filter((h) => h.target === runner.id);
      session.world.dispose();
      return { ahead, hit, hero: hero.id, runner: runner.id };
    };
    const now = fire(0);
    // Running, it was already more than its width past the aim when the dart flew.
    expect(now.ahead).toBeGreaterThan(0.5);
    expect(now.hit).toEqual([]);
    const then = fire(10);
    expect(then.hit).toEqual([{ type: 'hurt', target: then.runner, from: then.hero, part: 'body', kind: 'dart', amount: 25 }]);
  });
});
