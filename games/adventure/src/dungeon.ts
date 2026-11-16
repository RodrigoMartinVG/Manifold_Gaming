import { Random, type Vec3 } from '@manifold/common';

/** A dungeon's cell (m), and how tall its walls are. */
export const CELL = 2;
const WALL = 3;

/** One dungeon, made from a seed and a depth: its map's rows, where the character starts, and as a level's text. */
export interface Dungeon {
  seed: number;
  depth: number;
  rows: string[];
  spawn: Vec3;
  /** The level, in its text (format 7): a `map` with its zones, and the void under it. */
  text: string;
}

/** A room: its first cell, and how many cells across (columns) and deep (rows). */
interface Room {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/** The randomness of one dungeon: its own, from the seed and the depth (not the world's). */
const randomFor = (seed: number, depth: number) => new Random((seed ^ Math.imul(depth, 0x9e3779b1)) >>> 0);

/** A whole number in [min, max]. */
const between = (r: Random, min: number, max: number) => min + (r.uint32() % (max - min + 1));

/**
 * A DUNGEON FROM A SEED (stage 3k): the same seed and depth, the same dungeon, in Node and in every
 * browser (whole numbers only, from its own seeded randomness). Rooms are placed where they fit,
 * apart from each other, each one joined to the one before by a corridor that turns once; deeper,
 * there are more. The first room is where the character starts; the last has the exit; the middle
 * one, the key the exit asks for; and every other room, a gem. What is drawn is a map (stage 3j):
 * walls only where they touch the floor, nothing beyond them.
 *
 * Its grid is `size` cells across and it tries for `count` rooms (by its depth: 21 cells and 5 rooms
 * at depth 1, up to 37 and 9). With fewer than three rooms (on a grid where no more fit), the key goes
 * in the first room, and with one, the exit too, each where nothing else is: never without a key.
 */
export function dungeon(
  seed: number,
  depth: number,
  size = 21 + 4 * Math.min(depth - 1, 4),
  count = Math.min(4 + depth, 9),
): Dungeon {
  const r = randomFor(seed, depth);
  const rooms: Room[] = [];
  const overlaps = (a: Room, b: Room) =>
    a.col - 1 < b.col + b.cols && b.col - 1 < a.col + a.cols && a.row - 1 < b.row + b.rows && b.row - 1 < a.row + a.rows;
  for (let tries = 0; rooms.length < count && tries < 400; tries++) {
    const room = { cols: between(r, 3, 6), rows: between(r, 3, 6), col: 0, row: 0 };
    room.col = between(r, 1, size - room.cols - 1);
    room.row = between(r, 1, size - room.rows - 1);
    if (!rooms.some((other) => overlaps(room, other))) rooms.push(room);
  }
  const floor = Array.from({ length: size }, () => new Array<string>(size).fill(' '));
  const carve = (col: number, row: number) => (floor[row]![col] = '.');
  for (const room of rooms)
    for (let row = room.row; row < room.row + room.rows; row++)
      for (let col = room.col; col < room.col + room.cols; col++) carve(col, row);
  const center = (room: Room) => [room.col + (room.cols >> 1), room.row + (room.rows >> 1)] as const;
  // Each room to the one before: along one axis, then the other (which first, the dungeon's choice).
  for (let i = 1; i < rooms.length; i++) {
    const [c0, r0] = center(rooms[i - 1]!);
    const [c1, r1] = center(rooms[i]!);
    const across = (row: number, from: number, to: number) => {
      for (let c = Math.min(from, to); c <= Math.max(from, to); c++) carve(c, row);
    };
    const down = (col: number, from: number, to: number) => {
      for (let w = Math.min(from, to); w <= Math.max(from, to); w++) carve(col, w);
    };
    if (r.uint32() % 2 === 0) {
      across(r0, c0, c1);
      down(c1, r0, r1);
    } else {
      down(c0, r0, r1);
      across(r1, c0, c1);
    }
  }
  // What stands in the rooms: the exit in the last, the key in the middle one, a gem in each other but the first.
  const mark = (room: Room, what: string, anywhere: boolean) => {
    const [c, w] = anywhere ? [room.col + between(r, 0, room.cols - 1), room.row + between(r, 0, room.rows - 1)] : center(room);
    floor[w]![c] = what;
  };
  /** In a room, where nothing stands yet and the character does not start (the first room's center). */
  const free = (room: Room, what: string) => {
    const [sc, sr] = center(rooms[0]!);
    for (;;) {
      const c = room.col + between(r, 0, room.cols - 1);
      const w = room.row + between(r, 0, room.rows - 1);
      if (floor[w]![c] === '.' && !(c === sc && w === sr)) return void (floor[w]![c] = what);
    }
  };
  const last = rooms.length - 1;
  if (rooms.length >= 3) {
    const middle = last >> 1;
    rooms.forEach((room, i) => {
      if (i === last) mark(room, 'E', false);
      else if (i === middle) mark(room, 'k', false);
      else if (i > 0) mark(room, '*', true);
    });
  } else {
    // Two rooms (the exit in the second, the key in the first), or one (both in it): no gems.
    if (last === 1) mark(rooms[1]!, 'E', false);
    else free(rooms[0]!, 'E');
    free(rooms[0]!, 'k');
  }
  // Walls where a floor touches them (along a side or a corner); nothing farther out.
  const rows = floor.map((line, row) =>
    line
      .map((cell, col) => {
        if (cell !== ' ') return cell;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const near = floor[row + dr]?.[col + dc];
            if (near !== undefined && near !== ' ') return '#';
          }
        return ' ';
      })
      .join('')
      .replace(/\s+$/, ''),
  );
  // Rows with nothing at the end or the start are kept (the map's place is its first row's): only
  // trailing spaces go.
  const [sc, sr] = center(rooms[0]!);
  const spawn: Vec3 = [(sc + 0.5) * CELL, 1, (sr + 0.5) * CELL];
  const half = (size * CELL) / 2;
  const text = [
    '# Manifold level 7',
    `title Depth ${depth}`,
    `spawn ${spawn.join(' ')}`,
    'facing 0 0 1',
    `map 0 0 0  ${CELL} ${WALL}  * gem  k key  E exit`,
    ...rows,
    'end',
    `sensor fall  ${half} -6 ${half}  ${half + 20} 3 ${half + 20}`,
    '',
  ].join('\n');
  return { seed, depth, rows, spawn, text };
}

/** A text's hash (FNV-1a over its characters), as eight hexadecimal digits: to compare a dungeon made here with one made elsewhere. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** The dungeons the site's check makes in the reader's browser (and the test in Node): these seeds, at these depths. */
export const CHECKED_DUNGEONS: readonly (readonly [seed: number, depth: number])[] = [
  [1, 1],
  [1, 3],
  [7, 1],
  [7, 2],
  [42, 1],
  [42, 5],
];
