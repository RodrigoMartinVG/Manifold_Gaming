/**
 * A SAVED GAME AS DATA: the player's progress, with its version, never a photo of the world. Loading
 * builds the world again from what the progress says (its seed), and puts the progress into it. An
 * old progress is brought forward, one version at a time.
 */

/** Version 2, the one now: the seed, where the character is, and the cells it took a gem from. */
export interface Progress {
  seed: number;
  at: [number, number];
  taken: string[];
}
/** Version 1, the first: the seed, where, and how many gems it had (not which). */
interface ProgressV1 {
  seed: number;
  position: [number, number];
  gems: number;
}

export const VERSION = 2;

/** For each old version, how to turn it into the next. */
export const MIGRATIONS: Record<number, (old: unknown) => unknown> = {
  1: (old) => {
    const v1 = old as ProgressV1;
    // Version 1 did not say which gems: they all come back (what it could not say is lost).
    return { seed: v1.seed, at: v1.position, taken: [] } satisfies Progress;
  },
};

export interface Saved {
  version: number;
  progress: unknown;
}

/** A saved game read back: its progress brought to the version now, step by step, or why it cannot be. */
export function load(saved: Saved): Progress {
  if (saved.version > VERSION)
    throw new Error(`a save of version ${saved.version}: this game is version ${VERSION}`);
  let progress = saved.progress;
  for (let v = saved.version; v < VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`nothing brings version ${v} forward`);
    progress = step(progress);
  }
  return progress as Progress;
}
