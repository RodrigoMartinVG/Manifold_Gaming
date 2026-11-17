import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { LOCK_RANGE } from './character';
import { NO_INPUT } from './input';
import { initPhysics } from './physics';
import type { Entity, Event, PlayerInput } from './types';
import { CHARACTER_MASS, World } from './world';

beforeAll(initPhysics);

/**
 * MOVING FOR COMBAT (stage 4f): a blast's push, a lock-on that circles without drifting away, blocking.
 * In a world with a floor (its top at y = 0) and characters, their inputs as a session would give them.
 */
function arena() {
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  const character = (player: number, at: Vec3, can = {}) =>
    world.createEntity({
      transform: { position: at, rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player, can },
      health: { most: 100 },
    });
  const events: Event[] = [];
  const step = (inputs: Record<number, PlayerInput> = {}) => {
    world.applyInputs(new Map(Object.entries(inputs).map(([p, i]) => [Number(p), { ...NO_INPUT, ...i }])));
    world.step();
    events.push(...world.stepEvents);
  };
  return { world, character, events, step };
}

const flat = (a: Entity, b: Entity) => {
  const p = a.transform!.position;
  const q = b.transform!.position;
  return Math.hypot(p[0] - q[0], p[2] - q[2]);
};

describe('a blast (stage 4f)', () => {
  test('it pushes away what the physics moves and the characters near it, less farther, none behind a wall; heard and said', () => {
    const { world, character, events, step } = arena();
    const crate = world.createEntity({
      transform: { position: [2, 0.25, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] }, density: 400 },
    });
    const near = character(1, [0, 0.82, 1.5]);
    const far = character(2, [0, 0.82, -3.5]);
    world.createEntity({
      transform: { position: [-2, 1, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.1, 1, 2] } },
    });
    const sheltered = character(3, [-3, 0.82, 0]);
    for (let i = 0; i < 30; i++) step();
    events.length = 0;
    const pushed = world.explode([0, 0.1, 0], 4, 600, near.id);
    // (Between steps, its events are the last step's: read now. A game calls it in its rules, in a step.)
    const said = [...world.stepEvents];

    const share = (e: Entity) => pushed.find((p) => p.entity === e.id)?.share;
    expect(share(near)).toBeGreaterThan(share(far)!);
    expect(share(sheltered)).toBeUndefined();
    // A character: its velocity changed as if it weighed 80 kg, away from the blast and up.
    const v = near.character!.velocity;
    expect(vec3.length(v)).toBeCloseTo((600 * share(near)!) / CHARACTER_MASS, 6);
    expect(v[2]).toBeGreaterThan(0);
    expect(v[1]).toBeGreaterThan(0);
    const z0 = near.transform!.position[2];
    expect(near.character!.thrown).toBe(true);
    for (let i = 0; i < 20; i++) step();
    // Off the ground, and away: thrown, what it was given stays until it lands (about 1.5 m, here).
    expect(near.transform!.position[2]).toBeGreaterThan(z0 + 1);
    for (let i = 0; i < 60; i++) step();
    expect(near.character!.grounded).toBe(true);
    expect(near.character!.thrown).toBe(false);
    expect(said.some((e) => e.type === 'blast')).toBe(true);
    expect(said.find((e) => e.type === 'sound' && e.sound === 'blast')).toMatchObject({ source: near.id });
    // The crate went away along +X; the sheltered one did not move.
    expect(crate.transform!.position[0]).toBeGreaterThan(2.3);
    expect(Math.abs(sheltered.transform!.position[0] + 3)).toBeLessThan(0.01);
    world.dispose();
  });
});

describe('the lock-on (stage 4f)', () => {
  test('`lock` takes the nearest in front; asked to the side for a whole circle, it goes round it at the same distance, facing it', () => {
    const { world, character, step } = arena();
    const hero = character(1, [0, 0.82, 3]);
    const target = character(2, [0, 0.82, 0]);
    character(3, [0, 0.82, 8]); // behind it: not taken
    for (let i = 0; i < 30; i++) step();
    step({ 1: { lock: true } });
    step({ 1: {} });
    expect(hero.character!.lock).toBe(target.id);
    const r0 = flat(hero, target);
    // A whole circle at walking speed: 2π · 3 m at 4.5 m/s, a little over four seconds.
    let most = 0;
    let angle = 0;
    let last = Math.atan2(hero.transform!.position[0], hero.transform!.position[2]);
    for (let i = 0; i < 260; i++) {
      step({ 1: { side: 1 } });
      most = Math.max(most, Math.abs(flat(hero, target) - r0));
      const now = Math.atan2(hero.transform!.position[0], hero.transform!.position[2]);
      angle += Math.atan2(Math.sin(now - last), Math.cos(now - last));
      last = now;
      // Facing it, always.
      const f = hero.character!.facing;
      const to = vec3.normalize(vec3.sub(target.transform!.position, hero.transform!.position));
      expect(f[0] * to[0] + f[2] * to[2]).toBeGreaterThan(0.99);
    }
    expect(Math.abs(angle)).toBeGreaterThan(2 * Math.PI * 0.9);
    // Within 5 cm of where it started, all the way round.
    expect(most).toBeLessThan(0.05);
    // `lock` again lets go.
    step({ 1: { lock: true } });
    expect(hero.character!.lock).toBeNull();
    world.dispose();
  });

  test('without it, the same steps to the side go straight, and away; it lets go of one gone too far or down', () => {
    const { world, character, step } = arena();
    const hero = character(1, [0, 0.82, 3]);
    const target = character(2, [0, 0.82, 0]);
    for (let i = 0; i < 30; i++) step();
    for (let i = 0; i < 120; i++) step({ 1: { side: 1, face: [0, 0, -1] } });
    expect(flat(hero, target)).toBeGreaterThan(3 + 3);
    // Locked, then the target goes down: it lets go.
    world.place(hero, [0, 0.82, 3]);
    for (let i = 0; i < 10; i++) step({ 1: { face: [0, 0, -1] } });
    step({ 1: { lock: true } });
    step();
    expect(hero.character!.lock).toBe(target.id);
    world.hurt(target.id, 200);
    step();
    expect(hero.character!.lock).toBeNull();
    expect(LOCK_RANGE).toBe(15);
    world.dispose();
  });
});

describe('blocking (stage 4f)', () => {
  test('holding `block` on the ground, a character that can block guards itself: slower; one that cannot, walks', () => {
    const { world, character, step } = arena();
    const blocker = character(1, [0, 0.82, 0], { block: true });
    const walker = character(2, [3, 0.82, 0]);
    for (let i = 0; i < 30; i++) step();
    const z = [blocker.transform!.position[2], walker.transform!.position[2]];
    for (let i = 0; i < 60; i++) step({ 1: { move: [0, 0, -1], block: true }, 2: { move: [0, 0, -1], block: true } });
    expect(blocker.character!.mode).toBe('block');
    expect(walker.character!.mode).toBe('walk');
    // A second: about 2 m blocking, about 4.5 walking.
    expect(z[0]! - blocker.transform!.position[2]).toBeCloseTo(2, 0);
    expect(z[1]! - walker.transform!.position[2]).toBeGreaterThan(4);
    world.dispose();
  });
});
