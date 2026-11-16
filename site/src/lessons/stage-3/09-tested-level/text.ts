/**
 * BETWEEN TEXT AND THE WORLD: a drawing made into boxes, boxes written back as the drawing, and the
 * recipe that tests it. Nothing here knows the physics or the screen.
 */

/** A rectangle of cells: its first row and column, and how many rows and columns it takes. */
export interface Rect {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

/**
 * THE MERGE: the cells `is` picks, covered with as few rectangles as a greedy pass finds (as the
 * engine's `mapParts`). From each cell not covered yet, left to right and top to bottom: along the row
 * while it can, then down while the whole width fits. With `merge` off, a rectangle per cell.
 */
export function rectangles(rows: string[], is: (c: string) => boolean, merge: boolean): Rect[] {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const taken = new Set<string>(); // the cells already covered, as "row,col"
  const free = (row: number, col: number) =>
    !taken.has(`${row},${col}`) && is(rows[row]?.[col] ?? ' ');
  const out: Rect[] = [];
  for (let row = 0; row < rows.length; row++)
    for (let col = 0; col < width; col++) {
      if (!free(row, col)) continue;
      let cols = 1;
      let tall = 1;
      if (merge) {
        while (col + cols < width && free(row, col + cols)) cols++;
        const fits = (r: number) => {
          for (let c = col; c < col + cols; c++) if (!free(r, c)) return false;
          return true;
        };
        while (row + tall < rows.length && fits(row + tall)) tall++;
      }
      for (let r = row; r < row + tall; r++)
        for (let c = col; c < col + cols; c++) taken.add(`${r},${c}`);
      out.push({ row, col, rows: tall, cols });
    }
  return out;
}

/** What a box keeps of the line that made it: its character, and its center and half size (x, z). */
export interface Source {
  char: string;
  center: [number, number];
  half: [number, number];
}

/**
 * THE WAY BACK: each box painted on a grid of characters, in order (zones last, on their floor).
 * Meters to cells with Math.round, not Math.floor: meters may come back a hair off.
 */
export function drawingOf(boxes: Source[], cell: number): string {
  const grid: string[][] = [];
  for (const { char, center, half } of boxes) {
    const col = Math.round((center[0] - half[0]) / cell);
    const row = Math.round((center[1] - half[1]) / cell);
    const cols = Math.round((2 * half[0]) / cell);
    const rows = Math.round((2 * half[1]) / cell);
    for (let r = row; r < row + rows; r++)
      for (let c = col; c < col + cols; c++) (grid[r] ??= [])[c] = char;
  }
  return Array.from(grid, (line) =>
    Array.from(line ?? [], (c) => c ?? ' ')
      .join('')
      .trimEnd(),
  ).join('\n');
}

/**
 * ONE CHECK, `<what> <op> <value>`: whether it holds, said as the engine's console says it (which
 * rounds a number to 3 decimals; here it goes whole). `=` is exact; `~` is near: within a hundredth,
 * or a percent of the bigger.
 */
export function check(
  words: string,
  read: (what: string) => number | string | { missing: string },
): { holds: boolean; said: string } {
  const [what = '', op = '', ...rest] = words.trim().split(/\s+/);
  const value = rest.join(' ');
  const got = read(what);
  if (typeof got === 'object') return { holds: false, said: `assert ${words}: ${got.missing}` };
  const b = Number(value);
  const near = Math.abs(Number(got) - b) <= 0.01 * Math.max(1, Math.abs(Number(got)), Math.abs(b));
  const holds =
    typeof got === 'string'
      ? op === '=' && got === value
      : op === '='
        ? got === b
        : op === '<'
          ? got < b
          : op === '>'
            ? got > b
            : op === '~' && near;
  return { holds, said: `assert ${words}: ${holds ? 'yes' : `no, it is ${got}`}` };
}

/** What a recipe needs from the world it runs in: how to send it a change, and how to read a value. */
export interface Host {
  /** Sends a line that changes the world (it enters at a later step); false if it is not one. */
  send: (line: string) => boolean;
  read: (what: string) => number | string | { missing: string };
}

/**
 * A RECIPE, along the steps: its lines in order, and `wait n` leaves the rest for n steps later.
 * `assert` checks; any other line is a change of the world, sent, which enters at a later step. With
 * `fromEntry`, a wait does not count while something sent before it is still on its way, as the
 * engine's: in its page, a change goes to a server and comes back steps later.
 */
export class Recipe {
  readonly lines: string[];
  readonly asserts: number;
  passed = 0;
  last = ''; // what the last assert said
  private readonly world: Host;
  private readonly fromEntry: boolean;
  private next = 0;
  private left = 0; // the steps the wait still counts
  private onTheirWay = 0; // the changes sent that have not entered the world yet

  constructor(text: string, world: Host, fromEntry: boolean) {
    this.world = world;
    this.fromEntry = fromEntry;
    this.lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));
    this.asserts = this.lines.filter((l) => l.startsWith('assert ')).length;
  }

  /** The lines, until a wait (`wait 0` waits for nothing). */
  go() {
    while (this.left === 0 && this.next < this.lines.length) {
      const line = this.lines[this.next++] ?? '';
      const wait = /^wait\s+(\d+)$/.exec(line);
      if (wait) this.left = Number(wait[1]);
      else if (line.startsWith('assert ')) {
        const { holds, said } = check(line.slice('assert '.length), this.world.read);
        if (holds) this.passed++;
        this.last = said;
        console.log(said);
      } else if (this.world.send(line)) this.onTheirWay++;
      else console.log(`"${line}" is not understood (wait, assert, or a change of this world)`);
    }
  }

  /** What was sent entered the world (whoever runs the world says so, as it applies it). */
  entered() {
    this.onTheirWay--;
  }

  /** A step went by: the wait counts it (unless it waits for something on its way), then lines run. */
  stepped() {
    if (this.left > 0 && !(this.fromEntry && this.onTheirWay > 0)) this.left--;
    this.go();
  }

  get done() {
    return this.left === 0 && this.next >= this.lines.length;
  }
}
