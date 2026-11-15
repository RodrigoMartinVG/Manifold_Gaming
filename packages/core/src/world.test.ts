import { beforeAll, describe, expect, test } from 'vitest';
import { approx, quat } from '@manifold/common';
import { World, STEP } from './world';
import { stateHash } from './hash';
import { initPhysics } from './physics';

// Every world has its physics (stage 1a), and Rapier loads asynchronously.
beforeAll(initPhysics);

/** A world with some spinning boxes, at places and speeds taken from its randomness. */
function testWorld(seed: number) {
  const w = new World({ seed });
  for (let i = 0; i < 5; i++) {
    w.createEntity({
      transform: { position: [w.random.between(-5, 5), 1, w.random.between(-5, 5)], rotation: quat.identity() },
      spin: { angularVelocity: [w.random.between(-2, 2), w.random.between(-2, 2), w.random.between(-2, 2)] },
    });
  }
  return w;
}

describe('World', () => {
  test('every world has its own ids: two worlds created one after the other start the same', () => {
    const a = new World({ seed: 1 });
    const b = new World({ seed: 1 });
    expect(a.createEntity({}).id).toBe(1);
    expect(b.createEntity({}).id).toBe(1);
    expect(a.createEntity({}).id).toBe(2);
  });

  test('determinism: same seed, same hash at EVERY step; another seed, another hash', () => {
    const a = testWorld(5);
    const b = testWorld(5);
    const c = testWorld(6);
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
      c.step();
      expect(stateHash(b)).toBe(stateHash(a));
    }
    expect(stateHash(c)).not.toBe(stateHash(a));
  });

  test('the hash changes if any number changes (even by a rounding)', () => {
    const a = testWorld(5);
    const before = stateHash(a);
    const e = a.entities.get(3)!;
    e.transform!.position[1] += 1e-15;
    expect(stateHash(a)).not.toBe(before);
  });

  test('spin: after t seconds, the angle turned is |ω|·t, almost (and the rotation stays unit)', () => {
    const w = new World({ seed: 1 });
    const e = w.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.identity() },
      spin: { angularVelocity: [0, 0.9, 0] },
    });
    for (let i = 0; i < 120; i++) w.step(); // 2 s
    const q = e.transform!.rotation;
    // Without trigonometry (stage 1f), each step turns 2·atan(|ω|·dt/2): a hair less than |ω|·dt.
    expect(approx.angleBetween(quat.identity(), q)).toBeCloseTo(120 * 2 * Math.atan((0.9 * STEP) / 2), 9);
    expect(approx.angleBetween(quat.identity(), q)).toBeCloseTo(0.9 * 120 * STEP, 4);
    expect(Math.hypot(...q)).toBeCloseTo(1, 14);
  });

  test("events: the game sees each step's; the presentation, all the ones it has not read", () => {
    const w = new World({ seed: 1 });
    w.step();
    w.createEntity({});
    expect(w.stepEvents).toHaveLength(1);
    w.step(); // a new step: the game's list starts empty...
    expect(w.stepEvents).toHaveLength(0);
    w.createEntity({});
    // ...but the presentation, which did not read in between, sees both.
    expect(w.takeEvents().map((e) => e.type)).toEqual(['entityCreated', 'entityCreated']);
    expect(w.takeEvents()).toHaveLength(0);
  });
});

describe('spatial queries through the world (stage 2.5b)', () => {
  /** A floor, a box on it, a ball above, and a wall of group 2. */
  function scene() {
    const world = new World({ seed: 1 });
    const floor = world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] }, material: 'stone' },
    });
    const box = world.createEntity({
      transform: { position: [3, 0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
    });
    const ball = world.createEntity({
      transform: { position: [0, 2, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.5 } },
    });
    const wall = world.createEntity({
      transform: { position: [-3, 1, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.2, 1, 2] }, groups: { member: 0b10, filter: 0xffff } },
    });
    // Rapier's queries see a body from the step after it was created.
    world.step();
    return { world, floor, box, ball, wall };
  }

  test('a ray: the first entity it hits, how far, where, and the normal of its surface', () => {
    const { world, floor, box, ball } = scene();
    const hit = world.castRay([0, 5, 0], [0, -1, 0], 10)!;
    expect(hit.entity).toBe(ball.id); // the ball is first, above the floor
    expect(hit.normal[1]).toBeCloseTo(1, 3);
    // Leaving it out, or leaving out what the physics moves: the floor.
    expect(world.castRay([0, 5, 0], [0, -1, 0], 10, { skip: ball.id })!.entity).toBe(floor.id);
    const ground = world.castRay([0, 5, 0], [0, -1, 0], 10, { dynamic: false })!;
    expect(ground.entity).toBe(floor.id);
    expect(ground.distance).toBeCloseTo(5, 5);
    expect(ground.point[1]).toBeCloseTo(0, 5);
    // Along the floor towards +X, the box: its side, facing −X.
    const side = world.castRay([0, 0.5, 0], [1, 0, 0], 10)!;
    expect(side.entity).toBe(box.id);
    expect(side.distance).toBeCloseTo(2.5, 5);
    expect(side.normal[0]).toBeCloseTo(-1, 3);
    // Too short: nothing.
    expect(world.castRay([0, 0.5, 0], [1, 0, 0], 2)).toBeNull();
    world.dispose();
  });

  test('groups: a query sees only what its groups meet', () => {
    const { world, wall } = scene();
    expect(world.castRay([0, 1, 0], [-1, 0, 0], 10)!.entity).toBe(wall.id);
    // A query of a group that does not meet group 2 goes through the wall.
    expect(world.castRay([0, 1, 0], [-1, 0, 0], 10, { groups: { member: 0xffff, filter: 0b01 } })).toBeNull();
    world.dispose();
  });

  test('a shape moved along a line: the first entity it would touch, and how far it got', () => {
    const { world, box } = scene();
    // A ball of 0.25 m rolled along the floor towards the box: it touches it 0.25 m before its side.
    const hit = world.castShape({ kind: 'ball', radius: 0.25 }, [0, 0.5, 0], quat.identity(), [1, 0, 0], 10)!;
    expect(hit.entity).toBe(box.id);
    expect(hit.distance).toBeCloseTo(2.25, 3);
    world.dispose();
  });

  test("a body created during a step is in the queries from the next step on (Rapier's limit)", () => {
    const { world } = scene();
    const post = world.createEntity({
      transform: { position: [0, 0.5, 3], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
    });
    expect(world.castRay([0, 0.5, 0], [0, 0, 1], 10)).toBeNull();
    world.step();
    expect(world.castRay([0, 0.5, 0], [0, 0, 1], 10)!.entity).toBe(post.id);
    world.dispose();
  });

  test('the shortest way between two points: straight, until phase 7 glues spaces', () => {
    const world = new World({ seed: 1 });
    expect(world.shortestDelta([1, 2, 3], [4, 6, 3])).toEqual([3, 4, 0]);
    world.dispose();
  });

  test("a body's material is kept with it (the game's: the engine does not read it)", () => {
    const { world, floor } = scene();
    expect(floor.body!.material).toBe('stone');
    world.dispose();
  });
});
