/**
 * THE BROAD PHASE: which pairs MAY touch. Each ball is wrapped in its box along the axes (an AABB),
 * and two boxes overlap only if they overlap on every axis: four comparisons (here, on the floor's
 * two axes). It never misses a pair that touches: what it lets through is checked exactly later.
 */
export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
}

export interface Found {
  /** The pairs whose boxes overlap, as `i * count + j` with i < j. */
  pairs: number[];
  /** How many box tests it took. */
  tests: number;
}

const overlap = (a: Ball, b: Ball) =>
  Math.abs(a.x - b.x) <= a.radius + b.radius && Math.abs(a.z - b.z) <= a.radius + b.radius;

/** Every ball against every other: n · (n − 1) / 2 tests. */
export function everyPair(balls: readonly Ball[]): Found {
  const pairs: number[] = [];
  let tests = 0;
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      tests++;
      if (overlap(balls[i]!, balls[j]!)) pairs.push(i * balls.length + j);
    }
  return { pairs, tests };
}

/**
 * A GRID (spatial partition): the floor in square cells. Each ball goes into the cells its box
 * covers, and only balls that share a cell are tested. Two balls far apart never meet.
 */
export function grid(balls: readonly Ball[], cell: number): Found {
  // A cell's key is one number (not a text: making texts would cost more than the tests it saves).
  const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
  const cells = new Map<number, number[]>();
  balls.forEach((b, i) => {
    const [x0, x1] = [Math.floor((b.x - b.radius) / cell), Math.floor((b.x + b.radius) / cell)];
    const [z0, z1] = [Math.floor((b.z - b.radius) / cell), Math.floor((b.z + b.radius) / cell)];
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const list = cells.get(key(cx, cz));
        if (list) list.push(i);
        else cells.set(key(cx, cz), [i]);
      }
  });
  const pairs: number[] = [];
  let tests = 0;
  for (const [k, list] of cells)
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) {
        const i = Math.min(list[a]!, list[b]!);
        const j = Math.max(list[a]!, list[b]!);
        tests++;
        if (!overlap(balls[i]!, balls[j]!)) continue;
        // Two balls can share more than one cell: the pair counts only in the cell where the corner
        // of the overlap of their two boxes is (the corner with the smallest x and z). That one is
        // always one of the cells they share, and only one.
        const [p, q] = [balls[i]!, balls[j]!];
        const cx = Math.floor(Math.max(p.x - p.radius, q.x - q.radius) / cell);
        const cz = Math.floor(Math.max(p.z - p.radius, q.z - q.radius) / cell);
        if (key(cx, cz) === k) pairs.push(i * balls.length + j);
      }
  return { pairs, tests };
}
