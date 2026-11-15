import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/** The room "machines", and what a test needs to drive it. */
function machines() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.machines!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const notices: string[] = [];
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const at = () => me().transform!.position;
  const c = () => me().character!;
  const step = (input: PlayerInput = NO_INPUT) => {
    session.setInput(1, input);
    session.step();
    for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push(ev.text);
  };
  const machine = (from: Vec3) =>
    [...session.world.entities.values()].find((e) => e.mover && e.mover.from.every((v, i) => Math.abs(v - from[i]!) < 1e-6))!;
  const put = (x: number, y: number, z: number) => {
    expect(session.registry.run(`dojo.goto ${x} ${y} ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    for (let i = 0; i < 200 && !c().grounded; i++) step();
  };
  return { session, notices, at, c, step, machine, put };
}

describe('the machines (stage 3a)', () => {
  /** The ferry, and whether the character stands on it. */
  const theFerry = (m: ReturnType<typeof machines>) => {
    const ferry = m.machine([3, -0.15, -11.5]);
    const z = () => ferry.transform!.position[2]!;
    const on = () => m.c().grounded && Math.abs(m.at()[2]! - z()) < 1.2 && Math.abs(m.at()[0]! - 3) < 1.2 && m.at()[1]! > 0.7;
    /** Steps until the ferry leaves the pit's edge (z = −10) by `gap` meters, going away. */
    const leaving = (gap: number) => {
      let last = z();
      for (let i = 0; i < 400; i++) {
        const away = z() < last;
        last = z();
        if (away && z() + 1.5 < -10 - gap) return;
        m.step();
      }
      throw new Error('the ferry never left');
    };
    return { z, on, leaving };
  };

  test('boarding the ferry a little late, it steps over the gap onto it', () => {
    const m = machines();
    const ferry = theFerry(m);
    m.put(3, 1, -9.5);
    ferry.leaving(0.35);
    let on = -1;
    for (let i = 0; i < 60 && on < 0; i++) {
      m.step({ move: [0, 0, -1] });
      if (ferry.on()) on = i;
    }
    expect(on, 'on the ferry').toBeGreaterThan(0);
    expect(m.notices).not.toContain('you fell: back to the checkpoint');
  });

  test("caught on the ferry's rear edge as it pulls away over the pit, it gets on (before 3a it was dragged along on it)", () => {
    // Phase 2's close, in the room: its center 27 cm behind the edge, 8 cm low, its round bottom on it.
    const m = machines();
    const ferry = theFerry(m);
    ferry.leaving(2);
    m.put(3, 0.74, ferry.z() + 1.5 + 0.27);
    let on = -1;
    for (let i = 0; i < 90 && on < 0; i++) {
      m.step({ move: [0, 0, -1] });
      if (ferry.on()) on = i;
    }
    expect(on, 'on the ferry').toBeGreaterThan(0);
    expect(m.notices).not.toContain('you fell: back to the checkpoint');
  });

  test('riding the platform under the beam, the beam stops the character, and it lands on the floor (before 3a the carry took it into the beam)', () => {
    const m = machines();
    const platform = m.machine([7, 0.15, -25]);
    // Standing on it as it sets off from x = 7 towards the beam (at x = 3, its face at 3.25).
    const x = () => platform.transform!.position[0]!;
    let last = x();
    for (let i = 0; i < 600; i++) {
      const away = x() < last;
      last = x();
      if (away && x() < 6.95) break;
      m.step();
    }
    m.put(x(), 1.4, -25);
    const beam = 3 + 0.25 + 0.3; // where its capsule touches the beam
    let nearest = Infinity;
    for (let i = 0; i < 200; i++) {
      m.step();
      nearest = Math.min(nearest, m.at()[0]!);
    }
    expect(nearest, 'it reached the beam').toBeLessThan(beam + 0.1);
    expect(nearest, 'and never went into it').toBeGreaterThan(beam - 0.03);
    // The platform went on under the beam; the character, left behind, stands on the floor.
    expect(m.c().grounded).toBe(true);
    expect(m.at()[1]!).toBeCloseTo(0.82, 1);
  });
});
