import type { SignalOp } from './types';

/**
 * A WORD OF THE WORLD (stage 5.5e, one pattern where three were written): an entity's name, a material's, a
 * zone's parameter: lowercase letters, digits and _, from a letter (`door_north`, `ice`, `opacity`).
 */
export const WORD = /^[a-z][a-z0-9_]*$/;

/** How many signals or zones each kind of signal reads (−1: one or more): the world's and the level's, once. */
export const SIGNAL_READS: Readonly<Record<SignalOp, number>> = {
  input: 0,
  zone: 1,
  used: 1,
  seen: 1,
  any: -1,
  all: -1,
  not: 1,
  toggle: 1,
  latch: 2,
};

/** What is wrong with a signal of `op` reading `count`, in words, or null. */
export function signalReadsProblem(op: string, count: number): string | null {
  const reads = (SIGNAL_READS as Record<string, number>)[op];
  if (reads === undefined) return `"${op}" is not what a signal can be (${Object.keys(SIGNAL_READS).join(', ')})`;
  if (reads >= 0 ? count === reads : count >= 1) return null;
  return `a ${op} reads ${reads < 0 ? 'one signal or more' : reads === 0 ? 'nothing' : reads === 1 ? 'one' : `${reads}`}`;
}
