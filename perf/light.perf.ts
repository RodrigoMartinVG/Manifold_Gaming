import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { initPhysics, Session, World, type WorldSnapshot } from '@manifold/core';
import { DojoCartridge } from '@manifold/dojo/cartridge';
import { median, ms, record, ROUNDS, stress, time } from './measure';

/** THE LIGHT'S BUDGET (stage 3d), in the Dojo's stress room with eight characters. (How it is measured: measure.ts.) */

beforeAll(initPhysics);

describe('the light (stage 3d), in the stress room with eight characters', () => {
  test("four lamps, a fog bank and a watcher cost the step less than 0.6 of Rapier's: their rays, every character's and the watcher's", () => {
    // The stress room, with seven more players (eight characters, each lit by every lamp that reaches
    // it), two seconds after its birth; and the same moment with the light added.
    const session = new Session(DojoCartridge, { registry: stress() });
    for (let p = 2; p <= 8; p++) session.registry.run(`players.join ${p}`, 'console');
    for (let i = 0; i < 120; i++) session.step();
    const plain = session.world.snapshot();
    const w = session.world;
    w.ambient = 0.1;
    for (const [x, z] of [
      [-4, 4],
      [4, 4],
      [-4, -4],
      [4, -4],
    ])
      w.createEntity({
        transform: { position: [x!, 3, z!], rotation: quat.identity() },
        lamp: { radius: 7, intensity: 1, signal: null },
      });
    w.createEntity({
      transform: { position: [0, 1, 2], rotation: quat.identity() },
      sensor: { kind: 'fog', half: [3, 1, 1], params: { opacity: [1] } },
    });
    w.createEntity({
      transform: { position: [0, 2.5, -9], rotation: quat.fromDegrees([0, 1, 0], 180) },
      watcher: { range: 25, cone: 0.5, threshold: 0.3 },
    });
    session.step();
    const lit = session.world.snapshot();
    session.world.dispose();
    const steps = 120;
    const stepping = (snap: WorldSnapshot, step: (w: World) => void) => {
      const world = World.restore(snap);
      const spent = time(() => {
        for (let i = 0; i < steps; i++) step(world);
      });
      world.dispose();
      return spent / steps;
    };
    // What the light adds, against Rapier's step, in each round (the same moment of the machine for the
    // three), and the median of the rounds: a difference of two medians taken apart was too noisy (from
    // 0.006 to 0.5 in four runs).
    const rounds = Array.from({ length: ROUNDS }, () => {
      const rapier = stepping(plain, (x) => x.physics.step());
      const without = stepping(plain, (x) => x.step());
      const withLight = stepping(lit, (x) => x.step());
      return { light: (withLight - without) / rapier, without, withLight, rapier };
    });
    const light = median(rounds.map((r) => r.light));
    const said = `the step with the light ${ms(median(rounds.map((r) => r.withLight)))}, without ${ms(median(rounds.map((r) => r.without)))}; Rapier's ${ms(median(rounds.map((r) => r.rapier)))}`;
    // Measured on 2026-11-15 (stage 3f), round by round: 0.36 to 0.39 of Rapier's step (about 0.09 ms).
    record('light', {
      'ratio.light': light,
      'ms.withLight': median(rounds.map((r) => r.withLight)),
      'ms.without': median(rounds.map((r) => r.without)),
      'ms.rapier': median(rounds.map((r) => r.rapier)),
    });
    expect(light, said).toBeLessThan(0.6);
  });
});
