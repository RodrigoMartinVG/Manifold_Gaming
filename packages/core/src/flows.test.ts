import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { buildLevel, levelFromText } from './level';
import { initPhysics } from './physics';
import { carryAlong } from './systems/flows';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, a current along +X (2 m/s) over its middle, a character standing in it and one beside it, a ball in it. */
function stream() {
  const world = new World({ seed: 1 });
  buildLevel(
    world,
    levelFromText('# Manifold level 10\nbox 0 -0.5 0  20 0.5 20\nsensor current  0 1 0  6 1 2  flow 2 0 0\n', {
      zones: { current: { flow: 3 } },
    }),
  );
  const character = (player: number, at: Vec3) =>
    world.createEntity({
      transform: { position: at, rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player },
    });
  const inIt = character(1, [-3, 0.82, 0]);
  const beside = character(2, [-3, 0.82, 6]);
  const ball = world.createEntity({
    transform: { position: [-3, 0.2, 1], rotation: quat.identity() },
    body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 }, material: 'wood' },
  });
  /** Steps as a game that calls it in its own step (after the world's, as the Dojo does). */
  const run = (n: number, o?: { grounded?: boolean }) => {
    for (let i = 0; i < n; i++) {
      world.step();
      carryAlong(world, 'current', o);
    }
  };
  return { world, inIt, beside, ball, run };
}

describe('zones that carry what is in them (the core since stage 5.5h; the Dojo’s currents)', () => {
  test('a character standing in one drifts along it, one beside it stays; a ball in it rolls along', () => {
    const { world, inIt, beside, ball, run } = stream();
    run(60);
    expect(inIt.transform!.position[0]).toBeGreaterThan(-3 + 1);
    expect(inIt.transform!.position[2]).toBeCloseTo(0, 1);
    expect(beside.transform!.position[0]).toBeCloseTo(-3, 2);
    expect(ball.transform!.position[0]).toBeGreaterThan(-3 + 0.5);
    world.dispose();
  });

  test('grounded (the default, water at the ankles): not over it in the air; without it (a wind), in the air too', () => {
    const { world, inIt, run } = stream();
    run(20);
    const c = inIt.character!;
    expect(c.grounded).toBe(true);
    c.carry = [0, 0, 0];
    c.grounded = false;
    carryAlong(world, 'current');
    expect(c.carry).toEqual([0, 0, 0]);
    // (Options that do not say it keep it.)
    carryAlong(world, 'current', {});
    expect(c.carry).toEqual([0, 0, 0]);
    carryAlong(world, 'current', { grounded: false });
    expect(c.carry).toEqual([2, 0, 0]);
    world.dispose();
  });
});
