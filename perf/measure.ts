import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { registryFor } from '@manifold/core';
import { DojoCartridge } from '@manifold/dojo/cartridge';
import { ROOMS } from '@manifold/dojo/rooms';

/**
 * WHAT EVERY PERFORMANCE SCENARIO SHARES (stage 2.5a; a file per scenario since 5.5d): rounds, the time of a
 * function, medians, costs measured against Rapier's own step in the same round, and each scenario's numbers
 * written for continuous integration to keep (`perf/results/<scenario>.json`, never committed), so a trend can
 * be read across runs instead of from the comments.
 *
 * MEASURED AGAINST RAPIER, NOT AGAINST THE CLOCK. A budget in milliseconds holds on one machine and fails on a
 * slower one (continuous integration's is). So each cost is measured against Rapier's own step, on the same
 * machine, from the same state: a proportion that does not depend on the machine, and that measures what is
 * ours. Each proportion is taken within one round, with everything measured in it, and the median of eight
 * rounds counts: a slow moment of the machine cancels out. They run alone (`npm run perf`): with every test
 * file at once, the times go up to five times.
 */

export const ROUNDS = 8;

/** How long `f` takes, in milliseconds: the best of `reps` times (a short one, once, is mostly noise). */
export function time(f: () => void, reps = 1): number {
  let best = Infinity;
  for (let i = 0; i < reps; i++) {
    const start = performance.now();
    f();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

export const median = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * Each measurement, in `ROUNDS` rounds, all of them in every round. What each one costs next to
 * `unit`, IN THE SAME ROUND (so how fast the machine is at that moment cancels out), and the median
 * of those proportions; and each one's median in milliseconds, for the messages.
 */
export function measure<K extends string>(unit: NoInfer<K>, measures: Record<K, () => number>) {
  const keys = Object.keys(measures) as K[];
  const rounds = Array.from(
    { length: ROUNDS },
    () => Object.fromEntries(keys.map((k) => [k, measures[k]()])) as Record<K, number>,
  );
  const ratio = Object.fromEntries(keys.map((k) => [k, median(rounds.map((r) => r[k] / r[unit]))])) as Record<K, number>;
  const ms = Object.fromEntries(keys.map((k) => [k, median(rounds.map((r) => r[k]))])) as Record<K, number>;
  return { ratio, ms };
}

export const ms = (n: number) => `${n.toFixed(3)} ms`;

/** The stress room's registry (its view values, `show.*`, are the presentation's: not here). */
export function stress() {
  const registry = registryFor(DojoCartridge);
  const errors = registry
    .run(ROOMS.stress!.text, 'recipe')
    .filter((m) => m.level === 'error' && !/no such name "(show|view)\./.test(m.text));
  expect(errors).toEqual([]);
  return registry;
}

/** A scenario's numbers, written for continuous integration to keep: `perf/results/<scenario>.json`. */
export function record(scenario: string, numbers: Record<string, number>) {
  const folder = join(import.meta.dirname, 'results');
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, `${scenario}.json`),
    JSON.stringify({ scenario, when: new Date().toISOString(), numbers }, null, 2) + '\n',
  );
}
