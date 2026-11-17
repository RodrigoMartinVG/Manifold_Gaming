import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { stateHash } from './hash';
import { shotDice, spread } from './hits';
import { initPhysics } from './physics';
import type { Event, Projectile } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, and whatever else, in a world that collects every event. */
function room(seed = 1) {
  const world = new World({ seed });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [40, 0.5, 40] } },
  });
  const events: Event[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      world.step();
      events.push(...world.stepEvents);
    }
  };
  return { world, events, step };
}

const shoot = (world: World, at: Vec3, velocity: Vec3, o: Partial<Projectile> = {}) =>
  world.createEntity({
    transform: { position: at, rotation: quat.identity() },
    projectile: { from: null, velocity, radius: 0.03, damage: 30, kind: 'bolt', gravity: false, life: 120, ...o },
  });

describe('a shot’s own dice (stage 4c, decision 0022)', () => {
  test('the same world seed, step, player and shot: the same numbers; another shot, others; whatever the world drew', () => {
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    b.random.uint32();
    b.random.uint32();
    const numbers = (w: World, player: number, shot: number) => {
      const dice = shotDice(w, player, shot);
      return [dice.next(), dice.next()];
    };
    expect(numbers(a, 2, 0)).toEqual(numbers(b, 2, 0));
    expect(numbers(a, 2, 1)).not.toEqual(numbers(a, 2, 0));
    expect(numbers(a, 3, 0)).not.toEqual(numbers(a, 2, 0));
    expect(numbers(new World({ seed: 8 }), 2, 0)).not.toEqual(numbers(a, 2, 0));
    a.dispose();
    b.dispose();
  });

  test('a spread: within its cone, of length 1, filling it; none, the direction itself', () => {
    const w = new World({ seed: 3 });
    const forward: Vec3 = [0, 0, -1];
    let mean = 0;
    for (let shot = 0; shot < 400; shot++) {
      const d = spread(forward, [0, 1, 0], 2, shotDice(w, 1, shot));
      expect(vec3.length(d)).toBeCloseTo(1, 12);
      const angle = (Math.acos(Math.min(1, vec3.dot(d, forward))) * 180) / Math.PI;
      expect(angle).toBeLessThanOrEqual(2 + 1e-9);
      mean += angle / 400;
    }
    // Uniform over the disk of angles: on average two thirds of its edge.
    expect(mean).toBeCloseTo(4 / 3, 0);
    expect(spread(forward, [0, 1, 0], 0, shotDice(w, 1))).toEqual(forward);
    w.dispose();
  });
});

describe('projectiles (stage 4c)', () => {
  test('at 120 m/s, 2 m a step, a wall 2 cm thin stops it: never past it, and it says where it struck', () => {
    const { world, events, step } = room();
    world.createEntity({
      transform: { position: [0, 1, -10], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [2, 2, 0.01] } },
    });
    const bolt = shoot(world, [0, 1, 0], [0, 0, -120]);
    let deepest = 0;
    for (let i = 0; i < 20; i++) {
      step();
      const e = world.entities.get(bolt.id);
      if (e) deepest = Math.min(deepest, e.transform!.position[2]);
    }
    expect(world.entities.has(bolt.id)).toBe(false);
    expect(deepest).toBeGreaterThan(-10);
    const impact = events.find((e) => e.type === 'impact');
    expect(impact).toMatchObject({ type: 'impact', projectile: bolt.id, kind: 'bolt' });
    // Where it touched the wall: its face, at z = −9.99.
    expect(impact!.type === 'impact' && impact!.at[2]).toBeCloseTo(-9.99, 3);
    world.dispose();
  });

  test('it hurts the part of a character it strikes, from its shooter, and is gone; out of steps, it is gone too; gravity bends it', () => {
    const { world, events, step } = room();
    const target = world.createEntity({
      transform: { position: [0, 1, -8], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 2 },
      health: { most: 100 },
    });
    const shooter = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    step(30);
    // From inside its shooter: it is left out.
    shoot(world, [0, target.transform!.position[1], 0], [0, 0, -60], { from: shooter.id });
    step(20);
    expect(events.filter((e) => e.type === 'hurt')).toEqual([
      { type: 'hurt', target: target.id, from: shooter.id, part: 'body', kind: 'bolt', amount: 30 },
    ]);
    expect(target.health!.points).toBe(70);
    // Into the open, for 10 steps: gone after them.
    const lost = shoot(world, [0, 5, 0], [0, 0, 30], { life: 10 });
    step(9);
    expect(world.entities.has(lost.id)).toBe(true);
    step(1);
    expect(world.entities.has(lost.id)).toBe(false);
    // Bent: level at first, it falls as anything falls.
    const arc = shoot(world, [0, 10, 0], [5, 0, 0], { gravity: true });
    step(30);
    expect(arc.transform!.position[1]).toBeCloseTo(10 - 0.5 * 9.81 * 0.5 * 0.5, 0);
    world.dispose();
  });

  test('a snapshot with one in flight goes on to exactly the same', () => {
    const { world, step } = room();
    shoot(world, [0, 1, 0], [3, 2, -40], { gravity: true });
    step(5);
    const copy = World.restore(world.snapshot());
    expect(copy.seed).toBe(world.seed);
    step(30);
    for (let i = 0; i < 30; i++) copy.step();
    expect(stateHash(copy)).toBe(stateHash(world));
    world.dispose();
    copy.dispose();
  });
});
