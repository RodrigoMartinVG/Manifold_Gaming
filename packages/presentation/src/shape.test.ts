import * as THREE from 'three';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { quat } from '@manifold/common';
import { initPhysics, World } from '@manifold/core';
import { createCosmeticPhysics } from './cosmetic';
import { createEntityIndex } from './entities';
import { own } from './owned';
import { FLOOR, TIERS } from './quality';
import { createScope } from './scope';
import { ATMOSPHERE, farFor, farOf } from './stage';

beforeAll(initPhysics);

/** THE VIEW'S SHAPE (stage 5.5g): what owns the budget, what indexes the world, what gives back what a piece added. */
describe("the view's shape (stage 5.5g)", () => {
  test('one tier, the floor: decision 0026’s budget and every knob in one place', () => {
    expect(Object.keys(TIERS)).toEqual(['floor']);
    expect(FLOOR.budget).toEqual({ draws: 300, triangles: 50_000 });
    expect([FLOOR.lights, FLOOR.pixelRatio, FLOOR.samples, FLOOR.cell, FLOOR.shadows]).toEqual([6, 1, 4, 16, false]);
  });

  test('the far plane from the look’s fog, and the same 200 m without one', () => {
    expect(farOf(ATMOSPHERE)).toBeCloseTo(200, 9);
    expect(farOf(null)).toBe(200);
    expect(farOf({ ...ATMOSPHERE, fog: { day: [20, 90], night: [10, 45] } })).toBeCloseTo(100, 9);
    // By the fog of the moment: at full night, the games' fog ends at 85 m, and so, nearly, does what is drawn.
    expect(farFor(ATMOSPHERE.fog.night[1])).toBeCloseTo(85 / 0.9, 9);
  });

  test('the index: the entities by what they have, in id order, kept from the world’s events, made again for another world', () => {
    const at = { position: [0, 0, 0] as [number, number, number], rotation: quat.identity() };
    let world = new World({ seed: 1 });
    const a = world.createEntity({ transform: at, lamp: { radius: 3, intensity: 1, signal: null } });
    world.createEntity({ transform: at });
    const b = world.createEntity({ transform: at, lamp: { radius: 3, intensity: 1, signal: null } });
    const index = createEntityIndex(
      () => world,
      () => 1,
    );
    expect(index.with('lamp').map((e) => e.id)).toEqual([a.id, b.id]);
    // Made and gone, as the events say.
    const c = world.createEntity({ transform: at, lamp: { radius: 3, intensity: 1, signal: null } });
    index.made(c.id);
    world.removeEntity(a.id);
    index.gone(a.id);
    expect(index.with('lamp').map((e) => e.id)).toEqual([b.id, c.id]);
    // One that lost what it had is left out as it is read.
    delete (c as { lamp?: unknown }).lamp;
    expect(index.with('lamp').map((e) => e.id)).toEqual([b.id]);
    // Its player's character, found and kept; another world, everything again.
    expect(index.hero()).toBeUndefined();
    world.dispose();
    world = new World({ seed: 2 });
    const hero = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    expect(index.with('lamp')).toEqual([]);
    expect(index.hero()).toBe(hero);
    world.dispose();
  });

  test('a scope gives back what was added through it: objects out and freed, elements out, listeners off, the last first', () => {
    const scope = createScope();
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const freed = vi.fn();
    geometry.addEventListener('dispose', freed);
    material.addEventListener('dispose', freed);
    scope.add(scene, own(new THREE.Mesh(geometry, material), { geometry: true, material: true }));
    const target = new EventTarget();
    const heard = vi.fn();
    scope.listen(target, 'ping', heard);
    const order: number[] = [];
    scope.defer(() => order.push(1));
    scope.defer(() => order.push(2));
    expect(scene.children).toHaveLength(1);
    scope.end();
    expect(scene.children).toHaveLength(0);
    expect(freed).toHaveBeenCalledTimes(2);
    target.dispatchEvent(new Event('ping'));
    expect(heard).not.toHaveBeenCalled();
    expect(order).toEqual([2, 1]);
    // Once: ending again does nothing more.
    scope.end();
    expect(freed).toHaveBeenCalledTimes(2);
  });

  test('the physics of what is only seen: one for the page, made again for another world, stepped once a frame', () => {
    const cosmetic = createCosmeticPhysics();
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [5, 0.5, 5] } },
    });
    const physics = cosmetic.of(world);
    expect(cosmetic.of(world)).toBe(physics);
    // Its still boxes are in it.
    expect(physics.bodyCount).toBe(1);
    const step = vi.spyOn(physics, 'step');
    // Two pieces asking in the same frame: a step's worth of time, one step.
    cosmetic.advance(100, 1 / 60);
    cosmetic.advance(100, 1 / 60);
    expect(step).toHaveBeenCalledTimes(1);
    cosmetic.advance(116, 1 / 60);
    expect(step).toHaveBeenCalledTimes(2);
    const other = new World({ seed: 2 });
    expect(cosmetic.of(other)).not.toBe(physics);
    cosmetic.dispose();
    world.dispose();
    other.dispose();
  });
});
