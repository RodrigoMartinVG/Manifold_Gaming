import type { Vec } from './vec';

/**
 * WHAT IS DRAWN TO SEE WHAT THE CODE DECIDED (chapter 2): arrows, lines, points, a frame of three axes,
 * text, each one asked for by name from anywhere in the code, even from rules that know nothing of the
 * drawing. A request is plain data, put in a queue; at the end of the frame the view takes the queue
 * (`flush`) and draws it. Each one lasts `life` seconds of the clock (by default, one frame), and may be
 * drawn over everything (`depth: false`, for what is inside a solid). It is never part of the world:
 * nothing in the game reads it.
 */
export type Primitive =
  | { kind: 'arrow'; from: Vec; vector: Vec; color: number; depth: boolean }
  | { kind: 'line'; from: Vec; to: Vec; color: number; depth: boolean }
  | { kind: 'point'; at: Vec; color: number; depth: boolean }
  | { kind: 'text'; at: Vec; text: string; color: number; depth: boolean };

/** How a request is drawn: its color, how long it lasts (s; 0, one frame), and whether solids hide it. */
export interface Style {
  color?: number;
  life?: number;
  depth?: boolean;
}

const queue: { primitive: Primitive; left: number }[] = [];
const put = (primitive: Primitive, life = 0) => queue.push({ primitive, left: life });

export const debug = {
  /** The vector `vector` drawn at the point `from`. */
  arrow(from: Vec, vector: Vec, s: Style = {}) {
    put({ kind: 'arrow', from, vector, color: s.color ?? 0xffffff, depth: s.depth ?? true }, s.life);
  },
  line(from: Vec, to: Vec, s: Style = {}) {
    put({ kind: 'line', from, to, color: s.color ?? 0xffffff, depth: s.depth ?? true }, s.life);
  },
  point(at: Vec, s: Style = {}) {
    put({ kind: 'point', at, color: s.color ?? 0xffffff, depth: s.depth ?? true }, s.life);
  },
  /** A frame at `origin`: three directions in red, green and blue (forward, right, up, or the world's x, y, z). */
  axes(origin: Vec, x: Vec, y: Vec, z: Vec, s: Omit<Style, 'color'> = {}) {
    for (const [d, color] of [
      [x, 0xe0605a],
      [y, 0x6cc070],
      [z, 0x5a9ae6],
    ] as const)
      put({ kind: 'arrow', from: origin, vector: d, color, depth: s.depth ?? true }, s.life);
  },
  text(at: Vec, text: string, s: Style = {}) {
    put({ kind: 'text', at, text, color: s.color ?? 0xf2efe9, depth: s.depth ?? true }, s.life);
  },
  /**
   * What is to be drawn this frame, `dt` seconds after the last one: every request still alive. What was
   * asked for one frame goes after this one; the rest are `dt` older.
   */
  flush(dt: number): Primitive[] {
    const now = queue.map((q) => q.primitive);
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i]!;
      q.left -= dt;
      if (q.left <= 0) queue.splice(i, 1);
    }
    return now;
  },
};
