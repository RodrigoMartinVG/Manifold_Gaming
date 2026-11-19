import { beforeAll, describe, expect, test } from 'vitest';
import { BotHost, initPhysics, registryFor, Session, withoutView } from '@manifold/core';
import { WALL_CARTRIDGE, WALL_LEVEL_LIST } from '@manifold/wall/cartridge';
import { measure, ms, record, time } from './measure';

/**
 * A GAME'S LEVEL (stage 5.5d): the wall's first, as a page plays it, its attackers thinking where the match is
 * hosted (decision 0023). What a step of the engine costs here, what the bots' thinking adds, and what the
 * level's first step costs (every body checked on its own before it: the audit's S7, the slow first step
 * phase 5 left open), each against Rapier's own step in the same round. (How they are measured: measure.ts.)
 */

beforeAll(initPhysics);

/** The wall's first level, born as its page makes it (without the recipe's view lines). */
function level() {
  const registry = registryFor(WALL_CARTRIDGE);
  registry.run(withoutView(WALL_LEVEL_LIST[0]!.recipe), 'recipe');
  return new Session(WALL_CARTRIDGE, { registry });
}

describe('a game’s level (stage 5.5d): the wall’s first, its attackers thinking', () => {
  let t: ReturnType<typeof measure<'rapier' | 'engine' | 'bots' | 'first'>>;

  beforeAll(() => {
    // Two seconds in, its attackers about: from there, each measurement from the same saved moment.
    const session = level();
    const bots = new BotHost();
    for (let i = 0; i < 120; i++) {
      bots.think(session);
      session.step();
    }
    const saved = session.save();
    const steps = 60;
    const from = (run: () => void) => () => {
      session.load(saved);
      return (
        time(() => {
          for (let i = 0; i < steps; i++) run();
        }) / steps
      );
    };
    t = measure('rapier', {
      rapier: from(() => session.world.physics.step()),
      engine: from(() => session.step()),
      bots: from(() => bots.think(session)),
      first: () => {
        const fresh = level();
        const spent = time(() => fresh.step());
        fresh.world.dispose();
        return spent;
      },
    });
    session.world.dispose();
    record('level', {
      ...Object.fromEntries(Object.entries(t.ratio).map(([k, v]) => [`ratio.${k}`, v])),
      ...Object.fromEntries(Object.entries(t.ms).map(([k, v]) => [`ms.${k}`, v])),
    });
  });

  const said = (k: 'engine' | 'bots' | 'first') =>
    `${ms(t.ms[k])}, Rapier's step ${ms(t.ms.rapier)}: ${t.ratio[k].toFixed(2)} times`;

  // Measured on 2026-11-19 (a laptop, Node), two runs: the engine's step 10.4 and 10.6 times Rapier's (1.3 to 1.6
  // ms: here Rapier's step is cheap, a still level with few bodies that move, and what is around it is not);
  // the bots' thinking 1.25 and 1.28; the first step 99 and 101 (15 to 16 ms). The budgets leave about a third
  // more. After stage 5.5e, three runs: the engine's step 9.3 (1.3 ms, the same: what costs is the character's
  // controller); the first step 54, 47 and 47 (7.2 to 7.7 ms): a query before Rapier sees a body asks it only if
  // its way comes near it. What is left of it is Rapier's first step (1.5 ms) and code run for the first time.
  test("the engine's step costs less than 14 of Rapier's, and fits in half a frame (8 ms)", () => {
    expect(t.ratio.engine, `the engine's step ${said('engine')}`).toBeLessThan(14);
    expect(t.ms.engine, `the engine's step ${ms(t.ms.engine)}`).toBeLessThan(8);
  });

  test("the attackers' thinking adds less than 2 of Rapier's steps", () => {
    expect(t.ratio.bots, `the bots' thinking ${said('bots')}`).toBeLessThan(2);
  });

  test("the level's first step costs less than 75 of Rapier's (the slow first step, 100 until stage 5.5e)", () => {
    expect(t.ratio.first, `the first step ${said('first')}`).toBeLessThan(75);
  });
});
