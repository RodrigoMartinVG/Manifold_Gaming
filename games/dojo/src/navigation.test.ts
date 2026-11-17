import { beforeAll, describe, expect, test } from 'vitest';
import { buildNav, findPath } from '@manifold/bots';
import { initPhysics, registryFor, Session } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/** The keep (closing phase 3), as its room starts, stepped once. */
function keep() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.keep!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  session.step();
  return session;
}

/** Where the keep's path starts (the start, by the first door) and ends (the plate before the last door, up in the hall). */
const START = [0, 1, 6] as const;
const PLATE = [0, 5.2, -16.5] as const;

describe('the keep’s navigation (stage 4d): the demonstration', () => {
  test('from the start to the plate in the dark hall: through the door (pressing its button), onto the lift, up, and along the hall', () => {
    const session = keep();
    const world = session.world;
    const t0 = performance.now();
    const nav = buildNav(world);
    const built = performance.now() - t0;
    expect(nav.reason).toBeNull();
    const t1 = performance.now();
    const path = findPath(world, nav, [...START], [...PLATE], { depth: 2 })!;
    const found = performance.now() - t1;
    expect(path).not.toBeNull();
    const kinds = path.steps.map((s) => s.kind);
    // The door is shut: its button first (pressing `use` by it), through the door, the ride up.
    expect(kinds).toContain('use');
    expect(path.steps.find((s) => s.kind === 'use')!.zone).toBe('button');
    expect(path.steps.some((s) => s.door === 'door')).toBe(true);
    expect(kinds).toContain('ride');
    expect(kinds.indexOf('use')).toBeLessThan(kinds.indexOf('ride'));
    // Off the lift at its top, walking onto the ledge (nothing jumped).
    expect(kinds.slice(kinds.indexOf('ride') + 1).every((k) => k === 'walk')).toBe(true);
    // It ends on the plate, up on the ledge.
    const end = path.steps.at(-1)!.at;
    expect(end[1]).toBeCloseTo(4.35, 1);
    expect(Math.abs(end[2] - PLATE[2])).toBeLessThanOrEqual(0.5);
    // Not up the ledge's 4.3 m wall: the games' character does not climb (in the Dojo, until `dojo.climb on`).
    expect(kinds).not.toContain('climb');
    expect({ cells: nav.cells.length, built: Math.round(built), found: Math.round(found * 10) / 10 }).toMatchObject({
      cells: expect.any(Number),
    });
    expect(built).toBeLessThan(2000);
    expect(found).toBeLessThan(200);
    session.world.dispose();
  });

  test('the lift up (someone rode it): the plan goes to the plate by its foot that calls it down, then up it; a body that climbs, up the wall', () => {
    const session = keep();
    const world = session.world;
    // Open the door and send the lift up, as a player would: the lift's latch is set by riding it.
    session.registry.run('dojo.goto 1.6 1 0.7', 'console');
    session.setInput(1, { use: true });
    session.step();
    session.setInput(1, {});
    for (let i = 0; i < 90; i++) session.step();
    expect(world.signal('gate')).toBe(1);
    session.registry.run('dojo.goto 0 1.2 -4', 'console');
    for (let i = 0; i < 240; i++) session.step();
    expect(world.signal('lift_up')).toBe(1);
    session.registry.run('dojo.goto 0 1 6', 'console');
    session.step();
    const nav = buildNav(world);
    const path = findPath(world, nav, [...START], [...PLATE], { depth: 2 })!;
    const kinds = path.steps.map((s) => s.kind);
    // The door is open now: no button; the plate that calls the lift down, stood on; then the ride.
    expect(kinds).not.toContain('use');
    const stand = path.steps.find((s) => s.kind === 'stand')!;
    expect(stand.zone).toBe('call_down');
    expect(kinds.indexOf('stand')).toBeLessThan(kinds.indexOf('ride'));
    expect(path.changes.map((c) => [c.signal, c.value])).toEqual([['lift_up', 0]]);
    // And a body that climbs need not wait for the lift: up the wall.
    const climbing = findPath(world, nav, [...START], [...PLATE], { depth: 2, can: { climb: true } })!;
    expect(climbing.steps.map((s) => s.kind)).toContain('climb');
    session.world.dispose();
  });
});
