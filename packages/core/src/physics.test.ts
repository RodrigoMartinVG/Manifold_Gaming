import { beforeAll, describe, expect, test } from 'vitest';
import { approx, Random, quat, vec3, type Vec3 } from '@manifold/common';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import type { Shape } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A floor: a fixed box whose top is at y = 0. */
function floor(world: World) {
  return world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
  });
}

/** `n` balls and boxes at places taken from the world's randomness, falling on the floor. */
function rain(world: World, n: number, nudge = 0) {
  const r = world.random;
  for (let i = 0; i < n; i++) {
    const position: Vec3 = [r.between(-3, 3) + (i === 0 ? nudge : 0), r.between(1, 6), r.between(-3, 3)];
    const shape: Shape =
      r.between(0, 1) < 0.5
        ? { kind: 'ball', radius: r.between(0.1, 0.4) }
        : { kind: 'box', halfExtents: [r.between(0.1, 0.4), r.between(0.1, 0.4), r.between(0.1, 0.4)] };
    world.createEntity({ transform: { position, rotation: quat.identity() }, body: { type: 'dynamic', shape } });
  }
}

describe('the physics (Rapier, behind physics.ts)', () => {
  test('a ball falls, bounces and stays on the floor; its pose and velocity are in its components', () => {
    const world = new World({ seed: 1 });
    floor(world);
    const ball = world.createEntity({
      transform: { position: [0, 2, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 } },
    });
    // Half a second later it is falling: about g·t = 4.9 m/s downward.
    for (let i = 0; i < 30; i++) world.step();
    expect(ball.body!.linearVelocity[1]).toBeLessThan(-4);
    expect(ball.transform!.position[1]).toBeLessThan(2);
    // Four seconds later it rests on the floor: its center at its radius' height.
    for (let i = 0; i < 240; i++) world.step();
    expect(ball.transform!.position[1]).toBeCloseTo(0.25, 2);
    expect(Math.abs(ball.body!.linearVelocity[1])).toBeLessThan(0.01);
    world.dispose();
  });

  test('two worlds with the same seed give the same hash at every step (60 bodies, 10 seconds)', () => {
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    for (const w of [a, b]) {
      floor(w);
      rain(w, 60);
    }
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
      expect(stateHash(b), `step ${i + 1}`).toBe(stateHash(a));
    }
    a.dispose();
    b.dispose();
    // (Its cost, measured: 1.1 s alone: two worlds, 600 steps, the whole hash on every one. The time
    // each test has, for all of them, is in vitest.config.ts.)
  });

  test('Rapier counts in 32-bit numbers: a billionth of a meter does not exist for it', () => {
    // Near 3 m, a 32-bit number cannot tell apart two positions closer than about 0.24 µm. The nudge
    // changes our position (64 bits) and the hash at the start, but it is lost when it enters Rapier.
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    floor(a);
    floor(b);
    rain(a, 10);
    rain(b, 10, 1e-9);
    expect(stateHash(b)).not.toBe(stateHash(a));
    a.step();
    b.step();
    expect(stateHash(b)).toBe(stateHash(a));
    a.dispose();
    b.dispose();
  });

  test('a hundredth of a millimeter in one body changes the hash, and the worlds drift apart', () => {
    const a = new World({ seed: 7 });
    const b = new World({ seed: 7 });
    floor(a);
    floor(b);
    rain(a, 60);
    rain(b, 60, 1e-5);
    let firstDifferent = 0;
    for (let i = 1; i <= 600; i++) {
      a.step();
      b.step();
      if (!firstDifferent && stateHash(b) !== stateHash(a)) firstDifferent = i;
    }
    // From the first step on, and for good: the hash says AT WHICH STEP two simulations separated.
    expect(firstDifferent).toBe(1);
    expect(stateHash(b)).not.toBe(stateHash(a));
    a.dispose();
    b.dispose();
  });

  test('a kinematic body that spins is turned by the physics, at its angular velocity', () => {
    const world = new World({ seed: 1 });
    const spinner = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      spin: { angularVelocity: [0, 1.5, 0] },
      body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
    });
    for (let i = 0; i < 60; i++) world.step();
    // One second at 1.5 rad/s around y: 1.5 rad, and it did not move.
    expect(approx.angleBetween(quat.identity(), spinner.transform!.rotation)).toBeCloseTo(1.5, 5);
    expect(spinner.transform!.position).toEqual([0, 1, 0]);
    world.dispose();
  });

  test('the contacts (for show.contacts): a box resting on the floor touches it, with its normal along the vertical', () => {
    const world = new World({ seed: 1 });
    floor(world);
    world.createEntity({
      transform: { position: [0, 0.3, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] } },
    });
    for (let i = 0; i < 60; i++) world.step();
    const { points, normals } = world.physics.contacts();
    expect(points.length).toBeGreaterThanOrEqual(3 * 4); // a box flat on the floor: its four corners
    for (let i = 0; i < points.length; i += 3) {
      expect(points[i + 1]).toBeCloseTo(0, 1); // on the floor's top
      expect(Math.abs(normals[i + 1]!)).toBeCloseTo(1, 3); // vertical
    }
    world.dispose();
  });

  test("a ray that starts inside a body hits it at 0, with a zero normal: no surface, and a number (Rapier's is anything)", () => {
    const world = new World({ seed: 1 });
    const shapes: Shape[] = [
      { kind: 'ball', radius: 0.5 },
      { kind: 'box', halfExtents: [0.5, 0.5, 0.5] },
      { kind: 'capsule', halfHeight: 0.5, radius: 0.3 },
    ];
    const bodies = shapes.map((shape, i) =>
      world.createEntity({ transform: { position: [3 * i, 0, 0], rotation: quat.identity() }, body: { type: 'fixed', shape } }),
    );
    world.step();
    // From each one's center (a ball's: Rapier's normal is not even a number there), and from off it (a
    // ball's: Rapier's points sideways, no surface's).
    for (const [i, e] of bodies.entries())
      for (const from of [
        [3 * i, 0, 0],
        [3 * i + 0.1, 0.2, 0],
      ] as Vec3[]) {
        const hit = world.castRay(from, [0, -1, 0], 10)!;
        expect(hit.entity, e.body!.shape.kind).toBe(e.id);
        expect(hit.distance).toBe(0);
        expect(hit.normal, `${e.body!.shape.kind} from ${from.join(' ')}`).toEqual([0, 0, 0]);
      }
    // From outside, the surface's own.
    expect(world.castRay([0.3, 5, 0], [0, -1, 0], 10)!.normal[1]).toBeCloseTo(Math.sqrt(1 - 0.36), 5);
    world.dispose();
  });

  test('a character walking into a wall created between two steps stops at it (the controller does not see it yet)', () => {
    const world = new World({ seed: 1 });
    floor(world);
    const hero = world.createEntity({
      transform: { position: [0, 0.82, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    // Up to speed along +X (7.5 cm a step at 4.5 m/s).
    world.inputs.set(1, { move: [1, 0, 0] });
    for (let i = 0; i < 60; i++) world.step();
    const x = hero.transform!.position[0];
    expect(hero.character!.velocity[0]).toBeCloseTo(4.5, 1);
    // A wall 3 cm ahead of its capsule: less than a step.
    const face = x + 0.3 + 0.03;
    world.createEntity({
      transform: { position: [face + 0.5, 1, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.5, 1, 2] } },
    });
    for (let i = 0; i < 30; i++) {
      world.step();
      expect(hero.transform!.position[0] + 0.3, `step ${i + 1}`).toBeLessThanOrEqual(face + 1e-4);
    }
    world.dispose();
  });

  test("a snapshot keeps which bodies Rapier's queries do not see yet: restored, it answers and goes on the same", () => {
    const world = new World({ seed: 1 });
    floor(world);
    const hero = world.createEntity({
      transform: { position: [0, 0.82, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    const wall = world.createEntity({
      transform: { position: [0, 1, -8], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.5, 1, 2] } },
    });
    world.step();
    // The wall, put in the character's way between two steps; the snapshot, then.
    world.place(wall, [1.5, 1, 0]);
    const copy = World.restore(world.snapshot());
    for (const w of [world, copy])
      expect(w.castRay([0, 1, 0], [1, 0, 0], 10, { skip: hero.id })?.entity, 'the wall, where it is').toBe(wall.id);
    expect(stateHash(copy)).toBe(stateHash(world));
    for (let i = 0; i < 60; i++) {
      for (const w of [world, copy]) {
        w.inputs.set(1, { move: [1, 0, 0] });
        w.step();
      }
      expect(stateHash(copy), `step ${i + 1}`).toBe(stateHash(world));
    }
    expect(hero.transform!.position[0]).toBeLessThan(1 - 0.3 + 1e-3);
    world.dispose();
    copy.dispose();
  });

  test('sleep: what slides past its friction angle, or rolls down a slope, is not put to sleep there (Rapier did)', () => {
    /** A ramp of `degrees` (friction 0.5, rising towards +X) and, near its top, a box or a ball on it (0.5 too). */
    const slope = (degrees: number, shape: Shape) => {
      const world = new World({ seed: 1 });
      const a = (degrees * Math.PI) / 180;
      const rotation: [number, number, number, number] = [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
      world.createEntity({
        transform: { position: [0, 0, 0], rotation },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 3] }, friction: 0.5 },
      });
      const lift = 0.5 + (shape.kind === 'ball' ? shape.radius : 0.25);
      const thing = world.createEntity({
        transform: { position: [8 * Math.cos(a) - lift * Math.sin(a), 8 * Math.sin(a) + lift * Math.cos(a), 0], rotation },
        body: { type: 'dynamic', shape, friction: 0.5 },
      });
      const from = [...thing.transform!.position] as Vec3;
      const moved = () =>
        Math.sqrt(vec3.dot(vec3.sub(thing.transform!.position, from), vec3.sub(thing.transform!.position, from)));
      return { world, thing, moved };
    };
    const box: Shape = { kind: 'box', halfExtents: [0.25, 0.25, 0.25] };
    // Friction 0.5: it slides from 26.57° on. At 27°, from rest, about ½ · 9.81 · (sin 27° − 0.5 cos 27°) · t²:
    // 4.2 m in ten seconds (Rapier put it to sleep after half a second, 1.6 cm down).
    const steep = slope(27, box);
    for (let i = 0; i < 600; i++) steep.world.step();
    expect(steep.moved(), 'at 27°, it slides on').toBeGreaterThan(3.5);
    steep.world.dispose();
    // At 25° it holds: it rests, and stays.
    const gentle = slope(25, box);
    for (let i = 0; i < 120; i++) gentle.world.step();
    const rested = gentle.moved();
    for (let i = 0; i < 480; i++) gentle.world.step();
    expect(rested, 'at 25°, it holds').toBeLessThan(0.01);
    expect(gentle.moved()).toBe(rested);
    expect(gentle.thing.body!.linearVelocity).toEqual([0, 0, 0]);
    gentle.world.dispose();
    // A ball rolls down a slope of half a degree: (5/7) · 9.81 · sin 0.5° · t² / 2, 3.1 m in ten seconds
    // (Rapier put it to sleep after half a second, 8 mm down).
    const ball = slope(0.5, { kind: 'ball', radius: 0.25 });
    for (let i = 0; i < 600; i++) ball.world.step();
    expect(ball.moved(), 'a ball, at 0.5°').toBeGreaterThan(2.5);
    ball.world.dispose();
  });

  test('sleep: a world restored while something rests, or while something was refused its sleep, goes on the same', () => {
    const world = new World({ seed: 1 });
    floor(world);
    rain(world, 30);
    for (let i = 0; i < 240; i++) world.step();
    const copy = World.restore(world.snapshot());
    for (let i = 0; i < 240; i++) {
      world.step();
      copy.step();
      expect(stateHash(copy), `step ${i + 1}`).toBe(stateHash(world));
    }
    world.dispose();
    copy.dispose();
  });

  test('removing an entity removes its body from the physics', () => {
    const world = new World({ seed: 1 });
    floor(world);
    rain(world, 5);
    expect(world.physics.bodyCount).toBe(6);
    world.removeEntity(3);
    expect(world.physics.bodyCount).toBe(5);
    expect(world.entities.has(3)).toBe(false);
    world.dispose();
  });

  test('the gravity is part of the state: changing it changes how things fall, and the hash', () => {
    const fall = (vector?: Vec3) => {
      const world = new World({ seed: 1 });
      if (vector) world.gravity = { kind: 'uniform', vector };
      const ball = world.createEntity({
        transform: { position: [0, 10, 0], rotation: quat.identity() },
        body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.5 } },
      });
      const before = stateHash(world);
      for (let i = 0; i < 60; i++) world.step();
      const result = { y: ball.transform!.position[1], before };
      world.dispose();
      return result;
    };
    const earth = fall();
    const moon = fall([0, -1.62, 0]);
    // In one second: on Earth it falls about ½·9.81 = 4.9 m; on the Moon, about 0.8 m.
    expect(10 - earth.y).toBeCloseTo(4.9, 0);
    expect(10 - moon.y).toBeCloseTo(0.81, 1);
    expect(moon.before).not.toBe(earth.before);
  });
});

test('the random generator is untouched by the physics: the world consumes it only when a game asks', () => {
  const world = new World({ seed: 3 });
  const fresh = new Random(3);
  for (let i = 0; i < 30; i++) world.step();
  expect(world.random.state).toEqual(fresh.state);
  world.dispose();
});
