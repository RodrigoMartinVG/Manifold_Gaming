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
 */
export function levelFromPlan(text: string, source = 'its plan'): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^plan\s/.test(l));
  if (start < 0) throw new Error('a plan has a line `plan <x> <z>`');
  const end = lines.findIndex((l, i) => i > start && l.trim() === 'end');
  if (end < 0) throw new Error('a plan ends its grid with a line `end`');
  const [, xs, zs] = lines[start]!.trim().split(/\s+/);
  const x0 = Number(xs);
  const z0 = Number(zs);
  if (!Number.isFinite(x0) || !Number.isFinite(z0)) throw new Error('`plan` takes the grid corner: `plan <x> <z>`');
  const rows = lines.slice(start + 1, end);
  const width = Math.max(0, ...rows.map((r) => r.length));
  const at = (r: number, c: number) => rows[r]?.[c] ?? ' ';
  const n = (v: number) => String(Math.round(v * 100) / 100);
  const out: string[] = [];

  // The floor: a tile wherever a 4 by 4 square has anything.
  out.push(`# Made from ${source} (levelFromPlan, @manifold/kit): the floor, the walls, crates and pillars.`);
  for (let r = 0; r < rows.length; r += 4)
    for (let c = 0; c < width; c += 4) {
      let any = false;
      for (let i = 0; i < 4 && !any; i++) for (let j = 0; j < 4 && !any; j++) any = at(r + i, c + j) !== ' ';
      if (any) out.push(`kit floor_4  ${n(x0 + c + 2)} 0 ${n(z0 + r + 2)}`);
    }

  // The walls, by their height's character.
  const lay = (char: string, layers: number) => {
    const along = (len: number, center: number, fixed: number, turned: boolean) => {
      for (let k = 0; k < layers; k++)
        out.push(
          turned
            ? `kit wall_${len}  ${n(fixed)} ${3 * k} ${n(center)}  rotate y 90`
            : `kit wall_${len}  ${n(center)} ${3 * k} ${n(fixed)}`,
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

  // What stands on the floor.
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < width; c++) {
      const ch = at(r, c);
      if (ch === 'c') out.push(`kit block_1  ${n(x0 + c + 0.5)} 0 ${n(z0 + r + 0.5)}`);
      if (ch === 'o') out.push(`kit pillar  ${n(x0 + c + 0.5)} 0 ${n(z0 + r + 0.5)}`);
    }

  return [...lines.slice(0, start), ...out, ...lines.slice(end + 1)].join('\n');
}
