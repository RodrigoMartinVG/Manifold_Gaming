import { createRandom } from './random';

/** A cell of the map: its column and its row. */
export type Cell = [number, number];
/** A room: its first cell, and how many cells across (columns) and deep (rows). */
export interface Room {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/** A room tried, and whether it fit. */
export interface Try {
  room: Room;
  fit: boolean;
}

/** One dungeon, made from a seed and a depth. */
export interface Dungeon {
  /** How many cells across and deep. */
  size: number;
  /** How many rooms it asked for, and the rooms that fit. */
  asked: number;
  rooms: Room[];
  /** Every room tried, in order (to draw them). */
  tries: Try[];
  /** The map, a string per row: # a wall, . floor, * a gem, k the key, E the exit, a space nothing. */
  rows: string[];
  /** Where the explorer starts (the first room's center), and its path along the corridors to the
   * exit: the corners and the rooms' centers. */
  start: Cell;
  route: Cell[];
  /** Version 2's floor color (a hue, 0 to 1). Version 1 has none. */
  tint: number | null;
}

// THE DUNGEON'S OWN RANDOMNESS, from the seed and the depth: nothing else asks it for numbers. Stirred
// first, as the engine does, so that nearby seeds (7 and 8) do not start with nearly the same numbers.
function randomFor(seed: number, depth: number) {
  let h = (seed ^ Math.imul(depth, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return createRandom((h ^ (h >>> 16)) >>> 0);
}

/**
 * A DUNGEON FROM A SEED: the same seed, depth and version, the same dungeon, in every browser. Only
 * whole numbers come out of the randomness, and they are asked for always in the same order.
 */
export function makeDungeon(seed: number, depth: number, version = 1): Dungeon {
  const random = randomFor(seed, depth);
  // A whole number in [min, max]. (From the high bits: the low ones of this generator repeat.)
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  // VERSION 2 asks for one number more, first: the floor's color. Every number after it moves one place.
  const tint = version === 2 ? random() : null;
  // DEEPER, BIGGER: a wider map, and more rooms.
  const size = 21 + 4 * Math.min(depth - 1, 4);
  const asked = Math.min(4 + depth, 9);

  // ROOMS WHERE THEY FIT: a random rectangle, kept only if a cell is left between it and every room
  // (for a wall); at most 400 tries.
  const rooms: Room[] = [];
  const tries: Try[] = [];
  const apart = (a: Room, b: Room) =>
    a.col > b.col + b.cols ||
    b.col > a.col + a.cols ||
    a.row > b.row + b.rows ||
    b.row > a.row + a.rows;
  while (rooms.length < asked && tries.length < 400) {
    const cols = between(3, 6);
    const rows = between(3, 6);
    const room = { cols, rows, col: between(1, size - cols - 1), row: between(1, size - rows - 1) };
    const fit = rooms.every((other) => apart(room, other));
    tries.push({ room, fit });
    if (fit) rooms.push(room);
  }
  const grid: string[][] = [];
  for (let r = 0; r < size; r++) grid.push(new Array(size).fill(' '));
  const put = (c: number, r: number, cell: string) => {
    const line = grid[r];
    if (line) line[c] = cell;
  };
  // Floor in every cell between two corners: a line when they share a row or a column, else a room.
  const dig = ([c0, r0]: Cell, [c1, r1]: Cell) => {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++)
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) put(c, r, '.');
  };
  const center = (room: Room): Cell => [room.col + (room.cols >> 1), room.row + (room.rows >> 1)];
  for (const room of rooms)
    dig([room.col, room.row], [room.col + room.cols - 1, room.row + room.rows - 1]);

  // CORRIDORS THAT TURN ONCE: each room to the one before, along its row and then a column, or the
  // other way round (which one, a number of the seed).
  // (There is always a first room: the first try fits, with nothing yet to overlap.)
  const start = center(rooms[0]!);
  const route: Cell[] = [start];
  let previous: Room | null = null;
  for (const room of rooms) {
    if (previous) {
      const [c0, r0] = center(previous);
      const [c1, r1] = center(room);
      const corner: Cell = random() < 0.5 ? [c1, r0] : [c0, r1];
      dig([c0, r0], corner);
      dig(corner, [c1, r1]);
      route.push(corner, [c1, r1]);
    }
    previous = room;
  }

  // WHAT LIES IN THE ROOMS: the exit in the last, the key in the middle one, a gem anywhere in every
  // other. The first, where the explorer starts, has nothing.
  const last = rooms.length - 1;
  const middle = Math.max(1, last >> 1);
  rooms.forEach((room, i) => {
    const [c, r] = center(room);
    if (i === last) put(c, r, 'E');
    else if (i === middle) put(c, r, 'k');
    else if (i > 0) {
      const col = room.col + between(0, room.cols - 1);
      const row = room.row + between(0, room.rows - 1);
      put(col, row, '*');
    }
  });

  // WALLS where a floor touches (along a side or at a corner); nothing farther out.
  const rows = grid.map((line, r) =>
    line
      .map((cell, c) => {
        if (cell !== ' ') return cell;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) if ((grid[r + dr]?.[c + dc] ?? ' ') !== ' ') return '#';
        return ' ';
      })
      .join('')
      .trimEnd(),
  );
  return { size, asked, rooms, tries, rows, start, route, tint };
}
