import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { BotHost, initPhysics, registryFor, Session, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import type { GuardMemory } from './guard';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE GUARDS (stage 4e): played as a match is hosted, a host thinking for them before each step
 * (decision 0023), and the hero driven as a player would.
 */
function room(recipe: string, lines: string[]) {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(recipe, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  // (World changes, once there is a world: they enter at its first step.)
  for (const line of lines) expect(session.registry.run(line, 'console').filter((m) => m.level === 'error')).toEqual([]);
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
  const guard = (): Entity => all().find((e) => e.brain)!;
  const memory = () => bots.memoryOf(guard().id) as GuardMemory | undefined;
  return { session, bots, events, step, hero, guard, memory };
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const toward = (from: Vec3, x: number, z: number): Vec3 => {
  const d = Math.hypot(x - from[0], z - from[2]);
  return d < 0.05 ? [0, 0, 0] : [(x - from[0]) / d, 0, (z - from[2]) / d];
};

describe('the guards (stage 4e)', () => {
  test('a guard keeps to its route, there and back, and a sound behind it brings it to look', () => {
    const { session, step, guard, memory } = room('seed 3\ndojo.level moves', [
      'add route beat  -4 0 -2  4 0 -2',
      'dojo.guard -4 1 -2 beat',
    ]);
    for (let i = 0; i < 2; i++) step();
    const xs: number[] = [];
    for (let i = 0; i < 360; i++) {
      step();
      xs.push(guard().transform!.position[0]);
    }
    // From one end to the other and back: it got near both.
    expect(Math.max(...xs)).toBeGreaterThan(3);
    expect(xs.slice(xs.indexOf(Math.max(...xs))).some((x) => x < 0)).toBe(true);
    expect(memory()!.mode).toBe('patrol');
    // A ball dropped 4 m behind it: it hears it land, and goes to look.
    const at = guard().transform!.position;
    session.registry.run(`dojo.spawn ${at[0]} 3 ${at[2] + 4}`, 'console');
    let looked = false;
    for (let i = 0; i < 120 && !looked; i++) {
      step();
      looked = memory()!.mode === 'look';
    }
    expect(looked).toBe(true);
    session.world.dispose();
  });

  test('the keep: you ride the lift up; the guard behind the door hears it, opens the door, calls the lift down, rides up after you, and fights you', () => {
    const r = room(ROOMS.keep!.text, ['add route yard loop  -3 0 6  -3 0 2  3 0 2  3 0 6', 'dojo.guard -3 1 6 yard']);
    const { session, step, hero, guard, memory, events } = r;
    const world = () => session.world;
    for (let i = 0; i < 2; i++) step();
    // The act starts with you on the lift, past the shut door: it goes up with you, humming.
    session.registry.run('dojo.goto 0 1.2 -4', 'console');
    step();
    let heard = -1;
    let pressed = -1;
    let called = -1;
    let rode = -1;
    let guardTop = -1;
    const at = () => hero().transform!.position;
    for (let i = 0; i < 3600; i++) {
      const s = world().tick;
      const g = guard();
      const m = memory();
      if (heard < 0 && m?.mode === 'look') heard = s;
      if (pressed < 0 && world().signal('gate') !== 0) pressed = s;
      if (called < 0 && world().signal('sent') !== 0 && flat(g.transform!.position, [-2.6, 0, -3.4]) < 0.8) called = s;
      if (rode < 0 && called >= 0 && world().signal('riding') !== 0 && flat(g.transform!.position, [0, 0, -4]) < 1.1) rode = s;
      if (guardTop < 0 && g.transform!.position[1] > 4.8) guardTop = s;
      // You: up at the top, off the lift and along the hall, then on the lit plate before the last door, waiting.
      const p = at();
      const input: PlayerInput =
        p[1] < 4.8 ? {} : p[2] > -12 ? { move: toward(p, 0, -12) } : { move: toward(p, 0, -16.5), face: [0, 0, 1] };
      step(input);
      if ((hero().health?.down ?? -1) >= 0) break;
    }
    const hits = events.flatMap((e) => (e.type === 'hurt' && e.target === hero().id ? [e] : []));
    // Each part, in its order.
    expect(heard).toBeGreaterThan(0);
    expect(pressed).toBeGreaterThan(heard);
    expect(called).toBeGreaterThan(pressed);
    expect(rode).toBeGreaterThan(called);
    expect(guardTop).toBeGreaterThan(rode);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.from === guard().id && h.kind === 'stick')).toBe(true);
    // Out of points, you went down.
    expect(events.some((e) => e.type === 'down' && e.target === hero().id)).toBe(true);
    console.log(`heard ${heard}, door ${pressed}, called ${called}, rode ${rode}, up ${guardTop}, ${hits.length} hits, down at ${world().tick}`);
    session.world.dispose();
  });
});
