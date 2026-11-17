import { quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import {
  CHARACTER_GAP,
  DEFAULT_MOVEMENT,
  STANDS_ON,
  STEP_UP,
  type Capabilities,
  type EntityId,
  type Shape,
  type World,
} from '@manifold/core';
import { wayTo } from './signals';

/**
 * NAVIGATION (stage 4d, decision 0024): where a body can go in a level, as a grid of cells where a
 * standing body fits, sampled from the world as it is: the flat enough tops of what never moves (boxes,
 * turned or not, and the parts of a map's floor), and on each, a cell every half meter where the body's
 * capsule overlaps nothing. Its edges join neighboring cells: walking (within a step), dropping, jumping
 * up (within a jump), climbing (for a body that climbs), and across a gap. What a program moves is not a
 * cell like the rest: a door gives an edge that needs it open; a lift, cells at its foot and at its top
 * that need it there, and a ride between them. Built once for a level, where the brains run (decision
 * 0023): it is not part of the world's state, and nothing in the simulation reads it.
 */

/** How far apart the cells are (m): a little narrower than the character (0.6). */
export const CELL = 0.5;
/** Their centers, a quarter of a cell off the round numbers, where a level's edges usually are. */
const OFFSET = CELL / 2;
/** A level wider than this many cells is not sampled (a room of 150 × 150 m). */
const MOST_CELLS = 90_000;

/** The body a navigation is made for: its standing capsule, and how it moves. */
export interface NavBody {
  radius: number;
  halfHeight: number;
  /** What it steps up without jumping (the controller's), how high it jumps onto something, how far across a gap. */
  stepUp: number;
  jumpUp: number;
  jumpAcross: number;
  /** How fast it walks and climbs (m/s), and the gravity it falls by (m/s²). */
  speed: number;
  climbSpeed: number;
  gravity: number;
}

/**
 * The games' character (stage 4a: a capsule of 0.5 + 0.3), with the engine's numbers: it jumps 6.5 m/s
 * up (2.15 m on Earth; onto what is 1.8 m up, with room for its feet), and across 2.5 m.
 */
export const NAV_BODY: NavBody = Object.freeze({
  radius: 0.3,
  halfHeight: 0.5,
  stepUp: STEP_UP,
  jumpUp: 1.8,
  jumpAcross: 2.5,
  speed: DEFAULT_MOVEMENT.walk.speed,
  climbSpeed: DEFAULT_MOVEMENT.climb.speed,
  gravity: 9.81,
});

/** What a mechanism must say for a cell or an edge to be there: a signal's value. */
export interface Condition {
  signal: string;
  value: number;
}

/** A cell: its column, where a body's feet are on it, what it stands on, and what it needs (a lift there). */
export interface Cell {
  id: number;
  i: number;
  j: number;
  at: Vec3;
  on: EntityId;
  when: Condition | null;
}

export type EdgeKind = 'walk' | 'drop' | 'jump' | 'climb' | 'across' | 'ride';

/** An edge: from a cell to another, how, how long it takes (s), the capability it needs, and what a mechanism must say. */
export interface Edge {
  from: number;
  to: number;
  kind: EdgeKind;
  cost: number;
  needs: keyof Capabilities | null;
  when: Condition | null;
  /** A ride: standing at its start makes its signal so (the keep's lift goes up when someone is on it). */
  byStanding: boolean;
  /** A door it goes through (by name, or its entity's number), if any. */
  door: string | null;
}

export interface Nav {
  body: NavBody;
  cells: Cell[];
  /** Each cell's edges out. */
  out: Edge[][];
  /** Cells by column (`i j`), lowest first. */
  columns: Map<string, number[]>;
  /** Why there is none, when there is none. */
  reason: string | null;
}

const key = (i: number, j: number) => `${i} ${j}`;
const DOWN: Vec3 = [0, -1, 0];

/** A flat enough top: a box's face, as a plane with its two half sizes, and what it belongs to. */
interface Top {
  center: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
  hu: number;
  hv: number;
  low: [number, number];
  high: [number, number];
  on: EntityId;
  when: Condition | null;
}

/** The face of a box (its center, turn and half sizes) that looks most up, if it is flat enough to stand on. */
function topOf(center: Vec3, rotation: Quat, half: Vec3, on: EntityId, when: Condition | null): Top | null {
  const axes = [quat.rotate(rotation, [1, 0, 0]), quat.rotate(rotation, [0, 1, 0]), quat.rotate(rotation, [0, 0, 1])];
  let best = 0;
  for (let k = 1; k < 3; k++) if (Math.abs(axes[k]![1]) > Math.abs(axes[best]![1])) best = k;
  const sign = axes[best]![1] >= 0 ? 1 : -1;
  const normal = vec3.scale(axes[best]!, sign);
  if (normal[1] < STANDS_ON) return null;
  const face = vec3.add(center, vec3.scale(normal, half[best]!));
  const a = (best + 1) % 3;
  const b = (best + 2) % 3;
  const u = axes[a]!;
  const v = axes[b]!;
  const hu = half[a]!;
  const hv = half[b]!;
  const xs: number[] = [];
  const zs: number[] = [];
  for (const su of [-1, 1])
    for (const sv of [-1, 1]) {
      const corner = vec3.add(face, vec3.add(vec3.scale(u, su * hu), vec3.scale(v, sv * hv)));
      xs.push(corner[0]);
      zs.push(corner[2]);
    }
  return {
    center: face,
    normal,
    u,
    v,
    hu,
    hv,
    low: [Math.min(...xs), Math.min(...zs)],
    high: [Math.max(...xs), Math.max(...zs)],
    on,
    when,
  };
}

/** Where a vertical line at (x, z) meets a top, if it does within it. */
function heightOn(t: Top, x: number, z: number): number | null {
  if (x < t.low[0] || x > t.high[0] || z < t.low[1] || z > t.high[1]) return null;
  const y = t.center[1] - (t.normal[0] * (x - t.center[0]) + t.normal[2] * (z - t.center[2])) / t.normal[1];
  const d = vec3.sub([x, y, z], t.center);
  const eps = 1e-9;
  return Math.abs(vec3.dot(d, t.u)) <= t.hu + eps && Math.abs(vec3.dot(d, t.v)) <= t.hv + eps ? y : null;
}

/** The boxes a shape is made of, in its body's frame: itself, or a compound's parts. */
function boxesOf(shape: Shape): { offset: Vec3; half: Vec3 }[] {
  if (shape.kind === 'box') return [{ offset: [0, 0, 0], half: shape.halfExtents }];
  if (shape.kind === 'compound') return shape.parts.map((p) => ({ offset: p.offset, half: p.halfExtents }));
  return [];
}

/** Whether the body, its feet at `at`, overlaps nothing that never moves above what it steps up (a curb does not count). */
function fits(world: World, body: NavBody, at: Vec3, lift = body.stepUp): boolean {
  const capsule: Shape = { kind: 'capsule', halfHeight: body.halfHeight, radius: body.radius };
  const center: Vec3 = [at[0], at[1] + lift + CHARACTER_GAP + body.radius + body.halfHeight, at[2]];
  return world.castShape(capsule, center, quat.identity(), DOWN, 1e-3, QUERY) === null;
}

/** Whether the body goes from `a` to `b` (feet) with nothing in the way above what it steps up, at the higher one's height. */
function clear(world: World, body: NavBody, a: Vec3, b: Vec3): boolean {
  const y = Math.max(a[1], b[1]) + body.stepUp + CHARACTER_GAP + body.radius + body.halfHeight;
  const from: Vec3 = [a[0], y, a[2]];
  const way: Vec3 = [b[0] - a[0], 0, b[2] - a[2]];
  const length = Math.sqrt(way[0] * way[0] + way[2] * way[2]);
  if (length < 1e-9) return true;
  const capsule: Shape = { kind: 'capsule', halfHeight: body.halfHeight, radius: body.radius };
  return world.castShape(capsule, from, quat.identity(), vec3.scale(way, 1 / length), length, QUERY) === null;
}

/** What never moves: no characters, nothing the physics or a program moves. */
const QUERY = { characters: false, dynamic: false, moving: false } as const;

/** Whether a segment crosses a turned box (its center, turn, half sizes): the slabs' test, in the box's frame. */
function crosses(a: Vec3, b: Vec3, center: Vec3, rotation: Quat, half: Vec3): boolean {
  const back = quat.conjugate(rotation);
  const p = quat.rotate(back, vec3.sub(a, center));
  const d = quat.rotate(back, vec3.sub(b, a));
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-12) {
      if (Math.abs(p[k]!) > half[k]!) return false;
      continue;
    }
    let near = (-half[k]! - p[k]!) / d[k]!;
    let far = (half[k]! - p[k]!) / d[k]!;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * THE NAVIGATION OF A LEVEL, sampled from `world` as it is now for `body` (the games' character, if
 * none is said). With gravity along −Y: in a world whose "down" is another, none (its `reason` says why).
 */
export function buildNav(world: World, body: NavBody = NAV_BODY): Nav {
  const nav: Nav = { body, cells: [], out: [], columns: new Map(), reason: null };
  const g = world.gravity.vector;
  if (Math.abs(g[0]) > 1e-9 || Math.abs(g[2]) > 1e-9 || !(g[1] < 0)) {
    nav.reason = `its gravity is not along −Y (${g.join(' ')}): the grid is sampled along one "down"`;
    return nav;
  }
  // The tops: of what never moves, and of a lift where it waits and where it goes.
  const tops: Top[] = [];
  const doors: { name: string; center: Vec3; rotation: Quat; half: Vec3; when: Condition }[] = [];
  const lifts: { name: string; down: Top[]; up: Top[]; signal: string; seconds: number }[] = [];
  for (const e of world.entities.values()) {
    const b = e.body;
    const t = e.transform;
    if (!b || !t || e.character || b.type === 'dynamic') continue;
    const name = e.name ?? String(e.id);
    const m = e.mechanism;
    if (m?.door && b.shape.kind === 'box') {
      doors.push({
        name,
        center: m.closed.position,
        rotation: m.closed.rotation,
        half: b.shape.halfExtents,
        when: { signal: m.signal, value: 1 },
      });
      continue;
    }
    if (m?.lift) {
      const at = (by: Vec3, value: number) =>
        boxesOf(b.shape).flatMap((part) => {
          const center = vec3.add(vec3.add(m.closed.position, by), quat.rotate(m.closed.rotation, part.offset));
          const top = topOf(center, m.closed.rotation, part.half, e.id, { signal: m.signal, value });
          return top ? [top] : [];
        });
      const down = at([0, 0, 0], 0);
      const up = at(m.lift.by, 1);
      tops.push(...down, ...up);
      lifts.push({ name, down, up, signal: m.signal, seconds: m.seconds });
      continue;
    }
    // A program moves it (a platform that goes or turns): not sampled.
    if (b.type !== 'fixed' || e.mover || e.spin || m) continue;
    for (const part of boxesOf(b.shape)) {
      const top = topOf(vec3.add(t.position, quat.rotate(t.rotation, part.offset)), t.rotation, part.half, e.id, null);
      if (top) tops.push(top);
    }
  }
  if (tops.length === 0) {
    nav.reason = 'nothing to stand on';
    return nav;
  }
  const lowX = Math.min(...tops.map((t) => t.low[0]));
  const lowZ = Math.min(...tops.map((t) => t.low[1]));
  const highX = Math.max(...tops.map((t) => t.high[0]));
  const highZ = Math.max(...tops.map((t) => t.high[1]));
  const i0 = Math.floor((lowX - OFFSET) / CELL);
  const j0 = Math.floor((lowZ - OFFSET) / CELL);
  const i1 = Math.ceil((highX - OFFSET) / CELL);
  const j1 = Math.ceil((highZ - OFFSET) / CELL);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > MOST_CELLS) {
    nav.reason = `too wide to sample: ${((i1 - i0) * CELL).toFixed(0)} × ${((j1 - j0) * CELL).toFixed(0)} m`;
    return nav;
  }
  // The cells: down each column, every top it meets where the body fits (a lift's, as it would be there).
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const x = OFFSET + i * CELL;
      const z = OFFSET + j * CELL;
      const found: { y: number; top: Top }[] = [];
      for (const top of tops) {
        const y = heightOn(top, x, z);
        if (y !== null) found.push({ y, top });
      }
      found.sort((a, b) => a.y - b.y);
      const ids: number[] = [];
      for (const { y, top } of found) {
        const at: Vec3 = [x, y, z];
        // (A surface under another's thickness is not a floor: what the body would stand in is in the way.)
        if (!fits(world, body, at)) continue;
        const id = nav.cells.length;
        nav.cells.push({ id, i, j, at, on: top.on, when: top.when });
        nav.out.push([]);
        ids.push(id);
      }
      if (ids.length > 0) nav.columns.set(key(i, j), ids);
    }
  // The edges, to the eight around each cell (and across a gap, along them).
  const link = (from: Cell, to: Cell, kind: EdgeKind, cost: number, needs: keyof Capabilities | null) => {
    const door = doors.find((d) => crosses(chest(from, body), chest(to, body), d.center, d.rotation, d.half));
    // Onto a lift's cell, it must be there (a ride makes it so; on it already, it is there); through a
    // door, it must be open.
    const onIt = from.when !== null && to.when !== null && from.on === to.on && from.when.value === to.when.value;
    const when = door?.when ?? (kind === 'ride' || onIt ? null : to.when);
    nav.out[from.id]!.push({ from: from.id, to: to.id, kind, cost, needs, when, byStanding: false, door: door?.name ?? null });
  };
  const fallTime = (h: number) => Math.sqrt((2 * Math.max(0, h)) / body.gravity);
  const around = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  for (const a of nav.cells) {
    for (const [di, dj] of around) {
      const flat = Math.sqrt(di * di + dj * dj) * CELL;
      const there = nav.columns.get(key(a.i + di, a.j + dj)) ?? [];
      for (const id of there) {
        const b = nav.cells[id]!;
        // A lift's cells, at its foot and at its top, are not walked between (that is the ride).
        if (a.when && b.when && a.on === b.on && a.when.value !== b.when.value) continue;
        const rise = b.at[1] - a.at[1];
        if (!clear(world, body, a.at, b.at)) continue;
        if (Math.abs(rise) <= body.stepUp) link(a, b, 'walk', flat / body.speed, null);
        else if (rise < 0) link(a, b, 'drop', flat / body.speed + fallTime(-rise), null);
        else if (rise <= body.jumpUp) link(a, b, 'jump', flat / body.speed + 2 * fallTime(rise), null);
        else link(a, b, 'climb', rise / body.climbSpeed + 0.3, 'climb');
      }
      // Across a gap: along this way, past columns with nothing near this height, a cell at about it.
      const near = (id: number) => Math.abs(nav.cells[id]!.at[1] - a.at[1]) <= body.stepUp;
      if (there.some(near)) continue;
      for (let k = 2; k * flat <= body.jumpAcross; k++) {
        const far = (nav.columns.get(key(a.i + k * di, a.j + k * dj)) ?? []).map((id) => nav.cells[id]!);
        const b = far.find((c) => c.at[1] - a.at[1] <= body.stepUp && c.at[1] - a.at[1] >= -body.jumpUp && !c.when);
        if (b) {
          if (clear(world, body, a.at, b.at)) link(a, b, 'across', (k * flat) / body.speed + 0.4, null);
          break;
        }
        if (far.some((c) => c.at[1] > a.at[1] - body.jumpUp)) break;
      }
    }
  }
  // A lift's ride: from each cell at its foot to the one above it at its top.
  for (const lift of lifts) {
    const way = wayTo(world, lift.signal, 1);
    const zone = way && !way.use ? world.named(way.zone) : undefined;
    for (const a of nav.cells) {
      if (a.when?.signal !== lift.signal || a.when.value !== 0 || !lift.down.some((t) => t.on === a.on)) continue;
      const b = (nav.columns.get(key(a.i, a.j)) ?? [])
        .map((id) => nav.cells[id]!)
        .find((c) => c.on === a.on && c.when?.value === 1);
      if (!b) continue;
      nav.out[a.id]!.push({
        from: a.id,
        to: b.id,
        kind: 'ride',
        cost: lift.seconds,
        needs: null,
        when: { signal: lift.signal, value: 1 },
        byStanding: zone !== undefined && inZone(world, zone.id, chest(a, body)),
        door: null,
      });
    }
  }
  return nav;
}

/** A cell's body center, its feet `at` and its capsule above them. */
export const chest = (c: Cell, body: NavBody): Vec3 => [
  c.at[0],
  c.at[1] + CHARACTER_GAP + body.radius + body.halfHeight,
  c.at[2],
];

/** Whether a point is inside a zone (its box, turned), by the zone's entity. */
export function inZone(world: World, zone: EntityId, p: Vec3): boolean {
  const e = world.entities.get(zone);
  if (!e?.sensor || !e.transform) return false;
  const local = quat.rotate(quat.conjugate(e.transform.rotation), vec3.sub(p, e.transform.position));
  return [0, 1, 2].every((k) => Math.abs(local[k]!) <= e.sensor!.half[k]!);
}

/** The cell a point stands on (a body's center, or its feet): its column's highest cell not above it, or the nearest around. */
export function cellAt(nav: Nav, p: Vec3): Cell | null {
  const i = Math.round((p[0] - OFFSET) / CELL);
  const j = Math.round((p[2] - OFFSET) / CELL);
  let best: Cell | null = null;
  let distance = Infinity;
  for (let r = 0; r <= 2 && !best; r++)
    for (let di = -r; di <= r; di++)
      for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        for (const id of nav.columns.get(key(i + di, j + dj)) ?? []) {
          const c = nav.cells[id]!;
          if (c.at[1] > p[1] + 0.1) continue;
          const d = vec3.length(vec3.sub(c.at, p));
          if (d < distance) {
            distance = d;
            best = c;
          }
        }
      }
  return best;
}
