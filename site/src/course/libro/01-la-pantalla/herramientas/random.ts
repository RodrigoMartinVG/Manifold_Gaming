/**
 * A TOOL OF THE BOOK, until chapter 25 (_Lo mismo, otra vez_) explains it and the reader writes it. It is read-only
 * in the editor.
 *
 * NUMBERS THAT LOOK RANDOM, and are the same ones for the same seed: so the sky has the same stars on every
 * visit, and ours and the canvas's draw the very same ones. Each call gives a number from 0 up to (not
 * including) 1. (Mulberry32, a small and well-known generator.)
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
