import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { NO_INPUT } from './input';
import { stateHash } from './hash';
import { CHARACTER_SETTINGS, initPhysics, LIGHT } from './physics';
import type { CharacterSettings, Components, Entity, Event, PlayerInput, Shape } from './types';
import { FARTHEST, World } from './world';

beforeAll(initPhysics);

/**
 * WHAT THE CONTROLLER KEEPS (stage 4.5b): the velocity a character keeps is the one it had, not the one
 * it asked for; down a slope too steep to stand on it slides; what is light does not move it; and what
 * leaves the world is gone. In a world with a floor (its top at y = 0), a wall across +X at x = 2 (its
 * face at 1.8: 1.5 m of room) and what each test adds.
 */
function room(can: Record<string, boolean> = {}) {
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  world.createEntity({
    transform: { position: [2, 2, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.2, 2, 5] } },
  });
  const hero = world.createEntity({
    transform: { position: [0, 0.82, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1, can: { crouch: true, block: true, ...can } },
  });
  const events: Event[] = [];
  const step = (input: PlayerInput = {}) => {
    world.applyInputs(new Map([[1, { ...NO_INPUT, ...input }]]));
    world.step();
    events.push(...world.stepEvents);
  };
  for (let i = 0; i < 30; i++) step();
  return { world, hero, step, events };
}

const x = (e: Entity) => e.transform!.position[0];

describe('against a wall (stage 4.5b)', () => {
  test('in every way of moving, pressing a wall keeps no velocity into it; leaving along it starts from rest', () => {
    const ways: [string, PlayerInput][] = [
      ['walking', { move: [1, 0, 0] }],
      ['running', { move: [1, 0, 0], run: true }],
      ['crouched', { move: [1, 0, 0], crouch: true }],
      ['blocking', { move: [1, 0, 0], block: true }],
    ];
    for (const [way, asked] of ways) {
      const { world, hero, step } = room();
      for (let i = 0; i < 90; i++) step(asked);
      // At the wall (its face at 1.8, the body's radius 0.3, the controller's gap), and still.
      expect(x(hero), way).toBeGreaterThan(1.45);
      // (At most what the controller really moved it in its gap: millimeters a second, against 2 to 7.5 m/s before.)
      expect(Math.abs(hero.character!.velocity[0]), way).toBeLessThan(0.05);
      // Turning along it: from rest, not at the speed it had asked into the wall (4.5 m/s before).
      step({ move: [0, 0, 1] });
      expect(vec3.length(hero.character!.velocity), way).toBeLessThan(1);
      world.dispose();
    }
  });

  test('in the air too: jumping into it, it slides down along it, keeping nothing into it', () => {
    const { world, hero, step } = room();
    for (let i = 0; i < 20; i++) step({ move: [1, 0, 0] });
    step({ move: [1, 0, 0], jump: true });
    let into = Infinity;
    for (let i = 0; i < 40; i++) {
      step({ move: [1, 0, 0] });
      if (x(hero) > 1.45) into = Math.min(into, hero.character!.velocity[0]);
    }
    expect(Math.abs(into)).toBeLessThan(1e-3);
    world.dispose();
  });

  test('on open ground, the velocity it keeps is the one it had: what it moved in a step, over the step', () => {
    const { world, hero, step } = room();
    for (let i = 0; i < 20; i++) step({ move: [0, 0, -1] });
    const before = [...hero.transform!.position];
    step({ move: [0, 0, -1] });
    const moved = vec3.sub(hero.transform!.position, before as Vec3);
    expect(moved[2] * 60).toBeCloseTo(hero.character!.velocity[2], 1);
    world.dispose();
  });
});

describe('a slope too steep to stand on (stage 4.5b)', () => {
  /** On a slope of so many degrees and a friction, still for two seconds: how far down it went; and asked up it, how far up. */
  const onSlope = (degrees: number, friction = 0.6, asked: PlayerInput = {}) => {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.fromDegrees([1, 0, 0], degrees) },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [3, 0.1, 30] }, friction },
    });
    const hero = world.createEntity({
      transform: { position: [0, 1.2, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    const step = (input: PlayerInput) => {
      world.applyInputs(new Map([[1, { ...NO_INPUT, ...input }]]));
      world.step();
    };
    for (let i = 0; i < 30; i++) step({});
    const from = hero.transform!.position[1];
    for (let i = 0; i < 120; i++) step(asked);
    const down = from - hero.transform!.position[1];
    world.dispose();
    return down;
  };

  test('on 40°, standing still, it slides: down the slope, faster and faster, less its floor’s friction', () => {
    // Its friction 0.6 holds less than the slope pulls (tan 40° = 0.84): g (sin θ − μ cos θ) = 1.8 m/s²,
    // 3.6 m along it in two seconds, 2.3 m down. (Before, 14 cm: it kept no speed while it touched it.)
    expect(onSlope(40)).toBeGreaterThan(1.5);
    // A floor that grips more than the slope pulls (μ ≥ tan θ) holds it.
    expect(onSlope(40, 1)).toBeLessThan(0.05);
    // On 18°, flatter than it stands on (30°), it stays.
    expect(onSlope(18)).toBeLessThan(0.01);
  });

  test('up a slope of 40° it still walks (it pushes up it), and across it', () => {
    // The slope rises towards −Z (turned around +X): asked up it, it goes up.
    expect(onSlope(40, 0.6, { move: [0, 0, -1] })).toBeLessThan(-0.5);
  });
});

describe('what is light does not move a character (stage 4.5b)', () => {
  test('balls rolling into a character standing still leave it where it is; it pushes one it walks into', () => {
    const { world, hero, step } = room();
    const start = [...hero.transform!.position];
    for (let k = 0; k < 10; k++) {
      const ball = world.createEntity({
        transform: { position: [0.1 * ((k % 3) - 1), 0.15, -3], rotation: quat.identity() },
        body: {
          type: 'dynamic',
          shape: { kind: 'ball', radius: 0.15 },
          restitution: 0.5,
          angularDamping: 0.8,
          linearVelocity: [0, 0, 2 + k * 0.5],
        },
      });
      for (let i = 0; i < 60; i++) step();
      world.removeEntity(ball.id);
    }
    // (Before, the controller kept its gap from each ball, and they took it back 64 cm in ten.)
    expect(vec3.length(vec3.sub(hero.transform!.position, start as Vec3))).toBeLessThan(1e-4);
    world.dispose();
  });

  test('what weighs LIGHT kg or more still stops it: a crate of 45 kg it does not walk through', () => {
    const { world, hero, step } = room();
    world.createEntity({
      transform: { position: [0.9, 0.25, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] }, density: 360 },
    });
    expect(LIGHT).toBe(5);
    for (let i = 0; i < 30; i++) step({ move: [1, 0, 0] });
    // In front of the crate, or pushing it towards the wall: never past it.
    const crate = [...world.entities.values()].find((e) => e.body?.type === 'dynamic')!;
    expect(x(hero)).toBeLessThan(x(crate));
    world.dispose();
  });
});

describe('out of the world (stage 4.5b)', () => {
  test('what the physics moves, past FARTHEST from the origin, is gone; a character is not', () => {
    const world = new World({ seed: 1 });
    const ball = world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.15 } },
    });
    const hero = world.createEntity({
      transform: { position: [5, 0, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    let gone = -1;
    for (let i = 0; i < 60 * 15 && gone < 0; i++) {
      world.step();
      if (world.stepEvents.some((e) => e.type === 'entityRemoved' && e.id === ball.id)) gone = i;
    }
    // Falling from rest, 500 m in about ten seconds (√(2 · 500 / 9.81)).
    expect(FARTHEST).toBe(500);
    expect(gone / 60).toBeGreaterThan(9.5);
    expect(gone / 60).toBeLessThan(10.6);
    expect(world.entities.has(ball.id)).toBe(false);
    expect(world.entities.has(hero.id)).toBe(true);
    world.dispose();
  });
});

/**
 * ANY BODY, ITS OWN CONTROLLER, ITS OWN WEIGHT (stage 5.5e): a character's frame (where its waist and its
 * feet are) comes from its shape, not from the mannequin's capsule; how high a step it takes over is its
 * own; and a blast pushes it by its own weight. (The forest's creatures are not all the mannequin.)
 */
describe('any body, its own controller and weight (stage 5.5e)', () => {
  /**
   * A floor, a step 0.3 m high across +Z (its face at z = 1.5, 10 m deep) and the character, given its
   * first steps (`settle`).
   */
  function steps(character: Components, settle = 30) {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
    });
    world.createEntity({
      transform: { position: [0, 0.15, 6.5], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [5, 0.15, 5] } },
    });
    const hero = world.createEntity(character);
    const events: Event[] = [];
    const step = (input: PlayerInput = {}) => {
      world.applyInputs(new Map([[1, { ...NO_INPUT, ...input }]]));
      world.step();
      events.push(...world.stepEvents);
    };
    for (let i = 0; i < settle; i++) step();
    return { world, hero, step, events };
  }
  const capsule = { kind: 'capsule' as const, halfHeight: 0.5, radius: 0.3 };

  test('a ball and a box stand, walk, are heard landing at their bottom, and a moving platform carries them', () => {
    const bodies: [string, Shape, number][] = [
      ['ball', { kind: 'ball', radius: 0.4 }, 0.4],
      ['box', { kind: 'box', halfExtents: [0.3, 0.6, 0.3] }, 0.6],
    ];
    for (const [name, shape, bottom] of bodies) {
      // Dropped from 2 m: its landing heard where its bottom touched (not 0.8 m under its center, the
      // mannequin's capsule's), and its bottom on the floor.
      const { hero, step, events } = steps(
        {
          transform: { position: [0, bottom + 2, 0], rotation: quat.identity() },
          body: { type: 'character', shape },
          character: { player: 1 },
        },
        60,
      );
      const landing = events.find((e) => e.type === 'sound' && e.sound === 'land');
      expect(landing, name).toBeDefined();
      expect(landing!.type === 'sound' && landing!.at[1], name).toBeCloseTo(0, 1);
      expect(hero.character!.grounded, name).toBe(true);
      expect(hero.transform!.position[1] - bottom, name).toBeGreaterThan(-0.01);
      expect(hero.transform!.position[1] - bottom, name).toBeLessThan(0.05);
      for (let i = 0; i < 30; i++) step({ move: [-1, 0, 0] });
      expect(hero.transform!.position[0], name).toBeLessThan(-1);
      expect(hero.character!.grounded, name).toBe(true);
      // Born just above a platform that moves 4 m along +X in 2 s, it goes along with it, where it stood.
      const ride = new World({ seed: 1 });
      const board = ride.createEntity({
        transform: { position: [0, 0.3, 0], rotation: quat.identity() },
        body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [3, 0.1, 3] } },
        mover: { from: [0, 0.3, 0], to: [4, 0.3, 0], seconds: 2 },
      });
      const rider = ride.createEntity({
        transform: { position: [0, 0.4 + bottom + 0.05, 0], rotation: quat.identity() },
        body: { type: 'character', shape },
        character: { player: 1 },
      });
      const run = (n: number) => {
        for (let i = 0; i < n; i++) {
          ride.applyInputs(new Map([[1, NO_INPUT]]));
          ride.step();
        }
      };
      run(10);
      const offset = rider.transform!.position[0] - board.transform!.position[0];
      run(110);
      expect(board.transform!.position[0], name).toBeCloseTo(4, 2);
      expect(rider.character!.grounded, name).toBe(true);
      expect(Math.abs(rider.transform!.position[0] - board.transform!.position[0] - offset), name).toBeLessThan(0.01);
      ride.dispose();
    }
  });

  test('how high a step it takes over is its own: 0.3 m, over with the default, not with 0.2', () => {
    const walk = (controller?: Partial<CharacterSettings>) => {
      const { hero, step } = steps({
        transform: { position: [0, 0.82, 0], rotation: quat.identity() },
        body: { type: 'character', shape: capsule },
        character: { player: 1, ...(controller ? { controller } : {}) },
      });
      for (let i = 0; i < 90; i++) step({ move: [0, 0, 1] });
      return hero;
    };
    const over = walk();
    expect(over.transform!.position[2]).toBeGreaterThan(2);
    expect(over.transform!.position[1]).toBeGreaterThan(1.05);
    const held = walk({ stepHeight: 0.2 });
    expect(held.transform!.position[2]).toBeLessThan(1.5);
    expect(held.transform!.position[1]).toBeLessThan(0.9);
    // What it was given is kept with the rest of the default, and saved with the world.
    expect(held.character!.controller).toEqual({ ...CHARACTER_SETTINGS, stepHeight: 0.2 });
    expect(over.character!.controller).toBeUndefined();
  });

  test('a blast pushes it by its own weight', () => {
    const pushed = (mass?: number) => {
      const { world, hero } = steps({
        transform: { position: [0, 0.82, 1], rotation: quat.identity() },
        body: { type: 'character', shape: capsule },
        character: { player: 1, ...(mass !== undefined ? { mass } : {}) },
      });
      world.explode([0, 0.1, 0], 4, 600);
      return vec3.length(hero.character!.velocity);
    };
    expect(pushed(160)).toBeCloseTo(pushed() / 2, 9);
  });

  test('saved and loaded, a character keeps its controller and weight, and steps the same', () => {
    const { world, hero, step } = steps({
      transform: { position: [0, 0.82, 0], rotation: quat.identity() },
      body: { type: 'character', shape: capsule },
      character: { player: 1, controller: { stepHeight: 0.2 }, mass: 120 },
    });
    const copy = World.restore(world.snapshot());
    const twin = copy.entities.get(hero.id)!;
    expect(twin.character!.controller).toEqual(hero.character!.controller);
    expect(twin.character!.mass).toBe(120);
    for (let i = 0; i < 60; i++) {
      step({ move: [0, 0, 1] });
      copy.applyInputs(new Map([[1, { ...NO_INPUT, move: [0, 0, 1] }]]));
      copy.step();
    }
    expect(stateHash(copy)).toBe(stateHash(world));
    copy.dispose();
  });
});
