import type { World } from '@manifold/core';

/**
 * WHAT A SIGNAL ASKS FOR (stage 4d, decision 0024): to make a signal what an edge needs (a door open, a
 * lift down), what a body can do, read from the signal's own definition (3c, decision 0018): stand in
 * the zone a `zone` signal watches, press `use` in the zone a `used` signal watches, set or reset a
 * `latch`, flip a `toggle`, turn on the one input of an `all` that is off. Nothing written for it in the
 * level: the signals already say it. Null where the definition says nothing a body can do (a `seen`,
 * an input the game sets, a chain longer than `depth`).
 */
export interface Way {
  /** The zone to go to, by name. */
  zone: string;
  /** In it, press `use` (a button); if not, stand there (a plate). */
  use: boolean;
}

export function wayTo(world: World, name: string, value: number, depth = 6): Way | null {
  if (depth < 0) return null;
  const s = world.signals.find((w) => w.name === name);
  if (!s) return null;
  const on = value !== 0;
  // Already so: nothing to do (an empty way is not a way: the caller asks only when it is not).
  const next = (n: string, v: number) => wayTo(world, n, v, depth - 1);
  const isOn = (n: string) => world.signal(n) !== 0;
  switch (s.op) {
    case 'zone':
      // How many are in it: standing there turns it on; nobody can be told to empty it.
      return on ? { zone: s.reads[0]!, use: false } : null;
    case 'used':
      return on ? { zone: s.reads[0]!, use: true } : null;
    case 'not':
      return next(s.reads[0]!, on ? 0 : 1);
    case 'toggle':
      // It flips when what it reads turns on: whichever way it should go, that.
      return (s.value !== 0) === on ? null : next(s.reads[0]!, 1);
    case 'latch':
      // On when the first is on, off when the second is.
      return next(s.reads[on ? 0 : 1]!, 1);
    case 'any':
      if (on) {
        for (const r of s.reads) {
          const way = next(r, 1);
          if (way) return way;
        }
        return null;
      }
      return null;
    case 'all': {
      if (!on) {
        for (const r of s.reads) {
          const way = next(r, 0);
          if (way) return way;
        }
        return null;
      }
      // One body can turn on one of them: the one that is off, if only one is.
      const off = s.reads.filter((r) => !isOn(r));
      return off.length === 1 ? next(off[0]!, 1) : null;
    }
    default:
      // `input` (the game's), `seen` (what an eye sees): nothing a body is told to do.
      return null;
  }
}
