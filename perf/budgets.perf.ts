import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, registryFor, Session, stateHash, World, type WorldSnapshot } from '@manifold/core';
import { DojoCartridge } from '@manifold/dojo/cartridge';
import { ROOMS } from '@manifold/dojo/rooms';
import { Client, localPair, Server, type Channel, type ToClient, type ToServer } from '@manifold/net';

/**
 * THE PERFORMANCE BUDGETS (stage 2.5a), in the Dojo's stress room: the course with 200 cubes falling
 * on it (215 bodies). What a step, the hash and a snapshot cost, and what the second copy that
 * verifies costs when playing alone.
 *
 * MEASURED AGAINST RAPIER, NOT AGAINST THE CLOCK. A budget in milliseconds holds on one machine and
 * fails on a slower one (continuous integration's is). So each cost is measured against Rapier's own
 * step, on the same machine, from the same state: a proportion that does not depend on the machine,
 * and that measures what is ours. Each proportion is taken within one round, with everything measured
 * in it, and the median of eight rounds counts: a slow moment of the machine cancels out. Only one budget is in milliseconds, and generous: what a frame allows.
 *
 * They run alone (`npm run perf`): with every test file at once, the times go up to five times.
 *
 * Measured on 2026-11-14 (a laptop, Node), to see how much room each budget leaves: Rapier's step
 * 0.38–0.50 ms; the engine's step 2.3–3.2 times that (reading back every body: 0.19 ms; the zones,
 * each one against every body: 0.20 ms); the hash 3.5–6.5 times; a snapshot 2.0–2.3 times to take
 * and 3.3–4.0 to restore, 571 KB; playing alone 2.06–2.25 times one copy. Stage 2.5b made the step
 * cheaper (the zones look first at the box that holds them; a body asleep is not read again): the
 * engine's step 1.65–1.90 times Rapier's, and its budget went from 4 to 2.5.
 */

beforeAll(initPhysics);

const ROUNDS = 8;

/** The stress room's registry (its view values, `show.*`, are the presentation's: not here). */
function stress() {
  const registry = registryFor(DojoCartridge);
  const errors = registry
    .run(ROOMS.stress!.text, 'recipe')
    .filter((m) => m.level === 'error' && !/no such name "(show|view)\./.test(m.text));
  expect(errors).toEqual([]);
  return registry;
}

/** How long `f` takes, in milliseconds: the best of `reps` times (a short one, once, is mostly noise). */
function time(f: () => void, reps = 1): number {
  let best = Infinity;
  for (let i = 0; i < reps; i++) {
    const start = performance.now();
    f();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * Each measurement, in `ROUNDS` rounds, all of them in every round. What each one costs next to
 * `unit`, IN THE SAME ROUND (so how fast the machine is at that moment cancels out), and the median
 * of those proportions; and each one's median in milliseconds, for the messages.
 */
function measure<K extends string>(unit: NoInfer<K>, measures: Record<K, () => number>) {
  const keys = Object.keys(measures) as K[];
  const rounds = Array.from(
    { length: ROUNDS },
    () => Object.fromEntries(keys.map((k) => [k, measures[k]()])) as Record<K, number>,
  );
  const ratio = Object.fromEntries(keys.map((k) => [k, median(rounds.map((r) => r[k] / r[unit]))])) as Record<K, number>;
  const ms = Object.fromEntries(keys.map((k) => [k, median(rounds.map((r) => r[k]))])) as Record<K, number>;
  return { ratio, ms };
}

const ms = (n: number) => `${n.toFixed(3)} ms`;

describe('the performance budgets (stage 2.5a), in the stress room', () => {
  /** The stress room two seconds after its birth: most cubes still falling, rolling, piling up. */
  let snap: WorldSnapshot;
  /** What each one costs, from there: next to Rapier's own step (`ratio`), and in milliseconds. */
  let t: ReturnType<typeof measure<'rapier' | 'engine' | 'hash' | 'take' | 'restore'>>;

  beforeAll(() => {
    const session = new Session(DojoCartridge, { registry: stress() });
    for (let i = 0; i < 120; i++) session.step();
    snap = session.world.snapshot();
    session.world.dispose();
    const steps = 60;
    /** What `n` steps cost, each one, from the snapshot (a new world each time: the same state). */
    const stepping = (step: (w: World) => void) => () => {
      const w = World.restore(snap);
      const spent = time(() => {
        for (let i = 0; i < steps; i++) step(w);
      });
      w.dispose();
      return spent / steps;
    };
    const still = World.restore(snap);
    t = measure('rapier', {
      rapier: stepping((w) => w.physics.step()),
      engine: stepping((w) => w.step()),
      hash: () => time(() => stateHash(still), 5),
      take: () => time(() => still.snapshot(), 5),
      restore: () => time(() => World.restore(snap).dispose(), 5),
    });
    still.dispose();
  });

  const said = (k: 'engine' | 'hash' | 'take' | 'restore') =>
    `${ms(t.ms[k])}, Rapier's step ${ms(t.ms.rapier)}: ${t.ratio[k].toFixed(2)} times`;

  test('the scene is the stress one: 215 bodies', () => {
    const w = World.restore(snap);
    expect(w.physics.bodyCount).toBe(215);
    w.dispose();
  });

  test("the engine's step costs less than 2.5 of Rapier's: what is around the physics is not more than one and a half times it", () => {
    expect(t.ratio.engine, `the engine's step ${said('engine')}`).toBeLessThan(2.5);
  });

  test('and it fits in half a frame at 60 per second (8 ms), on any machine that runs the tests', () => {
    expect(t.ms.engine, `the engine's step ${ms(t.ms.engine)}`).toBeLessThan(8);
  });

  test("the hash costs less than eight of Rapier's steps", () => {
    expect(t.ratio.hash, `the hash ${said('hash')}`).toBeLessThan(8);
  });

  test("a snapshot: taken in less than 3.5 of Rapier's steps, restored in less than 5.5", () => {
    expect(t.ratio.take, `taken in ${said('take')}`).toBeLessThan(3.5);
    expect(t.ratio.restore, `restored in ${said('restore')}`).toBeLessThan(5.5);
  });

  test('a snapshot weighs less than 600 KB (as the server counts it: the physics bytes and the entities as text)', () => {
    // Not a time: the same bytes on every machine. 440,548 of physics and 130,620 of entities today.
    const bytes = snap.physics.length + JSON.stringify(snap.entities).length;
    expect(bytes).toBeLessThan(600_000);
  });

  test('playing alone (a server that verifies, and the copy that is drawn) costs less than 2.5 copies', () => {
    const steps = 240;
    const alone = measure('one', {
      one: () => {
        const session = new Session(DojoCartridge, { registry: stress() });
        const spent = time(() => {
          for (let i = 0; i < steps; i++) session.step();
        });
        session.world.dispose();
        return spent;
      },
      alone: () => {
        // As the page plays: its own server, and the client's copy, joined by a channel in memory.
        const birth = new Session(DojoCartridge, { registry: stress() });
        const server = new Server(DojoCartridge, { birth: birth.birth });
        birth.world.dispose();
        const pair = localPair<ToClient, ToServer>();
        server.connect(pair.a);
        const client = new Client(DojoCartridge, registryFor(DojoCartridge), pair.b as Channel<ToServer, ToClient>, {
          welcome() {},
          say() {},
          desync() {},
        });
        client.hello();
        pair.flush();
        const spent = time(() => {
          for (let i = 0; i < steps; i++) {
            server.step();
            client.drain();
          }
        });
        // It verified: once a second, the server's hash against the client's copy.
        expect(client.checks).toBe(steps / 60);
        client.session?.world.dispose();
        server.dispose();
        return spent;
      },
    });
    expect(
      alone.ratio.alone,
      `playing alone ${ms(alone.ms.alone / steps)} a step, one copy ${ms(alone.ms.one / steps)}: ${alone.ratio.alone.toFixed(2)} times`,
    ).toBeLessThan(2.5);
  });
});
