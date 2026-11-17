import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { buildNav, findPath } from '@manifold/bots';
import { initPhysics, levelOfWorld, levelToText, registryFor, Session, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/** The kit room (stage 4.5e), its player put somewhere and driven straight at a point along the ground. */
function room() {
  const registry = registryFor(DojoCartridge);
  registry.run(ROOMS.kit!.text, 'recipe');
  const session = new Session(DojoCartridge, { registry });
  for (let i = 0; i < 20; i++) session.step();
  const hero = () => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const walk = (from: Vec3, to: Vec3, steps = 360) => {
    session.world.place(hero(), from);
    for (let i = 0; i < 20; i++) session.step();
    for (let i = 0; i < steps; i++) {
      const p = hero().transform!.position;
      const d = Math.hypot(to[0] - p[0], to[2] - p[2]);
      const input: PlayerInput = d < 0.3 ? {} : { move: [(to[0] - p[0]) / d, 0, (to[2] - p[2]) / d] };
      session.setInput(1, input);
      session.step();
    }
    return [...hero().transform!.position] as Vec3;
  };
  return { session, registry, walk };
}

describe('the kit room (stage 4.5e)', () => {
  test('every piece of the kit is in it, each one body drawn with its model; written back as kit lines', () => {
    const { session } = room();
    const pieces = [...session.world.entities.values()].filter((e) => e.appearance?.model?.startsWith('kit.'));
    expect(new Set(pieces.map((e) => e.appearance!.model)).size).toBe(Object.keys(DojoCartridge.kit!).length);
    expect(pieces.every((e) => e.body?.type === 'fixed' && e.body.shape.kind === 'compound')).toBe(true);
    expect(levelToText(levelOfWorld(session.world))).toContain('kit wall_door  -2 0 -12');
    session.world.dispose();
  });

  test('walked: up the stairs of a floor to the platform 3 m up, up the ramp to the one a meter up, across the bridge', () => {
    const { session, walk } = room();
    // (Its center 0.82 m over its feet: on the landing, 3 m up; on the ramp's top, 1 m.)
    expect(walk([-6, 1, 16], [-6, 0, 8])[1]).toBeCloseTo(3.82, 1);
    expect(walk([3, 1, 15.5], [3, 0, 9])[1]).toBeCloseTo(1.82, 1);
    const across = walk([12, 1.82, 9], [12, 0, 15]);
    expect(across[2]).toBeGreaterThan(14);
    expect(across[1]).toBeCloseTo(1.82, 1);
    session.world.dispose();
  });

  test('the navigation goes up the stairs of a floor walking, step by step (its tops are the kit’s boxes)', () => {
    const { session } = room();
    const nav = buildNav(session.world);
    const path = findPath(session.world, nav, [-6, 0, 16], [-6, 3, 8], { depth: 1 });
    expect(path).not.toBeNull();
    expect(path!.steps.every((s) => s.kind === 'start' || s.kind === 'walk')).toBe(true);
    // And up the ramp, its slope turned within its piece.
    const ramp = findPath(session.world, nav, [3, 0, 15.5], [3, 1, 9], { depth: 1 });
    expect(ramp?.steps.every((s) => s.kind === 'start' || s.kind === 'walk')).toBe(true);
    session.world.dispose();
  });

  test('the console adds a piece with its line; one the kit does not have, it says why', () => {
    const { session, registry } = room();
    expect(registry.run('add kit block_1 0 0 10  name cube_new', 'console').filter((m) => m.level === 'error')).toEqual([]);
    session.step();
    expect(session.world.named('cube_new')?.appearance?.model).toBe('kit.block_1');
    const said = registry.run('add kit tower 0 0 10', 'console');
    expect(said.some((m) => m.level === 'error' && /not a piece of this game's kit/.test(m.text))).toBe(true);
    session.world.dispose();
  });
});
