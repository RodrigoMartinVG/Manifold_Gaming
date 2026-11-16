/**
 * SIGNALS: named numbers, computed once per step, at its end, in the order they are written. Each one
 * reads zones (who is on a plate, who pressed `use` in front of a button) or signals written ABOVE it:
 * so a cycle cannot be written, and from a cause to its effect there is always one step.
 */
export type Op = 'zone' | 'used' | 'any' | 'all' | 'not' | 'toggle' | 'latch';

export interface Signal {
  name: string;
  op: Op;
  /** What it reads: a zone (`zone`, `used`) or signals above it. */
  reads: string[];
  /** Its value now: 0 is off, anything else on. */
  value: number;
  /** What a toggle or a latch keeps between steps (whether what it reads was on). */
  kept: number;
}

export const signal = (name: string, op: Op, ...reads: string[]): Signal => ({
  name,
  op,
  reads,
  value: 0,
  kept: 0,
});

/** What the zones say at this step: how many are on each, and where `use` was pressed. */
export interface Zones {
  on: ReadonlyMap<string, number>;
  used: ReadonlySet<string>;
}

/**
 * Every signal, at the end of a step. In the order written, each one reads this step's values of the
 * ones above it. In the other order (`backwards`), a signal reads the ones below it before they are
 * computed: last step's values, and the effect comes steps later.
 */
export function compute(signals: Signal[], zones: Zones, backwards = false) {
  const valueOf = (name: string) => signals.find((s) => s.name === name)?.value ?? 0;
  for (const s of backwards ? [...signals].reverse() : signals) {
    const on = s.reads.map((r) => valueOf(r) !== 0);
    switch (s.op) {
      case 'zone':
        s.value = zones.on.get(s.reads[0]!) ?? 0;
        break;
      case 'used':
        s.value = zones.used.has(s.reads[0]!) ? 1 : 0;
        break;
      case 'any':
        s.value = on.some(Boolean) ? 1 : 0;
        break;
      case 'all':
        s.value = on.every(Boolean) ? 1 : 0;
        break;
      case 'not':
        s.value = on[0] ? 0 : 1;
        break;
      case 'toggle':
        // It flips when what it reads turns on (an edge), not while it stays on.
        if (on[0] && !s.kept) s.value = s.value ? 0 : 1;
        s.kept = on[0] ? 1 : 0;
        break;
      case 'latch':
        // On when the first turns on, off when the second does.
        if (on[0]) s.value = 1;
        else if (on[1]) s.value = 0;
        break;
    }
  }
}
