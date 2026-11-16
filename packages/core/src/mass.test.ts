import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { buildLevel, levelFromText, levelToText } from './level';
import { initPhysics } from './physics';
import { stateHash } from './hash';
import type { PlayerInput } from './types';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, a wooden crate (0.4 m: 44.8 kg) and a stone block (0.8 m: 1,229 kg), in a row along −Z; a character. */
function yard() {
  const world = new World({ seed: 1 });
  buildLevel(
    world,
    levelFromText(
      '# Manifold level 6\nbox 0 -0.5 0  12 0.5 12\nbox -2 0.2 -2  0.2 0.2 0.2  dynamic  material wood  name crate\nbox 2 0.4 -2  0.4 0.4 0.4  dynamic  material stone  name block\n',
    ),
  );
  const hero = world.createEntity({
    transform: { position: [-2, 0.82, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });
  const run = (n: number, input: PlayerInput = {}) => {
    for (let i = 0; i < n; i++) {
      world.inputs.set(1, input);
      world.lastInputs.set(1, i === 0 ? {} : input);
      world.step();
    }
  };
  return { world, hero, run, crate: world.named('crate')!, block: world.named('block')! };
}

describe('mass (stage 3g)', () => {
  test("a body weighs what its material's density says for its size; without one, the physics' own", () => {
    const { world, crate, block } = yard();
    expect(crate.body!.density).toBe(700);
    expect(world.physics.massOf(crate.body!.handle)).toBeCloseTo(0.4 ** 3 * 700, 1);
    expect(world.physics.massOf(block.body!.handle)).toBeCloseTo(0.8 ** 3 * 2400, 0);
    const ball = world.createEntity({
      transform: { position: [0, 3, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    expect(world.physics.massOf(ball.body!.handle)).toBeCloseTo((4 / 3) * Math.PI * 0.2 ** 3, 4);
    world.dispose();
  });

  test('walking into them, a character (70 kg) pushes the wooden crate along, and barely moves the stone block', () => {
    const pushed = (name: 'crate' | 'block', x: number) => {
      const y = yard();
      y.world.place(y.hero, [x, 0.82, 0]);
      y.run(20);
      const thing = y[name];
      const from = [...thing.transform!.position] as Vec3;
      y.run(120, { move: [0, 0, -1] });
      const moved = vec3.length(vec3.sub(thing.transform!.position, from));
      y.world.dispose();
      return moved;
    };
    const crate = pushed('crate', -2);
    const block = pushed('block', 2);
    expect(crate, 'the crate').toBeGreaterThan(2);
    expect(block, 'the block').toBeLessThan(0.3);
  });

  test("the crate's friction on the floor: 242 N (Rapier averages the two surfaces' 0.5 and 0.6), not 220 (the crate's own)", () => {
    // A push along the floor, as a force (each step, the change of velocity it gives: F · dt / m): how
    // much faster the crate goes in its second second than in its first.
    const faster = (newtons: number) => {
      const { world, crate } = yard();
      for (let i = 0; i < 60; i++) world.step();
      const mass = world.physics.massOf(crate.body!.handle);
      const speeds: number[] = [];
      for (let i = 1; i <= 120; i++) {
        world.push(crate, [newtons / 60 / mass, 0, 0]);
        world.step();
        if (i % 60 === 0) speeds.push(crate.body!.linearVelocity[0]);
      }
      world.dispose();
      return speeds[1]! - speeds[0]!;
    };
    // 44.8 kg · 9.81 · 0.55 = 241.7 N. Below it, the crate creeps at a steady few cm/s (Rapier's friction
    // gives a little, measured: 7 mm/s at 200 N, 32 at 240), and does not speed up; above it, it slides
    // faster and faster: at 255 N, (255 − 241.7) / 44.8 = 0.3 m/s more each second.
    expect(faster(230), 'pushed with 230 N').toBeLessThan(0.01);
    expect(faster(255), 'pushed with 255 N').toBeGreaterThan(0.2);
  });

  test('a game pushes what the physics moves: the same change of velocity, whatever its mass (the impulse is its mass times it)', () => {
    const { world, crate, block } = yard();
    world.step();
    world.push(crate, [0, 3, 0]);
    world.push(block, [0, 3, 0]);
    world.step();
    expect(crate.body!.linearVelocity[1]).toBeCloseTo(3 - 9.81 / 60, 2);
    expect(block.body!.linearVelocity[1]).toBeCloseTo(3 - 9.81 / 60, 2);
    world.dispose();
  });
});

describe('grabbing (stage 3g)', () => {
  test('grab: it takes the crate in front of it, which follows where it walks, held; grab again: it lets go, and the crate falls', () => {
    const { world, hero, run, crate } = yard();
    world.place(hero, [-2, 0.82, -0.9]);
    run(20);
    run(1, { grab: true });
    expect(hero.character!.holding).toBe(crate.id);
    run(30);
    // Held in front of it and a little up: off the floor.
    expect(crate.transform!.position[1]).toBeGreaterThan(0.6);
    // It walks 2 m along +X: the crate comes along.
    run(30, { move: [1, 0, 0] });
    run(30);
    // Still held (it turned to walk along +X, and the crate swung round in front of it), and along.
    expect(hero.character!.holding).toBe(crate.id);
    expect(crate.transform!.position[0]).toBeGreaterThan(0);
    run(1, { grab: true });
    expect(hero.character!.holding).toBe(0);
    run(60);
    expect(crate.transform!.position[1]).toBeLessThan(0.25);
    world.dispose();
  });

  test('the stone block is too heavy to lift: it stays on the ground, and walking away, it lets go', () => {
    const { world, hero, run, block } = yard();
    world.place(hero, [2, 0.82, -0.9]);
    run(20);
    run(1, { grab: true });
    expect(hero.character!.holding).toBe(block.id);
    run(30);
    expect(block.transform!.position[1]).toBeLessThan(0.45);
    run(60, { move: [0, 0, 1] });
    expect(hero.character!.holding).toBe(0);
    world.dispose();
  });

  test('what it holds is state: in the hash, and a snapshot while holding goes on the same', () => {
    const { world, hero, run } = yard();
    world.place(hero, [-2, 0.82, -0.9]);
    run(20);
    run(1, { grab: true });
    run(10);
    const back = World.restore(world.snapshot());
    for (let i = 0; i < 40; i++) {
      for (const w of [world, back]) {
        w.inputs.set(1, { move: [1, 0, 0] });
        w.lastInputs.set(1, { move: [1, 0, 0] });
        w.step();
      }
    }
    expect(stateHash(back)).toBe(stateHash(world));
    world.dispose();
    back.dispose();
  });

  test('format 6: a loose box, read and written back the same; it moves one way only', () => {
    const level = levelFromText('# Manifold level 6\nbox 0 0.2 0  0.2 0.2 0.2  dynamic  material wood\n');
    expect(level.boxes[0]!.dynamic).toBe(true);
    expect(levelFromText(levelToText(level))).toEqual(level);
    expect(() => levelFromText('# Manifold level 6\nbox 0 0 0  1 1 1  dynamic  move 1 0 0 1\n')).toThrow(
      /line 2: a box moves one way/,
    );
    expect(() => levelFromText('# Manifold level 5\nbox 0 0 0  1 1 1  dynamic\n')).toThrow(/line 2: "dynamic" is format 6/);
  });
});

describe('a body’s mass, computed (stage 3g)', () => {
  test('from its density and its shape, the same as the physics gives it: a box, a ball, a capsule', async () => {
    const { massOf } = await import('./world');
    const world = new World({ seed: 1 });
    const at = { position: [0, 5, 0] as Vec3, rotation: quat.identity() };
    for (const shape of [
      { kind: 'box' as const, halfExtents: [0.2, 0.3, 0.4] as Vec3 },
      { kind: 'ball' as const, radius: 0.25 },
      { kind: 'capsule' as const, halfHeight: 0.5, radius: 0.3 },
    ]) {
      const e = world.createEntity({ transform: at, body: { type: 'dynamic', shape, material: 'wood' } });
      expect(massOf(e.body!)).toBeCloseTo(world.physics.massOf(e.body!.handle), 2);
    }
    world.dispose();
  });
});
