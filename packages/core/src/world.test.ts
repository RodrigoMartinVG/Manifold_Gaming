import { beforeAll, describe, expect, test } from 'vitest';
import { approx, quat } from '@manifold/common';
import { component } from './components';
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

  test("a body's material is kept with it: the game reads its name (the sound of a step), and since 3b its friction and bounce are the material's", () => {
    const { world, floor } = scene();
    expect(floor.body!.material).toBe('stone');
    expect([floor.body!.friction, floor.body!.restitution]).toEqual([0.6, 0.2]);
    world.dispose();
  });
});

describe('names and materials (stage 3b)', () => {
  const at = { transform: { position: [0, 0, 0] as [number, number, number], rotation: quat.identity() } };

  test('an entity found by its name; a name names one entity, and is free again when it is gone', () => {
    const world = new World({ seed: 1 });
    const door = world.createEntity({ ...at, name: 'door_north' });
    expect(world.named('door_north')).toBe(door);
    expect(world.named('door_south')).toBeUndefined();
    expect(() => world.createEntity({ ...at, name: 'door_north' })).toThrow(/"door_north" is already another entity's name/);
    expect(() => world.createEntity({ ...at, name: 'Door North' })).toThrow(/is not a name/);
    world.removeEntity(door.id);
    expect(() => world.createEntity({ ...at, name: 'door_north' })).not.toThrow();
    world.dispose();
  });

  test("a body takes its material's friction and bounce, unless they are given; one the world does not know is an error", () => {
    const world = new World({ seed: 1 });
    const box = { kind: 'box' as const, halfExtents: [1, 1, 1] as [number, number, number] };
    const ice = world.createEntity({ ...at, body: { type: 'fixed', shape: box, material: 'ice' } });
    expect([ice.body!.friction, ice.body!.restitution]).toEqual([0.05, 0.05]);
    const given = world.createEntity({ ...at, body: { type: 'fixed', shape: box, material: 'ice', friction: 0.3 } });
    expect([given.body!.friction, given.body!.restitution]).toEqual([0.3, 0.05]);
    // Nothing said: stone's numbers, and no material.
    const plain = world.createEntity({ ...at, body: { type: 'fixed', shape: box } });
    expect([plain.body!.friction, plain.body!.restitution, plain.body!.material]).toEqual([0.6, 0.2, undefined]);
    expect(() => world.createEntity({ ...at, body: { type: 'fixed', shape: box, material: 'lava' } })).toThrow(
      /no material "lava" in this world \(stone, wood, metal, glass, ice\)/,
    );
    world.dispose();
  });

  test("a world's materials: the engine's and those added, in its hash and in its snapshots; one added again with other numbers is an error", () => {
    const world = new World({ seed: 1 });
    expect(Object.keys(world.materials)).toEqual(['stone', 'wood', 'metal', 'glass', 'ice']);
    const before = stateHash(world);
    world.addMaterial('oil', { friction: 0.02, bounce: 0, density: 900, drag: 0.4 });
    expect(stateHash(world)).not.toBe(before);
    // The same again is nothing new; with other numbers, the bodies made of it would not agree.
    expect(() => world.addMaterial('oil', { friction: 0.02, bounce: 0, density: 900, drag: 0.4 })).not.toThrow();
    expect(() => world.addMaterial('oil', { friction: 0.5, bounce: 0, density: 900, drag: 0.4 })).toThrow(/already this world's/);
    expect(() => world.addMaterial('tar', { friction: -1, bounce: 0, density: 900, drag: 0 })).toThrow(/its friction must be/);
    const back = World.restore(world.snapshot());
    expect(back.materials.oil).toEqual({ friction: 0.02, bounce: 0, density: 900, drag: 0.4 });
    expect(stateHash(back)).toBe(stateHash(world));
    // The engine's table is not touched by a world's additions.
    const fresh = new World({ seed: 1 });
    expect(fresh.materials.oil).toBeUndefined();
    fresh.dispose();
    world.dispose();
    back.dispose();
  });

  test('a zone keeps what it carries, as its own copy', () => {
    const world = new World({ seed: 1 });
    const flow = [3, 0, 0];
    const zone = world.createEntity({ ...at, sensor: { kind: 'current', half: [1, 1, 1], params: { flow } } });
    flow[0] = 9;
    expect(zone.sensor!.params).toEqual({ flow: [3, 0, 0] });
    expect(world.createEntity({ ...at, sensor: { kind: 'goal', half: [1, 1, 1] } }).sensor!.params).toEqual({});
    world.dispose();
  });
});

describe("a game's components (stage 2.5b): by name, as deep as they need", () => {
  /** A game's inventory: a list of records (it did not fit before: only loose values did). */
  type Inventory = { items: { kind: string; count: number }[]; open: boolean };

  test('an inventory travels in a snapshot, as deep as it is, and changing one item changes the hash', () => {
    const world = new World({ seed: 1 });
    const chest = world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.identity() },
      game: {
        'test.inventory': {
          items: [
            { kind: 'key', count: 1 },
            { kind: 'coin', count: 3 },
          ],
          open: false,
        } satisfies Inventory,
      },
    });
    const before = stateHash(world);
    const snap = world.snapshot();
    // Deep in it: the coins.
    component<Inventory>(chest, 'test.inventory')!.items[1]!.count = 4;
    expect(stateHash(world)).not.toBe(before);
    // The snapshot kept its own copy, as it was.
    const back = World.restore(snap);
    expect(component<Inventory>(back.entities.get(chest.id)!, 'test.inventory')!.items[1]!.count).toBe(3);
    expect(stateHash(back)).toBe(before);
    world.dispose();
    back.dispose();
  });

  test("a component's name goes with its game: `<game>.<component>`", () => {
    const world = new World({ seed: 1 });
    expect(() => world.createEntity({ game: { inventory: { items: [] } } })).toThrow(/<game>\.<component>/);
    expect(() => world.createEntity({ game: { 'dojo.runner': { falls: 0 }, 'dojo.inventory': { items: [] } } })).not.toThrow();
    world.dispose();
  });
});
