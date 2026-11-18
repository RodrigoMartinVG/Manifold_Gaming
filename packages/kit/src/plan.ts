/**
 * A LEVEL DRAWN AS A PLAN, MADE OF THE KIT (stage 5m, decision 0031: levels of 2 to 5 minutes, too many
 * pieces to place one by one). A plan is a level file with a grid in it, between `plan <x> <z>` and `end`:
 * one character a meter, the columns along +X from `x`, the rows along +Z from `z`. What the grid says
 * becomes the kit's lines; everything else in the file (its title, its lamps, routes, zones, guards)
 * passes as it is, before and after.
 *
 *     plan -12 -30
 *     ############
 *     #....c.....#
 *     #..o.......+
 *     #####..#####
 *     end
 *
 *   - `#` a wall 6 m high (the kit's walls, 3 m each, two up); `+` one 3 m high;
 *   - `c` a crate (a block of a meter), `o` a pillar, standing on the floor;
 *   - a space: nothing (no floor: a pit, or outside); any other character: floor (a letter or a digit
 *     may mark a place on the plan, for whoever reads it: it is floor).
 *
 * Walls: each run of two or more along a row is laid along X, along a column along Z (turned 90°), in
 * pieces of 4, 2 and 1 m; a wall cell alone, one piece of 1 m. A corner is in both runs (they overlap:
 * no gap). The floor: a tile of 4 m wherever a square of 4 by 4 cells from the plan's corner has anything
 * in it. Pure: the same plan, the same level, line for line (a test keeps the level files made from
 * their plans).
 *
 * (Stage 5o, decision 0031: levels with floors above floors.) A file may have several grids, and a grid
 * may stand at a height: `plan <x> <z> <y>`. There everything stands on `y` (its walls, crates, pillars)
 * and its floor is laid exactly where its cells are, no more (in tiles of 4, of 2 and of 1 m: a balcony
 * two cells wide does not cover the hall it looks down on), with `=` a railing a meter high (the kit's of
 * 2 m along its run, the last overlapping the one before it on an odd run). Stairs, lifts, what moves and
 * what is turned (a round room's walls) are the file's own lines.
 */
export function levelFromPlan(text: string, source = 'its plan'): string {
  let lines = text.split('\n');
  if (!lines.some((l) => /^plan\s/.test(l))) throw new Error('a plan has a line `plan <x> <z>`');
  // Each grid in turn, from the first: its lines in its place.
  for (let start = lines.findIndex((l) => /^plan\s/.test(l)); start >= 0; start = lines.findIndex((l) => /^plan\s/.test(l))) {
    const end = lines.findIndex((l, i) => i > start && l.trim() === 'end');
    if (end < 0) throw new Error('a plan ends its grid with a line `end`');
    lines = [...lines.slice(0, start), ...gridLines(lines[start]!, lines.slice(start + 1, end), source), ...lines.slice(end + 1)];
  }
  return lines.join('\n');
}

/** One grid's kit lines, from its `plan` line and its rows. */
function gridLines(head: string, rows: readonly string[], source: string): string[] {
  const [, xs, zs, ys] = head.trim().split(/\s+/);
  const x0 = Number(xs);
  const z0 = Number(zs);
  const raised = ys !== undefined;
  const y0 = raised ? Number(ys) : 0;
  if (!Number.isFinite(x0) || !Number.isFinite(z0) || !Number.isFinite(y0))
    throw new Error('`plan` takes the grid corner: `plan <x> <z>`, and a height: `plan <x> <z> <y>`');
  const width = Math.max(0, ...rows.map((r) => r.length));
  const at = (r: number, c: number) => rows[r]?.[c] ?? ' ';
  const n = (v: number) => String(Math.round(v * 100) / 100);
  const out: string[] = [];

  const Y = n(y0);
  // The floor: a tile wherever a 4 by 4 square has anything; raised, exactly its cells (4, 2 and 1 m tiles).
  out.push(
    `# Made from ${source} (levelFromPlan, @manifold/kit): the floor, the walls, crates and pillars${raised ? `, ${Y} m up` : ''}.`,
  );
  const full = (r: number, c: number, size: number) => {
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (at(r + i, c + j) === ' ') return false;
    return true;
  };
  for (let r = 0; r < rows.length; r += 4)
    for (let c = 0; c < width; c += 4) {
      if (!raised) {
        let any = false;
        for (let i = 0; i < 4 && !any; i++) for (let j = 0; j < 4 && !any; j++) any = at(r + i, c + j) !== ' ';
        if (any) out.push(`kit floor_4  ${n(x0 + c + 2)} 0 ${n(z0 + r + 2)}`);
        continue;
      }
      if (full(r, c, 4)) {
        out.push(`kit floor_4  ${n(x0 + c + 2)} ${Y} ${n(z0 + r + 2)}`);
        continue;
      }
      for (let i = 0; i < 4; i += 2)
        for (let j = 0; j < 4; j += 2) {
          if (full(r + i, c + j, 2)) {
            out.push(`kit floor_2  ${n(x0 + c + j + 1)} ${Y} ${n(z0 + r + i + 1)}`);
            continue;
          }
          for (let a = 0; a < 2; a++)
            for (let b = 0; b < 2; b++)
              if (at(r + i + a, c + j + b) !== ' ')
                out.push(`kit floor_1  ${n(x0 + c + j + b + 0.5)} ${Y} ${n(z0 + r + i + a + 0.5)}`);
        }
    }

  // The walls, by their height's character.
  const lay = (char: string, layers: number) => {
    const along = (len: number, center: number, fixed: number, turned: boolean) => {
      for (let k = 0; k < layers; k++)
        out.push(
          turned
            ? `kit wall_${len}  ${n(fixed)} ${n(y0 + 3 * k)} ${n(center)}  rotate y 90`
            : `kit wall_${len}  ${n(center)} ${n(y0 + 3 * k)} ${n(fixed)}`,
        );
    };
    /** A run from `from` (a cell) `length` cells long, in pieces of 4, 2 and 1. */
    const pieces = (from: number, length: number, fixed: number, turned: boolean, origin: number) => {
      let k = 0;
      for (const len of [4, 2, 1])
        while (length - k >= len) {
          along(len, origin + from + k + len / 2, fixed, turned);
          k += len;
        }
    };
    const inRow = (r: number, c: number) => at(r, c - 1) === char || at(r, c + 1) === char;
    const inColumn = (r: number, c: number) => at(r - 1, c) === char || at(r + 1, c) === char;
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < width; c++) {
        if (at(r, c) !== char || (c > 0 && at(r, c - 1) === char)) continue;
        let len = 0;
        while (at(r, c + len) === char) len++;
        if (len >= 2) pieces(c, len, z0 + r + 0.5, false, x0);
      }
    for (let c = 0; c < width; c++)
      for (let r = 0; r < rows.length; r++) {
        if (at(r, c) !== char || (r > 0 && at(r - 1, c) === char)) continue;
        let len = 0;
        while (at(r + len, c) === char) len++;
        if (len >= 2) pieces(r, len, x0 + c + 0.5, true, z0);
      }
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < width; c++)
        if (at(r, c) === char && !inRow(r, c) && !inColumn(r, c)) along(1, x0 + c + 0.5, z0 + r + 0.5, false);
  };
  lay('#', 2);
  lay('+', 1);
  // The railings: runs of `=`, in pieces of 2 m (on an odd run, the last one back over the one before it).
  const rail = (from: number, length: number, fixed: number, turned: boolean, origin: number) => {
    for (let k = 0; k < Math.max(2, length); k += 2) {
      const at0 = Math.min(k, Math.max(0, length - 2));
      const center = origin + from + at0 + 1;
      out.push(
        turned ? `kit railing_2  ${n(fixed)} ${Y} ${n(center)}  rotate y 90` : `kit railing_2  ${n(center)} ${Y} ${n(fixed)}`,
      );
    }
  };
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < width; c++) {
      if (at(r, c) !== '=' || at(r, c - 1) === '=') continue;
      let len = 0;
      while (at(r, c + len) === '=') len++;
      if (len >= 2) rail(c, len, z0 + r + 0.5, false, x0);
      else if (at(r - 1, c) !== '=' && at(r + 1, c) !== '=') rail(c, 1, z0 + r + 0.5, false, x0);
    }
  for (let c = 0; c < width; c++)
    for (let r = 0; r < rows.length; r++) {
      if (at(r, c) !== '=' || at(r - 1, c) === '=') continue;
      let len = 0;
      while (at(r + len, c) === '=') len++;
      if (len >= 2) rail(r, len, x0 + c + 0.5, true, z0);
    }

  // What stands on the floor.
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < width; c++) {
      const ch = at(r, c);
      if (ch === 'c') out.push(`kit block_1  ${n(x0 + c + 0.5)} ${Y} ${n(z0 + r + 0.5)}`);
      if (ch === 'o') out.push(`kit pillar  ${n(x0 + c + 0.5)} ${Y} ${n(z0 + r + 0.5)}`);
    }

  return out;
}
