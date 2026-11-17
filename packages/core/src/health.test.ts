import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import type { Event } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A floor and a character with 100 points (player 1). */
function room() {
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  const hero = world.createEntity({
    transform: { position: [0, 1, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
    health: { most: 100 },
  });
  const events: Event[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      world.step();
      events.push(...world.stepEvents);
    }
  };
  return { world, hero, step, events };
}

describe('health (stage 4c)', () => {
  test('a hit takes points, through the game’s filter, and says so; out of points it goes down, and takes no more', () => {
    const { world, hero, step } = room();
    step(30);
    // The game's policy: a hit on the head takes double.
    world.filterDamage = (_w, d) => (d.part === 'head' ? 2 * d.amount : d.amount);
    expect(world.hurt(hero.id, 30, { from: 7, part: 'body', kind: 'shot' })).toBe(30);
    expect(world.stepEvents.at(-1)).toEqual({ type: 'hurt', target: hero.id, from: 7, part: 'body', kind: 'shot', amount: 30 });
    expect(world.hurt(hero.id, 20, { part: 'head' })).toBe(40);
    expect(hero.health).toEqual({ points: 30, most: 100, down: -1 });
    // More than it has: what it has; down, at this step.
    expect(world.hurt(hero.id, 50)).toBe(30);
    expect(hero.health).toEqual({ points: 0, most: 100, down: world.tick });
    expect(world.stepEvents.at(-1)).toEqual({ type: 'down', target: hero.id, from: null });
    expect(world.hurt(hero.id, 10)).toBe(0);
    // Nothing, or something with no health: nothing.
    expect(world.hurt(hero.id + 99, 10)).toBe(0);
    world.dispose();
  });

  test('down, a character asks for nothing; it comes back with all its points, where the game says', () => {
    const { world, hero, step, events } = room();
    step(30);
    world.hurt(hero.id, 100);
    const where = [...hero.transform!.position];
    for (let i = 0; i < 30; i++) {
      world.inputs.set(1, { move: [1, 0, 0], jump: i === 3 });
      step();
    }
    expect(hero.transform!.position[0]).toBeCloseTo(where[0]!, 6);
    expect(hero.character!.grounded).toBe(true);
    // (A game revives in its rules, after the step's phases: among that step's events.)
    world.revive(hero.id, [3, 1, 0]);
    expect(world.stepEvents.at(-1)).toEqual({ type: 'revived', target: hero.id });
    expect(hero.health).toEqual({ points: 100, most: 100, down: -1 });
    step(30);
    expect(hero.transform!.position[0]).toBeGreaterThan(3);
    expect(events.filter((e) => e.type === 'down')).toEqual([]);
    world.dispose();
  });

  test('health is data: in the hash, and a snapshot goes on to exactly the same; a health of nothing is refused', () => {
    const { world, hero, step } = room();
    step(10);
    const before = stateHash(world);
    world.hurt(hero.id, 1);
    expect(stateHash(world)).not.toBe(before);
    const copy = World.restore(world.snapshot());
    expect(copy.entities.get(hero.id)!.health).toEqual({ points: 99, most: 100, down: -1 });
    step(20);
    for (let i = 0; i < 20; i++) copy.step();
    expect(stateHash(copy)).toBe(stateHash(world));
    expect(() => world.createEntity({ health: { most: 0 } })).toThrow(/more than 0/);
    world.dispose();
    copy.dispose();
  });
});
