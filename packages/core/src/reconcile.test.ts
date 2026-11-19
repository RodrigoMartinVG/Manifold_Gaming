import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { NO_INPUT } from './input';
import { initPhysics } from './physics';
import { resimulateOwn } from './reconcile';
import { replayOf } from './replay';
import { Session } from './session';

beforeAll(initPhysics);

/**
 * Two characters on a floor; `pulled`: player 1 is moved by what player 2 ASKS for (its jump), not by where
 * player 2 is. That cannot be reconciled as decision 0016 does: player 2's inputs are not one's own.
 */
function yard(pulled: boolean): Cartridge {
  return {
    id: 'yard',
    title: 'Yard',
    onStart(world) {
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
      });
      for (const [player, x] of [
        [1, -2],
        [2, 2],
      ] as const)
        world.createEntity({
          transform: { position: [x, 1, 0], rotation: quat.identity() },
          body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
          character: { player },
        });
    },
    onStep(world) {
      if (!pulled || !world.inputs.get(2)?.jump) return;
      const one = [...world.entities.values()].find((e) => e.character?.player === 1)!;
      world.place(one, [one.transform!.position[0] + 0.01, one.transform!.position[1], 0]);
    },
  };
}

/** Both walk; player 2 jumps now and then. */
function run(cartridge: Cartridge) {
  const session = new Session(cartridge);
  session.registry.run('players.join 2', 'console');
  for (let step = 1; step <= 240; step++) {
    session.setInput(1, { ...NO_INPUT, move: [0, 0, step < 120 ? -1 : 1] });
    session.setInput(2, { ...NO_INPUT, move: [0, 0, 1], jump: step % 50 < 10 });
    session.step();
  }
  const replay = replayOf(session);
  session.world.dispose();
  return replay;
}

describe('the re-simulation harness (stage 5.5c, decision 0016)', () => {
  test('one’s own character, with the other placed where it was: always as recorded', () => {
    const windows = resimulateOwn(yard(false), run(yard(false)), 1, { window: 30, every: 40 });
    expect(windows).toHaveLength(5);
    expect(windows.filter((w) => w.differs)).toEqual([]);
  });

  test('moved by what the other ASKS for (not where it is): the harness says where it first parts, and in what', () => {
    const windows = resimulateOwn(yard(true), run(yard(true)), 1, { window: 30, every: 40 });
    const parted = windows.filter((w) => w.differs);
    expect(parted.length).toBeGreaterThan(0);
    expect(parted[0]!.differs!.what).toMatch(/^own\.(transform|body|character)/);
  });
});
