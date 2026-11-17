import { vec3, type Vec3 } from '@manifold/common';
import type { Capabilities, World } from '@manifold/core';
import { CELL, cellAt, chest, inZone, type Cell, type Edge, type EdgeKind, type Nav } from './navigation';
import { wayTo, type Way } from './signals';

/**
 * PATHS (stage 4d, decision 0024): A* over a navigation's cells, its heuristic the distance along the
 * ground at the body's walking speed (it never overestimates, so the path found is the quickest), with the
 * edges a body may take: those whose capability it has and whose mechanism says what they need. When
 * none reaches, the planner looks at the edges it could not take, reads from each one's signal what
 * changes it (a plate to stand on, a button to press: signals.ts), and goes there first. Then the path
 * is pulled straight: of the cells it walks over, only the corners it must turn are kept.
 */

/** A point of a path: where the feet go, and how they get there (or what is done there). */
export interface Step {
  at: Vec3;
  /** `start`: where it begins; an edge's kind; `use`: press `use` here; `stand`: wait here, in a zone. */
  kind: EdgeKind | 'start' | 'use' | 'stand';
  /** For `use` and `stand`, the zone; through a door, its name. */
  zone?: string;
  door?: string;
}

export interface Path {
  steps: Step[];
  /** How long it takes (s), by its edges. */
  cost: number;
  /** What it changes on its way: for each zone it goes to, the signal and the value it wants there. */
  changes: { signal: string; value: number; way: Way }[];
}

/** What a body may do while it plans. */
export interface PlanOptions {
  /** Its capabilities (a character's `can`): none beyond walking and jumping, unless said. */
  can?: Partial<Capabilities>;
  /** How many buttons and plates in a row it may plan for (1, unless said). */
  depth?: number;
}

type Values = ReadonlyMap<string, number>;

const open = (e: Edge, can: Partial<Capabilities>, values: Values) => {
  if (e.needs && !can[e.needs]) return false;
  if (!e.when) return true;
  if (e.kind === 'ride' && e.byStanding) return true;
  return (values.get(e.when.signal) ?? 0) === e.when.value;
};

/** A small binary heap of cells by their estimate. */
class Queue {
  private items: { id: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(id: number, f: number) {
    const a = this.items;
    a.push({ id, f });
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (a[p]!.f <= a[k]!.f) break;
      [a[p], a[k]] = [a[k]!, a[p]!];
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!.id;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k]!, a[m]!];
        k = m;
      }
    }
    return top;
  }
}

/**
 * The quickest way from one cell to the first of `goals` it reaches (null: none), and the time to every
 * cell it reached (A* towards `toward`, or, without it, Dijkstra over all it can reach).
 */
function search(
  nav: Nav,
  start: number,
  goals: ReadonlySet<number>,
  toward: Vec3 | null,
  can: Partial<Capabilities>,
  values: Values,
): { edges: Edge[] | null; time: Map<number, number> } {
  const time = new Map<number, number>([[start, 0]]);
  const via = new Map<number, Edge>();
  const done = new Set<number>();
  const queue = new Queue();
  // The heuristic: how far it is along the ground, at the walking speed. Never more than any way's
  // time: every edge takes at least its own length along the ground at that speed (a fall of more than
  // 4 m is quicker than walking its height, so the height is left out).
  const h = (id: number) => {
    if (!toward) return 0;
    const at = nav.cells[id]!.at;
    return Math.sqrt((at[0] - toward[0]) * (at[0] - toward[0]) + (at[2] - toward[2]) * (at[2] - toward[2])) / nav.body.speed;
  };
  queue.push(start, h(start));
  while (queue.size > 0) {
    const id = queue.pop();
    if (done.has(id)) continue;
    done.add(id);
    if (goals.has(id)) {
      const edges: Edge[] = [];
      for (let at = id; at !== start;) {
        const e = via.get(at)!;
        edges.push(e);
        at = e.from;
      }
      return { edges: edges.reverse(), time };
    }
    const t = time.get(id)!;
    for (const e of nav.out[id]!) {
      if (done.has(e.to) || !open(e, can, values)) continue;
      const next = t + e.cost;
      if (next < (time.get(e.to) ?? Infinity)) {
        time.set(e.to, next);
        via.set(e.to, e);
        queue.push(e.to, next + h(e.to));
      }
    }
  }
  return { edges: null, time };
}

const stepsOf = (nav: Nav, start: Cell, edges: readonly Edge[]): Step[] => [
  { at: start.at, kind: 'start' },
  ...edges.map((e): Step => ({ at: nav.cells[e.to]!.at, kind: e.kind, ...(e.door ? { door: e.door } : {}) })),
];

/**
 * A PATH from `from` to `to` (points: a body's center or its feet), for a body that may do what `o`
 * says, in `world` as it is now: null if there is none, even pressing what it could press.
 */
export function findPath(world: World, nav: Nav, from: Vec3, to: Vec3, o: PlanOptions = {}): Path | null {
  const start = cellAt(nav, from);
  const goal = cellAt(nav, to);
  if (!start || !goal) return null;
  const values = new Map(world.signals.map((s) => [s.name, s.value]));
  const found = plan(world, nav, start, new Set([goal.id]), goal.at, o.can ?? {}, values, o.depth ?? 1);
  return found && { ...found, steps: pull(nav, found.steps) };
}

function plan(
  world: World,
  nav: Nav,
  start: Cell,
  goals: ReadonlySet<number>,
  toward: Vec3,
  can: Partial<Capabilities>,
  values: Values,
  depth: number,
): Path | null {
  const direct = search(nav, start.id, goals, toward, can, values);
  if (direct.edges)
    return { steps: stepsOf(nav, start, direct.edges), cost: direct.edges.reduce((sum, e) => sum + e.cost, 0), changes: [] };
  if (depth <= 0) return null;
  // Closed: what the edges it could not take need, from where it could get to.
  const reach = search(nav, start.id, new Set(), null, can, values).time;
  const wanted = new Map<string, number>();
  for (const id of reach.keys())
    for (const e of nav.out[id]!)
      if (e.when && !open(e, can, values) && (!e.needs || can[e.needs])) wanted.set(e.when.signal, e.when.value);
  let best: Path | null = null;
  for (const [signal, value] of wanted) {
    const way = wayTo(world, signal, value);
    const zone = way && world.named(way.zone);
    if (!way || !zone) continue;
    // The quickest cell it reaches inside that zone (its body's center in it).
    let there: Cell | null = null;
    let time = Infinity;
    for (const [id, t] of reach) {
      const c = nav.cells[id]!;
      if (t < time && inZone(world, zone.id, chest(c, nav.body))) {
        there = c;
        time = t;
      }
    }
    if (!there) continue;
    const first = search(nav, start.id, new Set([there.id]), there.at, can, values).edges;
    if (!first) continue;
    const after = new Map(values).set(signal, value);
    const rest = plan(world, nav, there, goals, toward, can, after, depth - 1);
    if (!rest) continue;
    const cost = first.reduce((sum, e) => sum + e.cost, 0) + rest.cost;
    if (best && best.cost <= cost) continue;
    best = {
      steps: [
        ...stepsOf(nav, start, first),
        { at: there.at, kind: way.use ? 'use' : 'stand', zone: way.zone },
        ...rest.steps.slice(1),
      ],
      cost,
      changes: [{ signal, value, way }, ...rest.changes],
    };
  }
  return best;
}

/** Whether a body walks straight from `a` to `b` (feet) over cells all the way, none of them needing a mechanism. */
function walkable(nav: Nav, a: Vec3, b: Vec3): boolean {
  const d = vec3.sub(b, a);
  const length = Math.sqrt(d[0] * d[0] + d[2] * d[2]);
  const n = Math.ceil(length / (CELL / 2));
  for (let k = 1; k < n; k++) {
    const p = vec3.add(a, vec3.scale(d, k / n));
    const i = Math.round((p[0] - CELL / 2) / CELL);
    const j = Math.round((p[2] - CELL / 2) / CELL);
    const ok = (nav.columns.get(`${i} ${j}`) ?? []).some((id) => {
      const c = nav.cells[id]!;
      return !c.when && Math.abs(c.at[1] - p[1]) <= nav.body.stepUp;
    });
    if (!ok) return false;
  }
  return true;
}

/** The path pulled straight: within each stretch walked, only the points where it must turn. */
function pull(nav: Nav, steps: readonly Step[]): Step[] {
  const out: Step[] = [steps[0]!];
  let k = 1;
  while (k < steps.length) {
    const s = steps[k]!;
    if (s.kind !== 'walk' || s.door) {
      out.push(s);
      k++;
      continue;
    }
    // From the last point kept, as far along the walked stretch as it goes straight.
    const from = out[out.length - 1]!.at;
    let last = k;
    while (
      last + 1 < steps.length &&
      steps[last + 1]!.kind === 'walk' &&
      !steps[last + 1]!.door &&
      walkable(nav, from, steps[last + 1]!.at)
    )
      last++;
    out.push(steps[last]!);
    k = last + 1;
  }
  return out;
}
