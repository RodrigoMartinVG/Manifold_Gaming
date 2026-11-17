import { beforeAll, describe, expect, test } from 'vitest';
import { vec3, type Vec3 } from '@manifold/common';
import { BotHost, initPhysics, registryFor, Session, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { EYE, weapon } from './rules';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE ARENA (stage 4g): the demonstration's second half, played as a match is hosted (a host thinking
 * for the bots), and you driven as a player would, aiming from your eyes where a first-person camera is.
 */
function arena() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.arena!.text.replace(/^view\..*$/m, ''), 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const bots = new BotHost();
  const events: Event[] = [];
  const step = (input: PlayerInput = {}) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
    events.push(...session.world.stepEvents);
  };
  const all = () => [...session.world.entities.values()];
  const hero = (): Entity => all().find((e) => e.character?.player === 1)!;
  const guards = (): Entity[] => all().filter((e) => e.brain);
  return { session, events, step, hero, guards };
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const toward = (from: Vec3, to: Vec3): Vec3 => {
  const d = flat(from, to);
  return d < 0.05 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
};
/** The aim, from the eyes, at a point: where to face (flat) and the pitch (a quarter turn a unit). */
const aimAt = (e: Entity, at: Vec3): PlayerInput => {
  const eye = vec3.add(e.transform!.position, [0, EYE, 0]);
  const to = vec3.sub(at, eye);
  return { face: toward(eye, at), pitch: (Math.atan2(to[1], Math.hypot(to[0], to[2])) * 180) / Math.PI / 90 };
};

describe('the arena (stage 4g)', () => {
  test('a dart leaves the eyes: aimed from them at a dummy’s head, it strikes the head', () => {
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
    session.world.place(hero, [-6.5, 1, 8.2]);
    for (let i = 0; i < 10; i++) step();
    session.world.place(hero, [-3, 1, 2]);
    // Its head: 0.62 m above its center (its hit part's); aimed 4 cm above that, so the dart's degree of
    // spread (9 cm at 5 m) stays on it and off the shoulders (they are wide, and reach up beside it).
    const head = vec3.add(dummy.transform!.position, [0, 0.66, 0]);
    for (let i = 0; i < 40; i++) step(aimAt(hero, head));
    step({ ...aimAt(hero, head), 'dojo.attack': true });
    expect(events.filter((e) => e.type === 'hurt').at(-1)).toMatchObject({ target: dummy.id, part: 'head' });
    session.world.dispose();
  });

  test('from start to end: a dart from its rack; the three guards seen, shot, shooting back; all three down at once', () => {
    const { session, events, step, hero, guards } = arena();
    const world = () => session.world;
    step();
    step();
    expect(events.some((e) => e.type === 'scene')).toBe(true);
    expect(guards()).toHaveLength(3);
    expect(guards().every((g) => weapon(g)!.kind === 'dart')).toBe(true);
    // The dart's rack.
    for (let i = 0; i < 200 && weapon(hero())!.kind !== 'dart'; i++)
      step({ move: toward(hero().transform!.position, [-2, 0, 8.5]) });
    expect(weapon(hero())!.kind).toBe('dart');
    // Each standing guard in turn: towards it until within 12 m, then aim at its middle and shoot when
    // the dart is ready; down, the next. (Down, you wait to be back on your feet.)
    let i = 0;
    for (; i < 60 * 90 && world().named('clear')!.objective!.state !== 'done'; i++) {
      const h = hero();
      if ((h.health?.down ?? -1) >= 0) {
        step({});
        continue;
      }
      const standing = guards().filter((g) => (g.health?.down ?? -1) < 0);
      const g = standing.sort(
        (a, b) => flat(a.transform!.position, h.transform!.position) - flat(b.transform!.position, h.transform!.position),
      )[0];
      if (!g) {
        step({});
        continue;
      }
      const d = flat(g.transform!.position, h.transform!.position);
      const aim = aimAt(h, g.transform!.position);
      const ready = world().tick >= weapon(h)!.ready;
      if (d > 12) step({ move: toward(h.transform!.position, g.transform!.position), ...aim });
      else step({ ...aim, 'dojo.attack': ready && i % 2 === 0 });
    }
    const hurts = events.flatMap((e) => (e.type === 'hurt' ? [e] : []));
    const byHero = hurts.filter((h) => h.from === hero().id && h.kind === 'dart');
    const byGuards = hurts.filter((h) => h.target === hero().id && h.kind === 'dart');
    const fromGuards = events.filter((e) => e.type === 'shot' && guards().some((g) => g.id === e.from)).length;
    // Your darts struck; the guards shot back (whether they struck is the balance's: their aim trails
    // one who moves, and they take a second to see you); guards down; and the objective done: all
    // three down at once.
    expect(byHero.length).toBeGreaterThanOrEqual(12);
    expect(fromGuards).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === 'down' && guards().some((g) => g.id === e.target)).length).toBeGreaterThanOrEqual(3);
    expect(world().named('clear')!.objective!.state).toBe('done');
    console.log(
      `arena: cleared at ${(i / 60).toFixed(1)} s; ${byHero.length} darts struck, the guards shot ${fromGuards} and ${byGuards.length} struck you, ${events.filter((e) => e.type === 'down' && e.target === hero().id).length} times down`,
    );
    session.world.dispose();
  });
});
