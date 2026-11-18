import { beforeAll, describe, expect, test } from 'vitest';
import { vec3, type Vec3 } from '@manifold/common';
import { BotHost, initPhysics, registryFor, Session, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { EYE, GUNNER, gunnerOf, weapon } from './rules';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE ARENA (stage 4g): the demonstration's second half, played as a match is hosted (a host thinking
 * for the bots), and you driven as a player would, aiming from your eyes where a first-person camera is.
 */
function arena(more = '') {
  const registry = registryFor(DojoCartridge);
  const recipe = ROOMS.arena!.text.replace(/^view\..*$/m, '') + more;
  expect(registry.run(recipe, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
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
    step({ ...aimAt(hero, head), 'arms.attack': true });
    expect(events.filter((e) => e.type === 'hurt').at(-1)).toMatchObject({ target: dummy.id, part: 'head' });
    session.world.dispose();
  });

  test('crouched, a dart leaves the crouch’s head (stage 4.5b), as the first-person camera is: lower', () => {
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
    const hero = [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
    session.world.place(hero, [-6.5, 1, 8.2]);
    for (let i = 0; i < 10; i++) step();
    session.world.place(hero, [-3, 1, 2]);
    const from = (input: PlayerInput) => {
      for (let i = 0; i < 30; i++) step(input);
      step({ ...input, 'arms.attack': true });
      const shot = events.filter((e) => e.type === 'shot').at(-1);
      return shot && shot.type === 'shot' ? shot.start[1] - hero.transform!.position[1] : NaN;
    };
    expect(from({})).toBeCloseTo(EYE, 2);
    expect(from({ crouch: true })).toBeCloseTo(0.12, 2);
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
      else step({ ...aim, 'arms.attack': ready && i % 2 === 0 });
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

  test("its guards are the room's to tune (stage 4.5a): from its recipe, harder; untold, as they were; a new one, as the others", () => {
    // Standing still in the open for 30 s, as the author did: how often down, and when first.
    const still = (more: string) => {
      const { session, step, hero, guards } = arena(more);
      step();
      session.world.place(hero(), [0, 1, 3]);
      let downs = 0;
      let first = -1;
      for (let i = 0; i < 60 * 30; i++) {
        step();
        if (session.world.stepEvents.some((e) => e.type === 'down' && e.target === hero().id)) {
          downs++;
          if (first < 0) first = i / 60;
        }
      }
      const told = guards().map((g) => gunnerOf(g));
      session.world.dispose();
      return { downs, first, told };
    };
    const as = still('');
    // Untold, a guard carries nothing of it: it fights as GUNNER says (every world's hash as it was).
    expect(as.told.every((t) => t === GUNNER)).toBe(true);
    // The first numbers, half a second to see, a shot a second dead on, from the recipe.
    const hard = still('\ndojo.guards.see 0.5\ndojo.guards.every 1\ndojo.guards.aim 1');
    expect(hard.told.every((t) => t.see === 30 && t.every === 60 && t.aim === 1 && t.range === GUNNER.range)).toBe(true);
    // (Down, they let you go, and you are back where they do not see you: so once each, but sooner.)
    expect(hard.first).toBeGreaterThan(0);
    expect(hard.first).toBeLessThan(as.first);
    console.log(
      `standing still 30 s: as it is, down ${as.downs} (first at ${as.first.toFixed(1)} s); harder, ${hard.downs} (first at ${hard.first.toFixed(1)} s)`,
    );

    // A guard put in later fights as those already there; their health, from the recipe too.
    const { session, step } = arena('\ndojo.guards.see 0.25\ndojo.guards.health 50');
    step();
    session.world.place(
      [...session.world.entities.values()].find((e) => e.character?.player === 1)!,
      [0, 1, 6],
    );
    session.registry.run('dojo.guard 0 1 0', 'console');
    step();
    step();
    const all = [...session.world.entities.values()].filter((e) => e.brain);
    expect(all).toHaveLength(4);
    expect(all.every((g) => gunnerOf(g).see === 15 && g.health!.most === 50)).toBe(true);
    session.world.dispose();
  });
});
