import type { Piece } from './page';

/** What a piece is asked to do at a moment of the frame, by name. */
export type PieceHook = keyof Piece;

/**
 * EVERY PIECE CALLED, WHATEVER ONE OF THEM DOES (stage 5.5a). The pieces of the view are called one after
 * another at each moment of a frame; before, one that threw stopped the rest of that frame, the drawing
 * included, and on every frame if it threw on every frame: a black page for a fault in one effect. Now each
 * call is on its own: one that throws is told once (each piece and moment once, with its error, so a
 * fault every frame is one message, not sixty a second) and the others, and the drawing, go on.
 */
export interface PieceCaller {
  /** Calls `hook` on every piece that has it, in order. */
  call<H extends PieceHook>(hook: H, ...args: Parameters<NonNullable<Piece[H]>>): void;
  /** The same, in the opposite order (`afterStep`: like nested brackets). */
  callReversed<H extends PieceHook>(hook: H, ...args: Parameters<NonNullable<Piece[H]>>): void;
}

export function pieceCaller(pieces: readonly Piece[], told: (text: string, error: unknown) => void): PieceCaller {
  const reported = new Set<string>();
  const one = (p: Piece, i: number, hook: PieceHook, args: unknown[]) => {
    const f = p[hook] as ((...a: unknown[]) => void) | undefined;
    if (!f) return;
    try {
      f.apply(p, args);
    } catch (error) {
      const key = `${i} ${hook}`;
      if (reported.has(key)) return;
      reported.add(key);
      told(`a piece of the view (number ${i}) failed in its \`${hook}\`; the rest goes on: ${String(error)}`, error);
    }
  };
  return {
    call(hook, ...args) {
      for (let i = 0; i < pieces.length; i++) one(pieces[i]!, i, hook, args);
    },
    callReversed(hook, ...args) {
      for (let i = pieces.length - 1; i >= 0; i--) one(pieces[i]!, i, hook, args);
    },
  };
}
